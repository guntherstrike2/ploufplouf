/** Minimal app metadata — no dependency on @/apps to avoid circular imports.
 * Must stay in sync with src/apps/index.ts — add an entry here when adding a new app.
 * audioChannels must match the manifest field (used by use-sound to silence on window close). */
export const APP_META: { slug: string; name: string; emoji: string; audioChannels?: string[] }[] = [
  { slug: "peagle",              name: "Peagle 98",               emoji: "🎯", audioChannels: ["peagle-music"] },
  { slug: "peagle-showroom",    name: "Peagle Showroom",         emoji: "🎨" },
  { slug: "plouf-plouf",    name: "Plouf Plouf",             emoji: "💧", audioChannels: ["ploufplouf-music"] },
  { slug: "profile",        name: "Mon Profil",              emoji: "👤" },
  { slug: "directory",      name: "Annuaire",                emoji: "📋" },
  { slug: "msn",            name: "GunthMessenger™",         emoji: "💬" },
  { slug: "gunth-meet",     name: "GunthMeet™",              emoji: "📹" },
  { slug: "radio",          name: "GunthRadio™",             emoji: "📻" },
  { slug: "linked-gunth",   name: "LinkedGunth™",            emoji: "🔗" },
  { slug: "gunther-board",  name: "GuntherBoard",            emoji: "📝" },
  { slug: "admin",          name: "Admin",                   emoji: "🗄️" },
  { slug: "my-computer",    name: "Mon Ordinateur",          emoji: "🖥️" },
  { slug: "trash",          name: "Corbeille",               emoji: "🗑️" },
  { slug: "settings",       name: "Paramètres GunthOS",      emoji: "⚙️" },
  { slug: "login",          name: "Connexion GunthOS",       emoji: "🔐" },
  { slug: "public-profile", name: "Profil",                  emoji: "👤" },
  { slug: "solitaire",      name: "Solitaire GunthOS™",      emoji: "🃏" },
  { slug: "defrag",         name: "Défragmenteur de disque", emoji: "🗂️" },
  { slug: "notepad",        name: "Bloc-notes",              emoji: "📝" },
  { slug: "printer",        name: "GunthPrint 3000™",        emoji: "🖨️" },
  { slug: "ie",             name: "Internet Explorer 6",     emoji: "🌐" },
  { slug: "changelog",     name: "Notes de version",        emoji: "📋" },
  { slug: "taskkill",      name: "TASKKILL.EXE",             emoji: "🎮", audioChannels: ["taskkill-sfx"] },
  { slug: "gunthrank",    name: "Classement du Kiff",      emoji: "🏆" },
];
