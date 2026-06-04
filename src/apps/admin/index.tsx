"use client";

import { useEffect, useRef, useState } from "react";
import type { AppProps } from "@/types";
import { useNotify } from "@/lib/contexts/notification-context";
import type { NotificationType } from "@/lib/contexts/notification-context";
import { useSettings } from "@/lib/contexts/settings-context";

// ─── shared primitives ────────────────────────────────────────────────────────

type UserRow = {
  id: string;
  email: string;
  username: string | null;
  role: string;
  createdAt: number;
  hasCredential: boolean;
};

const btn = (variant: "default" | "danger" | "accent" | "ghost" = "default"): React.CSSProperties => {
  const filled = variant === "danger" || variant === "accent";
  return {
    background: variant === "danger" ? "var(--t-error)" : variant === "accent" ? "var(--t-accent)" : "var(--t-bg)",
    border: "2px solid",
    borderTopColor: filled ? "rgba(255,255,255,0.25)" : "var(--t-border-light)",
    borderLeftColor: filled ? "rgba(255,255,255,0.25)" : "var(--t-border-light)",
    borderBottomColor: filled ? "rgba(0,0,0,0.3)" : "var(--t-border-dark)",
    borderRightColor: filled ? "rgba(0,0,0,0.3)" : "var(--t-border-dark)",
    fontFamily: "var(--t-font-body)",
    fontSize: "var(--t-text-xs)",
    color: filled ? "#fff" : "var(--t-text)",
    padding: "3px 10px",
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    flexShrink: 0,
  };
};

const inset: React.CSSProperties = {
  background: "var(--t-app-bg)",
  border: "2px solid",
  borderTopColor: "var(--t-border-dark)",
  borderLeftColor: "var(--t-border-dark)",
  borderBottomColor: "var(--t-border-light)",
  borderRightColor: "var(--t-border-light)",
  color: "var(--t-text)",
  fontFamily: "var(--t-font-body)",
  fontSize: "var(--t-text-xs)",
  padding: "3px 7px",
};

const divider: React.CSSProperties = {
  borderBottom: "1px solid var(--t-border-dark)",
};

// ─── nav sidebar ──────────────────────────────────────────────────────────────

type Section = "live" | "users" | "database" | "notifications" | "broadcast" | "vocal" | "peagle";

const NAV_ITEMS: { id: Section; label: string; icon: string }[] = [
  { id: "live",          label: "En direct",       icon: "🟢" },
  { id: "users",         label: "Utilisateurs",   icon: "👥" },
  { id: "database",      label: "Base de données", icon: "🗄️" },
  { id: "notifications", label: "Notifications",   icon: "🔔" },
  { id: "broadcast",     label: "Broadcast",       icon: "📢" },
  { id: "vocal",         label: "Vocal TTS",       icon: "🔊" },
  { id: "peagle",        label: "Peagle 98",       icon: "🎯" },
];

function Sidebar({ active, onSelect }: { active: Section; onSelect: (s: Section) => void }) {
  return (
    <div style={{
      width: 160,
      flexShrink: 0,
      borderRight: "2px solid var(--t-border-dark)",
      display: "flex",
      flexDirection: "column",
      background: "var(--t-bg)",
    }}>
      <div style={{
        padding: "6px 8px",
        borderBottom: "2px solid var(--t-border-dark)",
        fontFamily: "var(--t-font-display)",
        fontSize: "var(--t-text-xs)",
        color: "var(--t-text-muted)",
        letterSpacing: "0.05em",
      }}>
        ADMIN PANEL
      </div>
      <nav style={{ flex: 1, overflowY: "auto" }}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "8px 10px",
                border: "none",
                borderBottom: "1px solid var(--t-border-dark)",
                background: isActive ? "var(--t-accent)" : "transparent",
                color: isActive ? "#fff" : "var(--t-text)",
                fontFamily: "var(--t-font-body)",
                fontSize: "var(--t-text-sm)",
                cursor: "pointer",
                textAlign: "left",
                boxShadow: isActive ? "inset 2px 2px 0 rgba(0,0,0,0.2)" : "none",
              }}
            >
              <span style={{ fontSize: "var(--t-text-base)" }}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

// ─── section header ───────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle, actions }: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div style={{
      padding: "8px 12px",
      display: "flex",
      alignItems: "center",
      gap: 10,
      ...divider,
      flexShrink: 0,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "var(--t-font-display)", fontSize: "var(--t-text-sm)", color: "var(--t-text)" }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontFamily: "var(--t-font-body)", fontSize: "var(--t-text-xs)", color: "var(--t-text-muted)" }}>
            {subtitle}
          </div>
        )}
      </div>
      {actions && <div style={{ display: "flex", gap: 6, alignItems: "center" }}>{actions}</div>}
    </div>
  );
}

// ─── live panel ───────────────────────────────────────────────────────────────

type OnlineUser = {
  id: string;
  username: string | null;
  onlineStatus: string | null;
  lastHeartbeat: string | null;
  role: string;
};

type StatsData = {
  onlineUsers: OnlineUser[];
  activeSessions: number;
  counts: {
    totalUsers: number;
    totalMessages: number;
    totalNudges: number;
    totalPosts: number;
    totalReactions: number;
    totalComments: number;
    totalFollows: number;
    totalTickets: number;
  };
  topMessagers: { userId: string | null; username: string | null; msgCount: number }[];
  topPosters: { userId: string | null; username: string | null; postCount: number }[];
};

const STATUS_COLOR: Record<string, string> = {
  online: "var(--t-success)",
  away: "var(--t-warning)",
  busy: "var(--t-error)",
  offline: "var(--t-text-subtle)",
};

const STATUS_LABEL: Record<string, string> = {
  online: "en ligne",
  away: "absent",
  busy: "occupé",
  offline: "hors ligne",
};

const STAT_ITEMS: { key: keyof StatsData["counts"]; label: string; emoji: string }[] = [
  { key: "totalUsers",    label: "Utilisateurs",        emoji: "👤" },
  { key: "totalMessages", label: "Messages MSN",        emoji: "💬" },
  { key: "totalNudges",   label: "Nudges envoyés",      emoji: "👋" },
  { key: "totalPosts",    label: "Posts LinkedGunth",   emoji: "📝" },
  { key: "totalReactions",label: "Réactions LG",        emoji: "👍" },
  { key: "totalComments", label: "Commentaires LG",     emoji: "💭" },
  { key: "totalFollows",  label: "Follows LG",          emoji: "🔗" },
  { key: "totalTickets",  label: "Tickets GuntherBoard",emoji: "🎫" },
];

