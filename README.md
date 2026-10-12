# Le Journal

L'actualité belge et internationale sur ton téléphone, présentée comme un vrai journal.

- **À la une** : l'heure, la date et la météo de l'endroit où tu te trouves (heure par heure et sur 6 jours), les marchés, puis les infos du jour classées par importance : la manchette, « L'essentiel », une page par rubrique (Belgique, Monde, Économie, Marchés, Santé, Faits divers, Sciences & tech, Sport, Culture) et un fil « En continu ».
- **Flux** : un article par écran, comme TikTok. Tu glisses vers le haut pour le suivant ; un appui ouvre l'article **dans l'application**. Filtres par rubrique, favoris et partage.
- **Lecteur intégré** : chaque article se lit dans l'appli (chapeau, « L'essentiel » en 3 points, intertitres, sources citées en bas, article suivant).
- **Classement par importance** : chaque sujet reçoit une note de 1 à 5 (●●●●●) selon le nombre de médias qui le reprennent, sa fraîcheur, les « unes » des rédactions et tes rubriques prioritaires : Belgique, Économie, Marchés, Monde.
- **5 langues** : français (langue de base), anglais, néerlandais, turc et arabe (affichage de droite à gauche).
- **Réglages** : langue, thème clair/sombre, taille du texte, ville pour la météo, rubriques affichées.
- Fonctionne hors connexion avec la dernière édition et s'installe sur l'écran d'accueil.

## D'où viennent les infos ?

Toutes les 10 minutes, une tâche GitHub Actions (`.github/workflows/edition.yml`) :

1. lit les flux RSS de RTBF, Le Soir, La Libre, L'Avenir, La DH, Sudinfo, 7sur7, VRT NWS, Le Monde, Le Figaro, franceinfo, France 24, Euronews, BBC, The Guardian, CNBC, MarketWatch… (liste dans `scripts/feeds.mjs`) ;
2. traduit les titres étrangers puis regroupe les articles qui parlent du même sujet : plus un sujet est repris par des médias différents, plus il remonte ;
3. note chaque sujet (fraîcheur, « unes » des rédactions, rubriques prioritaires — réglables dans `PRIORITY`) ;
4. **la rédaction** : pour les 60 sujets les plus importants, Claude lit les articles des différents médias et rédige un article original en français (jusqu'à 15 nouveaux par passage, les autres sont gardés en cache) ;
5. traduit titres, résumés et articles complets dans les 5 langues ;
6. ajoute les marchés (BEL 20, CAC 40, Euro Stoxx 50, S&P 500, EUR/USD, Brent, or, bitcoin) ;
7. publie l'application sur GitHub Pages. L'appli ouverte vérifie toutes les 4 minutes s'il y a du nouveau.

GitHub peut décaler un passage planifié de quelques minutes quand ses serveurs sont chargés.

### Activer la rédaction (articles complets)

Sans clé, chaque article s'affiche en mode « revue de presse » : le résumé et ce qu'en disent les différents médias. Pour des articles complets rédigés :

1. crée une clé sur [console.anthropic.com](https://console.anthropic.com) ;
2. GitHub → **Settings → Secrets and variables → Actions → New repository secret** : nom `ANTHROPIC_API_KEY`, valeur = la clé.

Réglages facultatifs (onglet **Variables** au même endroit) : `JOURNAL_MODEL` (par défaut `claude-opus-5-5`), `JOURNAL_EFFORT` (`low` par défaut), `JOURNAL_WRITE_LIMIT` (articles rédigés par passage, 15 par défaut).

Les articles rédigés n'utilisent que les faits des sources, qui sont toujours citées en bas de l'article.
Le dépôt contient une **édition de lancement** (`data/news.json`, générée par `scripts/seed.mjs`) qui sert tant que la première génération automatique n'a pas tourné.

Météo : [Open-Meteo](https://open-meteo.com). Nom de la ville : BigDataCloud. Change : Frankfurter. Bitcoin : CoinGecko. Aucune clé d'API n'est nécessaire.

## Mise en ligne (une seule fois)

1. Sur GitHub : **Settings → Pages → Build and deployment → Source : « GitHub Actions »**.
2. **Actions → Édition automatique → Run workflow**.
3. L'adresse de l'application s'affiche à la fin de la tâche, du type `https://<utilisateur>.github.io/Journal/`.

## Installer sur le téléphone

- **iPhone** (Safari) : Partager → « Sur l'écran d'accueil ».
- **Android** (Chrome) : menu ⋮ → « Installer l'application ».

## En local

```bash
npm install
npm test                 # tests du lecteur RSS, du regroupement, du classement et de la rédaction
npm run news             # génère data/news.json à partir des vrais journaux
npm start                # http://localhost:8080
npm run preview          # dist/preview.html : tout en un seul fichier
```
