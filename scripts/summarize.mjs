// Résumé automatique (gratuit, sans IA payante) : on garde les phrases les plus
// représentatives du texte — celles qui reprennent le plus de mots importants —
// en tenant compte de leur position, puis on les remet dans l'ordre du texte.

const STOP = new Set(('alors au aucun aussi autre avant avec avoir bon car ce cela ces ceux chaque ci comme comment dans des du dedans dehors depuis devrait doit donc dos début elle elles en encore essai est et eu fait faites fois font hors ici il ils je juste la le les leur là ma maintenant mais mes mine moins mon mot même ni nommés notre nous ou où par parce pas peut peu plupart pour pourquoi quand que quel quelle quelles quels qui sa sans ses seulement si sien son sont sous soyez sujet sur ta tandis tellement tels tes ton tous tout toute toutes très tu voient vont votre vous vu ça étaient état étions été être aux une un été avait ont selon après cette entre plus elle lui leurs dont été déjà fait faire sera serait aurait avait avaient être the and that with for from this have has was were are will would could also into about their they said says').split(' '));

export function sentences(text) {
  return (text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?…»])\s+(?=[«"A-ZÀ-ÖØ-Þ0-9])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 40 && s.length <= 320);
}

const words = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').split(' ')
    .filter((w) => w.length > 3 && !STOP.has(w));

/**
 * @param {string[]} paragraphs  texte de l'article (paragraphes) ou extraits des médias
 * @param {number} max  nombre de phrases (3 à 5 selon la longueur)
 */
export function summarize(paragraphs, max) {
  const list = paragraphs.flatMap((p, pi) => sentences(p).map((s, si) => ({ s, pi, si })));
  if (!list.length) return [];
  const n = max || (list.length > 30 ? 5 : list.length > 14 ? 4 : 3);
  if (list.length <= n) return list.map((x) => x.s);

  const freq = new Map();
  for (const x of list) for (const w of new Set(words(x.s))) freq.set(w, (freq.get(w) || 0) + 1);
  const top = Math.max(...freq.values());
  list.forEach((x, i) => {
    const ws = words(x.s);
    const weight = ws.reduce((sum, w) => sum + freq.get(w) / top, 0) / Math.sqrt(ws.length || 1);
    const position = i === 0 ? 0.6 : x.si === 0 ? 0.25 : Math.max(0, 0.2 - i * 0.01);
    x.score = weight + position;
    x.tok = new Set(ws);
  });

  const picked = [];
  for (const x of [...list].sort((a, b) => b.score - a.score)) {
    if (picked.length >= n) break;
    // pas deux phrases qui disent la même chose
    const dup = picked.some((p) => {
      let inter = 0;
      for (const w of x.tok) if (p.tok.has(w)) inter++;
      return inter / Math.min(x.tok.size || 1, p.tok.size || 1) > 0.55;
    });
    if (!dup) picked.push(x);
  }
  return picked.sort((a, b) => list.indexOf(a) - list.indexOf(b)).map((x) => x.s);
}
