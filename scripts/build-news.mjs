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
import { FEEDS, MARKETS, CATEGORY_HINTS } from './feeds.mjs';

const OUT = new URL('../data/news.json', import.meta.url);
const CACHE = new URL('../.cache/translations.json', import.meta.url);
const LANGS = ['fr', 'en', 'nl', 'tr', 'ar'];
const MAX_AGE_H = 36;
const MAX_ARTICLES = 140;
const MIN_ARTICLES = 12; // en dessous, on garde l'édition précédente
const UA = 'Mozilla/5.0 (compatible; JournalBot/1.0; +https://github.com/)';

const log = (...a) => console.log('[news]', ...a);

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
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: '*/*', ...headers }, signal: ctrl.signal, redirect: 'follow' });
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
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

function similarity(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / Math.min(a.size, b.size) * (inter >= 3 ? 1 : inter >= 2 ? 0.8 : 0.4);
}

function guessCategory(a) {
  const hay = ` ${a.title} ${a.summary} `.toLowerCase();
  let best = null, bestHits = 0;
  for (const [cat, words] of Object.entries(CATEGORY_HINTS)) {
    const hits = words.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0);
    if (hits > bestHits) { best = cat; bestHits = hits; }
  }
  return bestHits >= 2 ? best : null;
}

export function cluster(articles) {
  const clusters = [];
  for (const a of articles) {
    a._tok = tokens(a.title);
    let home = null, best = 0;
    for (const c of clusters) {
      const s = similarity(a._tok, c.lead._tok);
      if (s > best) { best = s; home = c; }
    }
    if (home && best >= 0.6) home.items.push(a);
    else clusters.push({ lead: a, items: [a] });
  }
  return clusters;
}

function scoreCluster(c, now) {
  const sources = new Set(c.items.map((a) => a.source));
  const newest = Math.max(...c.items.map((a) => +new Date(a.publishedAt)));
  const ageH = Math.max(0, (now - newest) / 3.6e6);
  const weight = Math.max(...c.items.map((a) => a.weight));
  const onFront = c.items.some((a) => a.top);
  const coverage = 1 + 0.55 * Math.log2(sources.size);
  const fresh = Math.exp(-ageH / 14);
  return weight * coverage * (0.35 + fresh) * (onFront ? 1.25 : 1);
}

// Choisit l'article "vitrine" d'un sujet : un vrai journal, en français, avec image si possible.
function pickLead(c) {
  const rank = (a) => (a.aggregator ? 0 : 4) + (a.image ? 2 : 0) + (a.lang === 'fr' ? 1.5 : 0) + (a.summary ? 1 : 0) + a.weight;
  return [...c.items].sort((x, y) => rank(y) - rank(x))[0];
}

// ———————————————————————————————————————— enrichissement (og:image / og:description)

async function enrich(article) {
  const html = await fetchText(article.url, { timeout: 9000, headers: { accept: 'text/html' } });
  const meta = (prop) => {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, 'i');
    const tag = html.match(re)?.[0];
    return tag?.match(/content=["']([^"']+)["']/i)?.[1];
  };
  if (!article.image) article.image = upgradeImage(meta('og:image') || meta('twitter:image')) || null;
  if (!article.summary || article.summary.length < 60) {
    const d = meta('og:description') || meta('description');
    if (d) article.summary = clip(stripHtml(d), 320);
  }
}

// ———————————————————————————————————————— traduction

let cache = {};
async function loadCache() {
  try { cache = JSON.parse(await readFile(CACHE, 'utf8')); } catch { cache = {}; }
}
async function saveCache() {
  await mkdir(new URL('../.cache/', import.meta.url), { recursive: true });
  // on ne garde que les entrées récentes pour éviter que le cache grossisse sans fin
  const entries = Object.entries(cache).slice(-12000);
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
    const subset = articles.filter((a) => a.lang === lang && !a.title.fr);
    if (!subset.length) continue;
    const res = await translateAll(subset.flatMap((a) => [a.title[lang], a.summary[lang]]), lang, 'fr');
    subset.forEach((a, k) => {
      a.title.fr = res[2 * k] || a.title[lang];
      a.summary.fr = res[2 * k + 1] || a.summary[lang];
    });
  }
  // 2. du français vers les autres langues
  for (const tl of LANGS.filter((l) => l !== 'fr')) {
    const subset = articles.filter((a) => !a.title[tl]);
    if (!subset.length) continue;
    log(`traduction → ${tl} (${subset.length} articles)`);
    const res = await translateAll(subset.flatMap((a) => [a.title.fr, a.summary.fr]), 'fr', tl);
    subset.forEach((a, k) => {
      if (res[2 * k]) a.title[tl] = res[2 * k];
      if (res[2 * k + 1]) a.summary[tl] = res[2 * k + 1];
    });
  }
  await saveCache();
}

