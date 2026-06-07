export const PEAGLE_CURRENT_VERSION = "0.4.2";

export interface PeagleRelease {
  version: string;
  releasedAt: string;
  notes: string[];
}

export const PEAGLE_VERSIONS: PeagleRelease[] = [
  {
    version: "0.4.2",
    releasedAt: "2026-06-07",
    notes: [
      "Changelog et Instructions : mêmes fenêtres en « carte forêt » que le menu OPTIONS, sans barre de titre — titre et version posés directement en tête",
      "Changelog : versions séparées par un filet discret, mise en page allégée et plus aérée, barre de défilement masquée",
      "« Notes de mise à jour » renommé CHANGELOG partout dans l'UI",
      "Boutons unifiés sur le style « peg » du menu principal partout : gros peg orange pour l'action principale, pegs verts pour le reste, actions discrètes atténuées",
    ],
  },
  {
    version: "0.4.1",
    releasedAt: "2026-06-07",
    notes: [
      "Menu principal : nouveaux boutons « peg » qui rebondissent en apparaissant, secondaires regroupés sous JOUER",
      "Pause : refonte des boutons — REPRENDRE en gros peg orange, accès aux OPTIONS, astuce déplacée tout en bas",
      "Game over : boutons empilés (REJOUER, CLASSEMENT, MENU) avec REJOUER en peg orange, bulle de l'aigle au-dessus de sa tête",
      "Choix de bonus : cartes refaites avec couleur de rareté et bouton PASSER plus clair",
      "Instructions : textes resserrés et plus directs, carte aux coins arrondis",
      "En partie : le seed s'affiche dans une petite puce discrète, cliquable pour le copier",
      "Effets Scanlines et Pixel appliqués d'un seul coup sur tout l'écran, jeu et menus",
      "Décor : logo-titre plus net, lune et soleil déplacés à gauche avec halos et reflets adoucis",
      "Le classement ne fait plus planter le jeu quand le serveur est indisponible",
      "Allègement des petits glyphes décoratifs (flèches, étoiles, engrenages) dans les titres et boutons",
    ],
  },
  {
    version: "0.4.0",
    releasedAt: "2026-06-07",
    notes: [
      "Menu OPTIONS unique, partagé entre le menu principal et la pause (« RÉGLAGES » renommé OPTIONS)",
      "Options : effets Scanlines et Pixel, désactivés par défaut, appliqués sur tout l'écran (jeu et menus)",
      "Options : saisie d'un seed pour lancer une partie depuis le menu principal",
      "En partie, les Options affichent la seed en cours en lecture seule avec un bouton COPIER (plus de saisie au milieu d'un run)",
      "Le seed est aussi affiché en partie via une puce cliquable pour le copier",
      "Réglages visuels mémorisés entre les parties",
    ],
  },
  {
    version: "0.3.7",
    releasedAt: "2026-06-07",
    notes: [
      "Pause : encart ASTUCE aux coins arrondis pour rester cohérent avec le reste de l'UI",
      "Pause & game over : astuce déplacée tout en bas, après les boutons",
      "Choix de bonus : menu refait à la charte (carte diégétique façon Réglages, fin du thème doré)",
      "Dev Tools : bouton CHOIX DE BONUS pour afficher l'écran de bonus à la demande",
    ],
  },
  {
    version: "0.3.6",
    releasedAt: "2026-06-07",
    notes: [
      "Réglages : en-tête supprimé pour un panneau plus épuré et moderne",
      "Menu principal : CLASSEMENT, INSTRUCTIONS et RÉGLAGES rapprochés de JOUER",
      "Boutons phares agrandis : JOUER, REPRENDRE et REJOUER plus gros et plus présents",
    ],
  },
  {
    version: "0.3.5",
    releasedAt: "2026-06-07",
    notes: [
      "Réglages : panneau redessiné dans la DA du jeu (carte forêt + titre sur feuille), fini le look « fenêtre OS »",
    ],
  },
  {
    version: "0.3.4",
    releasedAt: "2026-06-07",
    notes: [
      "Menu principal : CLASSEMENT, INSTRUCTIONS et RÉGLAGES regroupés et détachés de JOUER",
    ],
  },
  {
    version: "0.3.3",
    releasedAt: "2026-06-07",
    notes: [
      "Boutons identiques à ceux du menu principal partout (pause, game over, fenêtres)",
      "Pause et game over : même layout, boutons empilés à largeur égale",
      "Bouton principal (Reprendre / Rejouer) en peg orange, comme Jouer du menu",
      "Correction du clignotement quand le curseur effleurait le bas d'un bouton",
      "Pegs du jeu aux coins arrondis (pixel-art), en cohérence avec les boutons",
      "Décor harmonisé : soleil, lune et sapins aux coins arrondis comme le reste",
      "Reflet pixel « en L » ajouté au soleil, à la lune et aux arbres, comme sur les pegs",
      "Soleil et lune déplacés à gauche, en accord avec leur reflet en haut-gauche",
      "Tous les halos (pegs, glow clutch, particules, astres, œuf de visée) aux coins arrondis",
      "Nuages du décor et lune du menu adoucis aux coins, pour l'unité visuelle",
      "Titre du menu en plus haute définition et plus gras, coins de lettres adoucis proprement",
      "Libellés épurés : suppression des pictogrammes en tête de boutons et de titres",
    ],
  },
  {
    version: "0.3.2",
    releasedAt: "2026-06-07",
    notes: [
      "Bouton INSTRUCTIONS dans le menu principal — règles complètes du jeu",
      "Astuces aléatoires sur l'écran de chargement (★ ASTUCE)",
      "Astuce contextuelle dans le menu pause",
      "Astuce en bas de l'écran game over avant les boutons d'action",
    ],
  },
  {
    version: "0.3.1",
    releasedAt: "2026-06-07",
    notes: [
      "Combos affichés à côté du peg éclaté, en diagonale — au plus près de l'action, sans gêner",
      "Textes de jeu à la charte : police pixel arcade (combos) + VT323 (scores)",
      "Lexique combo retravaillé sur le thème aigle/rapace (adieu JUICY!/ŒUFTASTIQUE!)",
      "Nouveau son de palier de combo : arpège pixel ascendant qui escalade avec le multiplicateur",
      "Width-fit auto : aucun mot ne déborde plus du cadre",
    ],
  },
  {
    version: "0.3.0",
    releasedAt: "2026-06-06",
    notes: [
      "Rework complet des textes flottants : plus diegésiques et lisibles",
      "Exclamations (JUICY!, TASTY!…) : pixel burst + dérive latérale organique",
      "Box combo → badge banner sombre avec bandes colorées",
      "Multiplicateur ×N affiché en doré dans les scores",
      "Overlay patch notes in-game depuis le menu principal",
    ],
  },
  {
    version: "0.2.0",
    releasedAt: "2026-06-06",
    notes: [
      "L'aigle a maintenant une vraie personnalité — il panique en mode clutch et suit ton œuf des yeux",
      "Vide tout le tableau ? Bonus énorme : 10 000 × le numéro du niveau",
      "Enchaîne les rattrapages au panier pour des bonus en série",
      "Les bumpers renvoient l'œuf avec beaucoup plus de patate",
      "La musique s'adapte en temps réel — ambiance calme, fever, ou game over, tout s'enchaîne proprement",
      "Les scores et les coups explosent à l'écran avec du style",
      "Le classement s'affiche directement sur l'écran de fin — tu sais où tu en es sans quitter le jeu",
      "Saisis un code de 6 caractères pour rejouer exactement le même niveau qu'un autre joueur",
      "La forêt s'anime différemment selon l'heure — lucioles le soir, soleil le matin",
      "Le jeu tourne bien plus fluide qu'avant",
    ],
  },
  {
    version: "0.1.0",
    releasedAt: "2026-05-01",
    notes: [
      "Première version de Peagle 98",
      "Lance des œufs, touche les pegs oranges pour gagner",
      "Choisis une amélioration entre chaque niveau",
      "Ton score va dans le classement mondial",
    ],
  },
];
