// ─── Répliques de l'aigle (game over / victoire / record) ────────────────────────
// Donnée pure — symétrique de `tips.ts`. La sélection aléatoire reste côté React
// (useMemo dans GameCanvas) pour re-tirer une réplique à chaque fin de partie.

export const WIN_QUIPS = [
  "The eagle is satisfied. That's rare. Enjoy it.",
  "All targets down! The eagle invites you to his nest. Decline.",
  "Victory! The phoenix shed a tear. Nobody remembers it but it's noted.",
  "Perfect. The eagle mentions your score to his ornithologist friends.",
  "Level cleared. The eagle awards you a fictional feather of honor.",
  "GG. The eagle filmed that on his iPhone. He doesn't have an iPhone.",
];

export const LOSE_QUIPS = [
  "You aim like a penguin. And penguins don't have hands.",
  "Even my eggs have more talent than you.",
  "I've seen turtles do better. Dead turtles.",
  "Keep this up and I'll be forced to migrate.",
  "My feathers fall out one by one every time you play.",
  "I've survived tornadoes. Not this score.",
  "Did you know eagles have vision 8× sharper than humans? You missed stuff 50 pixels wide.",
  "I'm a symbol of freedom and grandeur. You're a disgrace.",
  "Even a chick that hatched yesterday would do better.",
  "The Roman Empire had an eagle as its emblem. They still fell. Now I understand why.",
  "How did you even play that? With your eyes shut?",
  "I will not cry. Eagles don't cry. *cries*",
  "They say the eagle always flies alone. After watching you play, I get it.",
  "I have razor-sharp talons. I'll say no more.",
  "Someone should ban you from touching this game.",
  "I'm the king of the skies. You're not even king of your keyboard.",
  "Squirrels play better than you. Yes. Squirrels.",
  "I dive at 150 km/h. You just dive in score.",
  "My eagle grandmother plays better. And she's 40 years old.",
  "I've seen rabbits make better strategic decisions.",
  "At this rate, the targets are going to charge you money.",
  "I'm on the coats of arms of 15 nations. Not for this.",
  "Want me to show you how it's done? I don't have hands either.",
  "Even Icarus lasted longer. And he had wax wings.",
  "An eagle never loses face. You lose it every single game.",
  "Your score will go down in history. Not for the right reasons.",
  "They say you become a player by playing. Apparently not you.",
  "The orange targets saw you coming from a mile away. A long mile.",
  "It's official: the eagle is ashamed. The eagle is never ashamed.",
  "I thought it was a bug. No, it's just you.",
  "Even the pigeons are giving you side-eye. The pigeons.",
  "You're on the level of someone who's never played. Except you have played.",
  "The eagle squints. Not in admiration. In bewilderment.",
  "If mediocrity were a sport, you'd be an Olympic champion.",
];

export const RECORD_QUIPS = [
  "New record... your old score was so low it was easy.",
  "Congratulations. The bar was so low an earthworm could've cleared it.",
  "Record broken! Feel bad for the old record.",
  "You outdid yourself. Doesn't mean much, but still.",
  "New record! The eagle applauds... with his wings. It's loud.",
  "For once, you're not a total disgrace. Almost.",
  "Personal best! How do you celebrate? With seeds?",
  "Well played. I said 'well'. Not 'very well'. There's a difference.",
  "The eagle acknowledges your efforts. Grudgingly.",
  "You beat your record. The eagle will note that in his feathers.",
];
