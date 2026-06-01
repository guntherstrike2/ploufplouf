import type { Metadata } from "next";
import { SoundProvider } from "@/lib/contexts/sound-context";

export const metadata: Metadata = {
  title: "Peagle",
  description: "Peggle-like game — standalone",
};

export default function PeagleLayout({ children }: { children: React.ReactNode }) {
  return (
    <SoundProvider>
      {children}
    </SoundProvider>
  );
}
