import { PeagleIcon } from "@/components/ui/peagle-icon";
import {
  Droplets,
  User,
  Users,
  Radio,
  Network,
  LayoutDashboard,
  Database,
  Monitor,
  Trash2,
  Settings,
  LogIn,
  UserCircle,
  Spade,
  HardDrive,
  FileText,
  Printer,
  Globe,
  MessagesSquare,
  ScrollText,
  Palette,
  Video,
  Trophy,
} from "lucide-react";
import { MsnLogo } from "@/components/ui/msn-logo";
import type { IconTheme, IconRenderer } from "../types";

const MsnIcon: IconRenderer = ({ size }) => <MsnLogo size={size} />;
MsnIcon.displayName = "MsnIcon";

const EagleIcon: IconRenderer = ({ size }) => <PeagleIcon size={size} />;
EagleIcon.displayName = "EagleIcon";

export const lucideTheme: IconTheme = {
  id: "lucide",
  displayName: "Modern",
  description: "Icônes SVG modernes avec couleur par app",
  preview: "✨",
  style: "colored-bg",
  icons: {
    peagle:              { icon: EagleIcon,        color: "#c0392b" },
    "peagle-gallery":    { icon: Palette,         color: "#9b59b6" },
    "plouf-plouf":   { icon: Droplets,        color: "#2980b9" },
    profile:         { icon: User,            color: "#8e44ad" },
    directory:       { icon: Users,           color: "#27ae60" },
    msn:             { icon: MsnIcon,         color: "#0078d4" },
    "gunth-meet":    { icon: Video,           color: "#00897b" },
    radio:           { icon: Radio,           color: "#d35400" },
    "linked-gunth":  { icon: Network,         color: "#0077b5" },
    "gunther-board": { icon: LayoutDashboard, color: "#026aa7" },
    admin:           { icon: Database,        color: "#2c3e50" },
    "my-computer":   { icon: Monitor,         color: "#16a085" },
    trash:           { icon: Trash2,          color: "#7f8c8d" },
    settings:        { icon: Settings,        color: "#546e7a" },
    login:           { icon: LogIn,           color: "#2e7d32" },
    "public-profile":{ icon: UserCircle,      color: "#6a1b9a" },
    solitaire:       { icon: Spade,           color: "#1b5e20" },
    defrag:          { icon: HardDrive,       color: "#0d47a1" },
    notepad:         { icon: FileText,        color: "#37474f" },
    printer:         { icon: Printer,         color: "#4e342e" },
    ie:              { icon: Globe,           color: "#1565c0" },
    changelog:       { icon: ScrollText,      color: "#5c4033" },
    gunthrank:       { icon: Trophy,          color: "#f9d423" },
  },
  fallback: MessagesSquare,
};
