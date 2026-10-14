import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarize, sentences } from './summarize.mjs';

const text = [
  "Le gouvernement fédéral a présenté lundi un budget qui prévoit dix milliards d'euros d'économies d'ici 2029.",
  "Les syndicats dénoncent des mesures qui touchent d'abord les services publics et les pensions.",
  "Il faisait beau à Bruxelles ce jour-là, et les terrasses étaient pleines.",
  "Le budget prévoit aussi une hausse ciblée de la TVA, point sensible pour le MR au sein du gouvernement.",
  "Le Premier ministre défend un budget nécessaire pour respecter les règles européennes.",
  "Selon l'opposition, ce budget manque de mesures pour le pouvoir d'achat des ménages belges.",
  "La Commission européenne attend le projet de budget belge dans les prochains jours.",
];

test('résumé : 3 phrases clés, dans l’ordre du texte, sans la phrase hors sujet', () => {
  const out = summarize(text);
  assert.equal(out.length, 3);
  assert.equal(out[0], text[0], 'la première phrase (le chapeau) est gardée');
  assert.ok(!out.includes(text[2]));
  assert.deepEqual(out, [...out].sort((a, b) => text.indexOf(a) - text.indexOf(b)));
});

test('résumé : texte court rendu tel quel, phrases trop courtes ignorées', () => {
  assert.deepEqual(summarize(['Une seule phrase assez longue pour être un résumé correct.']), ['Une seule phrase assez longue pour être un résumé correct.']);
  assert.deepEqual(sentences('Oui. Non. Voici une phrase complète qui fait plus de quarante caractères.'), ['Voici une phrase complète qui fait plus de quarante caractères.']);
});

test('pas deux fois la même phrase (extrait repris par plusieurs médias)', () => {
  const s = 'La macabre découverte a eu lieu ce jeudi 8 octobre dans un appartement. ...';
  assert.deepEqual(summarize([s, s]), ['La macabre découverte a eu lieu ce jeudi 8 octobre dans un appartement.']);
});
