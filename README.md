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
4. récupère le texte complet et une vraie photo des sujets les plus importants (textes chiffrés, voir plus bas) ;
5. traduit titres, résumés et articles complets dans les 5 langues ;
6. ajoute les marchés (BEL 20, CAC 40, Euro Stoxx 50, S&P 500, EUR/USD, Brent, or, bitcoin) ;
7. publie l'application sur GitHub Pages. L'appli ouverte vérifie toutes les 4 minutes s'il y a du nouveau.

GitHub peut décaler un passage planifié de quelques minutes quand ses serveurs sont chargés.

### Articles complets dans l'appli (gratuit, lecture personnelle)

Pour les 80 sujets les plus importants, la tâche récupère le texte complet chez un média qui le publie en accès libre (RTBF, La Libre, franceinfo, BBC…), le traduit en français si besoin, puis le **chiffre** avec ton mot de passe. Le site reste public et gratuit, mais personne ne peut lire ces textes sans le mot de passe.

1. GitHub → **Settings → Secrets and variables → Actions → New repository secret** : nom `JOURNAL_KEY`, valeur = un mot de passe de ton choix.
2. Dans l'appli : **Réglages → Articles complets**, entre le même mot de passe (une seule fois, il reste sur le téléphone).

Sans mot de passe, chaque article s'affiche en « revue de presse » : le résumé et ce qu'en disent les différents médias. Les articles des journaux payants (Le Soir, L'Echo…) restent en revue de presse : on ne contourne pas leurs abonnements.

### Rédaction par Claude (facultatif, payant)

Si un secret `ANTHROPIC_API_KEY` est ajouté, Claude rédige en plus un article original par sujet. Ce n'est pas nécessaire pour utiliser l'appli.

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
