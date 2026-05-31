# Peagle — Refonte propre

> Refonte complète de l'app Peagle (jeu type Peggle) sur une base saine,
> simple, et extensible, pensée pour servir de socle à un **rogue-lite**.

Ce dossier contient le **cahier des charges** et **l'architecture cible**
avant écriture de la moindre ligne de jeu. On valide ça, puis on code.

## Documents

| Fichier | Contenu |
|---|---|
| [`00-cahier-des-charges.md`](./00-cahier-des-charges.md) | Vision, périmètre v1, règles du jeu, game feel, identité « oiseau » |
| [`01-architecture.md`](./01-architecture.md) | Découpage en couches, modèle de données, boucle de jeu, points d'extension rogue-lite |
| [`02-roadmap.md`](./02-roadmap.md) | Phases d'implémentation, ordre de migration, critères de « fait » |

## Décisions cadrées (validées)

1. **Table rase** — nouveau dossier propre, code de jeu écrit de zéro.
   L'ancien `src/apps/peagle/` reste en référence jusqu'à bascule, puis supprimé.
2. **Périmètre v1 = Peggle + squelette rogue-lite** — coeur Peggle jouable +
   points d'extension rogue-lite déjà câblés (enchaînement de niveaux, choix
   d'upgrade entre niveaux) avec seulement 1–2 upgrades d'exemple.
3. **Physique custom légère** maison — gravité + collisions cercle/cercle,
   isolée et testable, zéro dépendance.
4. **Esprit oiseau conservé** — on récupère les pixel-arts existants
   (skins oiseaux, icônes, thèmes) et on en fait des assets propres et
   réutilisables. Le jeu de mots Peagle (peg + eagle) reste central.

## Pourquoi une refonte

L'app actuelle fait ~10 500 lignes avec une dette structurelle nette :

- **Physique monolithique** : `state/ball.ts` (385 l.) gère substeps, gravité,
  murs, tous les types de pegs, tout le décor, le seau, et les « saves »
  spéciaux dans une seule fonction. Impossible à tester ou faire évoluer.
- **State dupliqué** : `runStateRef` (React) et `GameState` (moteur) gardent
  chacun une copie des upgrades/relics → désyncs.
- **Couplage moteur ↔ renderer ↔ React** fort : le renderer lit directement
  toute la structure `GameState`, ajouter un effet visuel oblige à toucher la
  physique (`trauma`, `flashWhite`…).
- **Mécaniques rogue-lite hardcodées** : dispatch des power-ups verts et des
  upgrades par chaînes de `if`/`switch`, non extensible sans toucher au coeur.
- **`PegIcon.tsx` = 1339 lignes** de `switch` ; `background.ts` = 867 lignes.

La cible inverse ces problèmes : **un coeur de jeu pur (sans React),
data-driven, piloté par événements, avec des points d'extension explicites.**
