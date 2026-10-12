import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { extractBlocks, ogImage, deriveKey, encrypt, decrypt, publishFullTexts } from './fulltext.mjs';

const para = (n) => `Paragraphe ${n} : ` + 'le gouvernement fédéral a présenté ses mesures budgétaires devant la Chambre. '.repeat(3);

test('extraction : paragraphes et intertitres, sans le superflu', () => {
  const html = `<html><head><meta property="og:image" content="//img.example/photo.jpg"></head><body>
    <nav><p>Menu de navigation du site très long et inutile pour le lecteur</p></nav>
    <article><h1>Titre</h1><p>${para(1)}</p><h2>Les mesures</h2><p>${para(2)}</p>
    <p>Abonnez-vous à notre newsletter pour recevoir toutes nos informations chaque matin</p>
    <aside><p>Lire aussi : un autre article sans rapport avec le sujet principal</p></aside>
    <p>${para(3)}</p><h2>Fin</h2></article>
    <footer><p>© Tous droits réservés, mentions légales et conditions générales</p></footer></body></html>`;
  const blocks = extractBlocks(html);
  assert.deepEqual(blocks.map((b) => (b.h ? 'h' : 'p')), ['p', 'h', 'p', 'p']);
  assert.equal(blocks[1].h, 'Les mesures');
  assert.equal(ogImage(html), 'https://img.example/photo.jpg');
});

test('extraction : JSON-LD articleBody découpé en paragraphes', () => {
  const body = [para(1), para(2), para(3)].join('\n');
  const html = `<script type="application/ld+json">${JSON.stringify({ '@type': 'NewsArticle', articleBody: body })}</script><div><p>court</p></div>`;
  const blocks = extractBlocks(html);
  assert.equal(blocks.length, 3);
  assert.ok(blocks.every((b) => b.p));
});

test('extraction : article réservé aux abonnés ou trop court ignoré', () => {
  assert.equal(extractBlocks(`<article><p>${para(1)}</p><p>Cet article est réservé aux abonnés. Pour lire la suite, abonnez-vous dès maintenant.</p></article>`), null);
  assert.equal(extractBlocks('<article><p>Une seule phrase un peu courte pour un article complet.</p></article>'), null);
});

test('chiffrement : seul le bon mot de passe ouvre les articles', async () => {
  const key = await deriveKey('secret');
  const box = await encrypt(key, { blocks: [{ p: 'Bonjour' }] });
  assert.deepEqual(await decrypt(key, box), { blocks: [{ p: 'Bonjour' }] });
  await assert.rejects(decrypt(await deriveKey('mauvais'), box));

  const dir = new URL(`file://${await mkdtemp('/tmp/journal-art-')}/`);
  const articles = [{ id: 'x1', full: { source: 'RTBF', url: 'https://rtbf.be/a', lang: 'fr', blocks: [{ p: 'un deux trois' }] } }, { id: 'x2' }];
  const meta = await publishFullTexts(articles, dir, 'secret');
  assert.deepEqual(await readdir(dir), ['x1.json']);
  assert.deepEqual(articles[0].full, { source: 'RTBF', minutes: 1 });
  const stored = JSON.parse(await readFile(new URL('x1.json', dir), 'utf8'));
  assert.ok(!JSON.stringify(stored).includes('un deux trois'), 'le texte est illisible sans la clé');
  assert.equal(await decrypt(key, meta.check), 'ok');
  assert.equal((await decrypt(key, stored)).blocks[0].p, 'un deux trois');
});
