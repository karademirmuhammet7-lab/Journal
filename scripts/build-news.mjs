#!/usr/bin/env node
// Génère data/news.json : récupère les flux RSS des journaux, regroupe les
// articles qui traitent du même sujet, classe les infos par importance,
// complète les images manquantes, traduit (fr, en, nl, tr, ar) et ajoute les marchés.
//
//   node scripts/build-news.mjs              → génération complète
//   node scripts/build-news.mjs --translate  → traduit seulement le fichier existant
//                                               (utile pour une édition rédigée à la main)

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { FEEDS, MARKETS, CATEGORY_HINTS, STRONG_HINTS, PRIORITY, LOCAL } from './feeds.mjs';
import { planWriting, writeArticles, writingEnabled } from './writer.mjs';
import { fetchFullTexts, publishFullTexts, ogImage } from './fulltext.mjs';
import { summarize } from './summarize.mjs';

const OUT = new URL('../data/news.json', import.meta.url);
const CACHE_DIR = process.env.JOURNAL_CACHE_DIR ? new URL(`file://${process.env.JOURNAL_CACHE_DIR}/`) : new URL('../.cache/', import.meta.url);
const CACHE = new URL('translations.json', CACHE_DIR);
const LANGS = ['fr', 'en', 'nl', 'tr', 'ar'];
const MAX_AGE_H = 36;
const MAX_ARTICLES = 140;
const MIN_ARTICLES = 12; // en dessous, on garde l'édition précédente
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';

const log = (...a) => console.log('[news]', ...a);
const FULL_KEY = process.env.JOURNAL_KEY || '';
const ARTICLES_DIR = new URL('../data/articles/', import.meta.url);

// ———————————————————————————————————————— utilitaires

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', laquo: '«', raquo: '»', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç', ecirc: 'ê', ocirc: 'ô', icirc: 'î', ucirc: 'û', euro: '€' };

export function decode(s = '') {
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

export function stripHtml(s = '') {
  return decode(decode(String(s)).replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function clip(text, max = 300) {
  if (!text || text.length <= max) return text || '';
  const cut = text.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (end > max * 0.55) return cut.slice(0, end + 1);
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:\-–]$/, '') + '…';
}

const hash = (s) => createHash('sha1').update(s).digest('hex').slice(0, 12);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url, { timeout = 15000, headers = {} } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: '*/*', 'accept-language': 'fr-BE,fr;q=0.9,en;q=0.7', ...headers }, signal: ctrl.signal, redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

async function pool(items, size, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        try { out[k] = await fn(items[k], k); } catch (e) { out[k] = undefined; }
      }
    }),
  );
  return out;
}

// ———————————————————————————————————————— parsing RSS / Atom

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', textNodeName: '#text', cdataPropName: false, processEntities: false });

const arr = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);
const txt = (x) => (x == null ? '' : typeof x === 'object' ? (x['#text'] ?? '') : String(x));

function pickImage(item) {
  const candidates = [];
  for (const m of [...arr(item['media:content']), ...arr(item['media:group']?.['media:content'])]) {
    if (m?.['@url'] && (!m['@medium'] || m['@medium'] === 'image') && !/\.(mp4|mp3|m3u8)/i.test(m['@url'])) candidates.push({ url: m['@url'], w: +m['@width'] || 0 });
  }
  for (const m of arr(item['media:thumbnail'])) if (m?.['@url']) candidates.push({ url: m['@url'], w: +m['@width'] || 0 });
  for (const e of arr(item.enclosure)) if (e?.['@url'] && (/image/.test(e['@type'] || '') || /\.(jpe?g|png|webp)/i.test(e['@url']))) candidates.push({ url: e['@url'], w: 0 });
  if (!candidates.length) {
    const html = decode(txt(item['content:encoded']) + ' ' + txt(item.description) + ' ' + txt(item.content));
    const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (m) candidates.push({ url: m[1], w: 0 });
  }
  candidates.sort((a, b) => b.w - a.w);
  return upgradeImage(candidates[0]?.url) || null;
}

