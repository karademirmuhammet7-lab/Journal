// La rédaction : pour chaque sujet important, Claude rédige un article original
// en français à partir de ce qu'en disent les différents médias.
// Actif uniquement si la variable d'environnement ANTHROPIC_API_KEY est définie.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import Anthropic from '@anthropic-ai/sdk';

const CACHE_DIR = process.env.JOURNAL_CACHE_DIR ? new URL(`file://${process.env.JOURNAL_CACHE_DIR}/`) : new URL('../.cache/', import.meta.url);
const CACHE = new URL('articles.json', CACHE_DIR);
const MODEL = process.env.JOURNAL_MODEL || 'claude-opus-5-5';
const EFFORT = process.env.JOURNAL_EFFORT || 'low';
const WRITE_LIMIT = +(process.env.JOURNAL_WRITE_LIMIT || 15); // articles rédigés par passage
const MAX_RANK = +(process.env.JOURNAL_WRITE_RANK || 60); // seulement les N sujets les plus importants
const MAX_SOURCE_CHARS = 6000;

const log = (...a) => console.log('[rédaction]', ...a);

const SYSTEM = `Tu es journaliste à la rédaction de « K-NEWS », un quotidien numérique belge francophone, sobre et rigoureux.
On te donne plusieurs sources de presse sur un même sujet. Rédige un article ORIGINAL en français, comme pour un journal de qualité.

Règles :
- N'utilise que les faits présents dans les sources. N'invente aucun chiffre, nom, citation ni date. Si une information est incertaine ou ne vient que d'un média, attribue-la (« selon Le Soir », « d'après la BBC »).
- Reformule avec tes propres mots : pas de phrases recopiées. Une courte citation entre guillemets est permise si elle est attribuée.
- Ton neutre et factuel, phrases claires. Explique le contexte utile à un lecteur belge (ce que cela change en Belgique, pour l'économie, pour les marchés) quand les sources le permettent.
- Titre : informatif, 110 caractères maximum, sans point final.
- Chapeau : 2 ou 3 phrases qui résument l'essentiel.
- Points clés : 3 phrases courtes.
- Corps : 2 à 4 parties avec un intertitre court chacune, 1 à 3 paragraphes par partie. Vise 250 à 450 mots ; si les sources sont minces, écris plus court plutôt que de remplir.
- Pas de formule creuse ni de conclusion moralisatrice.`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'lede', 'keyPoints', 'sections'],
  properties: {
    title: { type: 'string' },
    lede: { type: 'string' },
    keyPoints: { type: 'array', items: { type: 'string' } },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['heading', 'paragraphs'],
        properties: {
          heading: { type: 'string' },
          paragraphs: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
};

let cache = {};
async function loadCache() {
  try { cache = JSON.parse(await readFile(CACHE, 'utf8')); } catch { cache = {}; }
}
async function saveCache(keepIds) {
  await mkdir(CACHE_DIR, { recursive: true });
  // on garde les articles encore à l'affiche et les plus récents
  const entries = Object.entries(cache).sort((a, b) => (b[1].writtenAt || 0) - (a[1].writtenAt || 0));
  const kept = entries.filter(([id], i) => keepIds.has(id) || i < 400);
  await writeFile(CACHE, JSON.stringify(Object.fromEntries(kept)));
}

function sourceBlock(s, i) {
  const text = (s.text || s.summary || '').slice(0, MAX_SOURCE_CHARS);
  return `<source index="${i + 1}" media="${s.source}" langue="${s.lang}" publie="${s.publishedAt || ''}">
<titre>${s.title}</titre>
<texte>${text}</texte>
</source>`;
}

export async function writeOne(client, article) {
  const prompt = `Rubrique : ${article.cat}
Sources (${article.sources.length}) :

${article.sources.map(sourceBlock).join('\n\n')}

Rédige l'article.`;

  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM,
    output_config: { effort: EFFORT, format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: prompt }],
  });

  if (response.stop_reason === 'refusal') throw new Error('refus');
  if (response.stop_reason === 'max_tokens') throw new Error('réponse tronquée');
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const out = JSON.parse(text);
  if (!out.title || !out.lede || !out.sections?.length) throw new Error('article incomplet');
  return {
    title: out.title.trim(),
    lede: out.lede.trim(),
    keyPoints: out.keyPoints.map((p) => p.trim()).filter(Boolean).slice(0, 4),
    sections: out.sections
      .map((s) => ({ heading: s.heading.trim(), paragraphs: s.paragraphs.map((p) => p.trim()).filter(Boolean) }))
      .filter((s) => s.paragraphs.length),
  };
}