// ———————————————————————————————————————— marchés

async function fetchMarkets() {
  const out = await pool(MARKETS, 4, async (m) => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(m.symbol)}?range=1mo&interval=1d`;
    const data = JSON.parse(await fetchText(url, { timeout: 10000 }));
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

async function build() {
  const now = Date.now();
  log(`${FEEDS.length} flux à lire…`);
  const results = await pool(FEEDS, 8, async (feed) => {
    try {
      const items = parseFeed(await fetchText(feed.url), feed);
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
    if (age > MAX_AGE_H || age < -2) return false;
    const key = a.url.split('?')[0] + '|' + a.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  log(`${articles.length} articles récents`);

  const clusters = cluster(articles);
  for (const c of clusters) c.score = scoreCluster(c, now);
  clusters.sort((a, b) => b.score - a.score);

  const picked = clusters.slice(0, MAX_ARTICLES).map((c) => {
    const lead = pickLead(c);
    const cats = c.items.map((a) => a.cat).filter(Boolean);
    const voted = cats.sort((x, y) => cats.filter((v) => v === y).length - cats.filter((v) => v === x).length)[0];
    const hinted = guessCategory(lead);
    let cat = voted || hinted || 'monde';
    // un sujet repris par un flux "Belgique" généraliste mais clairement thématique est reclassé
    if ((cat === 'belgique' || cat === 'monde') && hinted && ['faits-divers', 'sante', 'finance', 'sport'].includes(hinted)) cat = hinted;
    const sources = [...new Set(c.items.map((a) => a.source))];
    return {
      id: hash(lead.url),
      cat,
      source: lead.source,
      url: lead.url,
      image: lead.image || c.items.find((a) => a.image)?.image || null,
      publishedAt: lead.publishedAt,
      lang: lead.lang,
      title: { [lead.lang]: lead.title },
      summary: { [lead.lang]: lead.summary || c.items.find((a) => a.summary && a.lang === lead.lang)?.summary || '' },
      coverage: sources.length,
      related: c.items.filter((a) => a !== lead && !a.aggregator).slice(0, 4).map((a) => ({ source: a.source, url: a.url })),
      score: +c.score.toFixed(4),
      _agg: lead.aggregator,
    };
  });

  if (picked.length < MIN_ARTICLES) {
    log(`seulement ${picked.length} articles : on conserve l'édition existante`);
    return null;
  }

  // compléter images et résumés manquants pour les articles les mieux classés
  const needy = picked.filter((a) => !a._agg && (!a.image || !a.summary[a.lang])).slice(0, 70);
  log(`enrichissement de ${needy.length} articles…`);
  await pool(needy, 6, async (a) => {
    const proxy = { url: a.url, image: a.image, summary: a.summary[a.lang] };
    await enrich(proxy);
    a.image = proxy.image;
    a.summary[a.lang] = proxy.summary;
  });

  await translateArticles(picked);

  // "À la une" : les sujets les plus importants, avec un peu de diversité
  const top = [];
  const perCat = {};
  for (const a of picked) {
    if (top.length >= 7) break;
    if ((perCat[a.cat] || 0) >= 2) continue;
    if (top.length === 0 && !a.image) continue; // la manchette doit avoir une photo
    top.push(a.id);
    perCat[a.cat] = (perCat[a.cat] || 0) + 1;
  }

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
  await writeFile(OUT, JSON.stringify(data));
  log(`✓ ${data.articles.length} articles, ${data.markets.length} marchés → data/news.json`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => {
  console.error(e);
  process.exit(1);
});