// Certaines sources envoient des vignettes minuscules : on demande une version plus grande.
function upgradeImage(url) {
  if (!url) return url;
  let u = decode(url).trim();
  if (u.startsWith('//')) u = 'https:' + u;
  u = u.replace(/^http:/, 'https:');
  u = u.replace(/ichef\.bbci\.co\.uk\/(ace\/standard|news)\/\d+\//, 'ichef.bbci.co.uk/$1/976/');
  return u;
}

export function parseFeed(xml, feed) {
  const doc = parser.parse(xml);
  const channel = doc?.rss?.channel || doc?.['rdf:RDF'] || null;
  const items = channel ? arr(channel.item || doc['rdf:RDF']?.item) : arr(doc?.feed?.entry);
  return items.map((it) => {
    let link = it.link;
    if (Array.isArray(link)) link = link.find((l) => l?.['@rel'] !== 'self' && (l?.['@href'] || typeof l === 'string')) ?? link[0];
    link = typeof link === 'object' ? link?.['@href'] || txt(link) : link;
    if (!link && it.guid) link = txt(it.guid);
    let title = stripHtml(txt(it.title));
    let source = feed.source;
    if (feed.aggregator) {
      const src = txt(it.source) || '';
      const idx = title.lastIndexOf(' - ');
      if (idx > 20) { source = title.slice(idx + 3).trim(); title = title.slice(0, idx).trim(); }
      if (src) source = stripHtml(src);
    }
    const rawSummary = feed.aggregator ? '' : txt(it.description) || txt(it.summary) || txt(it['content:encoded']) || txt(it.content);
    const date = new Date(txt(it.pubDate) || txt(it['dc:date']) || txt(it.published) || txt(it.updated) || NaN);
    return {
      title,
      url: String(link || '').trim(),
      summary: clip(stripHtml(rawSummary), 320),
      image: pickImage(it),
      publishedAt: isNaN(date) ? null : date.toISOString(),
      source,
      cat: feed.cat,
      region: feed.region || null,
      maxAgeH: feed.maxAgeH || MAX_AGE_H,
      lang: feed.lang,
      weight: feed.weight,
      top: !!feed.top,
      aggregator: !!feed.aggregator,
    };
  });
}

// ———————————————————————————————————————— regroupement & classement

const STOP = new Set(('le la les un une des du de d l et en à au aux pour par sur dans avec sans ce cette ces qui que quoi dont où est sont a ont été être plus moins pas ne se sa son ses leur leurs il elle ils elles on nous vous je tu y après avant contre entre sous vers chez comme mais ou donc car si tout tous toute toutes fait faire dit selon déjà encore aussi très bien the a an of to in on for and or is are was were with by at from as its it this that be has have after over new says de het een van en in op voor met is zijn niet dat die er ook naar bij om aan nog').split(' '));

function tokens(title) {
  return new Set(
    title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9 ]+/g, ' ')
      .split(' ')
      .filter((w) => w.length > 2 && !STOP.has(w))
      // racine grossière : « budgétaire » et « budget », « milliards » et « milliard » se rejoignent
      .map((w) => w.replace(/s$/, '').slice(0, 6)),
  );
}

function similarity(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / Math.min(a.size, b.size) * (inter >= 3 ? 1 : inter >= 2 ? 0.8 : 0.4);
}

// ———————————————————————————————————————— rubriques locales (Châtelet, Charleroi)

const placeRe = (name) => new RegExp(`(^|[^\\p{L}\\-])${name.replace(/[-]/g, '[- ]')}(?![\\p{L}])`, 'u');
const LOCAL_RE = Object.fromEntries(
  Object.entries(LOCAL).map(([cat, { places, exclude }]) => [cat, { places: places.map((p) => [p, placeRe(p)]), exclude }]),
);
const BELGIAN = /Belgique|belge|Wallonie|wallon|Hainaut|Charleroi|Bruxelles|TEC|SNCB/;