const signature = (a) => a.sources.map((s) => s.url).sort().join('|');

export const writingEnabled = () => !!process.env.ANTHROPIC_API_KEY;

/**
 * Reprend les articles déjà rédigés (cache) et renvoie ceux qu'il reste à rédiger.
 * @param {object[]} articles  articles classés par importance, avec `sources`
 */
export async function planWriting(articles) {
  await loadCache();
  for (const a of articles) {
    const c = cache[a.id];
    if (c) applyBody(a, c.body);
  }
  if (!writingEnabled()) {
    log('pas de clé ANTHROPIC_API_KEY : articles en mode « revue de presse »');
    return [];
  }
  return articles
    .slice(0, MAX_RANK)
    .filter((a) => {
      const c = cache[a.id];
      if (!c) return true;
      // sujet qui a pris de l'ampleur : on réécrit avec les nouvelles sources (au plus toutes les 2 h)
      const grown = a.sources.length >= (c.nSources || 1) + 2;
      return grown && Date.now() - c.writtenAt > 2 * 3600e3 && c.sig !== signature(a);
    })
    .slice(0, WRITE_LIMIT);
}

/** Fait rédiger les articles (leurs sources doivent porter `text`), puis enregistre le cache. */
export async function writeArticles(todo, allArticles) {
  if (todo.length) log(`${todo.length} article(s) à rédiger (${MODEL}, effort ${EFFORT})`);
  const client = todo.length ? new Anthropic({ maxRetries: 2, timeout: 120_000 }) : null;

  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, todo.length) }, async () => {
      while (i < todo.length) {
        const a = todo[i++];
        try {
          const body = await writeOne(client, a);
          cache[a.id] = { body, sig: signature(a), nSources: a.sources.length, writtenAt: Date.now() };
          applyBody(a, body);
          log(`✓ ${body.title}`);
        } catch (e) {
          log(`✗ ${a.title.fr || Object.values(a.title)[0]} — ${e.message}`);
        }
      }
    }),
  );
  await saveCache(new Set(allArticles.map((a) => a.id)));
}

function applyBody(a, body) {
  a.body = { fr: { lede: body.lede, keyPoints: body.keyPoints, sections: body.sections } };
  a.title = { fr: body.title };
  a.summary = { fr: body.lede };
  a.lang = 'fr';
  a.written = true;
}

// ———————————————————————————————————————— extraction du texte des sources

const decodeEntities = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;|&rsquo;/g, '’')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

const BOILERPLATE = /cookie|abonn|newsletter|inscri|publicit|tous droits|©|javascript|connectez-vous|lire aussi|à lire|related|sign up|subscribe/i;

/** Texte principal d'une page d'article (JSON-LD articleBody, sinon paragraphes). */
export function extractText(html) {
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const found = [];
      const walk = (o) => {
        if (!o || typeof o !== 'object') return;
        if (typeof o.articleBody === 'string') found.push(o.articleBody);
        Object.values(o).forEach(walk);
      };
      walk(JSON.parse(m[1]));
      const body = found.sort((a, b) => b.length - a.length)[0];
      if (body && body.length > 400) return decodeEntities(body).replace(/\s+/g, ' ').trim();
    } catch { /* JSON-LD invalide */ }
  }
  const region = html.match(/<article[\s\S]*?<\/article>/i)?.[0] || html;
  const paras = [...region.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => decodeEntities(m[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 60 && !BOILERPLATE.test(p));
  return paras.join('\n').slice(0, MAX_SOURCE_CHARS);
}
