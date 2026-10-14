// Texte complet des articles, pour une lecture personnelle dans l'application.
// Les textes sont chiffrés (AES-GCM, clé dérivée du mot de passe JOURNAL_KEY) :
// le site reste public, mais seul celui qui connaît le mot de passe peut les lire.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { webcrypto as crypto } from 'node:crypto';
import { summarize } from './summarize.mjs';

const CACHE_DIR = process.env.JOURNAL_CACHE_DIR ? new URL(`file://${process.env.JOURNAL_CACHE_DIR}/`) : new URL('../.cache/', import.meta.url);
const CACHE = new URL('texts.json', CACHE_DIR);
export const FULL_LIMIT = +(process.env.JOURNAL_FULL_LIMIT || 1000); // nombre de sujets avec texte complet
const MIN_CHARS = 700; // en dessous : article réservé aux abonnés ou extraction ratée
const ITERATIONS = 210000;
const SALT = 'le-journal/articles/v1';

const log = (...a) => console.log('[articles]', ...a);

// ———————————————————————————————————————— extraction

const decode = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&rsquo;/g, '’')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&hellip;/g, '…')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

const clean = (html) => decode(html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

const BOILERPLATE = [
  /cookie/i, /abonnez-vous|abonnement|s'abonner|réservé aux abonnés|article réservé|déjà abonné/i, /newsletter/i,
  /inscrivez-vous|connectez-vous|se connecter|créer un compte/i, /publicité/i, /tous droits réservés|©/i,
  /^(lire|à lire|voir) (aussi|également|plus)/i, /^(sur le même sujet|à découvrir|recommandé)/i,
  /javascript/i, /partager (sur|cet article)/i, /suivez-nous/i, /^photo\s*:/i, /^(©|crédit)/i,
  /sign up|subscribe|newsletter|cookies|all rights reserved|read more/i,
];
const PAYWALL = /(réservé aux abonnés|article réservé|pour lire la suite|il vous reste \d+ ?% de cet article|abonnez-vous pour lire|subscribe to continue)/i;

const isJunk = (t) => BOILERPLATE.some((re) => re.test(t));

function fromJsonLd(html) {
  let best = '';
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = (o) => {
        if (!o || typeof o !== 'object') return;
        if (typeof o.articleBody === 'string' && o.articleBody.length > best.length) best = o.articleBody;
        Object.values(o).forEach(walk);
      };
      walk(JSON.parse(m[1]));
    } catch { /* JSON-LD invalide */ }
  }
  if (best.length < MIN_CHARS) return null;
  const text = decode(best.replace(/<[^>]+>/g, '\n'));
  let paras = text.split(/\n\s*\n|\r?\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter((p) => p.length > 30 && !isJunk(p));
  // un seul bloc : on le découpe en paragraphes de quelques phrases
  if (paras.length === 1 && paras[0].length > 900) {
    const sentences = paras[0].match(/[^.!?]+[.!?»"]+(\s|$)/g) || [paras[0]];
    paras = [];
    for (let i = 0; i < sentences.length; i += 3) paras.push(sentences.slice(i, i + 3).join('').trim());
  }
  return paras.map((p) => ({ p }));
}

function fromHtml(html) {
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript|svg|form|nav|aside|footer|figure|figcaption|button|iframe)\b[\s\S]*?<\/\1>/gi, '');
  const regions = [...stripped.matchAll(/<article\b[\s\S]*?<\/article>/gi)].map((m) => m[0]);
  const region = regions.sort((a, b) => b.length - a.length)[0] || stripped.match(/<main\b[\s\S]*?<\/main>/i)?.[0] || stripped;
  const blocks = [];
  for (const m of region.matchAll(/<(h2|h3|p)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const text = clean(m[2]);
    if (!text || isJunk(text)) continue;
    if (m[1].toLowerCase() === 'p') {
      if (text.length < 40) continue;
      blocks.push({ p: text });
    } else if (text.length >= 3 && text.length <= 140) {
      blocks.push({ h: text });
    }
  }
  // pas d'intertitre en fin de texte ni deux de suite, pas de doublons
  const out = [];
  for (const b of blocks) {
    const prev = out.at(-1);
    if (prev && ((b.p && prev.p === b.p) || (b.h && prev.h))) { if (b.h) out[out.length - 1] = b; continue; }
    out.push(b);
  }
  while (out.length && out.at(-1).h) out.pop();
  return out;
}

export function ogImage(html) {
  const tag = html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)(?::src)?["'][^>]*>/i)?.[0];
  let url = tag?.match(/content=["']([^"']+)["']/i)?.[1];
  if (!url) return null;
  url = decode(url).trim();
  if (url.startsWith('//')) url = 'https:' + url;
  return /^https?:\/\//.test(url) && !/logo|placeholder|default[-_]?(image|og)/i.test(url) ? url.replace(/^http:/, 'https:') : null;
}

/** Corps d'un article sous forme de blocs { h } (intertitre) et { p } (paragraphe). */
export function extractBlocks(html) {
  const jsonLd = fromJsonLd(html);
  const dom = fromHtml(html);
  const len = (bs) => (bs || []).reduce((n, b) => n + (b.p || '').length, 0);
  // le HTML garde les intertitres ; on le préfère s'il est aussi complet
  const blocks = len(dom) >= len(jsonLd) * 0.8 ? dom : jsonLd;
  const total = len(blocks);
  if (total < MIN_CHARS) return null;
  if (PAYWALL.test(blocks.map((b) => b.p || '').join(' ')) && total < 2500) return null;
  return blocks;
}

// ———————————————————————————————————————— récupération (avec cache)

const RETRY_MS = 2 * 3.6e6; // une page illisible est retentée deux heures plus tard
const SEARCH_MS = 3 * 3.6e6;

let cache = {};
async function loadCache() {
  try { cache = JSON.parse(await readFile(CACHE, 'utf8')); } catch { cache = {}; }
}
async function saveCache(keep) {
  await mkdir(CACHE_DIR, { recursive: true });
  const entries = Object.entries(cache).sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
  await writeFile(CACHE, JSON.stringify(Object.fromEntries(entries.filter(([url], i) => keep.has(url) || i < 600))));
}

const isGoogle = (url) => /^https?:\/\/news\.google\./.test(url);

/**
 * Lien Google Actualités → adresse de l'article chez le média.
 * Les anciens identifiants contiennent l'adresse en base64 ; les récents
 * se résolvent par l'appel que fait la page Google Actualités elle-même.
 */
export async function resolveGoogleNews(url, fetchText) {
  const id = new URL(url).pathname.split('/').pop();
  try {
    const raw = Buffer.from(id.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('latin1');
    const direct = raw.match(/https?:\/\/[\x21-\x7e]+/)?.[0];
    if (direct && !raw.includes('AU_yq')) return direct;
  } catch { /* identifiant récent */ }
  const page = await fetchText(`https://news.google.com/rss/articles/${id}`, { timeout: 8000 });
  const sig = page.match(/data-n-a-sg="([^"]+)"/)?.[1];
  const ts = page.match(/data-n-a-ts="([^"]+)"/)?.[1];
  if (!sig || !ts) return null;
  const req = [[['Fbv4je', JSON.stringify(['garturlreq', [['X', 'X', ['X', 'X'], null, null, 1, 1, 'US:en', null, 1, null, null, null, null, null, 0, 1], 'X', 'X', 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0], id, +ts, sig]), null, 'generic']]];
  const res = await fetchText('https://news.google.com/_/DotsSplashUi/data/batchexecute', {
    timeout: 8000,
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: 'f.req=' + encodeURIComponent(JSON.stringify(req)),
  });
  const m = res.match(/\["garturlres\\",\\"(https?:[^\\"]+)/);
  if (m) return m[1];
  try {
    const json = JSON.parse(res.split('\n\n')[1]);
    return JSON.parse(json[0][2])[1] || null;
  } catch { return null; }
}