/** 'chatelet', 'charleroi' ou null, d'après les communes citées dans le texte. */
export function localCategory(text, belgian = false) {
  if (!text) return null;
  if (!belgian && !BELGIAN.test(text)) return null;
  for (const cat of ['chatelet', 'charleroi']) {
    const { places, exclude } = LOCAL_RE[cat];
    let cleaned = text;
    for (const re of exclude) cleaned = cleaned.replace(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'), ' ');
    const hits = places.filter(([name, re]) => re.test(cleaned)).map(([name]) => name);
    // « Roux » est aussi un nom de famille ou une couleur : il faut une autre commune, ou « à Roux »
    const strong = hits.filter((h) => h !== 'Roux');
    if (strong.length || (hits.includes('Roux') && /(^|\s)(à|de|d'|sur) Roux(?![\p{L}])/u.test(cleaned))) return cat;
  }
  return null;
}

export function guessCategory(a, min = 2) {
  const hay = ` ${a.titleFr || a.title} ${a.summary} `.toLowerCase().replace(/[’`]/g, "'");
  const title = ` ${a.titleFr || a.title} `.toLowerCase().replace(/[’`]/g, "'");
  let best = null, bestScore = 0;
  for (const cat of new Set([...Object.keys(CATEGORY_HINTS), ...Object.keys(STRONG_HINTS)])) {
    let score = 0;
    for (const w of STRONG_HINTS[cat] || []) if (hay.includes(w)) score += title.includes(w) ? 3 : 2;
    for (const w of CATEGORY_HINTS[cat] || []) if (hay.includes(w)) score += 1;
    if (score > bestScore) { best = cat; bestScore = score; }
  }
  return bestScore >= min ? best : null;
}

export function cluster(articles) {
  const clusters = [];
  for (const a of articles) {
    a._tok = tokens(a.titleFr || a.title);
    let home = null, best = 0;
    for (const c of clusters) {
      for (const other of c.items) {
        const s = similarity(a._tok, other._tok);
        if (s > best) { best = s; home = c; }
      }
    }
    if (home && best >= 0.6) home.items.push(a);
    else clusters.push({ lead: a, items: [a] });
  }
  return clusters;
}

function scoreCluster(c, now, cat) {
  const sources = new Set(c.items.map((a) => a.source));
  const newest = Math.max(...c.items.map((a) => +new Date(a.publishedAt)));
  const ageH = Math.max(0, (now - newest) / 3.6e6);
  const weight = Math.max(...c.items.map((a) => a.weight));
  const onFront = c.items.some((a) => a.top);
  const coverage = 1 + 0.55 * Math.log2(sources.size);
  const fresh = Math.exp(-ageH / 14);
  return weight * coverage * (0.35 + fresh) * (onFront ? 1.25 : 1) * (PRIORITY[cat] ?? 1);
}

// Importance de 1 à 5 : rang dans l'édition, relevé si le sujet est très repris.
function importance(rank, c) {
  const sources = new Set(c.items.map((a) => a.source)).size;
  let level = rank < 5 ? 5 : rank < 15 ? 4 : rank < 40 ? 3 : rank < 80 ? 2 : 1;
  if (sources >= 5) level = Math.max(level, 4);
  else if (sources >= 3) level = Math.max(level, 3);
  return level;
}

// Choisit l'article "vitrine" d'un sujet : un vrai journal, en français, avec image si possible.
function pickLead(c) {
  const rank = (a) => (a.aggregator ? 0 : 4) + (a.image ? 2 : 0) + (a.lang === 'fr' ? 1.5 : 0) + (a.summary ? 1 : 0) + a.weight;
  return [...c.items].sort((x, y) => rank(y) - rank(x))[0];
}

// ———————————————————————————————————————— enrichissement (og:image / og:description)

async function enrich(article, { withText = false } = {}) {
  const html = await fetchText(article.url, { timeout: 9000, headers: { accept: 'text/html' } });
  if (withText) article.text = (await import('./writer.mjs')).extractText(html);
  const meta = (prop) => {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, 'i');
    const tag = html.match(re)?.[0];
    return tag?.match(/content=["']([^"']+)["']/i)?.[1];
  };
  if (!article.image) article.image = upgradeImage(ogImage(html)) || null;
  if (!article.summary || article.summary.length < 60) {
    const d = meta('og:description') || meta('description');
    if (d) article.summary = clip(stripHtml(d), 320);
  }
}

// ———————————————————————————————————————— traduction

let cache = null;
async function loadCache() {
  if (cache) return; // déjà chargé : on garde les traductions faites pendant ce passage
  try { cache = JSON.parse(await readFile(CACHE, 'utf8')); } catch { cache = {}; }
}
async function saveCache() {
  await mkdir(CACHE_DIR, { recursive: true });
  // on ne garde que les entrées récentes pour éviter que le cache grossisse sans fin
  const entries = Object.entries(cache).slice(-40000);
  await writeFile(CACHE, JSON.stringify(Object.fromEntries(entries)));
}

async function gtx(text, sl, tl) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=${sl}&tl=${tl}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8', 'user-agent': UA },
    body: 'q=' + encodeURIComponent(text),
  });
  if (!res.ok) throw new Error(`translate HTTP ${res.status}`);
  const data = await res.json();
  return data[0].map((seg) => seg[0]).join('');
}

