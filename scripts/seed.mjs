// Édition de lancement, rédigée à partir de recherches (12 octobre 2026).
// Elle sert tant que la génération automatique (GitHub Actions) n'a pas encore tourné.
//   node scripts/seed.mjs && node scripts/build-news.mjs --translate
import { writeFile } from 'node:fs/promises';

const S = (source, url, title) => ({ source, url, title, summary: '', lang: 'fr' });

const A = ({ id, cat, importance, coverage, publishedAt, title, lede, keyPoints, sections, sources }) => ({
  id, cat, importance, coverage: coverage || sources.length,
  source: sources[0].source, url: sources[0].url, image: null, publishedAt, lang: 'fr', written: true,
  title: { fr: title }, summary: { fr: lede },
  body: { fr: { lede, keyPoints, sections: sections.map(([heading, ...paragraphs]) => ({ heading, paragraphs })) } },
  sources, score: 0,
});

const articles = [
  A({
    id: 'greve', cat: 'belgique', importance: 5, coverage: 4, publishedAt: '2026-10-12T05:45:00Z',
    title: 'Grève dans les services publics : la Belgique tourne au ralenti ce lundi',
    lede: "À l'appel de la CGSP, le rail, la STIB, le TEC, De Lijn, la RTBF et bpost sont perturbés. Trois jours après la manifestation nationale à Bruxelles, les syndicats veulent peser sur les choix budgétaires du gouvernement, à la veille du discours du Premier ministre.",
    keyPoints: [
      'Rail, STIB, TEC, De Lijn, RTBF et bpost sont perturbés à l’appel de la CGSP.',
      'La SNCB ne fait rouler qu’une partie de ses trains, de dimanche 22 h au dernier train de lundi.',
      'Le mouvement vise le budget fédéral, à la veille de la déclaration de Bart De Wever.',
    ],
    sections: [
      ['Un pays au ralenti',
        "Trois jours après la manifestation nationale qui a rassemblé de nombreux manifestants à Bruxelles vendredi, la contestation sociale se poursuit. La CGSP, la centrale des services publics de la FGTB, appelle à la grève dans l'ensemble des services publics ce lundi 12 octobre.",
        "Les transports sont les plus touchés : moins de trains circulent depuis dimanche soir, et les réseaux de la STIB à Bruxelles, du TEC en Wallonie et de De Lijn en Flandre sont perturbés. La RTBF et bpost sont également concernés. À Bruxelles-Ville, Bruxelles-Propreté et le centre administratif Brucity fonctionnent au ralenti."],
      ['Le budget en toile de fond',
        "Les syndicats veulent peser sur les choix budgétaires du gouvernement fédéral. Celui-ci doit transmettre son projet de budget à la Commission européenne, et le Premier ministre Bart De Wever doit prononcer mardi sa déclaration de politique générale devant la Chambre."],
      ['Ce qu’il faut prévoir',
        "Les voyageurs sont invités à vérifier leur trajet avant de partir. À Brussels Airport, les vols sont maintenus, mais l'accès à l'aéroport est compliqué par la grève."],
    ],
    sources: [
      S("L'Avenir", 'https://www.lavenir.net/actu/belgique/2026/10/12/la-contestation-sociale-reprend-ce-lundi-12-octobre-avec-cette-fois-une-greve-dans-les-services-publics-direct-LR3FSMC7M5DQLHRLXSNJP7V6PE/', 'Grève dans les services publics ce lundi 12 octobre en Belgique : les transports en commun, la RTBF et Bpost impactés'),
      S('La DH', 'https://www.dhnet.be/actu/belgique/2026/10/02/greve-confirmee-sur-le-rail-le-12-octobre-2026-NVRW2JMK7NB7TLZFIWTPALD7ZM/', 'Grève confirmée sur le rail le 12 octobre 2026'),
      S('Ville de Bruxelles', 'https://www.bruxelles.be/actualites', 'Actualités de la Ville de Bruxelles'),
      S('shortnews.be', 'https://shortnews.be/strike/4-public-services-strike-on-12-october-2026-10-12', 'Grève des services publics du lundi 12 octobre'),
    ],
  }),
  A({
    id: 'budget', cat: 'belgique', importance: 5, publishedAt: '2026-10-12T08:10:00Z',
    title: "Budget fédéral : la coalition Arizona cherche toujours 10 milliards d'euros avant l'échéance européenne",
    lede: "La Commission européenne attend le projet de budget belge ce mardi 13 octobre, jour de la déclaration de politique générale de Bart De Wever. La TVA et les dépenses de soins de santé bloquent encore un accord.",
    keyPoints: [
      "Le gouvernement cherche environ 10 milliards d'euros pour respecter les règles européennes d'ici 2029.",
      'L’adaptation des taux de TVA, très sensible pour le MR, reste le principal point de blocage.',
      'Le projet est attendu à Bruxelles le 13 octobre, jour du discours du Premier ministre.',
    ],
    sections: [
      ['Une échéance serrée',
        "La coalition Arizona — N-VA, MR, Les Engagés, Vooruit et CD&V — reprend ses négociations budgétaires alors que l'échéance approche : la Commission européenne attend le projet de budget belge ce mardi 13 octobre, jour où le Premier ministre Bart De Wever doit présenter sa déclaration de politique générale au Parlement.",
        "Selon The Brussels Times, l'objectif est de trouver environ 10 milliards d'euros pour remettre les finances publiques en conformité avec les règles budgétaires européennes d'ici 2029. Peu d'observateurs croient toutefois que l'échéance sera tenue."],
      ['Les points de friction',
        "L'adaptation de certains taux de TVA reste le principal point de blocage, en particulier pour le MR. Le ralentissement de la croissance des dépenses de soins de santé rencontre lui aussi des résistances au sein de la majorité."],
      ['La ligne du Premier ministre',
        "Bart De Wever répète qu'il préfère un bon accord à un accord conclu dans la précipitation. Pour lui, l'assainissement des finances publiques est la tâche principale de la législature."],
    ],
    sources: [
      S('The Brussels Times', 'https://www.brusselstimes.com/2301600/in-search-of-e10-billion-belgian-government-prepares-for-another-major-budget-meeting', 'À la recherche de 10 milliards : le gouvernement prépare une nouvelle réunion budgétaire'),
      S('Belga', 'https://www.belganewsagency.eu/pm-de-wever-sounds-alarm-on-belgiums-public-finances-amid-budget-negotiations', "Le Premier ministre De Wever tire la sonnette d'alarme sur les finances publiques"),
      S('The Brussels Times', 'https://www.brusselstimes.com/2353788/pm-de-wever-continues-bilateral-talks-as-budget-talks-enter-final-stretch', 'Bart De Wever poursuit les discussions bilatérales'),
    ],
  }),
  A({
    id: 'nobel', cat: 'economie', importance: 5, coverage: 6, publishedAt: '2026-10-12T10:05:00Z',
    title: "Nobel d'économie : les Américains Robert Hall et Michael Woodford récompensés",
    lede: "L'Académie royale des sciences de Suède distingue l'économiste de Stanford et celui de Columbia pour avoir donné des fondements solides aux modèles qui servent à stabiliser l'économie, aujourd'hui utilisés par les banques centrales.",
    keyPoints: [
      'Robert E. Hall (Stanford) et Michael Woodford (Columbia) reçoivent le prix 2026.',
      'Ils sont récompensés « pour les fondements microéconomiques de la stabilisation macroéconomique ».',
      'Leurs modèles aident banques centrales et gouvernements à amortir les cycles économiques.',
    ],
    sections: [
      ['Le dernier Nobel de la saison',
        "Le prix de la Banque de Suède en sciences économiques, dernier Nobel annoncé cette année, revient à deux économistes américains : Robert E. Hall, professeur à Stanford, et Michael Woodford, de l'université Columbia.",
        "Selon le comité, leurs travaux ont fourni une base théorique stable aux modèles employés aujourd'hui par les banques centrales et les gouvernements du monde entier."],
      ['Comprendre les hauts et les bas de l’économie',
        "Leurs recherches portent sur les mécanismes qui font alterner phases d'expansion et de récession, et sur la manière dont la politique économique peut en limiter les dégâts.",
        "Michael Woodford est connu pour ses travaux sur la politique monétaire et le rôle des anticipations. Robert Hall a consacré une grande partie de sa carrière au marché du travail et aux cycles, et a longtemps présidé le comité américain chargé de dater officiellement les récessions."],
      ['Pourquoi cela concerne aussi la Belgique',
        "Ces outils sont au cœur des décisions des grandes banques centrales, dont la Banque centrale européenne. Ses choix de taux d'intérêt se répercutent directement sur les crédits hypothécaires et l'épargne des ménages belges."],
    ],
    sources: [
      S('CNBC', 'https://www.cnbc.com/2026/10/12/nobel-economics-prize-winner-woodford-hall.html', 'Le Nobel d’économie attribué à Robert E. Hall et Michael Woodford'),
      S('NPR', 'https://www.npr.org/2026/10/12/nx-s1-5996634/last-nobel-prize-of-the-year-to-be-announced-for-economics', 'Le Nobel d’économie à Hall et Woodford pour leurs travaux sur les cycles'),
      S('CNN', 'https://www.cnn.com/2026/10/12/business/nobel-prize-economics-intl', 'Deux Américains récompensés pour des modèles contre les récessions'),
      S('NBC News', 'https://www.nbcnews.com/world/europe/americans-hall-woodford-win-2026-nobel-economics-prize-rcna602928', 'Les Américains Hall et Woodford remportent le Nobel d’économie 2026'),
      S('The Japan Times', 'https://www.japantimes.co.jp/business/2026/10/12/nobel-economics-prize/', 'Robert Hall et Michael Woodford, Nobel d’économie 2026'),
    ],
  }),
  A({
    id: 'ukraine', cat: 'monde', importance: 5, coverage: 4, publishedAt: '2026-10-12T07:00:00Z',
    title: "Ukraine : Trump annonce une trêve sur l'énergie, Kyiv pose ses conditions",
    lede: "Donald Trump affirme que Moscou et Kyiv ont accepté de cesser leurs frappes contre les infrastructures énergétiques. La Maison Blanche nuance, et l'Ukraine signale une nouvelle attaque près de Kharkiv.",
    keyPoints: [
      'Donald Trump annonce un cessez-le-feu sur les frappes visant l’énergie.',
      'La Maison Blanche précise qu’il pourrait ne s’agir que des raffineries de pétrole.',
      'Kyiv suspendra ses frappes si Moscou fait de même ; une centrale de Kharkiv aurait été visée.',
    ],
    sections: [
      ['Une annonce aux contours flous',
        "Donald Trump a affirmé que la Russie et l'Ukraine avaient accepté de cesser de frapper leurs infrastructures énergétiques. Peu après, un responsable de la Maison Blanche a nuancé : le président pourrait avoir voulu parler d'un accord limité aux raffineries de pétrole, rapporte Euronews.",
        'Le président américain a par ailleurs de nouveau pressé les Ukrainiens d’élire un nouveau dirigeant.'],
      ['La réponse de Kyiv',
        "Volodymyr Zelensky assure que l'Ukraine cessera ses frappes contre le secteur énergétique russe si Moscou en fait autant. Mais des responsables ukrainiens ont signalé, après les déclarations de Donald Trump, une frappe russe contre une centrale électrique à Kharkiv.",
        "À l'approche de l'hiver, les réseaux électriques et de chauffage restent l'un des enjeux les plus sensibles du conflit."],
    ],
    sources: [
      S('Euronews', 'https://www.euronews.com/video/2026/10/12/latest-news-bulletin-october-12th-2026-morning', 'Le bulletin d’information du 12 octobre 2026'),
      S('SBS News', 'https://news.sbs.co.kr/english/article.do?news_id=N1008793124', 'Les grandes informations du 12 octobre 2026'),
    ],
  }),
  A({
    id: 'marches', cat: 'finance', importance: 4, publishedAt: '2026-10-12T07:30:00Z',
    title: 'Marchés : une semaine sous le regard de la Fed, les taux européens sous tension',
    lede: "Wall Street a terminé en hausse vendredi après une semaine agitée. Les investisseurs guettent la Réserve fédérale, tandis qu'en Europe la remontée des taux français inquiète.",
    keyPoints: [
      'Wall Street a fini la semaine dans le vert, portée par quelques géants de la tech.',
      'En Europe, l’écart entre les taux français et allemands se creuse.',
      'Le pétrole recule après la promesse du G7 de libérer 100 millions de barils.',
    ],
    sections: [
      ['Wall Street tient bon, mais pas partout',
        "Les marchés américains ont terminé la semaine dernière en hausse après des séances agitées. Les indices masquent toutefois une réalité contrastée : en septembre, 78 % des valeurs du S&P 500 ont reculé, et la progression a été portée par quelques grandes valeurs technologiques."],
      ['Les taux, principal point de tension',
        "En Europe, l'attention se porte sur le marché obligataire. Les rendements des emprunts d'État ont nettement progressé ces dernières semaines et l'écart entre les taux français et allemands s'est creusé : les investisseurs exigent une prime plus élevée pour prêter à la France."],
      ['Le pétrole en repli',
        "Le brut a reculé après l'engagement du G7 de mettre 100 millions de barils sur le marché et la reprise des exportations du Moyen-Orient. Une baisse qui réduit la pression sur l'inflation, et donc sur les taux d'intérêt."],
      ['À suivre cette semaine',
        "Le calendrier est dominé par les signaux de la Réserve fédérale américaine. Aux États-Unis, la confiance des consommateurs s'est encore dégradée en octobre."],
    ],
    sources: [
      S('MoneyVox', 'https://www.moneyvox.fr/bourse/actualites/110681/wall-street-au-sommet-le-journal-de-la-bourse-du-6-octobre-2026', 'Wall Street au sommet… Le journal de la Bourse du 6 octobre 2026'),
      S('Scala Patrimoine', 'https://scala-patrimoine.fr/2026/10/01/le-rendez-vous-des-marches-financiers-et-de-leconomie-octobre-2026/', 'Le rendez-vous des marchés financiers et de l’économie – octobre 2026'),
      S('Bourse Direct', 'https://www.boursedirect.fr/fr/actualites/categorie/calendrier-economique', 'Calendrier économique'),
    ],
  }),
  A({
    id: 'riyad', cat: 'monde', importance: 4, coverage: 3, publishedAt: '2026-10-12T06:00:00Z',
    title: "Arabie saoudite : l'aéroport de Riyad visé pour le deuxième jour consécutif",
    lede: "Une nouvelle attaque attribuée aux rebelles houthis a fait douze victimes supplémentaires. Plusieurs pays condamnent ; Washington envisage d'appuyer une riposte saoudienne.",
    keyPoints: [
      'L’aéroport international de Riyad a été attaqué deux jours de suite.',
      'Douze victimes supplémentaires sont signalées.',
      'La Turquie, le Pakistan, l’Égypte et l’Arabie saoudite condamnent les Houthis.',
    ],
    sections: [
      ['Nouvelle attaque',
        "L'aéroport international de Riyad, la capitale saoudienne, a de nouveau été visé, pour la deuxième journée consécutive, selon la chaîne sud-coréenne SBS. Le bilan fait état de douze victimes supplémentaires."],
      ['Condamnations et risque d’escalade',
        "Les attaques sont attribuées aux rebelles houthis du Yémen, soutenus par l'Iran. La Turquie, le Pakistan, l'Égypte et l'Arabie saoudite les ont condamnées.",
        "À Washington, l'administration Trump dit vouloir maintenir la pression sur Téhéran et envisage de s'impliquer dans les frappes saoudiennes contre les Houthis."],
    ],
    sources: [S('SBS News', 'https://news.sbs.co.kr/english/article.do?news_id=N1008793124', 'Les grandes informations du 12 octobre 2026'), S('Euronews', 'https://www.euronews.com/video/2026/10/12/latest-news-bulletin-october-12th-2026-morning', 'Le bulletin d’information du 12 octobre 2026')],
  }),
  A({
    id: 'coree', cat: 'monde', importance: 4, coverage: 2, publishedAt: '2026-10-11T23:40:00Z',
    title: 'La Corée du Nord tire plusieurs missiles balistiques vers la mer de l’Est',
    lede: 'La présidence sud-coréenne a convoqué en urgence une réunion consacrée à la sécurité nationale après ces tirs.',
    keyPoints: ['Pyongyang a tiré plusieurs missiles balistiques.', 'Séoul a réuni d’urgence ses responsables de la sécurité.'],
    sections: [
      ['Séoul en alerte',
        "La Corée du Nord a lancé plusieurs missiles balistiques en direction de la mer de l'Est, également appelée mer du Japon, selon la chaîne sud-coréenne SBS. Le bureau présidentiel sud-coréen a aussitôt convoqué une réunion d'urgence sur la sécurité nationale.",
        "Les premiers comptes rendus ne détaillent ni le type ni la portée des missiles."],
    ],
    sources: [S('SBS News', 'https://news.sbs.co.kr/english/article.do?news_id=N1008792331', 'Morning Wide : les grandes informations du 12 octobre 2026')],
  }),
  A({
    id: 'petrole', cat: 'economie', importance: 3, publishedAt: '2026-10-06T17:30:00Z',
    title: 'Pétrole : le G7 promet 100 millions de barils pour faire baisser les prix',
    lede: "Le brut recule alors que les exportations du Moyen-Orient repartent et que le G7 s'engage à puiser dans ses réserves. Une détente bienvenue pour l'inflation.",
    keyPoints: ['Le G7 s’engage à libérer 100 millions de barils.', 'Les exportations du Moyen-Orient repartent.', 'Moins de pression sur l’inflation et les taux.'],
    sections: [
      ['Le brut recule',
        "Les cours du pétrole ont reculé début octobre après l'engagement des pays du G7 de mettre 100 millions de barils sur le marché, alors que les exportations du Moyen-Orient se redressent, selon MoneyVox."],
      ['Ce que cela change',
        "Un pétrole moins cher réduit les pressions inflationnistes, ce qui allège à son tour la pression sur les taux d'intérêt. Le 6 octobre, la Bourse de Paris en a profité : le CAC 40 a gagné 0,40 %, à 7 865 points."],
    ],
    sources: [S('MoneyVox', 'https://www.moneyvox.fr/bourse/actualites/110681/wall-street-au-sommet-le-journal-de-la-bourse-du-6-octobre-2026', 'Wall Street au sommet… Le journal de la Bourse du 6 octobre 2026')],
  }),
  A({
    id: 'tech-wallstreet', cat: 'finance', importance: 3, publishedAt: '2026-10-01T08:00:00Z',
    title: 'Wall Street : la tech tient les indices, mais 78 % des valeurs du S&P 500 ont reculé en septembre',
    lede: "Le S&P 500 termine septembre quasi stable et le Nasdaq progresse, portés par Meta, AMD et Intel. La grande majorité des actions a pourtant baissé.",
    keyPoints: ['S&P 500 +0,26 %, Nasdaq +2,9 %, Dow Jones −3,5 % en septembre.', 'Meta, AMD et Intel ont porté la hausse.', '78 % des valeurs du S&P 500 ont pourtant reculé.'],
    sections: [
      ['Une hausse en trompe-l’œil',
        "Le S&P 500 a terminé septembre presque à l'équilibre (+0,26 %), le Nasdaq a progressé de 2,9 % et le Dow Jones a cédé 3,5 %. En Europe, l'Euro Stoxx 50 a reculé de 1,6 %.",
        "La hausse est très concentrée : Meta a gagné 26,7 % sur le mois, AMD 30 % et Intel 34,3 %, alors que 78 % des valeurs du S&P 500 ont fini le mois dans le rouge et que 27 % ont chuté d'au moins 10 %."],
      ['Les obligations, point de tension',
        "Le marché obligataire concentre les inquiétudes, avec une forte hausse des rendements et un écart grandissant entre les dettes française et allemande."],
    ],
    sources: [S('Scala Patrimoine', 'https://scala-patrimoine.fr/2026/10/01/le-rendez-vous-des-marches-financiers-et-de-leconomie-octobre-2026/', 'Le rendez-vous des marchés financiers et de l’économie – octobre 2026')],
  }),
  A({
    id: 'greve-aeroport', cat: 'belgique', importance: 3, publishedAt: '2026-10-12T06:30:00Z',
    title: "Brussels Airport : les vols maintenus, mais rejoindre l'aéroport reste un casse-tête",
    lede: "Aucun impact sur le trafic aérien n'est prévu, mais la grève complique l'accès à Zaventem. Les voyageurs sont invités à prévoir une large marge.",
    keyPoints: ['Pas d’annulations de vols prévues à ce stade.', 'Trains réduits et bus De Lijn perturbés.', 'Prévoir de l’avance avant le départ.'],
    sections: [
      ['Comment s’y rendre',
        "Brussels Airport ne prévoit pas d'annulations liées à la grève des services publics, rapporte Air Journal. Mais rejoindre Zaventem est plus difficile : la SNCB ne fait circuler qu'une partie de ses trains et le réseau De Lijn est perturbé.",
        "Les voyageurs qui partent ce lundi ont intérêt à vérifier leur itinéraire, à envisager un autre moyen de transport et à arriver à l'aéroport avec de l'avance."],
    ],
    sources: [S('Air Journal', 'https://www.air-journal.fr/2026-10-12-greve-du-12-octobre-a-bruxelles-des-vols-prevus-normalement-mais-un-acces-a-laeroport-perturbe-ce-lundi-5278150.html', 'Grève du 12 octobre à Bruxelles : des vols prévus normalement, mais un accès à l’aéroport perturbé')],
  }),
  A({
    id: 'climat', cat: 'belgique', importance: 3, publishedAt: '2026-10-11T13:30:00Z',
    title: 'Marche pour le climat : des dizaines de milliers de personnes dans les rues de Bruxelles',
    lede: 'Les organisateurs revendiquent 60 000 participants, la police en a compté 45 000, à l’approche de la conférence climat COP31.',
    keyPoints: ['60 000 participants selon les organisateurs, 45 000 selon la police.', 'La mobilisation précède la COP31.'],
    sections: [
      ['Une forte mobilisation',
        "Une marche pour le climat a traversé Bruxelles ce week-end, rapporte BX1. Les organisateurs annoncent 60 000 participants, la police en a compté 45 000.",
        "La mobilisation intervient alors que l'Union européenne prépare sa position pour la COP31."],
    ],
    sources: [S('BX1', 'https://bx1.be/', 'BX1, la chaîne d’info de Bruxelles')],
  }),
  A({
    id: 'mineurs', cat: 'faits-divers', importance: 3, publishedAt: '2026-10-11T15:20:00Z',
    title: 'Débordements après la manifestation nationale : des mineurs relâchés faute de place en IPPJ',
    lede: "Des mineurs soupçonnés d'avoir pris part aux violences du 9 octobre à Bruxelles ont été remis en liberté, les institutions de protection de la jeunesse étant saturées.",
    keyPoints: ['Des mineurs interpellés le 9 octobre ont été relâchés.', 'Les IPPJ manquent de places.'],
    sections: [
      ['Faute de place',
        "Après les débordements survenus en marge de la manifestation nationale du vendredi 9 octobre à Bruxelles, plusieurs mineurs interpellés ont été remis en liberté, rapporte BX1. En cause : le manque de places dans les institutions publiques de protection de la jeunesse (IPPJ).",
        "Le manque de capacité de ces institutions est un sujet récurrent en Belgique."],
    ],
    sources: [S('BX1', 'https://bx1.be/', 'BX1, la chaîne d’info de Bruxelles')],
  }),
  A({
    id: 'france-sondage', cat: 'monde', importance: 3, publishedAt: '2026-10-12T05:00:00Z',
    title: 'Présidentielle française : un sondage annonce un second tour Le Pen – Mélenchon',
    lede: "Selon une enquête d'opinion relayée par Euronews, le Rassemblement national et La France insoumise s'affronteraient au second tour. La contestation étudiante bouscule la campagne.",
    keyPoints: ['Un sondage prédit un duel Le Pen – Mélenchon au second tour.', 'La mobilisation étudiante pèse sur la campagne.'],
    sections: [
      ['Un duel annoncé',
        "D'après un sondage relayé par Euronews, la prochaine présidentielle française déboucherait sur un second tour entre Le Pen et Jean-Luc Mélenchon. Euronews souligne aussi que des manifestations étudiantes bousculent la campagne.",
        "Un sondage reste une photographie de l'opinion à un moment donné, à plusieurs mois du scrutin."],
    ],
    sources: [S('Euronews', 'https://www.yahoo.com/news/world/articles/latest-news-bulletin-october-12th-050032352.html', 'Le bulletin d’information du 12 octobre 2026')],
  }),
  A({
    id: 'grippe', cat: 'sante', importance: 3, publishedAt: '2026-10-10T08:00:00Z',
    title: 'Grippe : la vaccination commence, un vaccin renforcé conseillé aux plus de 65 ans',
    lede: 'La vaccination est recommandée de la mi-octobre à la mi-décembre, en priorité pour les seniors, les femmes enceintes et les malades chroniques.',
    keyPoints: ['Se faire vacciner entre la mi-octobre et la mi-décembre.', 'Priorité aux 65 ans et plus, aux femmes enceintes et aux malades chroniques.', 'Un vaccin renforcé est recommandé pour les seniors.'],
    sections: [
      ['Qui doit se faire vacciner',
        "La campagne de vaccination contre la grippe saisonnière démarre. Il est recommandé de se faire vacciner entre la mi-octobre et la mi-décembre, en priorité pour les personnes de 65 ans et plus, les femmes enceintes et les personnes atteintes de maladies chroniques."],
      ['Un vaccin renforcé pour les seniors',
        "Le Conseil supérieur de la santé privilégie désormais, pour les plus de 65 ans, un vaccin renforcé, plus fortement dosé ou avec adjuvant. Selon Test-Achats, il peut être obtenu en pharmacie sans ordonnance."],
    ],
    sources: [S('Test-Achats', 'https://www.test-achats.be/sante/maladies-et-medicaments/apercus-maladies/news/vaccin-renforce-grippe-belgique-2026', 'La Belgique recommande le vaccin renforcé contre la grippe : ce qu’il faut savoir en 3 questions')],
  }),
  A({
    id: 'taiwan', cat: 'monde', importance: 3, publishedAt: '2026-10-12T08:30:00Z',
    title: 'Taïwan : Pékin sanctionne des ministres du Paraguay et du Belize',
    lede: "La Chine frappe de sanctions des membres des gouvernements paraguayen et bélizien, deux des rares pays qui reconnaissent encore Taipei.",
    keyPoints: ['Pékin sanctionne des ministres du Paraguay et du Belize.', 'Ces pays reconnaissent officiellement Taïwan.'],
    sections: [
      ['Pression diplomatique',
        "La Chine a annoncé des sanctions visant des ministres du Paraguay et du Belize en raison de leurs liens avec Taïwan, selon Euronews.",
        "Ces deux pays font partie du petit nombre d'États qui reconnaissent encore officiellement Taipei plutôt que Pékin. La Chine considère Taïwan comme une partie de son territoire et cherche à isoler l'île sur la scène internationale."],
    ],
    sources: [S('Euronews', 'https://www.euronews.com/video/2026/10/12/latest-news-bulletin-october-12th-2026-morning', 'Le bulletin d’information du 12 octobre 2026')],
  }),
  A({
    id: 'couteau', cat: 'faits-divers', importance: 2, publishedAt: '2026-10-09T10:00:00Z',
    title: 'Coup de couteau dans le centre de Bruxelles : la police diffuse un avis de recherche',
    lede: "À la demande du parquet de Bruxelles, la police fédérale publie les images de deux suspects d'une agression au couteau commise en avril.",
    keyPoints: ['Avis de recherche pour deux suspects.', 'Les faits remontent à avril, dans le centre de Bruxelles.'],
    sections: [
      ['Appel à témoins',
        "À la demande du parquet de Bruxelles, la police fédérale a diffusé un avis de recherche concernant deux suspects d'une agression au couteau commise en avril dans le centre de la capitale, rapporte BruxellesToday.",
        'Toute personne qui reconnaîtrait ces individus ou disposerait d’informations est invitée à contacter les enquêteurs.'],
    ],
    sources: [S('BruxellesToday', 'https://www.bruxellestoday.be/faits-divers/agression-couteau-bruxelles-police-recherche-deux-suspects.html', 'Agression au couteau dans le centre de Bruxelles : la police recherche deux suspects')],
  }),
  A({
    id: 'delhi', cat: 'monde', importance: 2, publishedAt: '2026-10-12T06:45:00Z',
    title: 'Inde : Delhi ferme des stations de métro avant une manifestation contre le chef des élections',
    lede: 'Les autorités ont restreint la circulation et fermé plusieurs stations du centre de la capitale indienne.',
    keyPoints: ['Stations de métro fermées et circulation restreinte à Delhi.', 'La manifestation vise le chef de la commission électorale.'],
    sections: [
      ['Mesures de sécurité',
        "Les autorités de Delhi ont fermé plusieurs stations de métro et restreint la circulation avant une manifestation visant le chef de la commission électorale indienne, selon Euronews."],
    ],
    sources: [S('Euronews', 'https://www.euronews.com/video/2026/10/12/latest-news-bulletin-october-12th-2026-morning', 'Le bulletin d’information du 12 octobre 2026')],
  }),
  A({
    id: 'burnout', cat: 'sante', importance: 2, publishedAt: '2026-10-07T09:00:00Z',
    title: 'Burn-out : en Belgique, le parcours du combattant des malades',
    lede: "Un reportage décrit le long chemin administratif et médical imposé aux personnes en burn-out, et le coût d'une absence de longue durée pour les employeurs.",
    keyPoints: ['Les malades décrivent un parcours long et éprouvant.', 'Les absences de longue durée coûtent cher aux employeurs.'],
    sections: [
      ['Un parcours du combattant',
        "Un reportage consacré au burn-out en Belgique suit Lisiane et décrit le chemin, long et complexe, que doivent suivre les personnes en épuisement professionnel pour être reconnues et accompagnées.",
        "Il souligne aussi le coût d'une absence de longue durée pour les employeurs."],
    ],
    sources: [S('Europe Says', 'https://www.europesays.com/be-fr/tag/elite/', 'Lisiane raconte le burn-out et le parcours du combattant que la Belgique impose aux malades')],
  }),
];

const data = {
  generatedAt: '2026-10-12T14:30:00Z',
  edition: 'seed',
  top: ['greve', 'budget', 'nobel', 'ukraine', 'marches', 'riyad', 'coree', 'petrole'],
  markets: [],
  sources: [...new Set(articles.flatMap((a) => a.sources.map((s) => s.source)))].sort(),
  articles,
};

await writeFile(new URL('../data/news.json', import.meta.url), JSON.stringify(data, null, 1));
console.log(`${articles.length} articles écrits`);
