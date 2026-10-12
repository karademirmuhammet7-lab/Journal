import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed, cluster, stripHtml } from './build-news.mjs';

const now = new Date().toUTCString();

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel><title>Le Monde</title>
<item>
  <title><![CDATA[Nobel d’économie : Robert Hall et Michael Woodford récompensés]]></title>
  <link>https://www.lemonde.fr/economie/article/2026/10/12/nobel.html</link>
  <pubDate>${now}</pubDate>
  <description><![CDATA[Les deux économistes américains sont distingués pour leurs travaux &amp; modèles.]]></description>
  <media:content url="https://img.lemde.fr/photo.jpg" width="644" height="322" medium="image"/>
</item>
<item>
  <title>Grève : la Belgique tourne au ralenti</title>
  <link>https://www.lemonde.fr/x.html</link>
  <pubDate>${now}</pubDate>
  <content:encoded><![CDATA[<p><img src="https://example.org/a.jpg"/>Texte <b>gras</b></p>]]></content:encoded>
</item>
</channel></rss>`;

const atom = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
<entry><title>Atom title</title><link rel="alternate" href="https://ex.org/atom"/><updated>${new Date().toISOString()}</updated><summary>Résumé</summary></entry>
</feed>`;

const gn = `<rss><channel><item><title>Grève dans les services publics ce lundi en Belgique - L'Avenir</title><link>https://news.google.com/rss/articles/abc</link><pubDate>${now}</pubDate><description>&lt;a href="x"&gt;liste&lt;/a&gt;</description><source url="https://www.lavenir.net">L'Avenir</source></item></channel></rss>`;

test('RSS : titre, lien, image media:content, résumé décodé', () => {
  const [a, b] = parseFeed(rss, { source: 'Le Monde', cat: 'economie', lang: 'fr', weight: 1 });
  assert.equal(a.title, 'Nobel d’économie : Robert Hall et Michael Woodford récompensés');
  assert.equal(a.image, 'https://img.lemde.fr/photo.jpg');
  assert.equal(a.summary, 'Les deux économistes américains sont distingués pour leurs travaux & modèles.');
  assert.ok(a.publishedAt);
  assert.equal(b.image, 'https://example.org/a.jpg');
  assert.equal(b.summary, 'Texte gras');
});

test('Atom', () => {
  const [a] = parseFeed(atom, { source: 'X', cat: 'monde', lang: 'fr', weight: 1 });
  assert.equal(a.url, 'https://ex.org/atom');
  assert.equal(a.summary, 'Résumé');
});

test('Google Actualités : source extraite du titre, pas de résumé', () => {
  const [a] = parseFeed(gn, { source: 'Google Actualités', cat: null, lang: 'fr', weight: 0.6, aggregator: true });
  assert.equal(a.title, 'Grève dans les services publics ce lundi en Belgique');
  assert.equal(a.source, "L'Avenir");
  assert.equal(a.summary, '');
});

test('regroupe les titres qui parlent du même sujet', () => {
  const mk = (title) => ({ title });
  const c = cluster([
    mk('Grève dans les services publics : trains et bus perturbés ce lundi en Belgique'),
    mk('Grève des services publics en Belgique : les trains perturbés lundi'),
    mk('Nobel d’économie : Robert Hall et Michael Woodford récompensés'),
  ]);
  assert.equal(c.length, 2);
  assert.equal(c[0].items.length, 2);
});

test('stripHtml', () => {
  assert.equal(stripHtml('&lt;p&gt;Bonjour&amp;nbsp;<b>toi</b>&lt;/p&gt;'), 'Bonjour toi');
});

test('classement thématique des titres de flux généralistes', async () => {
  const { guessCategory } = await import('./build-news.mjs');
  const g = (title, summary = '') => guessCategory({ title, summary });
  assert.equal(g('Énorme exploit belge en tennis : Zizou Bergs élimine Carlos Alcaraz'), 'sport');
  assert.equal(g('France : un principal de collège et une professeure blessés par balles, un jeune interpellé'), 'faits-divers');
  assert.equal(g('"Je m’appelle Alain, je suis un homme et j’ai eu un cancer du sein"'), 'sante');
  assert.equal(g('Le Nobel d’économie décerné aux Américains Michael Woodford et Robert Hall'), 'economie');
  assert.equal(g('Wall Street termine en hausse, le Nasdaq au plus haut'), 'finance');
  assert.equal(g('Le chef militaire de l’OTAN dévoile sa stratégie face à la Russie'), null);
});

test('rubriques locales : Châtelet et Charleroi', async () => {
  const { localCategory } = await import('./build-news.mjs');
  assert.equal(localCategory('Châtelineau : une école inondée après les orages', true), 'chatelet');
  assert.equal(localCategory('Bouffioulx : les derniers potiers', true), 'chatelet');
  assert.equal(localCategory('Conseil communal de Châtelet : les jeunes prennent la parole', true), 'chatelet');
  assert.equal(localCategory('Gosselies : un incendie dans un entrepôt', true), 'charleroi');
  assert.equal(localCategory('Le Sporting de Charleroi s’impose face au Standard'), 'charleroi');
  assert.equal(localCategory('Marchienne-au-Pont : travaux sur le ring', true), 'charleroi');
  assert.equal(localCategory('Accident à Roux ce matin', true), 'charleroi');
  assert.equal(localCategory('Pierre Roux remporte le concours', true), null);
  assert.equal(localCategory('Paris : incident à la station Châtelet-les-Halles'), null);
  assert.equal(localCategory('Concert au théâtre du Châtelet à Paris'), null);
  assert.equal(localCategory('Jumetière et Gillyane', true), null);
});