/** Traduit une liste de textes en regroupant les requêtes. */
export async function translateAll(texts, sl, tl) {
  const out = new Array(texts.length);
  const todo = [];
  texts.forEach((t, i) => {
    const clean = (t || '').replace(/\s*\n\s*/g, ' ').trim();
    if (!clean) { out[i] = ''; return; }
    const key = `${sl}>${tl}:${hash(clean)}`;
    cache ||= {};
    if (cache[key]) out[i] = cache[key];
    else todo.push({ i, clean, key });
  });
  let batch = [];
  let size = 0;
  const flush = async () => {
    if (!batch.length) return;
    const joined = batch.map((b) => b.clean).join('\n');
    let parts = null;
    for (let attempt = 0; attempt < 3 && !parts; attempt++) {
      try {
        const res = await gtx(joined, sl, tl);
        const split = res.split('\n').map((s) => s.trim());
        if (split.length === batch.length) parts = split;
        else break;
      } catch (e) {
        await sleep(1500 * (attempt + 1));
      }
    }
    if (!parts) {
      // repli : un texte à la fois
      parts = [];
      for (const b of batch) {
        try { parts.push((await gtx(b.clean, sl, tl)).trim()); } catch { parts.push(null); }
        await sleep(120);
      }
    }
    batch.forEach((b, k) => {
      if (parts[k]) { out[b.i] = parts[k]; cache[b.key] = parts[k]; }
      else out[b.i] = null;
    });
    batch = [];
    size = 0;
    await sleep(250);
  };
  for (const item of todo) {
    if (size + item.clean.length > 3800) await flush();
    batch.push(item);
    size += item.clean.length + 1;
  }
  await flush();
  return out;
}