/**
 * Ajoute `full = { source, url, lang, blocks }` aux articles, en choisissant
 * parmi leurs sources celle dont le texte est lisible en entier. Si aucune ne
 * l'est (article réservé aux abonnés, page illisible), on cherche le même sujet
 * chez d'autres médias avec `findMore(article)`.
 */
export async function fetchFullTexts(articles, { fetchText, pool, translateBlocks, findMore, budgetMs = 180000 }) {
  await loadCache();
  const deadline = Date.now() + budgetMs;
  const top = articles.slice(0, FULL_LIMIT);
  let fetched = 0;
  let resolved = 0;
  let found = 0;

  const resolve = async (url) => {
    if (!isGoogle(url)) return url;
    const key = 'gn:' + url;
    if (cache[key] && (cache[key].to || Date.now() - cache[key].at < RETRY_MS)) return cache[key].to;
    let to = null;
    try { to = await resolveGoogleNews(url, fetchText); } catch { /* réessayé plus tard */ }
    cache[key] = { to, at: Date.now() };
    if (to) resolved++;
    return to;
  };

  const read = async (url) => {
    let entry = cache[url];
    if (!entry || (!entry.blocks && Date.now() - entry.at > RETRY_MS)) {
      if (Date.now() > deadline) return entry || null;
      try {
        const html = await fetchText(url, { timeout: 8000, headers: { accept: 'text/html' } });
        entry = { blocks: extractBlocks(html), image: ogImage(html), at: Date.now() };
      } catch {
        entry = { blocks: null, at: Date.now() };
      }
      cache[url] = entry;
      fetched++;
    }
    return entry;
  };

  const tryCandidates = async (a, candidates) => {
    const tried = new Set();
    for (const s of candidates) {
      if (a.full || Date.now() > deadline) return;
      const url = await resolve(s.url);
      if (!url || tried.has(url)) continue;
      tried.add(url);
      const entry = await read(url);
      if (!entry) continue;
      if (!a.image && entry.image) a.image = entry.image;
      if (entry.blocks) a.full = { source: s.source, url, lang: s.lang, blocks: entry.blocks };
    }
  };

  // 1. les sources de l'article (les médias francophones d'abord)
  await pool(top, 8, async (a) => {
    const candidates = [...(a.sources || [])]
      .filter((s) => /^https?:/.test(s.url))
      .sort((x, y) => (y.lang === 'fr') - (x.lang === 'fr') || isGoogle(x.url) - isGoogle(y.url));
    await tryCandidates(a, candidates.slice(0, 5));
  });

  // 2. le même sujet chez d'autres médias
  if (findMore) {
    await pool(top.filter((a) => !a.full), 6, async (a) => {
      if (Date.now() > deadline) return;
      const key = 'alt:' + a.id;
      let alt = cache[key];
      if (!alt || Date.now() - alt.at > SEARCH_MS) {
        let list = [];
        try { list = await findMore(a); } catch { /* recherche indisponible */ }
        alt = cache[key] = { list, at: Date.now() };
      }
      const known = new Set((a.sources || []).map((s) => s.url));
      await tryCandidates(a, alt.list.filter((s) => !known.has(s.url)).slice(0, 4));
      if (a.full) found++;
    });
  }

  // texte étranger → français
  const foreign = top.filter((a) => a.full && a.full.lang !== 'fr');
  for (const a of foreign) {
    const fr = await translateBlocks(a.full.blocks, a.full.lang, 'fr');
    if (fr) { a.full.blocks = fr; a.full.translatedFrom = a.full.lang; a.full.lang = 'fr'; }
  }
  const keep = new Set(articles.flatMap((a) => (a.sources || []).flatMap((s) => [s.url, 'gn:' + s.url, cache['gn:' + s.url]?.to])));
  for (const a of articles) {
    keep.add('alt:' + a.id);
    for (const s of cache['alt:' + a.id]?.list || []) keep.add(s.url);
  }
  await saveCache(keep);
  log(`${top.filter((a) => a.full).length}/${top.length} articles complets (${fetched} pages lues, ${resolved} liens Google résolus, ${found} trouvés chez un autre média${Date.now() > deadline ? ', temps écoulé' : ''})`);
}

