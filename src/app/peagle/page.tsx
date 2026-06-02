"use client";

import { PeagleApp } from "@/apps/peagle";

export default function PeaglePage() {
  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <PeagleApp windowId="standalone" />
    </div>
  );
}
