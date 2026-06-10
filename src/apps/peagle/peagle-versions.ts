export const PEAGLE_CURRENT_VERSION = "0.5.2";

export interface PeagleRelease {
  version: string;
  releasedAt: string;
  notes: string[];
}

export const PEAGLE_VERSIONS: PeagleRelease[] = [
  {
    version: "0.5.2",
    releasedAt: "2026-06-10",
    notes: [
      "Pause & game over: screens fully repainted in the game's pixel art — eagle, buttons, ranking and tip all in the arcade font, no more \"window\" look",
      "Punchier buttons everywhere (menu, pause, game over, upgrade): they bounce on hover, squash on click and spring back",
      "Game over ranking: French and accented player names now display correctly",
      "Leaderboard: redrawn as a forest card like the OPTIONS and INSTRUCTIONS menus, eagle for survivors and a grave for the fallen",
      "Bucket catches no longer hand out streak bonuses or extra eggs — catching the egg now simply keeps the points and orange multiplier you've already built up this turn",
      "End-of-turn total now stays white and only flashes gold while it's actually counting up",
      "The plasma display glows a touch cleaner, with sharper characters",
    ],
  },
  {
    version: "0.5.1",
    releasedAt: "2026-06-10",
    notes: [
      "Compressed music: roughly 6 MB less to download, with no audible loss",
      "Leaderboard: faster server-side queries (database index)",
      "Score submission now reports network failures and can be retried at the next game over",
      "Eagle screeches are no longer downloaded when sound is muted",
      "Minor optimizations to floating-text rendering",
    ],
  },
  {
    version: "0.5.0",
    releasedAt: "2026-06-10",
    notes: [
      "New \"blue × orange\" scoring: normal pegs count the points, orange targets raise a multiplier — the turn is paid out all at once at the end of the round",
      "The orange multiplier carries over from turn to turn as long as you catch the egg in the bucket, and breaks the moment an egg flies off-screen: risk versus reward",
      "Spectacular end-of-turn payout: bonuses (streak, jackpot, board cleared, eggs remaining) scroll past in gold, then the counter ticks up to the total with an accelerating count sound",
      "Fully redesigned pinball-style HUD: a big plasma dot-matrix display in the center that plays mini-animations on every highlight (streak, frenzy, clutch, jackpot, record, level won, game over)",
      "Catch STREAK bonus: chaining qualifying catches earns a growing bonus and extra eggs",
      "Pinball-style inserts around the display (targets, eggs, level) that light up on their event, plus a dedicated pause button",
      "Main menu: redrawn \"peg\" buttons rendered on canvas, reacting to the egg bouncing off the title",
      "Game text moved to English: tips, combo words, and the eagle's quips",
      "Décor: reworked forest and pre-clutch sunset ambiance",
    ],
  },
  {
    version: "0.4.2",
    releasedAt: "2026-06-08",
    notes: [
      "Options: new SHAKE setting to enable or disable screen shake on impacts (on by default)",
      "Décor: forest fully repainted — softer colors (no more neon green), more varied hills, trees, grass and clouds, leaves drifting through the air, gentler sun and halo",
      "Décor: the bucket is redrawn as a flat block sitting on the ground, in the pixel style, and squashes when a ball lands in it",
      "Level intro: pegs appear following a pattern picked at random each game (diagonal, spiral, snake, from the center, confetti…) — each peg's pop breathes a little more",
      "Punchier impacts: shockwaves that travel farther and grow with big combos, color bursts and a micro-freeze on standout hits",
    ],
  },
  {
    version: "0.4.1",
    releasedAt: "2026-06-07",
    notes: [
      "Pause & game over: content placed in a framed \"forest\" card, like the OPTIONS menu, instead of floating on screen",
      "Pause: the eagle now follows the cursor with its eyes",
      "Décor: forest sky softened to a blue gradient, sun rays removed",
      "Leaderboard: rows and player highlight resized to the pixel style",
    ],
  },
  {
    version: "0.4.0",
    releasedAt: "2026-06-07",
    notes: [
      "Single OPTIONS menu shared between the main menu and pause (\"SETTINGS\" renamed OPTIONS), redrawn in the game's art direction — forest card, no more \"OS window\" look",
      "Options: Scanlines and Pixel effects (off by default) applied all at once across the whole screen, game and menus; settings remembered between games",
      "Options: enter a seed to start a game from the menu; in-game, the current seed is shown read-only with a COPY button",
      "Buttons unified on the main menu's \"peg\" style everywhere (menu, pause, game over, windows): big bouncing orange peg for the main action (PLAY / RESUME / REPLAY), green pegs for the rest, subtle actions dimmed",
      "Main menu: LEADERBOARD, INSTRUCTIONS and OPTIONS grouped together and separated from PLAY",
      "Pause & game over: same layout, buttons stacked at equal width, tip moved to the very bottom after the buttons",
      "Game over: the eagle's speech bubble placed above its head",
      "Changelog and Instructions: same \"forest card\" windows as the OPTIONS menu, with no title bar — title and version at the top, airy layout, hidden scrollbar",
      "\"Patch notes\" renamed CHANGELOG everywhere in the UI",
      "Upgrade picker: menu reworked to match the art direction (diegetic card, end of the golden theme), cards with rarity color and a clearer SKIP button",
      "Instructions: tighter, more direct text",
      "Décor: higher-definition, sharper title logo, sun and moon moved to the left with softened halos and reflections; pegs, celestial bodies, fir trees and halos with rounded corners for visual unity",
      "Lightened the small decorative glyphs (arrows, stars, gears) in titles and buttons",
      "Fixed the flicker when the cursor grazed the bottom of a button",
      "The leaderboard no longer crashes the game when the server is unavailable",
      "Dev Tools: UPGRADE PICKER button to show the upgrade screen on demand",
    ],
  },
  {
    version: "0.3.2",
    releasedAt: "2026-06-07",
    notes: [
      "INSTRUCTIONS button in the main menu — full game rules",
      "Random tips on the loading screen (★ TIP)",
      "Contextual tip in the pause menu",
      "Tip at the bottom of the game over screen before the action buttons",
    ],
  },
  {
    version: "0.3.1",
    releasedAt: "2026-06-07",
    notes: [
      "Combos shown next to the popped peg, on a diagonal — as close to the action as possible, without getting in the way",
      "Game text matched to the style: arcade pixel font (combos) + VT323 (scores)",
      "Combo lexicon reworked around the eagle/raptor theme (goodbye JUICY!/EGGTASTIC!)",
      "New combo-tier sound: an ascending pixel arpeggio that climbs with the multiplier",
      "Auto width-fit: no word overflows the frame anymore",
    ],
  },
  {
    version: "0.3.0",
    releasedAt: "2026-06-06",
    notes: [
      "Complete rework of floating text: more diegetic and readable",
      "Exclamations (JUICY!, TASTY!…): pixel burst + organic lateral drift",
      "Combo box → dark badge banner with colored bands",
      "×N multiplier shown in gold in the scores",
      "In-game patch notes overlay from the main menu",
    ],
  },
  {
    version: "0.2.0",
    releasedAt: "2026-06-06",
    notes: [
      "The eagle now has a real personality — it panics in clutch mode and follows your egg with its eyes",
      "Clear the whole board? Huge bonus: 10,000 × the level number",
      "Chain bucket catches for streak bonuses",
      "Bumpers send the egg back with a lot more punch",
      "The music adapts in real time — calm, fever, or game over ambiance, everything transitions cleanly",
      "Scores and hits explode on screen with style",
      "The leaderboard shows up right on the end screen — you know where you stand without leaving the game",
      "Enter a 6-character code to replay the exact same level as another player",
      "The forest animates differently depending on the time of day — fireflies in the evening, sun in the morning",
      "The game runs much smoother than before",
    ],
  },
  {
    version: "0.1.0",
    releasedAt: "2026-05-01",
    notes: [
      "First release of Peagle 98",
      "Launch eggs, hit the orange pegs to score",
      "Pick an upgrade between each level",
      "Your score goes to the global leaderboard",
    ],
  },
];