// ———————————————————————————————————————— chiffrement

const b64 = (buf) => Buffer.from(buf).toString('base64');

export async function deriveKey(passphrase) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: new TextEncoder().encode(SALT), iterations: ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encrypt(key, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(value)));
  return { iv: b64(iv), data: b64(data) };
}

export async function decrypt(key, { iv, data }) {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: Buffer.from(iv, 'base64') }, key, Buffer.from(data, 'base64'));
  return JSON.parse(new TextDecoder().decode(plain));
}

/** Écrit data/articles/<id>.json (chiffré) et ne laisse dans l'édition qu'un indicateur. */
export async function publishFullTexts(articles, outDir, passphrase) {
  const key = await deriveKey(passphrase);
  await mkdir(outDir, { recursive: true });
  for (const a of articles) {
    if (!a.full) continue;
    const { source, url, blocks, translatedFrom } = a.full;
    const summary = summarize(blocks.filter((b) => b.p).map((b) => b.p));
    await writeFile(new URL(`${a.id}.json`, outDir), JSON.stringify(await encrypt(key, { source, url, blocks, summary, translatedFrom })));
    const words = blocks.reduce((n, b) => n + (b.p || b.h).split(/\s+/).length, 0);
    a.full = { source, minutes: Math.max(1, Math.round(words / 220)) };
  }
  return { salt: SALT, iterations: ITERATIONS, check: await encrypt(key, 'ok') };
}