function LivePanel() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((d) => { setData(Array.isArray(d?.onlineUsers) ? d : null); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(load, []);

  // Auto-refresh every 15s
  useEffect(() => {
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, []);

  const statCard: React.CSSProperties = {
    border: "2px solid",
    borderTopColor: "var(--t-border-light)",
    borderLeftColor: "var(--t-border-light)",
    borderBottomColor: "var(--t-border-dark)",
    borderRightColor: "var(--t-border-dark)",
    background: "var(--t-bg)",
    padding: "10px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 100,
  };

  const rankRow = (name: string | null, value: number, i: number): React.ReactNode => (
    <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", borderBottom: "1px solid var(--t-border-dark)" }}>
      <span style={{ fontFamily: "var(--t-font-body)", fontSize: "var(--t-text-xs)", color: "var(--t-text-muted)", width: 14, textAlign: "right" }}>
        {i + 1}.
      </span>
      <span style={{ flex: 1, fontFamily: "var(--t-font-body)", fontSize: "var(--t-text-sm)", color: "var(--t-accent)" }}>
        {name ?? "—"}
      </span>
      <span style={{ fontFamily: "var(--t-font-body)", fontSize: "var(--t-text-xs)", color: "var(--t-text-muted)" }}>
        {value}
      </span>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <SectionHeader
        title="En direct"
        subtitle={data ? `${data.onlineUsers.length} connecté${data.onlineUsers.length !== 1 ? "s" : ""} · ${data.activeSessions} session${data.activeSessions !== 1 ? "s" : ""} actives` : "Chargement…"}
        actions={<button style={btn()} onClick={load}>↻ Rafraîchir</button>}
      />
      <div style={{ flex: 1, overflow: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>

        {loading && !data ? (
          <div style={{ fontFamily: "var(--t-font-body)", fontSize: "var(--t-text-sm)", color: "var(--t-text-muted)", padding: 8 }}>Chargement…</div>
        ) : data ? (
          <>
            {/* Users online */}
            <div style={{
              border: "2px solid",
              borderTopColor: "var(--t-border-light)",
              borderLeftColor: "var(--t-border-light)",
              borderBottomColor: "var(--t-border-dark)",
              borderRightColor: "var(--t-border-dark)",
              background: "var(--t-bg)",
            }}>
              <div style={{
                padding: "4px 8px",
                background: "var(--t-inset-from)",
                borderBottom: "1px solid var(--t-border-dark)",
                fontFamily: "var(--t-font-display)",
                fontSize: "var(--t-text-xs)",
                color: "var(--t-text-muted)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--t-success)", display: "inline-block" }} />
                Utilisateurs connectés ({data.onlineUsers.length})
              </div>
              {data.onlineUsers.length === 0 ? (
                <div style={{ padding: "10px 12px", fontFamily: "var(--t-font-body)", fontSize: "var(--t-text-sm)", color: "var(--t-text-muted)" }}>
                  Personne en ligne pour l&apos;instant.
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8, padding: 10 }}>
                  {data.onlineUsers.map((u) => {
                    const status = u.onlineStatus ?? "online";
                    const color = STATUS_COLOR[status] ?? "var(--t-text-muted)";
                    const hb = u.lastHeartbeat ? new Date(u.lastHeartbeat) : null;
                    const seenAgo = hb ? Math.round((Date.now() - hb.getTime()) / 1000) : null;
                    return (
                      <div key={u.id} style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "5px 10px",
                        border: "2px solid",
                        borderTopColor: "var(--t-border-light)",
                        borderLeftColor: "var(--t-border-light)",
                        borderBottomColor: "var(--t-border-dark)",
                        borderRightColor: "var(--t-border-dark)",
                        background: "var(--t-app-bg)",
                      }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                        <span style={{ fontFamily: "var(--t-font-body)", fontSize: "var(--t-text-sm)", color: "var(--t-accent)" }}>
                          {u.username ?? u.id.slice(0, 8)}
                        </span>
                        {u.role === "admin" && (
                          <span style={{ background: "var(--t-accent)", color: "#fff", fontSize: "var(--t-text-xs)", padding: "0 4px", fontFamily: "var(--t-font-body)" }}>
                            admin
                          </span>
                        )}
                        <span style={{ fontFamily: "var(--t-font-body)", fontSize: "var(--t-text-xs)", color: "var(--t-text-muted)" }}>
                          {STATUS_LABEL[status] ?? status}
                          {seenAgo !== null && ` · il y a ${seenAgo}s`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Stats globales */}
            <div style={{
              border: "2px solid",
              borderTopColor: "var(--t-border-light)",
              borderLeftColor: "var(--t-border-light)",
              borderBottomColor: "var(--t-border-dark)",
              borderRightColor: "var(--t-border-dark)",
              background: "var(--t-bg)",
            }}>
              <div style={{
                padding: "4px 8px",
                background: "var(--t-inset-from)",
                borderBottom: "1px solid var(--t-border-dark)",
                fontFamily: "var(--t-font-display)",
                fontSize: "var(--t-text-xs)",
                color: "var(--t-text-muted)",
              }}>
                Statistiques globales
              </div>
              <div style={{ padding: 10, display: "flex", flexWrap: "wrap" as const, gap: 8 }}>
                {STAT_ITEMS.map(({ key, label, emoji }) => (
                  <div key={key} style={statCard}>
                    <span style={{ fontSize: "var(--t-text-md)" }}>{emoji}</span>
                    <span style={{ fontFamily: "var(--t-font-display)", fontSize: "var(--t-text-lg)", color: "var(--t-accent)" }}>
                      {data.counts[key]}
                    </span>
                    <span style={{ fontFamily: "var(--t-font-body)", fontSize: "var(--t-text-xs)", color: "var(--t-text-muted)" }}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Classements */}
            <div style={{ display: "flex", gap: 12 }}>

              {/* Top messageurs */}
              <div style={{ flex: 1, border: "2px solid", borderTopColor: "var(--t-border-light)", borderLeftColor: "var(--t-border-light)", borderBottomColor: "var(--t-border-dark)", borderRightColor: "var(--t-border-dark)", background: "var(--t-bg)" }}>
                <div style={{ padding: "4px 8px", background: "var(--t-inset-from)", borderBottom: "1px solid var(--t-border-dark)", fontFamily: "var(--t-font-display)", fontSize: "var(--t-text-xs)", color: "var(--t-text-muted)" }}>
                  💬 Top messageurs MSN
                </div>
                {data.topMessagers.length === 0 ? (
                  <div style={{ padding: "8px 12px", fontFamily: "var(--t-font-body)", fontSize: "var(--t-text-xs)", color: "var(--t-text-muted)" }}>Aucun message</div>
                ) : data.topMessagers.map((m, i) => rankRow(m.username, m.msgCount, i))}
              </div>

              {/* Top posters LinkedGunth */}
              <div style={{ flex: 1, border: "2px solid", borderTopColor: "var(--t-border-light)", borderLeftColor: "var(--t-border-light)", borderBottomColor: "var(--t-border-dark)", borderRightColor: "var(--t-border-dark)", background: "var(--t-bg)" }}>
                <div style={{ padding: "4px 8px", background: "var(--t-inset-from)", borderBottom: "1px solid var(--t-border-dark)", fontFamily: "var(--t-font-display)", fontSize: "var(--t-text-xs)", color: "var(--t-text-muted)" }}>
                  📝 Top posters LinkedGunth
                </div>
                {data.topPosters.length === 0 ? (
                  <div style={{ padding: "8px 12px", fontFamily: "var(--t-font-body)", fontSize: "var(--t-text-xs)", color: "var(--t-text-muted)" }}>Aucun post</div>
                ) : data.topPosters.map((p, i) => rankRow(p.username, p.postCount, i))}
              </div>

            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

// ─── users panel ──────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  return (
    <span style={{
      background: role === "admin" ? "var(--t-accent)" : "var(--t-border-dark)",
      color: role === "admin" ? "#fff" : "var(--t-text-muted)",
      padding: "1px 6px",
      fontSize: "var(--t-text-xs)",
      fontFamily: "var(--t-font-body)",
      display: "inline-block",
      minWidth: 36,
      textAlign: "center",
    }}>
      {role}
    </span>
  );
}

function UsersPanel() {
  const notify = useNotify();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [newPwd, setNewPwd] = useState<Record<string, string>>({});

  function load() {
    setLoading(true);
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => { setUsers(Array.isArray(data) ? data : []); setLoading(false); });
  }

  useEffect(load, []);

  async function toggleRole(u: UserRow) {
    setBusy(u.id);
    const next = u.role === "admin" ? "user" : "admin";
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: next }),
    });
    setBusy(null);
    if (res.ok) {
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, role: next } : x));
      notify({ type: "success", title: "Rôle modifié", message: `${u.username ?? u.email} → ${next}` });
    } else {
      notify({ type: "error", title: "Erreur", message: "Impossible de modifier le rôle" });
    }
  }

  async function deleteUser(id: string) {
    setBusy(id);
    const u = users.find((x) => x.id === id);
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    setBusy(null);
    setConfirmDelete(null);
    if (res.ok) {
      setUsers((prev) => prev.filter((x) => x.id !== id));
      notify({ type: "success", title: "Utilisateur supprimé", message: u?.username ?? u?.email });
    } else {
      notify({ type: "error", title: "Erreur suppression" });
    }
  }

  async function handleReset(userId: string) {
    const pwd = newPwd[userId] ?? "";
    if (pwd.length < 1) { notify({ type: "warning", title: "Mot de passe vide", message: "Le mot de passe ne peut pas être vide" }); return; }
    setBusy(userId);
    const res = await fetch("/api/admin/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, newPassword: pwd }),
    });
    const data = await res.json();
    setBusy(null);
    if (data.ok) {
      notify({ type: "success", title: "Mot de passe changé" });
      setNewPwd((p) => ({ ...p, [userId]: "" }));
    } else {
      notify({ type: "error", title: "Erreur reset", message: data.error ?? "Erreur inconnue" });
    }
  }

  const cell: React.CSSProperties = { padding: "6px 10px", verticalAlign: "middle" };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <SectionHeader
        title="Utilisateurs"
        subtitle={loading ? "Chargement…" : `${users.length} utilisateur${users.length !== 1 ? "s" : ""}`}
        actions={<button style={btn()} onClick={load}>↻ Rafraîchir</button>}
      />
      <div style={{ flex: 1, overflow: "auto" }}>
        {loading ? (
          <div style={{ padding: 20, fontFamily: "var(--t-font-body)", fontSize: "var(--t-text-sm)", color: "var(--t-text-muted)" }}>
            Chargement…
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--t-font-body)", fontSize: "var(--t-text-sm)" }}>
            <thead>
              <tr style={{ ...divider, textAlign: "left", color: "var(--t-text-muted)", background: "var(--t-inset-from)" }}>
                <th style={cell}>Username</th>
                <th style={cell}>Email</th>
                <th style={cell}>Rôle</th>
                <th style={cell}>Inscrit</th>
                <th style={cell}>Reset mdp</th>
                <th style={cell}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: "1px solid var(--t-border-dark)", color: "var(--t-text)" }}>
                  <td style={cell}>
                    <span style={{ color: "var(--t-accent)" }}>{u.username ?? "—"}</span>
                  </td>
                  <td style={{ ...cell, color: "var(--t-text-muted)", fontSize: "var(--t-text-xs)" }}>{u.email}</td>
                  <td style={cell}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <RoleBadge role={u.role} />
                      <button
                        style={btn(u.role === "admin" ? "default" : "accent")}
                        disabled={busy === u.id}
                        onClick={() => toggleRole(u)}
                      >
                        {u.role === "admin" ? "→ user" : "→ admin"}
                      </button>
                    </div>
                  </td>
                  <td style={{ ...cell, color: "var(--t-text-muted)", fontSize: "var(--t-text-xs)" }}>
                    {new Date(u.createdAt).toLocaleDateString("fr-FR")}
                  </td>
                  <td style={cell}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      {!u.hasCredential && (
                        <span style={{ background: "var(--t-error)", color: "#fff", fontSize: "var(--t-text-xs)", padding: "1px 5px", fontFamily: "var(--t-font-body)" }}>
                          ⚠ Pas de mdp
                        </span>
                      )}
                      <input
                        type="password"
                        placeholder={u.hasCredential ? "Nouveau mdp…" : "Définir…"}
                        value={newPwd[u.id] ?? ""}
                        onChange={(e) => setNewPwd((p) => ({ ...p, [u.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && handleReset(u.id)}
                        style={{ ...inset, width: 130 }}
                      />
                      <button style={btn()} disabled={busy === u.id} onClick={() => handleReset(u.id)}>
                        {busy === u.id ? "…" : "Reset"}
                      </button>
                    </div>
                  </td>
                  <td style={cell}>
                    {confirmDelete === u.id ? (
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <span style={{ fontSize: "var(--t-text-xs)", color: "var(--t-text-muted)" }}>Confirmer ?</span>
                        <button style={btn("danger")} disabled={busy === u.id} onClick={() => deleteUser(u.id)}>
                          {busy === u.id ? "…" : "Oui"}
                        </button>
                        <button style={btn()} onClick={() => setConfirmDelete(null)}>Non</button>
                      </div>
                    ) : (
                      <button style={btn("danger")} onClick={() => setConfirmDelete(u.id)}>Supprimer</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── database panel ───────────────────────────────────────────────────────────

function DatabasePanel() {
  const notify = useNotify();
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleImport(file: File) {
    setImporting(true);
    try {
      const res = await fetch("/api/admin/db/import", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: file,
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (data.ok) {
        notify({ type: "success", title: "DB importée", message: "Rechargez la page pour voir les changements", duration: null });
      } else {
        notify({ type: "error", title: "Erreur import", message: data.error ?? "Erreur inconnue" });
      }
    } finally {
      setImporting(false);
    }
  }

  const cardStyle: React.CSSProperties = {
    border: "2px solid",
    borderTopColor: "var(--t-border-light)",
    borderLeftColor: "var(--t-border-light)",
    borderBottomColor: "var(--t-border-dark)",
    borderRightColor: "var(--t-border-dark)",
    background: "var(--t-bg)",
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <SectionHeader title="Base de données" subtitle="Export et import de la base SQLite" />
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>

        <div style={cardStyle}>
          <div style={{ fontFamily: "var(--t-font-display)", fontSize: "var(--t-text-sm)", color: "var(--t-text)" }}>
            Exporter la base
          </div>
          <div style={{ fontFamily: "var(--t-font-body)", fontSize: "var(--t-text-xs)", color: "var(--t-text-muted)" }}>
            Télécharge le fichier <code style={{ color: "var(--t-accent)" }}>database.db</code> actuel.
          </div>
          <div>
            <a
              href="/api/admin/db/export"
              download
              style={{ ...btn(), textDecoration: "none", display: "inline-block" }}
            >
              ⬇ Télécharger database.db
            </a>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontFamily: "var(--t-font-display)", fontSize: "var(--t-text-sm)", color: "var(--t-text)" }}>
            Importer une base
          </div>
          <div style={{ fontFamily: "var(--t-font-body)", fontSize: "var(--t-text-xs)", color: "var(--t-text-muted)" }}>
            Remplace la base courante par un fichier <code style={{ color: "var(--t-accent)" }}>.db</code>.
            Cette opération est <strong style={{ color: "var(--t-error)" }}>irréversible</strong>.
          </div>
          <div>
            <button
              style={btn("danger")}
              disabled={importing}
              onClick={() => fileRef.current?.click()}
            >
              {importing ? "Import en cours…" : "⬆ Importer un fichier .db"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".db,application/octet-stream"
              style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ""; }}
            />
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── notifications test panel ─────────────────────────────────────────────────

const NOTIF_TYPES: { value: NotificationType; label: string; color: string }[] = [
  { value: "info",    label: "Info",    color: "var(--t-titlebar-from)" },
  { value: "success", label: "Succès",  color: "var(--t-success)" },
  { value: "warning", label: "Warning", color: "var(--t-warning)" },
  { value: "error",   label: "Erreur",  color: "var(--t-error)" },
];

const PRESETS: { label: string; type: NotificationType; title: string; message?: string; duration: number | null }[] = [
  { label: "Connexion réussie",   type: "success", title: "Connecté",          message: "Bienvenue sur GunthOS !",              duration: 4000 },
  { label: "Erreur serveur",      type: "error",   title: "Erreur 500",         message: "Le serveur a planté. Réessayez.",       duration: 6000 },
  { label: "Mise à jour dispo",   type: "info",    title: "Mise à jour",        message: "Version 2.1 disponible.",              duration: 5000 },
  { label: "Session expirée",     type: "warning", title: "Session expirée",    message: "Reconnectez-vous pour continuer.",      duration: null },
  { label: "Fichier supprimé",    type: "success", title: "Supprimé",           message: undefined,                               duration: 3000 },
  { label: "Persistante (∞)",     type: "info",    title: "Notification persist",message: "Elle reste jusqu'à ce que tu la fermes.", duration: null },
];

// ─── shared notif composer ────────────────────────────────────────────────────

type DurationKey = "3000" | "5000" | "8000" | "null";

type NotifComposerProps = {
  panelTitle: string;
  submitLabel: string;
  disabled?: boolean;
  titlePlaceholder?: string;
  onSubmit: (payload: { type: NotificationType; title: string; message?: string; duration: number | null }) => void;
};

function NotifComposer({ panelTitle, submitLabel, disabled, titlePlaceholder, onSubmit }: NotifComposerProps) {
  const [type, setType] = useState<NotificationType>("info");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [duration, setDuration] = useState<DurationKey>("5000");

  const labelStyle: React.CSSProperties = {
    fontFamily: "var(--t-font-body)",
    fontSize: "var(--t-text-xs)",
    color: "var(--t-text-muted)",
    marginBottom: 3,
    display: "block",
  };

  function handleSubmit() {
    onSubmit({
      type,
      title: title.trim() || "Sans titre",
      message: message.trim() || undefined,
      duration: duration === "null" ? null : Number(duration),
    });
  }

  return (
    <div style={{
      border: "2px solid",
      borderTopColor: "var(--t-border-light)",
      borderLeftColor: "var(--t-border-light)",
      borderBottomColor: "var(--t-border-dark)",
      borderRightColor: "var(--t-border-dark)",
      background: "var(--t-bg)",
    }}>
      <div style={{
        padding: "4px 8px",
        background: "var(--t-inset-from)",
        borderBottom: "1px solid var(--t-border-dark)",
        fontFamily: "var(--t-font-display)",
        fontSize: "var(--t-text-xs)",
        color: "var(--t-text-muted)",
      }}>
        {panelTitle}
      </div>
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <label style={labelStyle}>Type</label>
          <div style={{ display: "flex", gap: 4 }}>
            {NOTIF_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                style={{
                  flex: 1,
                  padding: "4px 0",
                  border: "2px solid",
                  borderTopColor: type === t.value ? "rgba(255,255,255,0.25)" : "var(--t-border-light)",
                  borderLeftColor: type === t.value ? "rgba(255,255,255,0.25)" : "var(--t-border-light)",
                  borderBottomColor: type === t.value ? "rgba(0,0,0,0.3)" : "var(--t-border-dark)",
                  borderRightColor: type === t.value ? "rgba(0,0,0,0.3)" : "var(--t-border-dark)",
                  background: type === t.value ? t.color : "var(--t-bg)",
                  color: type === t.value ? "#fff" : "var(--t-text-muted)",
                  fontFamily: "var(--t-font-body)",
                  fontSize: "var(--t-text-xs)",
                  cursor: "pointer",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={labelStyle}>Titre</label>
          <input
            type="text"
            value={title}
            placeholder={titlePlaceholder ?? "Titre…"}
            onChange={(e) => setTitle(e.target.value)}
            style={{ ...inset, width: "100%", boxSizing: "border-box" as const }}
          />
        </div>
        <div>
          <label style={labelStyle}>Message (optionnel)</label>
          <textarea
            value={message}
            placeholder="Détails…"
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            style={{ ...inset, width: "100%", boxSizing: "border-box" as const, resize: "vertical" as const, fontFamily: "var(--t-font-body)" }}
          />
        </div>
        <div>
          <label style={labelStyle}>Durée</label>
          <select
            value={duration}
            onChange={(e) => setDuration(e.target.value as DurationKey)}
            style={{ ...inset, width: "100%", cursor: "pointer" }}
          >
            <option value="3000">3 secondes</option>
            <option value="5000">5 secondes</option>
            <option value="8000">8 secondes</option>
            <option value="null">Persistante (∞)</option>
          </select>
        </div>
        <button
          disabled={disabled}
          onClick={handleSubmit}
          style={{ ...btn("accent"), padding: "6px 0", textAlign: "center" as const, fontSize: "var(--t-text-sm)", opacity: disabled ? 0.6 : 1 }}
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

function NotificationsPanel() {
  const notify = useNotify();

  function firePreset(p: typeof PRESETS[number]) {
    notify({ type: p.type, title: p.title, message: p.message, duration: p.duration });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <SectionHeader title="Test notifications" subtitle="Déclenche des notifications pour valider le système" />
      <div style={{ flex: 1, overflow: "auto", padding: 16, display: "flex", gap: 16 }}>

        {/* Composer */}
        <div style={{ flex: 1, maxWidth: 360 }}>
          <NotifComposer
            panelTitle="Composer une notification"
            submitLabel="▶ Envoyer la notification"
            titlePlaceholder="Mon titre"
            onSubmit={(p) => notify(p)}
          />
        </div>

        {/* Presets */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{
            border: "2px solid",
            borderTopColor: "var(--t-border-light)",
            borderLeftColor: "var(--t-border-light)",
            borderBottomColor: "var(--t-border-dark)",
            borderRightColor: "var(--t-border-dark)",
            background: "var(--t-bg)",
          }}>
            <div style={{
              padding: "4px 8px",
              background: "var(--t-inset-from)",
              borderBottom: "1px solid var(--t-border-dark)",
              fontFamily: "var(--t-font-display)",
              fontSize: "var(--t-text-xs)",
              color: "var(--t-text-muted)",
            }}>
              Scénarios prédéfinis
            </div>
            <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              {PRESETS.map((p) => {
                const typeInfo = NOTIF_TYPES.find((t) => t.value === p.type)!;
                return (
                  <button
                    key={p.label}
                    onClick={() => firePreset(p)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 10px",
                      border: "2px solid",
                      borderTopColor: "var(--t-border-light)",
                      borderLeftColor: "var(--t-border-light)",
                      borderBottomColor: "var(--t-border-dark)",
                      borderRightColor: "var(--t-border-dark)",
                      background: "var(--t-bg)",
                      cursor: "pointer",
                      fontFamily: "var(--t-font-body)",
                      fontSize: "var(--t-text-sm)",
                      color: "var(--t-text)",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: typeInfo.color, flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{p.label}</span>
                    <span style={{ fontSize: "var(--t-text-xs)", color: "var(--t-text-muted)", fontFamily: "var(--t-font-body)" }}>
                      {p.duration === null ? "∞" : `${p.duration / 1000}s`}
                    </span>
                    <span style={{ fontSize: "var(--t-text-xs)", padding: "1px 5px", background: typeInfo.color, color: "#fff", fontFamily: "var(--t-font-body)" }}>
                      {typeInfo.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── broadcast panel ─────────────────────────────────────────────────────────

const JOKES: { label: string; type: NotificationType; title: string; message?: string; duration: number | null }[] = [
  { label: "Rentre chez toi",      type: "warning", title: "Alerte RH",            message: "Il est l'heure de rentrer chez toi. Ferme ton ordi.",        duration: null  },
  { label: "T'as rien à faire ?",  type: "info",    title: "Sondage rapide",        message: "T'es encore là ? T'as vraiment rien de mieux à faire ?",     duration: 8000  },
  { label: "Mise à jour critique", type: "error",   title: "MISE À JOUR URGENTE",   message: "Redémarrez immédiatement. (non on déconne)",                 duration: 6000  },
  { label: "Cafétéria ouverte",    type: "success", title: "☕ Cafétéria",           message: "Les croissants viennent d'arriver. Premier arrivé…",         duration: 5000  },
  { label: "Big Brother",          type: "warning", title: "👁 Surveillance active", message: "Tes faits et gestes sont enregistrés. Bonne journée !",      duration: 7000  },
  { label: "GG",                   type: "success", title: "Félicitations !",        message: "T'as gagné. On sait pas quoi, mais t'as gagné.",             duration: 5000  },
  { label: "404 cerveau",          type: "error",   title: "Erreur 404",             message: "Cerveau introuvable. Veuillez contacter le support.",        duration: 6000  },
  { label: "Reboot demandé",       type: "info",    title: "Reboot recommandé",      message: "Un redémarrage de toi-même est conseillé. Va faire un tour.", duration: null },
];

function BroadcastPanel() {
  const notify = useNotify();
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<{ reached: number; ts: number } | null>(null);

  const panelBox: React.CSSProperties = {
    border: "2px solid",
    borderTopColor: "var(--t-border-light)",
    borderLeftColor: "var(--t-border-light)",
    borderBottomColor: "var(--t-border-dark)",
    borderRightColor: "var(--t-border-dark)",
    background: "var(--t-bg)",
  };

  const panelTitle: React.CSSProperties = {
    padding: "4px 8px",
    background: "var(--t-inset-from)",
    borderBottom: "1px solid var(--t-border-dark)",
    fontFamily: "var(--t-font-display)",
    fontSize: "var(--t-text-xs)",
    color: "var(--t-text-muted)",
  };

  async function send(payload: { type: NotificationType; title: string; message?: string; duration: number | null }) {
    setSending(true);
    try {
      const res = await fetch("/api/notifications/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { ok?: boolean; reached?: number; error?: string };
      if (data.ok) {
        setLastResult({ reached: data.reached ?? 0, ts: Date.now() });
        notify({ type: "success", title: `Envoyé à ${data.reached} client${(data.reached ?? 0) !== 1 ? "s" : ""}` });
      } else {
        notify({ type: "error", title: "Erreur broadcast", message: data.error });
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <SectionHeader
        title="Broadcast"
        subtitle="Envoie une notification à tous les utilisateurs connectés"
        actions={lastResult && (
          <span style={{ fontFamily: "var(--t-font-body)", fontSize: "var(--t-text-xs)", color: "var(--t-text-muted)" }}>
            Dernier envoi : {lastResult.reached} client{lastResult.reached !== 1 ? "s" : ""}
          </span>
        )}
      />
      <div style={{ flex: 1, overflow: "auto", padding: 16, display: "flex", gap: 16 }}>

        {/* Blagues prédéfinies */}
        <div style={{ flex: 1 }}>
          <div style={panelBox}>
            <div style={panelTitle}>Blagues prédéfinies 🎭</div>
            <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              {JOKES.map((j) => {
                const typeInfo = NOTIF_TYPES.find((t) => t.value === j.type)!;
                return (
                  <button
                    key={j.label}
                    disabled={sending}
                    onClick={() => send({ type: j.type, title: j.title, message: j.message, duration: j.duration })}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "7px 10px",
                      border: "2px solid",
                      borderTopColor: "var(--t-border-light)",
                      borderLeftColor: "var(--t-border-light)",
                      borderBottomColor: "var(--t-border-dark)",
                      borderRightColor: "var(--t-border-dark)",
                      background: "var(--t-bg)",
                      cursor: sending ? "wait" : "pointer",
                      fontFamily: "var(--t-font-body)",
                      fontSize: "var(--t-text-sm)",
                      color: "var(--t-text)",
                      textAlign: "left",
                      opacity: sending ? 0.6 : 1,
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: typeInfo.color, flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{j.label}</span>
                    <span style={{ fontSize: "var(--t-text-xs)", color: "var(--t-text-muted)" }}>
                      {j.duration === null ? "∞" : `${j.duration / 1000}s`}
                    </span>
                    <span style={{ fontSize: "var(--t-text-xs)", padding: "1px 5px", background: typeInfo.color, color: "#fff" }}>
                      {typeInfo.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Message custom */}
        <div style={{ flex: 1, maxWidth: 340 }}>
          <NotifComposer
            panelTitle="Message personnalisé"
            submitLabel={sending ? "Envoi…" : "📢 Broadcaster"}
            disabled={sending}
            titlePlaceholder="Titre de la notif…"
            onSubmit={(p) => {
              if (!p.title.trim()) { notify({ type: "warning", title: "Titre requis" }); return; }
              send(p);
            }}
          />
        </div>

      </div>
    </div>
  );
}

// ─── vocal tts panel ─────────────────────────────────────────────────────────

const TTS_PRANKS: { label: string; text: string; pitch?: number; rate?: number }[] = [
  { label: "Réunion obligatoire",   text: "Attention, réunion obligatoire dans cinq minutes. Amenez votre chaise." },
  { label: "Café terminé",          text: "Avertissement. La machine à café est en panne. Répétez. La machine à café est en panne." },
  { label: "Informatique appelle",  text: "Ici le service informatique. Nous avons détecté un virus sur votre ordinateur. Ne touchez à rien." },
  { label: "Big Brother",           text: "Vos écrans sont surveillés. Bonne journée.", pitch: 0.6, rate: 0.85 },
  { label: "Mission impossible",    text: "Ce message va s'autodétruire dans trois secondes. Bonne chance.", pitch: 0.8, rate: 0.9 },
  { label: "Fin de journée",        text: "Il est dix-sept heures. Vous pouvez rentrer chez vous. Le bureau est fermé.", rate: 0.95 },
  { label: "Alerte incendie fake",  text: "Exercice incendie. Veuillez évacuer les locaux calmement. Ceci est un exercice." },
  { label: "OVNI détecté",          text: "Alerte météo. Un objet non identifié a été détecté au-dessus du bâtiment. Restez calmes.", pitch: 1.2 },
  { label: "Voix de robot",         text: "Bonjour humain. Je suis votre nouveau collègue virtuel. Ravi de vous rencontrer.", pitch: 0.5, rate: 0.7 },
  { label: "Classique",             text: "Quelqu'un a oublié ses clés à l'accueil. Merci de passer les récupérer." },
];

function VocalPanel() {
  const notify = useNotify();
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [pitch, setPitch] = useState(1);
  const [rate, setRate] = useState(1);
  const [lastResult, setLastResult] = useState<{ reached: number; ts: number } | null>(null);

  const panelBox: React.CSSProperties = {
    border: "2px solid",
    borderTopColor: "var(--t-border-light)",
    borderLeftColor: "var(--t-border-light)",
    borderBottomColor: "var(--t-border-dark)",
    borderRightColor: "var(--t-border-dark)",
    background: "var(--t-bg)",
  };

  const panelTitleStyle: React.CSSProperties = {
    padding: "4px 8px",
    background: "var(--t-inset-from)",
    borderBottom: "1px solid var(--t-border-dark)",
    fontFamily: "var(--t-font-display)",
    fontSize: "var(--t-text-xs)",
    color: "var(--t-text-muted)",
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: "var(--t-font-body)",
    fontSize: "var(--t-text-xs)",
    color: "var(--t-text-muted)",
    marginBottom: 3,
    display: "block",
  };

  async function send(payload: { text: string; pitch?: number; rate?: number }) {
    setSending(true);
    try {
      const res = await fetch("/api/admin/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: payload.text, lang: "fr-FR", pitch: payload.pitch ?? 1, rate: payload.rate ?? 1 }),
      });
      const data = await res.json() as { ok?: boolean; reached?: number; error?: string };
      if (data.ok) {
        setLastResult({ reached: data.reached ?? 0, ts: Date.now() });
        notify({ type: "success", title: `🔊 Vocal envoyé à ${data.reached} client${(data.reached ?? 0) !== 1 ? "s" : ""}` });
      } else {
        notify({ type: "error", title: "Erreur TTS", message: data.error });
      }
    } finally {
      setSending(false);
    }
  }

  function preview() {
    if (!text.trim()) return;
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = "fr-FR";
      utt.pitch = pitch;
      utt.rate = rate;
      window.speechSynthesis.speak(utt);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <SectionHeader
        title="Synthèse vocale"
        subtitle="Fais parler tous les navigateurs connectés"
        actions={lastResult && (
          <span style={{ fontFamily: "var(--t-font-body)", fontSize: "var(--t-text-xs)", color: "var(--t-text-muted)" }}>
            Dernier envoi : {lastResult.reached} client{lastResult.reached !== 1 ? "s" : ""}
          </span>
        )}
      />
      <div style={{ flex: 1, overflow: "auto", padding: 16, display: "flex", gap: 16 }}>

        {/* Pranks prédéfinis */}
        <div style={{ flex: 1 }}>
          <div style={panelBox}>
            <div style={panelTitleStyle}>Pranks prédéfinis 🎤</div>
            <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              {TTS_PRANKS.map((p) => (
                <button
                  key={p.label}
                  disabled={sending}
                  onClick={() => send(p)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 10px",
                    border: "2px solid",
                    borderTopColor: "var(--t-border-light)",
                    borderLeftColor: "var(--t-border-light)",
                    borderBottomColor: "var(--t-border-dark)",
                    borderRightColor: "var(--t-border-dark)",
                    background: "var(--t-bg)",
                    cursor: sending ? "wait" : "pointer",
                    fontFamily: "var(--t-font-body)",
                    fontSize: "var(--t-text-sm)",
                    color: "var(--t-text)",
                    textAlign: "left",
                    opacity: sending ? 0.6 : 1,
                  }}
                >
                  <span style={{ fontSize: "var(--t-text-base)" }}>🔊</span>
                  <span style={{ flex: 1 }}>{p.label}</span>
                  {(p.pitch !== undefined && p.pitch !== 1) && (
                    <span style={{ fontSize: "var(--t-text-xs)", color: "var(--t-text-muted)" }}>
                      pitch {p.pitch}
                    </span>
                  )}
                  {(p.rate !== undefined && p.rate !== 1) && (
                    <span style={{ fontSize: "var(--t-text-xs)", color: "var(--t-text-muted)" }}>
                      ×{p.rate}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Composer custom */}
        <div style={{ flex: 1, maxWidth: 340 }}>
          <div style={panelBox}>
            <div style={panelTitleStyle}>Message vocal personnalisé</div>
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={labelStyle}>Texte à dire</label>
                <textarea
                  value={text}
                  placeholder="Ce que tu veux faire dire aux navigateurs…"
                  onChange={(e) => setText(e.target.value)}
                  rows={5}
                  style={{ ...inset, width: "100%", boxSizing: "border-box" as const, resize: "vertical" as const }}
                />
              </div>
              <div>
                <label style={labelStyle}>Tonalité (pitch) : {pitch}</label>
                <input
                  type="range" min="0.5" max="2" step="0.1"
                  value={pitch}
                  onChange={(e) => setPitch(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <label style={labelStyle}>Vitesse (rate) : {rate}</label>
                <input
                  type="range" min="0.5" max="2" step="0.1"
                  value={rate}
                  onChange={(e) => setRate(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={preview}
                  disabled={!text.trim()}
                  style={{ ...btn(), flex: 1, opacity: !text.trim() ? 0.5 : 1 }}
                >
                  ▶ Prévisualiser
                </button>
                <button
                  disabled={sending || !text.trim()}
                  onClick={() => send({ text, pitch, rate })}
                  style={{ ...btn("accent"), flex: 2, padding: "6px 0", textAlign: "center" as const, opacity: (sending || !text.trim()) ? 0.6 : 1 }}
                >
                  {sending ? "Envoi…" : "🔊 Broadcaster"}
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── peagle panel ────────────────────────────────────────────────────────────

type PeagleScoreRow = {
  userId: string;
  username: string | null;
  score: number;
  won: boolean;
  createdAt: number;
};

function PeaglePanel() {
  const notify = useNotify();
  const [scores, setScores] = useState<PeagleScoreRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmUser, setConfirmUser] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch("/api/admin/peagle-scores")
      .then((r) => r.json())
      .then((d: { scores: PeagleScoreRow[]; total: number }) => {
        setScores(d.scores ?? []);
        setTotal(d.total ?? 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, []);

  async function resetAll() {
    setBusy(true);
    const res = await fetch("/api/admin/peagle-scores", { method: "DELETE" });
    const data = await res.json() as { ok?: boolean; error?: string };
    setBusy(false);
    setConfirmReset(false);
    if (data.ok) {
      setScores([]);
      setTotal(0);
      notify({ type: "success", title: "Scores Peagle réinitialisés" });
    } else {
      notify({ type: "error", title: "Erreur", message: data.error });
    }
  }

  async function resetUser(userId: string) {
    setBusy(true);
    const res = await fetch("/api/admin/peagle-scores", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json() as { ok?: boolean; error?: string };
    setBusy(false);
    setConfirmUser(null);
    if (data.ok) {
      setScores((prev) => prev.filter((s) => s.userId !== userId));
      setTotal((t) => Math.max(0, t - scores.filter((s) => s.userId === userId).length));
      notify({ type: "success", title: "Scores supprimés pour cet utilisateur" });
    } else {
      notify({ type: "error", title: "Erreur", message: data.error });
    }
  }

  const cell: React.CSSProperties = { padding: "6px 10px", verticalAlign: "middle" };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <SectionHeader
        title="Peagle 98"
        subtitle={loading ? "Chargement…" : `${total} score${total !== 1 ? "s" : ""} en base · top 20 affiché`}
        actions={
          <>
            <button style={btn()} onClick={load} disabled={loading || busy}>↻ Rafraîchir</button>
            {confirmReset ? (
              <>
                <span style={{ fontFamily: "var(--t-font-body)", fontSize: "var(--t-text-xs)", color: "var(--t-error)" }}>
                  Tout supprimer ?
                </span>
                <button style={btn("danger")} disabled={busy} onClick={resetAll}>
                  {busy ? "…" : "Confirmer"}
                </button>
                <button style={btn()} onClick={() => setConfirmReset(false)}>Annuler</button>
              </>
            ) : (
              <button style={btn("danger")} onClick={() => setConfirmReset(true)} disabled={busy || total === 0}>
                Reset tous les scores
              </button>
            )}
          </>
        }
      />
      <div style={{ flex: 1, overflow: "auto" }}>
        {loading ? (
          <div style={{ padding: 20, fontFamily: "var(--t-font-body)", fontSize: "var(--t-text-sm)", color: "var(--t-text-muted)" }}>
            Chargement…
          </div>
        ) : scores.length === 0 ? (
          <div style={{ padding: 20, fontFamily: "var(--t-font-body)", fontSize: "var(--t-text-sm)", color: "var(--t-text-muted)", textAlign: "center" }}>
            Aucun score enregistré.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--t-font-body)", fontSize: "var(--t-text-sm)" }}>
            <thead>
              <tr style={{ ...divider, textAlign: "left", color: "var(--t-text-muted)", background: "var(--t-inset-from)" }}>
                <th style={{ ...cell, width: 30 }}>#</th>
                <th style={cell}>Joueur</th>
                <th style={cell}>Score</th>
                <th style={cell}>Victoire</th>
                <th style={cell}>Date</th>
                <th style={cell}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {scores.map((s, i) => (
                <tr key={`${s.userId}-${s.createdAt}`} style={{ borderBottom: "1px solid var(--t-border-dark)", color: "var(--t-text)" }}>
                  <td style={{ ...cell, color: "var(--t-text-muted)", fontSize: "var(--t-text-xs)" }}>{i + 1}</td>
                  <td style={cell}>
                    <span style={{ color: "var(--t-accent)" }}>{s.username ?? s.userId.slice(0, 8)}</span>
                  </td>
                  <td style={cell}>
                    <span style={{ fontFamily: "var(--t-font-display)", color: "var(--t-accent)" }}>
                      {s.score.toLocaleString("fr-FR")}
                    </span>
                  </td>
                  <td style={cell}>
                    {s.won
                      ? <span style={{ color: "var(--t-success)" }}>✔ Gagné</span>
                      : <span style={{ color: "var(--t-text-muted)" }}>—</span>
                    }
                  </td>
                  <td style={{ ...cell, color: "var(--t-text-muted)", fontSize: "var(--t-text-xs)" }}>
                    {new Date(s.createdAt).toLocaleDateString("fr-FR")}
                  </td>
                  <td style={cell}>
                    {confirmUser === s.userId ? (
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <span style={{ fontSize: "var(--t-text-xs)", color: "var(--t-text-muted)" }}>Confirmer ?</span>
                        <button style={btn("danger")} disabled={busy} onClick={() => resetUser(s.userId)}>
                          {busy ? "…" : "Oui"}
                        </button>
                        <button style={btn()} onClick={() => setConfirmUser(null)}>Non</button>
                      </div>
                    ) : (
                      <button style={btn("danger")} onClick={() => setConfirmUser(s.userId)} disabled={busy}>
                        Supprimer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── access denied ────────────────────────────────────────────────────────────

function AccessDenied() {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100%",
      gap: 12,
      background: "var(--t-bg)",
      fontFamily: "var(--t-font-body)",
    }}>
      <span style={{ fontSize: 48 }}>🔒</span>
      <span style={{ fontSize: "var(--t-text-sm)", color: "var(--t-text-muted)" }}>
        Accès réservé aux administrateurs
      </span>
    </div>
  );
}

// ─── root component ───────────────────────────────────────────────────────────

export function DbAdmin({ windowId: _windowId }: AppProps) {
  const [access, setAccess] = useState<"pending" | "granted" | "denied">("pending");
  const [section, setSection] = useState<Section>("live");

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.status === 403 ? "denied" : "granted")
      .then(setAccess)
      .catch(() => setAccess("denied"));
  }, []);

  if (access === "pending") return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: "var(--t-bg)", fontFamily: "var(--t-font-body)", fontSize: "var(--t-text-sm)", color: "var(--t-text-muted)" }}>
      Vérification…
    </div>
  );

  if (access === "denied") return <AccessDenied />;

  return (
    <div style={{ display: "flex", height: "100%", background: "var(--t-bg)" }}>
      <Sidebar active={section} onSelect={setSection} />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {section === "live"           && <LivePanel />}
        {section === "users"         && <UsersPanel />}
        {section === "database"      && <DatabasePanel />}
        {section === "notifications" && <NotificationsPanel />}
        {section === "broadcast"     && <BroadcastPanel />}
        {section === "vocal"         && <VocalPanel />}
        {section === "peagle"        && <PeaglePanel />}
      </div>
    </div>
  );
}
