// Sources du journal.
// weight : poids éditorial de la source (1 = référence).
// top    : flux "à la une" d'un média — ses articles reçoivent un bonus d'importance.
// Les flux qui ne répondent pas sont simplement ignorés lors de la génération.

const GNQ = (q) => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=fr&gl=BE&ceid=BE:fr`;

const GN = (topic) =>
  topic
    ? `https://news.google.com/rss/headlines/section/topic/${topic}?hl=fr&gl=BE&ceid=BE:fr`
    : 'https://news.google.com/rss?hl=fr&gl=BE&ceid=BE:fr';

export const FEEDS = [
  // ——— Belgique ———
  { source: 'RTBF', cat: null, region: 'be', lang: 'fr', weight: 1.0, top: true, url: 'https://rss.rtbf.be/article/rss/highlight_rtbf_info.xml' },
  { source: 'La Libre', cat: 'belgique', lang: 'fr', weight: 0.95, url: 'https://www.lalibre.be/arc/outboundfeeds/rss/section/belgique/?outputType=xml' },
  { source: 'La Libre', cat: null, region: 'be', lang: 'fr', weight: 0.95, top: true, url: 'https://www.lalibre.be/arc/outboundfeeds/rss/?outputType=xml' },
  { source: "L'Avenir", cat: null, region: 'be', lang: 'fr', weight: 0.85, url: 'https://www.lavenir.net/arc/outboundfeeds/rss/?outputType=xml' },
  { source: 'La DH', cat: null, region: 'be', lang: 'fr', weight: 0.8, url: 'https://www.dhnet.be/arc/outboundfeeds/rss/?outputType=xml' },
  { source: '7sur7', cat: 'belgique', lang: 'fr', weight: 0.75, url: 'https://www.7sur7.be/belgique/rss.xml' },
  { source: 'VRT NWS', cat: null, region: 'be', lang: 'nl', weight: 0.85, url: 'https://www.vrt.be/vrtnws/nl.rss.articles.xml' },
  { source: 'Google Actualités', cat: null, region: 'be', lang: 'fr', weight: 0.6, top: true, aggregator: true, url: GN('NATION') },
  { source: 'Google Actualités', cat: null, lang: 'fr', weight: 0.6, top: true, aggregator: true, url: GN() },

  // ——— Local : Charleroi et Châtelet (articles gardés 7 jours, l'actu locale est plus rare) ———
  { source: 'Google Actualités', cat: 'charleroi', region: 'be', local: true, lang: 'fr', weight: 0.7, aggregator: true, maxAgeH: 168, url: GNQ('Charleroi when:7d') },
  { source: 'Google Actualités', cat: 'charleroi', region: 'be', local: true, lang: 'fr', weight: 0.7, aggregator: true, maxAgeH: 168, url: GNQ('Gosselies OR Marcinelle OR Jumet OR Gilly OR Montignies-sur-Sambre OR Marchienne-au-Pont OR Couillet OR Ransart OR Lodelinsart OR Dampremy when:7d') },
  { source: 'Google Actualités', cat: 'chatelet', region: 'be', local: true, lang: 'fr', weight: 0.7, aggregator: true, maxAgeH: 168, url: GNQ('Châtelet Charleroi OR Châtelineau OR Bouffioulx when:7d') },
  { source: 'La DH', cat: 'charleroi', region: 'be', local: true, lang: 'fr', weight: 0.85, maxAgeH: 168, url: 'https://www.dhnet.be/arc/outboundfeeds/rss/section/regions/charleroi/?outputType=xml' },
  { source: 'La Nouvelle Gazette', cat: 'charleroi', region: 'be', local: true, lang: 'fr', weight: 0.85, maxAgeH: 168, url: 'https://www.lanouvellegazette.be/rss2/2/cible_principale' },
  { source: 'Télésambre', cat: 'charleroi', region: 'be', local: true, lang: 'fr', weight: 0.85, maxAgeH: 168, url: 'https://www.telesambre.be/rss.xml' },
  { source: 'RTBF', cat: 'charleroi', region: 'be', local: true, lang: 'fr', weight: 0.9, maxAgeH: 168, url: 'https://rss.rtbf.be/article/rss/highlight_rtbf_regions_hainaut.xml' },

  // ——— Monde ———
  { source: 'Le Monde', cat: null, lang: 'fr', weight: 1.0, top: true, url: 'https://www.lemonde.fr/rss/une.xml' },
  { source: 'Le Monde', cat: 'monde', lang: 'fr', weight: 1.0, url: 'https://www.lemonde.fr/international/rss_full.xml' },
  { source: 'France 24', cat: 'monde', lang: 'fr', weight: 0.9, url: 'https://www.france24.com/fr/rss' },
  { source: 'franceinfo', cat: 'monde', lang: 'fr', weight: 0.9, url: 'https://www.francetvinfo.fr/monde.rss' },
  { source: 'franceinfo', cat: null, lang: 'fr', weight: 0.9, top: true, url: 'https://www.francetvinfo.fr/titres.rss' },
  { source: 'La Libre', cat: 'monde', lang: 'fr', weight: 0.9, url: 'https://www.lalibre.be/arc/outboundfeeds/rss/section/international/?outputType=xml' },
  { source: 'BBC News', cat: 'monde', lang: 'en', weight: 0.95, top: true, url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { source: 'Le Figaro', cat: 'monde', lang: 'fr', weight: 0.9, url: 'https://www.lefigaro.fr/rss/figaro_international.xml' },
  { source: 'Euronews', cat: 'monde', lang: 'fr', weight: 0.85, url: 'https://fr.euronews.com/rss?level=theme&name=news' },
  { source: 'The Guardian', cat: 'monde', lang: 'en', weight: 0.85, url: 'https://www.theguardian.com/world/rss' },
  { source: 'Google Actualités', cat: 'monde', lang: 'fr', weight: 0.6, aggregator: true, url: GN('WORLD') },

  // ——— Économie ———
  { source: 'Le Monde', cat: 'economie', lang: 'fr', weight: 0.95, url: 'https://www.lemonde.fr/economie/rss_full.xml' },
  { source: 'La Libre', cat: 'economie', lang: 'fr', weight: 0.9, url: 'https://www.lalibre.be/arc/outboundfeeds/rss/section/economie/?outputType=xml' },
  { source: 'franceinfo', cat: 'economie', lang: 'fr', weight: 0.85, url: 'https://www.francetvinfo.fr/economie.rss' },
  { source: 'BBC News', cat: 'economie', lang: 'en', weight: 0.85, url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
  { source: 'Le Figaro', cat: 'economie', lang: 'fr', weight: 0.9, url: 'https://www.lefigaro.fr/rss/figaro_economie.xml' },
  { source: 'France 24', cat: 'economie', lang: 'fr', weight: 0.85, url: 'https://www.france24.com/fr/%C3%A9co-tech/rss' },
  { source: '20 Minutes', cat: 'economie', lang: 'fr', weight: 0.75, url: 'https://www.20minutes.fr/feeds/rss-economie.xml' },
  { source: 'The Guardian', cat: 'economie', lang: 'en', weight: 0.85, url: 'https://www.theguardian.com/business/rss' },
  { source: 'Euronews', cat: 'economie', lang: 'fr', weight: 0.8, url: 'https://fr.euronews.com/rss?level=theme&name=business' },
  { source: 'La DH', cat: 'economie', lang: 'fr', weight: 0.75, url: 'https://www.dhnet.be/arc/outboundfeeds/rss/section/actu/economie/?outputType=xml' },
  { source: 'Google Actualités', cat: 'economie', lang: 'fr', weight: 0.6, aggregator: true, url: GN('BUSINESS') },

  // ——— Finance & marchés ———
  { source: 'Le Figaro', cat: 'finance', lang: 'fr', weight: 0.9, url: 'https://www.lefigaro.fr/rss/figaro_bourse.xml' },
  { source: 'Le Figaro', cat: 'finance', lang: 'fr', weight: 0.85, url: 'https://www.lefigaro.fr/rss/figaro_placement.xml' },
  { source: 'Investing.com', cat: 'finance', lang: 'fr', weight: 0.8, url: 'https://fr.investing.com/rss/news.rss' },
  { source: 'MarketWatch', cat: 'finance', lang: 'en', weight: 0.85, url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories' },
  { source: 'CNBC', cat: 'finance', lang: 'en', weight: 0.9, url: 'https://www.cnbc.com/id/15839069/device/rss/rss.html' },
  { source: 'The Guardian', cat: 'finance', lang: 'en', weight: 0.85, url: 'https://www.theguardian.com/business/stock-markets/rss' },
  { source: 'Le Monde', cat: 'finance', lang: 'fr', weight: 0.85, url: 'https://www.lemonde.fr/argent/rss_full.xml' },

  // ——— Santé ———
  { source: 'Le Monde', cat: 'sante', lang: 'fr', weight: 0.95, url: 'https://www.lemonde.fr/sante/rss_full.xml' },
  { source: 'franceinfo', cat: 'sante', lang: 'fr', weight: 0.9, url: 'https://www.francetvinfo.fr/sante.rss' },
  { source: 'BBC News', cat: 'sante', lang: 'en', weight: 0.8, url: 'https://feeds.bbci.co.uk/news/health/rss.xml' },
  { source: 'Google Actualités', cat: 'sante', lang: 'fr', weight: 0.6, aggregator: true, url: GN('HEALTH') },

  // ——— Faits divers ———
  { source: 'franceinfo', cat: 'faits-divers', lang: 'fr', weight: 0.85, url: 'https://www.francetvinfo.fr/faits-divers.rss' },
  { source: 'La DH', cat: 'faits-divers', lang: 'fr', weight: 0.85, url: 'https://www.dhnet.be/arc/outboundfeeds/rss/section/actu/faits/?outputType=xml' },
  { source: '7sur7', cat: 'faits-divers', lang: 'fr', weight: 0.75, url: 'https://www.7sur7.be/faits-divers/rss.xml' },

  // ——— Sciences & tech ———
  { source: 'Le Monde', cat: 'tech', lang: 'fr', weight: 0.9, url: 'https://www.lemonde.fr/sciences/rss_full.xml' },
  { source: 'Le Monde', cat: 'tech', lang: 'fr', weight: 0.9, url: 'https://www.lemonde.fr/pixels/rss_full.xml' },
  { source: 'franceinfo', cat: 'tech', lang: 'fr', weight: 0.8, url: 'https://www.francetvinfo.fr/sciences.rss' },
  { source: 'Numerama', cat: 'tech', lang: 'fr', weight: 0.75, url: 'https://www.numerama.com/feed/' },
  { source: 'Google Actualités', cat: 'tech', lang: 'fr', weight: 0.55, aggregator: true, url: GN('TECHNOLOGY') },

  // ——— Sport ———
  { source: 'RTBF Sport', cat: 'sport', lang: 'fr', weight: 0.9, url: 'https://rss.rtbf.be/article/rss/highlight_rtbf_sport.xml' },
  { source: 'La DH', cat: 'sport', lang: 'fr', weight: 0.85, url: 'https://www.dhnet.be/arc/outboundfeeds/rss/section/sports/?outputType=xml' },
  { source: "L'Équipe", cat: 'sport', lang: 'fr', weight: 0.85, url: 'https://dwh.lequipe.fr/api/edito/rss?path=/' },

  // ——— Culture ———
  { source: 'Le Monde', cat: 'culture', lang: 'fr', weight: 0.85, url: 'https://www.lemonde.fr/culture/rss_full.xml' },
  { source: 'franceinfo', cat: 'culture', lang: 'fr', weight: 0.8, url: 'https://www.francetvinfo.fr/culture.rss' },
];

// Rubriques prioritaires : multiplicateur appliqué au score d'importance.
// Belgique, économie, finance et monde passent devant le reste.
export const PRIORITY = {
  chatelet: 1.5,
  charleroi: 1.45,
  belgique: 1.4,
  economie: 1.35,
  finance: 1.35,
  monde: 1.25,
  sante: 0.9,
  'faits-divers': 0.85,
  tech: 0.85,
  sport: 0.7,
  culture: 0.7,
};

// Marchés suivis (Yahoo Finance, côté serveur)
export const MARKETS = [
  { id: 'bel20', label: 'BEL 20', symbol: '^BFX', kind: 'index' },
  { id: 'cac40', label: 'CAC 40', symbol: '^FCHI', kind: 'index' },
  { id: 'stoxx50', label: 'Euro Stoxx 50', symbol: '^STOXX50E', kind: 'index' },
  { id: 'sp500', label: 'S&P 500', symbol: '^GSPC', kind: 'index' },
  { id: 'nasdaq', label: 'Nasdaq', symbol: '^IXIC', kind: 'index' },
  { id: 'eurusd', label: 'EUR/USD', symbol: 'EURUSD=X', kind: 'fx', digits: 4 },
  { id: 'brent', label: 'Brent', symbol: 'BZ=F', kind: 'commodity', unit: '$' },
  { id: 'gold', label: 'Or', symbol: 'GC=F', kind: 'commodity', unit: '$' },
  { id: 'btc', label: 'Bitcoin', symbol: 'BTC-EUR', kind: 'crypto', unit: '€' },
];

// Mots-clés permettant de classer un article venu d'un flux généraliste.
// Un mot « fort » compte double : un seul suffit à classer l'article.
export const STRONG_HINTS = {
  sport: ['football', 'tennis', 'cycliste', 'cyclisme', 'diables rouges', 'red flames', 'ligue des champions', 'formule 1', 'grand prix', 'pro league', 'mondial de football', 'sélectionneur', 'buteur', 'tour de france', 'roland-garros', 'atp', 'wta', 'jeux olympiques', 'basket', 'hockey', 'rugby', 'marathon', 'champion du monde', 'anderlecht', 'club brugge', 'standard de liège'],
  'faits-divers': ['blessé par balle', 'blessés par balles', 'blessé par balles', 'meurtre', 'assassinat', 'fusillade', 'poignardé', 'coup de couteau', 'incendie', 'cambriolage', 'braquage', 'homicide', 'féminicide', 'disparition inquiétante', 'retrouvé mort', 'retrouvée morte', 'cour d\'assises', 'arrestations judiciaires', 'interpellé', 'interpellés', 'garde à vue', 'violé', 'viol', 'accident de la route', 'collision'],
  sante: ['cancer', 'vaccin', 'vaccination', 'hôpital', 'hôpitaux', 'épidémie', 'maladie', 'médecins', 'patients', 'grippe', 'covid', 'alzheimer', 'santé mentale', 'diabète', 'infirmiers'],
  finance: ['bourse', 'cac 40', 'bel 20', 'wall street', 'nasdaq', 's&p 500', 'dow jones', 'bitcoin', 'cryptomonnaie', 'bce', 'banque centrale', 'réserve fédérale', 'taux directeur', 'obligations', 'actionnaires', 'introduction en bourse', 'stoxx'],
  economie: ["nobel d'économie", 'inflation', 'pib', 'chômage', 'licenciements', 'faillite', 'droits de douane', 'prix de l\'essence', 'prix du gasoil', 'pouvoir d\'achat', 'salaires', 'croissance économique', 'récession', 'budget'],
  culture: ['festival de', 'cinéma', 'exposition', 'musée'],
};

export const CATEGORY_HINTS = {
  'faits-divers': ['meurtre', 'assassinat', 'agression', 'incendie', 'accident', 'fusillade', 'interpellé', 'suspect', 'parquet', 'braquage', 'disparition', 'poignard', 'tué', 'blessé grave', 'police judiciaire', 'cambriolage', 'procès', 'cour d\'assises', 'noyade', 'collision'],
  sante: ['santé', 'hôpital', 'médecin', 'vaccin', 'cancer', 'virus', 'épidémie', 'maladie', 'patients', 'soins', 'grippe', 'covid', 'oms', 'inami', 'mutuelle', 'sciensano', 'alzheimer', 'diabète'],
  finance: ['bourse', 'cac 40', 'bel 20', 'wall street', 'nasdaq', 'action', 'obligations', 'taux', 'bce', 'fed', 'bitcoin', 'crypto', 'dividende', 'banque centrale', 'euro dollar'],
  economie: ['économie', 'inflation', 'pib', 'emploi', 'chômage', 'budget', 'entreprise', 'industrie', 'croissance', 'salaires', 'faillite', 'licenciement', 'commerce', 'tarifs douaniers', 'pétrole', 'énergie', 'nobel d\'économie'],
  sport: ['football', 'diables rouges', 'ligue des champions', 'tennis', 'cyclisme', 'formule 1', 'jupiler pro league', 'anderlecht', 'standard', 'club brugge', 'tour de france', 'basket', 'jeux olympiques'],
  tech: ['intelligence artificielle', ' ia ', 'openai', 'apple', 'google', 'smartphone', 'espace', 'nasa', 'esa', 'climat', 'scientifiques', 'chercheurs', 'cyberattaque', 'tech'],
  culture: ['film', 'cinéma', 'festival', 'musique', 'concert', 'livre', 'exposition', 'musée', 'série', 'chanteur', 'théâtre'],
};

// ——— Communes locales ———
// Châtelet (entité) : Châtelet, Châtelineau, Bouffioulx.
// Charleroi (entité) : les 15 anciennes communes fusionnées en 1977.
export const LOCAL = {
  chatelet: {
    places: ['Châtelet', 'Châtelineau', 'Bouffioulx'],
    // le Châtelet parisien n'a rien à voir
    exclude: [/du Châtelet/i, /Châtelet[- ]les[- ]Halles/i, /Châtelet[- ]en[- ]Brie/i, /Le Châtelet\b/],
  },
  charleroi: {
    places: [
      'Charleroi', 'Carolo', 'Carolos', 'Couillet', 'Dampremy', 'Gilly', 'Gosselies', 'Goutroux', 'Jumet',
      'Lodelinsart', 'Marchienne-au-Pont', 'Marchienne', 'Marcinelle', 'Monceau-sur-Sambre',
      'Montignies-sur-Sambre', 'Mont-sur-Marchienne', 'Ransart', 'Roux', 'Spiroudome',
    ],
    exclude: [],
  },
};
