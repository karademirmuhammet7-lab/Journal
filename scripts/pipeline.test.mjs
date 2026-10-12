import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';

process.env.JOURNAL_CACHE_DIR = await mkdtemp('/tmp/journal-test-');
delete process.env.ANTHROPIC_API_KEY;
process.env.JOURNAL_KEY = 'test';

const now = new Date();
const ago = (h) => new Date(now - h * 3600e3).toUTCString();
const rss = (items) => `<?xml version="1.0"?><rss xmlns:media="http://search.yahoo.com/mrss/"><channel>${items
  .map(([t, l, h, d, img]) => `<item><title>${t}</title><link>${l}</link><pubDate>${ago(h)}</pubDate><description>${d}</description>${img ? `<media:content url="${img}" medium="image"/>` : ''}</item>`)
  .join('')}</channel></rss>`;

const FEEDS = {
  'lalibre.be/arc/outboundfeeds/rss/section/belgique': rss([
    ['Budget fédéral : le gouvernement De Wever trouve un accord sur 10 milliards', 'https://lalibre.be/budget', 1, 'Après une nuit de négociations, la coalition Arizona a bouclé son budget.', 'https://img/budget.jpg'],
    ['Grève des services publics : trains et bus perturbés lundi en Belgique', 'https://lalibre.be/greve', 3, 'La CGSP mobilise le rail et les transports en commun.', null],
  ]),
  'lemonde.fr/rss/une.xml': rss([
    ['Budget fédéral belge : le gouvernement De Wever trouve un accord sur 10 milliards', 'https://lemonde.fr/budget-belge', 2, 'Le Premier ministre belge a annoncé un accord.', 'https://img/lm.jpg'],
    ['Football : victoire du Real Madrid en Liga', 'https://lemonde.fr/foot', 1, 'Le Real Madrid s’impose.', 'https://img/foot.jpg'],
  ]),
  'feeds.bbci.co.uk/news/business': rss([
    ['Belgian government agrees budget deal worth 10 billion euros', 'https://bbc.co.uk/belgium-budget', 2, 'The coalition led by Bart De Wever reached a deal.', 'https://img/bbc.jpg'],
    ['Oil prices fall as G7 pledges reserves release', 'https://bbc.co.uk/oil', 4, 'Brent crude dropped after the announcement.', 'https://img/oil.jpg'],
  ]),
  'francetvinfo.fr/sante.rss': rss(['Grippe saisonnière', 'Hôpitaux bruxellois saturés', 'Pénurie de médecins généralistes', 'Nouveau traitement contre Alzheimer', 'Cancer du sein dépistage', 'Vaccin contre la dengue', 'Diabète type deux étude', 'Sommeil des adolescents', 'Pollution atmosphérique décès', 'Antibiotiques résistance mondiale', 'Santé mentale étudiants', 'Tabac jeunes recul'].map((t, i) => [t, `https://fi.fr/s${i}`, 5 + i, 'Un résumé santé.', null])),
};

globalThis.fetch = async (url, opts = {}) => {
  url = String(url);
  const hit = Object.entries(FEEDS).find(([k]) => url.includes(k));
  if (hit) return new Response(hit[1], { status: 200 });
  if (url.includes('translate.googleapis')) {
    const q = decodeURIComponent(String(opts.body).slice(2));
    const known = { 'Belgian government agrees budget deal worth 10 billion euros': 'Le gouvernement belge trouve un accord budgétaire de 10 milliards d’euros' };
    const out = q.split('\n').map((l) => known[l] || `[T]${l}`).join('\n');
    return Response.json([[[out, q]]]);
  }
  if (/lalibre\.be\/greve/.test(url)) return new Response('<html><meta property="og:image" content="https://img/og.jpg"><article>' + Array.from({ length: 12 }, (_, i) => `<p>Paragraphe ${i} de l’article sur la grève des services publics en Belgique, avec ses conséquences.</p>`).join('') + '</article></html>');
  return new Response('not found', { status: 404 });
};

const { build } = await import(new URL('./build-news.mjs', import.meta.url).href);

test('pipeline complet sans clé API : regroupement, priorités, importance, traductions', async () => {
  const data = await build();
  assert.ok(data, 'une édition est produite');
  const budget = data.articles.find((a) => /budget/i.test(a.title.fr));
  assert.equal(budget.coverage, 3, 'trois médias sur le budget (fr + fr + en)');
  assert.equal(budget.cat, 'belgique');
  assert.equal(budget.importance, 5);
  assert.equal(data.articles[0].id, budget.id, 'le sujet le plus repris, en Belgique, passe en tête');
  assert.equal(budget.sources.length, 3);
  assert.ok(budget.sources.every((s) => s.title && s.url && !('text' in s)));
  // la source anglaise est traduite en français pour la revue de presse
  assert.equal(budget.sources.find((s) => s.source === 'BBC News').title, 'Le gouvernement belge trouve un accord budgétaire de 10 milliards d’euros');
  for (const l of ['en', 'nl', 'tr', 'ar']) assert.ok(budget.title[l], `titre en ${l}`);
  const foot = data.articles.find((a) => /Real Madrid/.test(a.title.fr));
  assert.ok(data.articles.indexOf(foot) > data.articles.indexOf(budget), 'le sport passe après');
  const greve = data.articles.find((a) => /Grève/.test(a.title.fr));
  assert.equal(greve.image, 'https://img/og.jpg', 'image complétée depuis la page');
  assert.equal(greve.full.source, 'La Libre', 'texte complet récupéré');
  assert.equal(greve.full.blocks.length, 12);
  assert.equal(data.top[0], budget.id);
});

test('rédaction : réponse structurée transformée en article', async () => {
  const { writeOne } = await import(new URL('./writer.mjs', import.meta.url).href);
  let request;
  const client = { beta: { messages: { create: async (r) => { request = r; return {
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: JSON.stringify({ title: ' Un titre ', lede: 'Chapeau.', keyPoints: ['A', 'B', 'C'], sections: [{ heading: 'Partie', paragraphs: ['P1', ''] }] }) }],
  }; } } } };
  const body = await writeOne(client, { cat: 'belgique', sources: [{ source: 'Le Soir', lang: 'fr', title: 'T', text: 'texte', publishedAt: '' }] });
  assert.equal(body.title, 'Un titre');
  assert.deepEqual(body.sections, [{ heading: 'Partie', paragraphs: ['P1'] }]);
  assert.equal(request.output_config.format.type, 'json_schema');
  assert.match(request.messages[0].content, /Le Soir/);
  await assert.rejects(writeOne({ beta: { messages: { create: async () => ({ stop_reason: 'refusal', content: [] }) } } }, { cat: 'x', sources: [] }));
});
