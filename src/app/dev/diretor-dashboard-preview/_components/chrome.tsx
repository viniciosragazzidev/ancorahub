"use client";

/**
 * The director's chrome in the Lite look, only inside this preview (the real one is F2 of the plan):
 * the same sections and items of corretop-sidebar.tsx, monochrome icons, active item in a pill,
 * and a header in the LightAppHeader style.
 */
import Link from "next/link";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Bell, Bot, CircleDollarSign, CircleHelp, Eye, HeartHandshake, LayoutGrid, Lightbulb, Megaphone, Menu, MessageCircle,
  MessagesSquare, MessageSquareText, PanelLeftClose, PanelLeftOpen, Presentation, Search, SlidersHorizontal, Sparkles, Users, Wrench, X,
} from "lucide-react";

import { motionTokens as m } from "@/components/arc/motion-tokens";

import styles from "../preview.module.css";
import { initials } from "./format";
import { exitT, fadeT, LiteNumber, useReduce } from "./motion";

type Item = { label: string; href: string; icon: typeof LayoutGrid; section: string; beta?: boolean; statusDot?: boolean };

/** Same items, order and sections as navigationItems in src/components/corretop-sidebar.tsx. */
const NAV: Item[] = [
  { label: "Painel", href: "/dashboard", icon: LayoutGrid, section: "Principal" },
  { label: "Conversas", href: "/conversas", icon: MessagesSquare, section: "Principal" },
  { label: "Leads", href: "/leads", icon: Lightbulb, section: "Principal" },
  { label: "Distribuição", href: "/distribuicao", icon: Presentation, section: "Operação" },
  { label: "Vendas", href: "/vendas", icon: CircleDollarSign, section: "Operação" },
  { label: "Equipe", href: "/equipe", icon: Users, section: "Operação" },
  { label: "Relacionamento", href: "/relacionamento", icon: HeartHandshake, section: "Operação" },
  { label: "Qualificação", href: "/qualificacao", icon: Sparkles, section: "Marketing" },
  { label: "Atendimento", href: "/atendimento/situacoes", icon: MessageSquareText, section: "Marketing" },
  { label: "WhatsApp", href: "/integrations/whatsapp", icon: MessageCircle, section: "Marketing", beta: true, statusDot: true },
  { label: "Campanhas", href: "/marketing/campanhas", icon: Megaphone, section: "Marketing" },
  { label: "Ferramentas", href: "/ferramentas", icon: Wrench, section: "Ferramentas" },
  { label: "Ajustes", href: "/settings", icon: SlidersHorizontal, section: "Administração" },
];

const USER = { name: "Renata Vasconcelos", role: "Diretora" };

