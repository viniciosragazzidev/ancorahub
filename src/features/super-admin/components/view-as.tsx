"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { Avatar } from "@/components/arc/avatar/avatar";
import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { useTopStrip } from "@/components/light/use-top-strip";

import styles from "./view-as.module.css";

export type ViewAsState = { canViewAs: boolean; viewingAs: { name: string; role: string } | null };
type Candidate = { userId: string; name: string; email: string; role: "broker" | "supervisor" | "manager"; tenantName: string; branchName: string | null; image: string | null };

const ROLE_LABEL: Record<string, string> = { broker: "Corretor", supervisor: "Supervisor", manager: "Gestor" };
export const EXIT_VIEW_AS_HREF = "/api/super-admin/view-as/exit";

const Bolt = ({ size = 18 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true"><path d="M13.2 2.5 4.6 13.4c-.4.5 0 1.1.6 1.1h5.3l-1.3 6.9c-.1.7.8 1.1 1.2.5l8.7-11c.4-.5 0-1.2-.6-1.2h-5.3l1.3-6.6c.2-.7-.8-1.1-1.3-.6z" /></svg>
);

/**
 * The super admin's lightning button (end of the "Mais" menu, or the sidebar):
 * opens "Ver como" to see the app as a broker or a supervisor, or goes back to
 * the admin's own access while viewing as someone.
 */
export function ViewAsButton({ state, variant = "menu", onNavigate }: { state: ViewAsState; variant?: "menu" | "sidebar"; onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  if (!state.canViewAs) return null;
  if (state.viewingAs) {
    return (
      <a href={EXIT_VIEW_AS_HREF} className={styles.button} data-variant={variant} data-active="true" onClick={onNavigate}>
        <span className={styles.bolt}><Bolt /></span>
        <span className={styles.label}><strong>Voltar ao meu acesso</strong><small>Vendo como {state.viewingAs.name}</small></span>
      </a>
    );
  }
  return (
    <>
      <button type="button" className={styles.button} data-variant={variant} onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span className={styles.bolt}><Bolt /></span>
        <span className={styles.label}><strong>Ver como</strong><small>Entre como corretor, supervisor ou gestor</small></span>
      </button>
      <ViewAsSheet open={open} onOpenChange={setOpen} />
    </>
  );
}

function ViewAsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<Candidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const request = useRef(0);

  useEffect(() => {
    if (!open) return;
    const id = ++request.current;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/super-admin/view-as/users?q=${encodeURIComponent(query)}`, { cache: "no-store" });
        const body = (await response.json()) as { users?: Candidate[]; error?: string };
        if (id !== request.current) return;
        if (!response.ok) { setError(body.error ?? "Não deu para buscar agora."); setUsers([]); return; }
        setError(null);
        setUsers(body.users ?? []);
      } catch {
        if (id === request.current) { setError("Não deu para buscar agora. Confira a internet."); setUsers([]); }
      }
    }, query ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [open, query]);

  async function start(user: Candidate) {
    setStarting(user.userId);
    setError(null);
    try {
      const response = await fetch("/api/super-admin/view-as", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.userId }) });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) { setError(body.error ?? "Não deu para entrar agora."); setStarting(null); return; }
      window.location.assign("/dashboard");
    } catch {
      setError("Não deu para entrar agora. Confira a internet.");
      setStarting(null);
    }
  }

  return (
    <BottomSheet className="arc-venancor" open={open} onOpenChange={onOpenChange} title="Ver como" description="Você vê o app exatamente como a pessoa vê. Só visualização: nada que você tocar é gravado." detents={[0.92]} closeLabel="Fechar">
      <div className={styles.sheet}>
        <div className={styles.searchWrap}>
          <svg className={styles.searchIcon} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
          <input className={styles.search} type="search" value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Nome ou e-mail" aria-label="Buscar corretor, supervisor ou gestor" autoComplete="off" />
        </div>
        {error ? <p role="alert" className={styles.error}>{error}</p> : null}
        {users === null ? <p className={styles.muted} role="status">Carregando...</p> : null}
        {users && !users.length && !error ? <p className={styles.muted}>Ninguém com esse nome. Tente o e-mail.</p> : null}
        {users?.length ? (
          <ul className={styles.list} aria-label="Corretores e supervisores">
            {users.map((user) => (
              <li key={user.userId}>
                <button type="button" className={styles.row} onClick={() => void start(user)} disabled={Boolean(starting)} aria-busy={starting === user.userId}>
                  <Avatar name={user.name} src={user.image ?? undefined} size="md" />
                  <span className={styles.rowText}>
                    <strong>{user.name}</strong>
                    <small>{[user.branchName, user.tenantName].filter(Boolean).join(" · ")}</small>
                  </span>
                  <span className={styles.role} data-role={user.role}>{starting === user.userId ? "Entrando..." : ROLE_LABEL[user.role]}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </BottomSheet>
  );
}

/** Fixed strip while viewing as someone: who, read only, and the way back. */
export function ViewAsBanner({ viewingAs }: { viewingAs: ViewAsState["viewingAs"] }) {
  const active = Boolean(viewingAs);
  const bannerRef = useRef<HTMLDivElement>(null);
  // Layout effect: runs before the tours and welcome cards (rendered after the banner) read their marks.
  useLayoutEffect(() => {
    if (!active) return;
    const html = document.documentElement;
    html.dataset.viewAs = "1";
    return () => { delete html.dataset.viewAs; };
  }, [active]);
  useTopStrip(bannerRef, active);
  if (!viewingAs) return null;
  return (
    <div ref={bannerRef} className={styles.banner} role="status">
      <span className={styles.bannerBolt}><Bolt size={14} /></span>
      <span className={styles.bannerText}>Vendo como <strong>{viewingAs.name}</strong> ({ROLE_LABEL[viewingAs.role] ?? viewingAs.role}) · só visualização</span>
      <a href={EXIT_VIEW_AS_HREF} className={styles.bannerExit}>Voltar ao meu acesso</a>
    </div>
  );
}
