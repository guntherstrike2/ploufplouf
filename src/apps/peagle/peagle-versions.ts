export const PEAGLE_CURRENT_VERSION = "0.5.1";

export interface PeagleRelease {
  version: string;
  releasedAt: string;
  notes: string[];
}

export const PEAGLE_VERSIONS: PeagleRelease[] = [
  {
    version: "0.5.1",
    releasedAt: "2026-06-10",
    notes: [
      "Musiques compressées : environ 6 Mo de téléchargement en moins, sans perte audible",
      "Classement : requêtes accélérées côté serveur (index en base de données)",
      "L'envoi du score signale désormais les échecs réseau et peut être retenté au game over suivant",
      "Les cris d'aigle ne sont plus téléchargés quand le son est coupé",
      "Optimisations mineures du rendu des textes flottants",
    ],
  },
  {
    version: "0.5.0",
    releasedAt: "2026-06-10",
    notes: [
      "Nouveau score « bleu × orange » : les pegs normaux comptent les points, les cibles oranges montent un multiplicateur — le tour est versé d'un coup en fin de manche",
      "Le multiplicateur orange se conserve d'un tour à l'autre tant que vous rattrapez l'œuf au panier, et se brise dès qu'un œuf sort de l'écran : risque contre récompense",
      "Versement de fin de tour spectaculaire : les bonus (série, jackpot, tableau vidé, œufs restants) défilent en or puis le compteur s'égrène jusqu'au total, avec son de comptage qui accélère",
      "HUD entièrement refait façon flipper : grand afficheur plasma à points au centre qui joue des mini-animations sur chaque moment fort (série, frenzy, clutch, jackpot, record, niveau gagné, game over)",
      "Bonus de SÉRIE de paniers : enchaîner les rattrapages qualifiants rapporte un bonus croissant et des œufs supplémentaires",
      "Inserts façon flipper autour de l'afficheur (cibles, œufs, niveau) qui s'allument sur leur événement, plus un bouton pause dédié",
      "Menu principal : boutons « peg » redessinés et rendus en canvas, qui réagissent à l'œuf qui tape le titre",
      "Textes du jeu passés en anglais : astuces, mots de combo et répliques de l'aigle",
      "Décor : forêt et ambiance de coucher de soleil avant le mode clutch retravaillées",
    ],
  },
  {
    version: "0.4.2",
    releasedAt: "2026-06-08",
    notes: [
      "Options : nouveau réglage TREMBLEMENT pour activer ou couper le tremblement d'écran aux impacts (activé par défaut)",
      "Décor : forêt entièrement repeinte — couleurs adoucies (fini le vert fluo), collines, arbres, herbe et nuages plus variés, feuilles qui dérivent dans l'air, soleil et halo plus doux",
      "Décor : le panier est redessiné comme un bloc plat posé au sol, dans la charte pixel, et se compresse à la réception d'une bille",
      "Intro de niveau : les pegs apparaissent selon un motif tiré au hasard à chaque partie (diagonale, spirale, serpent, depuis le centre, confettis…) — le pop de chaque peg respire un peu plus",
      "Impacts plus percutants : ondes de choc qui voyagent plus loin et grandissent avec les gros combos, éclats de couleur et micro-arrêt sur les coups marquants",
    ],
  },
  {
    version: "0.4.1",
    releasedAt: "2026-06-07",
    notes: [
      "Pause & game over : contenu posé dans une carte « forêt » encadrée, comme le menu OPTIONS, au lieu de flotter à l'écran",
      "Pause : l'aigle suit désormais le curseur du regard",
      "Décor : ciel de la forêt adouci en dégradé bleu, suppression des rayons de soleil",
      "Classement : lignes et surbrillance du joueur retaillées à la charte pixel",
    ],
  },
  {
    version: "0.4.0",
    releasedAt: "2026-06-07",
    notes: [
      "Menu OPTIONS unique, partagé entre le menu principal et la pause (« RÉGLAGES » renommé OPTIONS), redessiné dans la DA du jeu — carte forêt, fini le look « fenêtre OS »",
      "Options : effets Scanlines et Pixel (désactivés par défaut) appliqués d'un seul coup sur tout l'écran, jeu et menus ; réglages mémorisés entre les parties",
      "Options : saisie d'un seed pour lancer une partie depuis le menu ; en partie, la seed en cours s'affiche en lecture seule avec un bouton COPIER",
      "Boutons unifiés sur le style « peg » du menu principal partout (menu, pause, game over, fenêtres) : gros peg orange qui rebondit pour l'action principale (JOUER / REPRENDRE / REJOUER), pegs verts pour le reste, actions discrètes atténuées",
      "Menu principal : CLASSEMENT, INSTRUCTIONS et OPTIONS regroupés et détachés de JOUER",
      "Pause & game over : même layout, boutons empilés à largeur égale, astuce déplacée tout en bas après les boutons",
      "Game over : bulle de l'aigle placée au-dessus de sa tête",
      "Changelog et Instructions : mêmes fenêtres « carte forêt » que le menu OPTIONS, sans barre de titre — titre et version en tête, mise en page aérée, barre de défilement masquée",
      "« Notes de mise à jour » renommé CHANGELOG partout dans l'UI",
      "Choix de bonus : menu refait à la charte (carte diégétique, fin du thème doré), cartes avec couleur de rareté et bouton PASSER plus clair",
      "Instructions : textes resserrés et plus directs",
      "Décor : logo-titre en plus haute définition et plus net, soleil et lune déplacés à gauche avec halos et reflets adoucis ; pegs, astres, sapins et halos aux coins arrondis pour l'unité visuelle",
      "Allègement des petits glyphes décoratifs (flèches, étoiles, engrenages) dans les titres et boutons",
      "Correction du clignotement quand le curseur effleurait le bas d'un bouton",
      "Le classement ne fait plus planter le jeu quand le serveur est indisponible",
      "Dev Tools : bouton CHOIX DE BONUS pour afficher l'écran de bonus à la demande",
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
