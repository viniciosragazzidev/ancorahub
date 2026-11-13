"use client";

import { useEffect, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Accessibility,
  Bell,
  Building2,
  CalendarClock,
  ChevronRight,
  MessageCircle,
  Puzzle,
  ShieldCheck,
  Trophy,
  User,
  type LucideIcon,
} from "lucide-react";

import styles from "./light-settings.module.css";

export type LightSettingsSection = {
  id: "conta" | "disponibilidade" | "whatsapp" | "seguranca" | "extensao" | "placar" | "acessibilidade" | "unidade" | "notificacoes";
  title: string;
  description: string;
  node: ReactNode;
};

type SectionId = LightSettingsSection["id"];

const SECTION_ICONS: Record<SectionId, LucideIcon> = {
  conta: User,
  unidade: Building2,
  seguranca: ShieldCheck,
  disponibilidade: CalendarClock,
  whatsapp: MessageCircle,
  notificacoes: Bell,
  placar: Trophy,
  acessibilidade: Accessibility,
  extensao: Puzzle,
};

// Groups of the list, like a phone settings screen. Order inside a group follows the order the page sends.
const SECTION_GROUPS: { title: string; ids: SectionId[] }[] = [
  { title: "Conta", ids: ["conta", "unidade", "seguranca"] },
  { title: "Atendimento", ids: ["disponibilidade", "whatsapp", "notificacoes", "placar"] },
  { title: "Preferências", ids: ["acessibilidade", "extensao"] },
];

function groupSections(sections: LightSettingsSection[]) {
  const grouped = SECTION_GROUPS.map((group) => ({
    title: group.title,
    sections: sections.filter((section) => group.ids.includes(section.id)),
  }));
  const known = new Set(SECTION_GROUPS.flatMap((group) => group.ids));
  const others = sections.filter((section) => !known.has(section.id));
  if (others.length) grouped.push({ title: "Outros", sections: others });
  return grouped.filter((group) => group.sections.length > 0);
}

/**
 * Configurações of the Lite app (broker and manager). Without ?tab it lists the sections as cards;
 * with ?tab it shows that section (the app header carries the title and the back button). The
 * section content comes from the server page, so passkey and 2FA keep their own components and logic.
 */
export function LightSettings({ sections, intro = "Sua conta, sua disponibilidade e a segurança do acesso.", header, footer }: { sections: LightSettingsSection[]; intro?: string; header?: ReactNode; footer?: ReactNode }) {
  const searchParams = useSearchParams();
  const requested = searchParams.get("tab");
  // Old links use tab=passkey for the security section.
  const activeId = requested === "passkey" ? "seguranca" : requested;
  const active = sections.find((section) => section.id === activeId);
  const wantsPasskey = requested === "passkey";

  useEffect(() => {
    if (!wantsPasskey) return;
    const timer = window.setTimeout(() => document.getElementById("passkey-section")?.scrollIntoView({ behavior: "smooth" }), 100);
    return () => window.clearTimeout(timer);
  }, [wantsPasskey, activeId]);

  // Entrance: the page rises a little and the rows come in one after the other (CSS, so it never hides content); only fades with reduced motion.
  const enter = (index: number) => ({ style: { "--enter-index": Math.min(index, 8) } as CSSProperties });

  if (active) {
    return (
      <div key={active.id} {...enter(0)} data-tour="micro-settings-intro" className={`${styles.enter} mx-auto w-full max-w-4xl px-4 pb-6 pt-2 sm:px-6`}>
        <h1 className="sr-only">{active.title}</h1>
        {active.node}
      </div>
    );
  }

  return (
    <div className="arc-venancor mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 pb-6 pt-2 sm:px-6">
      <h1 className="sr-only">Configurações</h1>
      {header ? <div {...enter(0)} className={styles.enter}>{header}</div> : null}
      <p {...enter(header ? 1 : 0)} data-tour="micro-settings-intro" className={`${styles.enter} text-sm text-(--text-secondary)`}>{intro}</p>
      <div data-tour="micro-settings-sections" className="flex flex-col gap-5">
        {groupSections(sections).map((group, groupIndex) => (
          <section key={group.title} aria-labelledby={`settings-group-${groupIndex}`} className="flex flex-col gap-2">
            <h2 id={`settings-group-${groupIndex}`} className="px-1 text-sm font-semibold text-(--text-secondary)">
              {group.title}
            </h2>
            <ul className="overflow-hidden rounded-3xl bg-(--surface) shadow-(--shadow-resting)">
              {group.sections.map((section) => {
                const index = sections.indexOf(section);
                const Icon = SECTION_ICONS[section.id];
                return (
                  <li
                    key={section.id}
                    {...enter(index + 2)}
                    data-tour={index === 0 ? "micro-settings-account" : undefined}
                    className={`${styles.enter} relative after:absolute after:bottom-0 after:left-19 after:right-0 after:h-px after:bg-(--border) last:after:hidden`}
                  >
                    <Link href={`/settings?tab=${section.id}`} className="group flex min-h-16 items-center gap-4 px-4 py-3.5 transition-colors duration-150 hover:bg-(--surface-muted) active:bg-(--surface-muted) motion-reduce:transition-none">
                      <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-2xl bg-(--chat-action-soft) text-(--chat-action-text)">
                        <Icon className="size-5" strokeWidth={1.9} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-semibold text-(--foreground)">{section.title}</span>
                        <span className="block text-sm text-(--text-secondary)">{section.description}</span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-(--text-muted) transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      {footer}
    </div>
  );
}
