import { lazy, type ComponentType } from "react";
import type { AppManifest, AppProps } from "@/types";

const PeagleApp = lazy(
  () => import("./index").then((m) => ({ default: m.PeagleApp })),
) as ComponentType<AppProps>;

export const manifest: AppManifest = {
  slug: "peagle2",
  name: "Peagle (refonte)",
  description: "Refonte propre — lance l'œuf, casse les pegs orange.",
  emoji: "🥚",
  version: "0.1.0",
  defaultSize: { w: 540, h: 760 },
  loadDuration: 600,
  showInLauncher: true,
  component: PeagleApp,
  audioChannels: ["peagle2-music"],
};
