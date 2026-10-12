// Édition de lancement, rédigée à la main à partir de recherches (12 octobre 2026).
// Elle sert tant que la génération automatique (GitHub Actions) n'a pas encore tourné.
//   node scripts/seed.mjs && node scripts/build-news.mjs --translate
import { writeFile } from 'node:fs/promises';

const A = (id, cat, source, url, publishedAt, title, summary, extra = {}) => ({
  id, cat, source, url, image: null, publishedAt, lang: 'fr',
  title: { fr: title }, summary: { fr: summary }, coverage: 1, related: [], score: 0, ...extra,
});

const articles = [
  A('nobel', 'economie', 'CNBC', 'https://www.cnbc.com/2026/10/12/nobel-economics-prize-winner-woodford-hall.html', '2026-10-12T10:05:00Z',
    "Nobel d'économie : les Américains Robert Hall et Michael Woodford récompensés",
    "L'Académie royale des sciences de Suède distingue l'économiste de Stanford et celui de Columbia « pour les fondements microéconomiques de la stabilisation macroéconomique ». Leurs modèles sont aujourd'hui utilisés par les banques centrales et les gouvernements pour amortir les cycles d'expansion et de récession.",
    { coverage: 5, related: [{ source: 'NPR', url: 'https://www.npr.org/2026/10/12/nx-s1-5996634/last-nobel-prize-of-the-year-to-be-announced-for-economics' }, { source: 'CNN', url: 'https://www.cnn.com/2026/10/12/business/nobel-prize-economics-intl' }, { source: 'NBC News', url: 'https://www.nbcnews.com/world/europe/americans-hall-woodford-win-2026-nobel-economics-prize-rcna602928' }] }),
  A('greve', 'belgique', "L'Avenir", 'https://www.lavenir.net/actu/belgique/2026/10/12/la-contestation-sociale-reprend-ce-lundi-12-octobre-avec-cette-fois-une-greve-dans-les-services-publics-direct-LR3FSMC7M5DQLHRLXSNJP7V6PE/', '2026-10-12T05:45:00Z',
    'Grève dans les services publics : la Belgique tourne au ralenti ce lundi',
    "À l'appel de la CGSP, le rail, la STIB, le TEC, De Lijn, la RTBF et bpost sont perturbés. La SNCB n'assure qu'un service réduit jusqu'au dernier train. Trois jours après la manifestation nationale à Bruxelles, les syndicats veulent peser sur les choix budgétaires du gouvernement, à la veille du discours du Premier ministre.",
    { coverage: 4, related: [{ source: 'La DH', url: 'https://www.dhnet.be/actu/belgique/2026/10/02/greve-confirmee-sur-le-rail-le-12-octobre-2026-NVRW2JMK7NB7TLZFIWTPALD7ZM/' }, { source: 'shortnews.be', url: 'https://shortnews.be/strike/4-public-services-strike-on-12-october-2026-10-12' }] }),
  A('budget', 'belgique', 'The Brussels Times', 'https://www.brusselstimes.com/2301600/in-search-of-e10-billion-belgian-government-prepares-for-another-major-budget-meeting', '2026-10-12T08:10:00Z',
    "Budget fédéral : la coalition Arizona cherche toujours 10 milliards d'euros avant l'échéance européenne",
    "La Commission européenne attend le projet de budget belge ce mardi 13 octobre, jour où Bart De Wever doit prononcer sa déclaration de politique générale. L'adaptation des taux de TVA, très sensible pour le MR, et le freinage de la croissance des dépenses de soins de santé bloquent encore un accord. Le Premier ministre dit préférer un bon accord à un accord bâclé.",
    { coverage: 3, related: [{ source: 'Belga', url: 'https://www.belganewsagency.eu/pm-de-wever-sounds-alarm-on-belgiums-public-finances-amid-budget-negotiations' }] }),
  A('ukraine', 'monde', 'Euronews', 'https://www.euronews.com/video/2026/10/12/latest-news-bulletin-october-12th-2026-morning', '2026-10-12T07:00:00Z',
    "Ukraine : Trump annonce une trêve sur l'énergie, Kyiv pose ses conditions",
    "Donald Trump affirme que Moscou et Kyiv ont accepté de cesser leurs frappes contre les infrastructures énergétiques, avant que la Maison Blanche ne précise qu'il pourrait ne s'agir que des raffineries. Volodymyr Zelensky se dit prêt à suspendre ces frappes si la Russie fait de même, alors que Kyiv signale une attaque contre une centrale de la région de Kharkiv.",
    { coverage: 4 }),
  A('riyad', 'monde', 'SBS News', 'https://news.sbs.co.kr/english/article.do?news_id=N1008793124', '2026-10-12T06:00:00Z',
    "Arabie saoudite : l'aéroport de Riyad visé pour le deuxième jour consécutif",
    "Une nouvelle attaque attribuée aux rebelles houthis a fait douze victimes supplémentaires selon un premier bilan. La Turquie, le Pakistan, l'Égypte et l'Arabie saoudite condamnent ces frappes ; à Washington, l'administration Trump envisage d'appuyer une riposte saoudienne.",
    { coverage: 3 }),
  A('greve-aeroport', 'belgique', 'Air Journal', 'https://www.air-journal.fr/2026-10-12-greve-du-12-octobre-a-bruxelles-des-vols-prevus-normalement-mais-un-acces-a-laeroport-perturbe-ce-lundi-5278150.html', '2026-10-12T06:30:00Z',
    "Brussels Airport : les vols maintenus, mais rejoindre l'aéroport reste un casse-tête",
    "Aucun impact sur le trafic aérien n'est prévu à ce stade, mais la grève des services publics complique l'accès à Zaventem, avec moins de trains et des bus De Lijn perturbés. Les voyageurs sont invités à prévoir une large marge."),
  A('coree', 'monde', 'SBS News', 'https://news.sbs.co.kr/english/article.do?news_id=N1008792331', '2026-10-11T23:40:00Z',
    'La Corée du Nord tire plusieurs missiles balistiques vers la mer de l’Est',
    "La présidence sud-coréenne a convoqué en urgence une réunion consacrée à la sécurité nationale après ces tirs, nouveau signal de tension dans la péninsule.",
    { coverage: 2 }),
  A('france-sondage', 'monde', 'Euronews', 'https://www.yahoo.com/news/world/articles/latest-news-bulletin-october-12th-050032352.html', '2026-10-12T05:00:00Z',
    'Présidentielle française : un sondage annonce un second tour Le Pen – Mélenchon',
    "Selon une enquête d'opinion relayée par Euronews, le Rassemblement national et La France insoumise s'affronteraient au second tour. La campagne est par ailleurs bousculée par la contestation étudiante."),
  A('marches', 'finance', 'La rédaction', 'https://www.boursorama.com/bourse/actualites/', '2026-10-12T07:30:00Z',
    'Marchés : une semaine sous le regard de la Fed',
    "Wall Street a terminé en hausse vendredi après une semaine agitée. Les investisseurs guettent désormais les signaux de la Réserve fédérale, tandis qu'en Europe la remontée des taux français et l'écart avec l'Allemagne restent sous surveillance. Le pétrole reflue après la promesse du G7 de mettre 100 millions de barils sur le marché."),
  A('mineurs', 'faits-divers', 'BX1', 'https://bx1.be/', '2026-10-11T15:20:00Z',
    'Débordements après la manifestation nationale : des mineurs relâchés faute de place en IPPJ',
    "Des mineurs soupçonnés d'avoir pris part aux violences en marge de la manifestation du 9 octobre à Bruxelles ont été remis en liberté, les institutions publiques de protection de la jeunesse étant saturées. Le manque de places revient au cœur du débat."),
  A('climat', 'belgique', 'BX1', 'https://bx1.be/', '2026-10-11T13:30:00Z',
    'Marche pour le climat : des dizaines de milliers de personnes dans les rues de Bruxelles',
    "Les organisateurs revendiquent 60 000 participants, la police en a compté 45 000. Le cortège a réclamé des engagements plus fermes de la Belgique et de l'Union européenne à l'approche de la COP31."),
  A('grippe', 'sante', 'Test-Achats', 'https://www.test-achats.be/sante/maladies-et-medicaments/apercus-maladies/news/vaccin-renforce-grippe-belgique-2026', '2026-10-10T08:00:00Z',
    'Grippe : la vaccination commence, un vaccin renforcé conseillé aux plus de 65 ans',
    "La vaccination est recommandée de la mi-octobre à la mi-décembre, en priorité pour les 65 ans et plus, les femmes enceintes et les malades chroniques. Le Conseil supérieur de la santé privilégie désormais un vaccin renforcé pour les seniors, délivré en pharmacie sans ordonnance."),
  A('taiwan', 'monde', 'Euronews', 'https://www.euronews.com/video/2026/10/12/latest-news-bulletin-october-12th-2026-morning', '2026-10-12T08:30:00Z',
    'Taïwan : Pékin sanctionne des ministres du Paraguay et du Belize',
    "La Chine frappe de sanctions des membres des gouvernements paraguayen et bélizien, deux des rares pays qui reconnaissent encore Taipei. Une nouvelle étape dans la pression diplomatique exercée sur l'île."),
  A('couteau', 'faits-divers', 'BruxellesToday', 'https://www.bruxellestoday.be/faits-divers/agression-couteau-bruxelles-police-recherche-deux-suspects.html', '2026-10-09T10:00:00Z',
    'Coup de couteau dans le centre de Bruxelles : la police diffuse un avis de recherche',
    "À la demande du parquet de Bruxelles, la police fédérale publie les images de deux suspects d'une agression au couteau commise en avril dans le centre de la capitale. Toute personne pouvant les identifier est invitée à contacter les enquêteurs."),
  A('delhi', 'monde', 'Euronews', 'https://www.euronews.com/video/2026/10/12/latest-news-bulletin-october-12th-2026-morning', '2026-10-12T06:45:00Z',
    'Inde : Delhi ferme des stations de métro avant une manifestation contre le chef des élections',
    "Les autorités ont restreint la circulation et fermé plusieurs stations du centre de la capitale indienne pour encadrer un rassemblement visant le responsable de la commission électorale."),
  A('petrole', 'economie', 'MoneyVox', 'https://www.moneyvox.fr/bourse/actualites/110681/wall-street-au-sommet-le-journal-de-la-bourse-du-6-octobre-2026', '2026-10-06T17:30:00Z',
    'Pétrole : le G7 promet 100 millions de barils pour faire baisser les prix',
    "Le brut recule alors que les exportations du Moyen-Orient repartent et que le G7 s'engage à mettre des réserves sur le marché. Une détente qui réduit la pression sur l'inflation et, par ricochet, sur les taux d'intérêt."),
  A('tech-wallstreet', 'finance', 'Scala Patrimoine', 'https://scala-patrimoine.fr/2026/10/01/le-rendez-vous-des-marches-financiers-et-de-leconomie-octobre-2026/', '2026-10-01T08:00:00Z',
    "Wall Street : la tech tient les indices, mais 78 % des valeurs du S&P 500 ont reculé en septembre",
    "Le S&P 500 termine septembre quasi stable (+0,26 %) et le Nasdaq gagne 2,9 %, portés par Meta, AMD et Intel. Le Dow Jones cède 3,5 % et l'Euro Stoxx 50 1,6 %. Le marché obligataire reste le principal point de tension, avec la remontée des rendements."),
  A('burnout', 'sante', 'Europe Says', 'https://www.europesays.com/be-fr/tag/elite/', '2026-10-07T09:00:00Z',
    'Burn-out : en Belgique, le parcours du combattant des malades',
    "Témoignages à l'appui, un reportage décrit le long chemin administratif et médical imposé aux personnes en burn-out, et le coût d'une absence de longue durée pour les employeurs."),
];

const data = {
  generatedAt: '2026-10-12T14:30:00Z',
  edition: 'seed',
  top: ['nobel', 'greve', 'budget', 'ukraine', 'riyad', 'marches', 'grippe'],
  markets: [],
  sources: [...new Set(articles.map((a) => a.source))].sort(),
  articles,
};

await writeFile(new URL('../data/news.json', import.meta.url), JSON.stringify(data, null, 1));
console.log(`${articles.length} articles écrits`);