function NavList({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  return (
    <nav aria-label="Menu principal" className={styles.nav}>
      {NAV.map((item, index) => {
        const showSection = index === 0 || NAV[index - 1].section !== item.section;
        const active = item.href === "/dashboard";
        const Icon = item.icon;
        return (
          <div key={item.href} className={styles.navGroup}>
            {showSection ? <p className={styles.navSection} data-collapsed={collapsed}>{item.section}</p> : null}
            <Link
              href={item.href}
              className={styles.navItem}
              data-active={active}
              aria-current={active ? "page" : undefined}
              aria-label={collapsed ? item.label : undefined}
              title={collapsed ? item.label : undefined}
              onClick={onNavigate}
            >
              {active ? <motion.span layoutId="director-nav-pill" className={styles.navPill} transition={m.spring.morph} /> : null}
              <span className={styles.navIcon}>
                <Icon aria-hidden="true" size={20} strokeWidth={active ? 2.2 : 1.9} />
                {item.statusDot ? <span className={styles.navDot} aria-label="WhatsApp conectado" /> : null}
              </span>
              <span className={styles.navLabel} data-collapsed={collapsed}>{item.label}</span>
              {item.beta && !collapsed ? <span className={styles.betaBadge}>Beta</span> : null}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}

function SidebarBody({ collapsed, onToggle, onNavigate, closeButton }: { collapsed: boolean; onToggle?: () => void; onNavigate?: () => void; closeButton?: ReactNode }) {
  return (
    <>
      <div className={styles.brandRow}>
        <span className={styles.brandMark} aria-hidden="true">Â</span>
        <span className={styles.brandText} data-collapsed={collapsed}>
          <span className={styles.brandName}>Âncora Saúde</span>
          <span className={styles.brandSub}>CorreTop</span>
        </span>
        {closeButton}
      </div>
      <Link href="/ver-como" className={styles.sideRow} aria-label={collapsed ? "Ver como" : undefined} title={collapsed ? "Ver como" : undefined} onClick={onNavigate}>
        <Eye aria-hidden="true" size={18} />
        <span className={styles.navLabel} data-collapsed={collapsed}>Ver como</span>
      </Link>
      <Link href="/distribuicao?view=plantao" className={styles.sideRow} aria-label={collapsed ? "Área de plantão, plantão ao vivo ativo" : undefined} title="Plantão ao vivo ativo" onClick={onNavigate}>
        <span className={styles.liveDot} aria-hidden="true" />
        <span className={styles.navLabel} data-collapsed={collapsed}>Área de plantão</span>
      </Link>
      <NavList collapsed={collapsed} onNavigate={onNavigate} />
      <div className={styles.sideFooter}>
        <button type="button" className={styles.sideRow} aria-label={collapsed ? "Agente IA" : undefined} title={collapsed ? "Agente IA" : undefined}>
          <Bot aria-hidden="true" size={18} />
          <span className={styles.navLabel} data-collapsed={collapsed}>Agente IA</span>
          <span className={styles.liveDot} aria-hidden="true" data-collapsed={collapsed} />
        </button>
        <button type="button" className={styles.profileRow} aria-label={`Perfil de ${USER.name}`}>
          <span className={styles.avatar} aria-hidden="true">{initials(USER.name)}</span>
          <span className={styles.profileText} data-collapsed={collapsed}>
            <span className={styles.profileName}>{USER.name}</span>
            <span className={styles.profileRole}>{USER.role}</span>
          </span>
        </button>
        {onToggle ? (
          <button type="button" className={styles.sideRow} onClick={onToggle} aria-label={collapsed ? "Abrir menu lateral" : "Recolher menu lateral"} title="Ctrl+B">
            {collapsed ? <PanelLeftOpen aria-hidden="true" size={18} /> : <PanelLeftClose aria-hidden="true" size={18} />}
            <span className={styles.navLabel} data-collapsed={collapsed}>Recolher menu</span>
          </button>
        ) : null}
      </div>
    </>
  );
}

export function LiteSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside className={styles.sidebar} data-collapsed={collapsed} aria-label="Navegação">
      <SidebarBody collapsed={collapsed} onToggle={onToggle} />
    </aside>
  );
}

/** Below 1024px the same menu opens as a left drawer (D7 keeps the drawer). */
export function LiteDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const reduce = useReduce();
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("button")?.focus();
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); trigger?.focus?.(); };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open ? (
        <div className={styles.drawerRoot} key="drawer">
          <motion.div className={styles.veil} onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: m.duration.fast } }} exit={{ opacity: 0, transition: exitT }} />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={styles.drawer}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0, transition: reduce ? fadeT : m.spring.smooth }}
            exit={{ opacity: 0, x: reduce ? 0 : -12, transition: exitT }}
          >
            <span id={titleId} className={styles.srOnly}>Menu</span>
            <SidebarBody
              collapsed={false}
              onNavigate={onClose}
              closeButton={<button type="button" className={styles.iconButton} onClick={onClose} aria-label="Fechar menu"><X aria-hidden="true" size={18} /></button>}
            />
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

/** Header in the LightAppHeader style: [menu] [title] [search] [notifications] [help] [avatar]. Gains a border when the page scrolls. */
export function LiteHeader({ title, scrolled, onMenu, notifications, notificationPulse }: { title: string; scrolled: boolean; onMenu: () => void; notifications: number; notificationPulse: number }) {
  const reduce = useReduce();
  return (
    <header className={styles.header} data-scrolled={scrolled}>
      <button type="button" className={`${styles.iconButton} ${styles.menuButton}`} onClick={onMenu} aria-label="Abrir menu">
        <Menu aria-hidden="true" size={20} />
      </button>
      <p className={styles.headerTitle}>{title}</p>
      <div className={styles.headerActions}>
        <button type="button" className={`${styles.searchButton}`} aria-label="Buscar (Ctrl+K)">
          <Search aria-hidden="true" size={18} />
          <span className={styles.searchText}>Buscar</span>
          <kbd className={styles.kbd}>Ctrl K</kbd>
        </button>
        <button type="button" className={styles.iconButton} aria-label={`Notificações, ${notifications} novas`}>
          <motion.span
            key={notificationPulse}
            className={styles.bellWrap}
            initial={reduce || !notificationPulse ? false : { rotate: -12 }}
            animate={{ rotate: 0 }}
            transition={m.spring.snappy}
          >
            <Bell aria-hidden="true" size={18} />
          </motion.span>
          {notifications ? <span className={styles.bellBadge}><LiteNumber value={notifications} /></span> : null}
        </button>
        <button type="button" className={`${styles.iconButton} ${styles.hideSm}`} aria-label="Ajuda">
          <CircleHelp aria-hidden="true" size={18} />
        </button>
        <span className={`${styles.avatar} ${styles.hideSm}`} aria-hidden="true">{initials(USER.name)}</span>
      </div>
    </header>
  );
}
