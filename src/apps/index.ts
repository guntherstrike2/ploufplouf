/**
 * APP REGISTRY — source de vérité unique pour toutes les apps GunthOS.
 *
 * Pour ajouter une nouvelle app :
 *   1. Créer un dossier src/apps/mon-app/
 *   2. Créer src/apps/mon-app/index.tsx  (composant React)
 *   3. Créer src/apps/mon-app/manifest.ts (AppManifest)
 *   4. Importer et ajouter le manifest ci-dessous — c'est tout.
 */

import type { AppManifest } from "@/types";

import { manifest as ploufPlouf } from "./plouf-plouf/manifest";
import { manifest as profile } from "./profile/manifest";
import { manifest as directory } from "./directory/manifest";
import { manifest as msn } from "./msn/manifest";
import { manifest as radio } from "./radio/manifest";

import { manifest as myComputer } from "./my-computer/manifest";
import { manifest as trash } from "./trash/manifest";
import { manifest as settings } from "./settings/manifest";
import { manifest as login } from "./login/manifest";
import { manifest as publicProfile } from "./public-profile/manifest";

import { manifest as solitaire } from "./solitaire/manifest";
import { manifest as peagle } from "./peagle/manifest";
import { manifest as peagleGallery } from "./peagle-gallery/manifest";
import { manifest as defrag } from "./defrag/manifest";
import { manifest as notepad } from "./notepad/manifest";
import { manifest as printer } from "./printer/manifest";
import { manifest as ie } from "./ie/manifest";
import { manifest as linkedGunth } from "./linked-gunth/manifest";
import { manifest as guntherBoard } from "./gunther-board/manifest";
import { manifest as dbAdmin } from "./admin/manifest";
import { manifest as changelog } from "./changelog/manifest";
import { manifest as taskkill } from "./taskkill/manifest";
import { manifest as gunthMeet } from "./gunth-meet/manifest";
import { manifest as gunthrank } from "./gunthrank/manifest";

export const APP_REGISTRY: AppManifest[] = [
  // Apps visibles dans le launcher (Start menu + desktop)
  peagle,
  ploufPlouf,
  profile,
  directory,
  msn,
  radio,
  gunthMeet,
  linkedGunth,
  guntherBoard,
  gunthrank,
  taskkill,

  // Apps système (ouvertes programmatiquement, pas dans le launcher)
  peagleGallery,
  dbAdmin,
  myComputer,
  trash,
  settings,
  login,
  publicProfile,

  // Apps utilitaires (ouvertes depuis My Computer)
  solitaire,
  defrag,
  notepad,
  printer,
  ie,
  changelog,
];

/** Apps affichées dans le Start menu et sur le bureau */
export const LAUNCHER_APPS = APP_REGISTRY.filter((a) => a.showInLauncher);

/** Lookup rapide par slug */
export function getAppManifest(slug: string): AppManifest | undefined {
  // Les slugs de profil public sont "profile:<username>"
  if (slug.startsWith("profile:")) return APP_REGISTRY.find((a) => a.slug === "public-profile");
  return APP_REGISTRY.find((a) => a.slug === slug);
}
