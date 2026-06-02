import { IconThemeProvider } from "@/lib/contexts/icon-theme-context";
import { SiteShell } from "@/components/ui/site-shell";

export default function OsLayout({ children }: { children: React.ReactNode }) {
  return (
    <IconThemeProvider>
      <SiteShell>{children}</SiteShell>
    </IconThemeProvider>
  );
}
