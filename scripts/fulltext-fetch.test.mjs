import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';

process.env.JOURNAL_CACHE_DIR = await mkdtemp('/tmp/journal-cache-');
const { fetchFullTexts } = await import('./fulltext.mjs');

const para = (n) => `Paragraphe ${n} : un jeune homme a été découvert sans vie dans son appartement à Charleroi. `.repeat(3);
const ARTICLE = `<article>${[1, 2, 3, 4].map((n) => `<p>${para(n)}</p>`).join('')}</article>`;
const PAYWALL = `<article><p>${para(1)}</p><p>Cet article est réservé aux abonnés. Pour lire la suite, abonnez-vous.</p></article>`;
const pool = async (items, n, fn) => Promise.all(items.map(fn));

test('texte complet : lien Google Actualités résolu, puis autre média si réservé aux abonnés', async () => {
  const calls = [];
  const fetchText = async (url, opts = {}) => {
    calls.push(url);
    if (url.includes('/rss/articles/AU_yqLabc')) return '<div data-n-a-sg="SIG" data-n-a-ts="1700000000"></div>';
    if (url.includes('batchexecute')) {
      assert.match(decodeURIComponent(opts.body), /AU_yqLabc/);
      return `)]}'\n\n[["wrb.fr","Fbv4je","[\\"garturlres\\",\\"https://www.sudinfo.be/id/1\\",1]",null,null,null,"generic"]]`;
    }
    if (url === 'https://www.sudinfo.be/id/1') return ARTICLE;
    if (url === 'https://www.dhnet.be/premium') return PAYWALL;
    if (url === 'https://www.rtbf.be/article/2') return ARTICLE;
    throw new Error('HTTP 404');
  };
  const a1 = { id: 'g', sources: [{ source: 'Sudinfo', url: 'https://news.google.com/rss/articles/AU_yqLabc?oc=5', lang: 'fr' }] };
  const a2 = { id: 'p', sources: [{ source: 'La DH', url: 'https://www.dhnet.be/premium', lang: 'fr' }] };
  const findMore = async (a) => (a.id === 'p' ? [{ source: 'RTBF', url: 'https://www.rtbf.be/article/2', lang: 'fr' }] : []);
  await fetchFullTexts([a1, a2], { fetchText, pool, translateBlocks: async () => null, findMore });
  assert.equal(a1.full.url, 'https://www.sudinfo.be/id/1');
  assert.equal(a1.full.blocks.length, 4);
  assert.equal(a2.full.source, 'RTBF');
  assert.ok(calls.includes('https://www.dhnet.be/premium'));
});