async function translateArticles(articles) {
  await loadCache();
  // 1. tout ramener en français (langue de base du journal)
  for (const lang of ['en', 'nl']) {
    const subset = articles.filter((a) => a.lang === lang && !a.summary.fr);
    if (!subset.length) continue;
    const res = await translateAll(subset.flatMap((a) => [a.title[lang], a.summary[lang]]), lang, 'fr');
    subset.forEach((a, k) => {
      a.title.fr ||= res[2 * k] || a.title[lang];
      a.summary.fr = res[2 * k + 1] || a.summary[lang];
    });
  }
  // extraits des sources étrangères (revue de presse) → français
  for (const lang of ['en', 'nl']) {
    const items = articles.flatMap((a) => a.sources || []).filter((x) => x.lang === lang && !x.fr);
    if (!items.length) continue;
    const res = await translateAll(items.flatMap((x) => [x.title, x.summary]), lang, 'fr');
    items.forEach((x, k) => {
      x.title = x.titleFr || res[2 * k] || x.title;
      x.summary = res[2 * k + 1] || x.summary;
      x.fr = true;
    });
  }
  // résumé en 3 à 5 phrases, à partir de ce qu'écrivent les médias
  for (const a of articles) {
    if (a.body?.fr || a.brief?.fr) continue;
    const lines = summarize([a.summary.fr, ...(a.sources || []).map((x) => x.summary)].filter(Boolean));
    if (lines.length >= 2) a.brief = { fr: lines };
  }
  // 2. du français vers les autres langues (titre, résumé et article complet)
  for (const tl of LANGS.filter((l) => l !== 'fr')) {
    const subset = articles.filter((a) => !a.title[tl]);
    if (subset.length) {
      log(`traduction → ${tl} (${subset.length} titres)`);
      const res = await translateAll(subset.flatMap((a) => [a.title.fr, a.summary.fr]), 'fr', tl);
      subset.forEach((a, k) => {
        if (res[2 * k]) a.title[tl] = res[2 * k];
        if (res[2 * k + 1]) a.summary[tl] = res[2 * k + 1];
      });
    }
    const briefs = articles.filter((a) => a.brief?.fr && !a.brief[tl]);
    if (briefs.length) {
      const flat = briefs.flatMap((a) => a.brief.fr);
      const res = await translateAll(flat, 'fr', tl);
      let k = 0;
      for (const a of briefs) {
        const part = res.slice(k, k + a.brief.fr.length);
        k += a.brief.fr.length;
        if (part.every(Boolean)) a.brief[tl] = part;
      }
    }
    const bodies = articles.filter((a) => a.body?.fr && !a.body[tl]);
    if (bodies.length) {
      log(`traduction → ${tl} (${bodies.length} articles complets)`);
      const flat = bodies.map((a) => flattenBody(a.body.fr));
      const res = await translateAll(flat.flat(), 'fr', tl);
      let k = 0;
      bodies.forEach((a, n) => {
        const part = res.slice(k, k + flat[n].length);
        k += flat[n].length;
        if (part.every(Boolean)) a.body[tl] = rebuildBody(a.body.fr, part);
      });
    }
  }
  await saveCache();
}

async function translateBlocks(blocks, sl, tl) {
  const res = await translateAll(blocks.map((b) => b.p || b.h), sl, tl);
  if (!res.every(Boolean)) return null;
  return blocks.map((b, i) => (b.p ? { p: res[i] } : { h: res[i] }));
}

// un article complet ↔ une liste de textes (pour la traduction)
function flattenBody(b) {
  return [b.lede, ...b.keyPoints, ...b.sections.flatMap((s) => [s.heading, ...s.paragraphs])];
}
function rebuildBody(b, t) {
  let i = 0;
  const next = () => t[i++];
  return {
    lede: next(),
    keyPoints: b.keyPoints.map(next),
    sections: b.sections.map((s) => ({ heading: next(), paragraphs: s.paragraphs.map(next) })),
  };
}

// ———————————————————————————————————————— marchés

