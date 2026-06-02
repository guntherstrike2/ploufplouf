import { lazy, type ComponentType } from "react";
import type { AppManifest, AppProps } from "@/types";

const PeagleGalleryApp = lazy(
  () => import("./index").then((m) => ({ default: m.PeagleGalleryApp }))
) as ComponentType<AppProps>;

export const manifest: AppManifest = {
  slug: "peagle-gallery",
  name: "Galerie Peagle",
  description: "Choisir les assets de Peagle (admin)",
  emoji: "🎨",
  version: "1.0.0",
  defaultSize: { w: 560, h: 660 },
  loadDuration: 600,
  showInLauncher: false,
  component: PeagleGalleryApp,
};
