# Le Journal

L'actualité belge et internationale sur ton téléphone, présentée comme un vrai journal.

- **À la une** : l'heure, la date et la météo de l'endroit où tu te trouves (heure par heure et sur 6 jours), les marchés, puis les infos du jour classées par importance : la manchette, « L'essentiel », une page par rubrique (Belgique, Monde, Économie, Marchés, Santé, Faits divers, Sciences & tech, Sport, Culture) et un fil « En continu ».
- **Flux** : un article par écran, comme TikTok. Tu glisses vers le haut pour le suivant ; un appui ouvre l'article du journal. Filtres par rubrique, favoris et partage.
- **5 langues** : français (langue de base), anglais, néerlandais, turc et arabe (affichage de droite à gauche).
- **Réglages** : langue, thème clair/sombre, taille du texte, ville pour la météo, rubriques affichées.
- Fonctionne hors connexion avec la dernière édition et s'installe sur l'écran d'accueil.

## D'où viennent les infos ?

Toutes les 30 minutes, une tâche GitHub Actions (`.github/workflows/edition.yml`) :

1. lit les flux RSS de RTBF, Le Soir, La Libre, L'Avenir, La DH, BX1, 7sur7, VRT NWS, The Brussels Times, L'Echo, Le Monde, franceinfo, France 24, Les Echos, BBC… (liste dans `scripts/feeds.mjs`) ;
2. regroupe les articles qui parlent du même sujet : plus un sujet est repris par des médias différents, plus il remonte ;
3. tient compte de la fraîcheur et des « unes » des rédactions pour composer la page ;
4. complète les photos manquantes, traduit titres et résumés dans les 5 langues ;
5. ajoute les marchés (BEL 20, CAC 40, Euro Stoxx 50, S&P 500, EUR/USD, Brent, or, bitcoin) ;
6. publie l'application sur GitHub Pages.

Chaque article renvoie vers le site du journal qui l'a publié.
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
npm test                 # tests du lecteur RSS et du regroupement
npm run news             # génère data/news.json à partir des vrais journaux
npm start                # http://localhost:8080
npm run preview          # dist/preview.html : tout en un seul fichier
```