async function fetchMarkets() {
  const out = await pool(MARKETS, 4, async (m) => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(m.symbol)}?range=1mo&interval=1d`;
    const data = JSON.parse(await fetchText(url, { timeout: 10000, headers: { 'user-agent': 'Mozilla/5.0 (compatible; JournalBot/1.0)', accept: 'application/json' } }));
    const r = data.chart.result[0];
    const closes = (r.indicators.quote[0].close || []).filter((x) => x != null);
    const price = r.meta.regularMarketPrice ?? closes.at(-1);
    const prev = closes.length > 1 ? closes.at(-2) : r.meta.chartPreviousClose;
    return {
      id: m.id, label: m.label, kind: m.kind, unit: m.unit || '', digits: m.digits ?? (price > 1000 ? 0 : 2),
      price, change: prev ? ((price - prev) / prev) * 100 : 0, spark: closes.slice(-20).map((x) => +x.toFixed(4)),
    };
  });
  return out.filter(Boolean);
}

// ———————————————————————————————————————— pipeline

export async function build() {
  const now = Date.now();
  log(`${FEEDS.length} flux à lire…`);
  const results = await pool(FEEDS, 8, async (feed) => {
    try {
      const items = parseFeed(await fetchText(feed.url, { headers: { accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.5' } }), feed);
      log(`✓ ${feed.source} (${feed.cat ?? 'une'}) : ${items.length}`);
      return items;
    } catch (e) {
      log(`✗ ${feed.source} ${feed.url} — ${e.message}`);
      return [];
    }
  });

  const seen = new Set();
  let articles = results.flat().filter((a) => {
    if (!a.title || !a.url || !/^https?:/.test(a.url) || !a.publishedAt) return false;
    const age = (now - +new Date(a.publishedAt)) / 3.6e6;
    if (age > a.maxAgeH || age < -2) return false;
    const key = a.url.split('?')[0] + '|' + a.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  log(`${articles.length} articles récents`);

  // titres étrangers traduits avant le regroupement : un même sujet couvert par
  // la BBC, la VRT et Le Soir est ainsi reconnu comme un seul sujet
  await loadCache();
  for (const lang of ['en', 'nl']) {
    const foreign = articles.filter((a) => a.lang === lang);
    if (!foreign.length) continue;
    const res = await translateAll(foreign.map((a) => a.title), lang, 'fr');
    foreign.forEach((a, k) => { if (res[k]) a.titleFr = res[k]; });
  }

  const clusters = cluster(articles);
  for (const c of clusters) {
    const lead = pickLead(c);
    // les rubriques locales ne se décident que sur le texte (voir plus bas)
    const cats = c.items.map((a) => a.cat).filter((x) => x && !LOCAL[x]);
    const voted = cats.sort((x, y) => cats.filter((v) => v === y).length - cats.filter((v) => v === x).length)[0];
    const hinted = guessCategory(lead);
    const sure = guessCategory(lead, 3); // mot distinctif dans le titre
    const belgian = c.items.some((a) => a.region === 'be' || a.cat === 'belgique');
    let cat = voted || hinted || (belgian ? 'belgique' : 'monde');
    // un sujet d'actualité générale mais clairement thématique est reclassé
    if ((cat === 'belgique' || cat === 'monde') && sure && sure !== 'economie') cat = sure;
    if (cat === 'monde' && sure === 'economie') cat = 'economie';
    const localText = c.items.map((a) => `${a.title} ${a.summary || ''}`).join(' \n ');
    const local = localCategory(localText, belgian);
    if (local) cat = local;
    c.lead = lead;
    c.cat = cat;
    c.score = scoreCluster(c, now, cat);
  }
  clusters.sort((a, b) => b.score - a.score);

  // l'actu locale est toujours gardée, même si elle est moins reprise
  const chosen = [...clusters.slice(0, MAX_ARTICLES), ...clusters.slice(MAX_ARTICLES).filter((c) => LOCAL[c.cat]).slice(0, 40)];
  log(`${chosen.filter((c) => c.cat === 'charleroi').length} sujets Charleroi, ${chosen.filter((c) => c.cat === 'chatelet').length} sujets Châtelet`);
  const picked = chosen.map((c, rank) => {
    const lead = c.lead;
    const direct = c.items.filter((a) => !a.aggregator);
    // identifiant stable d'un sujet : son plus ancien article
    const first = [...c.items].sort((x, y) => new Date(x.publishedAt) - new Date(y.publishedAt))[0];
    return {
      id: hash(first.url),
      cat: c.cat,
      source: lead.source,
      url: lead.url,
      image: lead.image || c.items.find((a) => a.image)?.image || null,
      publishedAt: lead.publishedAt,
      updatedAt: new Date(Math.max(...c.items.map((a) => +new Date(a.publishedAt)))).toISOString(),
      lang: lead.lang,
      title: lead.titleFr ? { [lead.lang]: lead.title, fr: lead.titleFr } : { [lead.lang]: lead.title },
      summary: { [lead.lang]: lead.summary || c.items.find((a) => a.summary && a.lang === lead.lang)?.summary || '' },
      coverage: new Set(c.items.map((a) => a.source)).size,
      importance: importance(rank, c),
      sources: (direct.length ? [lead, ...direct.filter((a) => a !== lead)] : [lead]).slice(0, 6).map((a) => ({
        source: a.source, url: a.url, title: a.title, titleFr: a.titleFr, summary: a.summary, lang: a.lang, publishedAt: a.publishedAt,
      })),
      score: +c.score.toFixed(4),
      _agg: lead.aggregator,
    };
  });

  if (picked.length < MIN_ARTICLES) {
    log(`seulement ${picked.length} articles : on conserve l'édition existante`);
    return null;
  }

  // texte complet (lecture personnelle, chiffré) — récupère aussi des photos
  if (FULL_KEY) await fetchFullTexts(picked, { fetchText, pool, translateBlocks });

  // une vraie photo pour chaque article : on essaie toutes ses sources
  const needy = picked.filter((a) => !a.image || !a.summary[a.lang]).slice(0, 90);
  log(`photos et résumés à compléter : ${needy.length}`);
  await pool(needy, 6, async (a) => {
    const urls = [a.url, ...(a.sources || []).map((s) => s.url)].filter((u, i, all) => /^https?:/.test(u) && !/news\.google\./.test(u) && all.indexOf(u) === i);
    for (const url of urls.slice(0, 3)) {
      const proxy = { url, image: a.image, summary: a.summary[a.lang] };
      try { await enrich(proxy); } catch { continue; }
      a.image = proxy.image;
      if (url === a.url) a.summary[a.lang] = proxy.summary;
      if (a.image) break;
    }
  });
  log(`${picked.filter((a) => a.image).length}/${picked.length} articles avec photo`);

  // la rédaction : articles complets, lisibles dans l'application
  const todo = await planWriting(picked);
  if (todo.length) {
    const sources = todo.flatMap((a) => a.sources.slice(0, 4));
    log(`lecture de ${sources.length} articles sources…`);
    await pool(sources, 6, async (src) => {
      const proxy = { url: src.url, image: null, summary: src.summary };
      await enrich(proxy, { withText: true });
      src.text = proxy.text;
    });
  }
  await writeArticles(todo, picked);
  if (writingEnabled()) log(`${picked.filter((a) => a.written).length}/${picked.length} articles rédigés`);

  await translateArticles(picked);

  // "À la une" : les sujets les plus importants, avec un peu de diversité
  const top = [];
  const perCat = {};
  for (const a of picked) {
    if (top.length >= 8) break;
    if ((perCat[a.cat] || 0) >= (LOCAL[a.cat] ? 1 : 3)) continue;
    if (top.length === 0 && !a.image) continue; // la manchette doit avoir une photo
    top.push(a.id);
    perCat[a.cat] = (perCat[a.cat] || 0) + 1;
  }

  // aperçu du classement dans le journal de la tâche
  log('— classement —');
  picked.slice(0, 25).forEach((a, i) =>
    log(`${String(i + 1).padStart(2)}. [${a.cat}] ${'●'.repeat(a.importance)} ×${a.coverage} ${a.written ? '✎' : ' '} ${a.title.fr}`));

  for (const a of picked) for (const s of a.sources) { delete s.text; delete s.fr; delete s.titleFr; }

  let markets = [];
  try { markets = await fetchMarkets(); } catch (e) { log('marchés indisponibles', e.message); }

  for (const a of picked) delete a._agg;
  return {
    generatedAt: new Date().toISOString(),
    edition: 'live',
    top,
    markets,
    sources: [...new Set(picked.map((a) => a.source))].sort(),
    articles: picked,
  };
}

async function main() {
  if (process.argv.includes('--translate')) {
    const data = JSON.parse(await readFile(OUT, 'utf8'));
    await translateArticles(data.articles);
    await writeFile(OUT, JSON.stringify(data, null, 1));
    log('traductions ajoutées');
    return;
  }
  const data = await build();
  if (!data) return;
  await mkdir(new URL('../data/', import.meta.url), { recursive: true });
  if (FULL_KEY) data.crypto = await publishFullTexts(data.articles, ARTICLES_DIR, FULL_KEY);
  else for (const a of data.articles) delete a.full;
  await writeFile(OUT, JSON.stringify(data));
  log(`✓ ${data.articles.length} articles, ${data.markets.length} marchés → data/news.json`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => {
  console.error(e);
  process.exit(1);
});
