export const PEAGLE_CURRENT_VERSION = "0.3.2";

export interface PeagleRelease {
  version: string;
  releasedAt: string;
  notes: string[];
}

export const PEAGLE_VERSIONS: PeagleRelease[] = [
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
