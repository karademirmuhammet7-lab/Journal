// Texte complet des articles, pour une lecture personnelle dans l'application.
// Les textes sont chiffrés (AES-GCM, clé dérivée du mot de passe JOURNAL_KEY) :
// le site reste public, mais seul celui qui connaît le mot de passe peut les lire.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { webcrypto as crypto } from 'node:crypto';

const CACHE_DIR = process.env.JOURNAL_CACHE_DIR ? new URL(`file://${process.env.JOURNAL_CACHE_DIR}/`) : new URL('../.cache/', import.meta.url);
const CACHE = new URL('texts.json', CACHE_DIR);
export const FULL_LIMIT = +(process.env.JOURNAL_FULL_LIMIT || 80); // nombre de sujets avec texte complet
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

let cache = {};
async function loadCache() {
  try { cache = JSON.parse(await readFile(CACHE, 'utf8')); } catch { cache = {}; }
}
async function saveCache(keep) {
  await mkdir(CACHE_DIR, { recursive: true });
  const entries = Object.entries(cache).sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
  await writeFile(CACHE, JSON.stringify(Object.fromEntries(entries.filter(([url], i) => keep.has(url) || i < 300))));
}

/**
 * Ajoute `full = { source, url, lang, blocks }` aux articles les plus importants,
 * en choisissant parmi leurs sources celle dont le texte est lisible en entier.
 */
export async function fetchFullTexts(articles, { fetchText, pool, translateBlocks }) {
  await loadCache();
  const top = articles.slice(0, FULL_LIMIT);
  let fetched = 0;
  await pool(top, 6, async (a) => {
    const candidates = [...(a.sources || [])]
      .filter((s) => /^https?:/.test(s.url) && !/news\.google\./.test(s.url))
      .sort((x, y) => (y.lang === 'fr') - (x.lang === 'fr'));
    for (const s of candidates.slice(0, 4)) {
      let entry = cache[s.url];
      if (!entry) {
        try {
          const html = await fetchText(s.url, { timeout: 9000, headers: { accept: 'text/html' } });
          entry = { blocks: extractBlocks(html), image: ogImage(html), at: Date.now() };
        } catch {
          entry = { blocks: null, at: Date.now() };
        }
        cache[s.url] = entry;
        fetched++;
      }
      if (!a.image && entry.image) a.image = entry.image;
      if (entry.blocks) {
        a.full = { source: s.source, url: s.url, lang: s.lang, blocks: entry.blocks };
        break;
      }
    }
  });
  // texte étranger → français
  const foreign = top.filter((a) => a.full && a.full.lang !== 'fr');
  for (const a of foreign) {
    const fr = await translateBlocks(a.full.blocks, a.full.lang, 'fr');
    if (fr) { a.full.blocks = fr; a.full.translatedFrom = a.full.lang; a.full.lang = 'fr'; }
  }
  await saveCache(new Set(articles.flatMap((a) => (a.sources || []).map((s) => s.url))));
  log(`${top.filter((a) => a.full).length}/${top.length} articles complets (${fetched} pages lues)`);
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
    await writeFile(new URL(`${a.id}.json`, outDir), JSON.stringify(await encrypt(key, { source, url, blocks, translatedFrom })));
    const words = blocks.reduce((n, b) => n + (b.p || b.h).split(/\s+/).length, 0);
    a.full = { source, minutes: Math.max(1, Math.round(words / 220)) };
  }
  return { salt: SALT, iterations: ITERATIONS, check: await encrypt(key, 'ok') };
}
