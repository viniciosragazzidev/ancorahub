"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

export type LightSettingsSection = {
  id: "conta" | "disponibilidade" | "whatsapp" | "seguranca" | "extensao" | "placar" | "acessibilidade" | "unidade" | "notificacoes";
  title: string;
  description: string;
  node: ReactNode;
};

/**
 * Configurações of the Lite app (broker and manager). Without ?tab it lists the sections as cards;
 * with ?tab it shows that section (the app header carries the title and the back button). The
 * section content comes from the server page, so passkey and 2FA keep their own components and logic.
 */
export function LightSettings({ sections, intro = "Sua conta, sua disponibilidade e a segurança do acesso.", header }: { sections: LightSettingsSection[]; intro?: string; header?: ReactNode }) {
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
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

  // Entrance: the page rises a little and the rows come in one after the other; only fades with reduced motion.
  const enter = (index: number) => reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.15 } }
    : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.22, delay: Math.min(index, 8) * 0.035, ease: [0.22, 1, 0.36, 1] as const } };

  if (active) {
    return (
      <motion.div key={active.id} {...enter(0)} data-tour="micro-settings-intro" className="mx-auto w-full max-w-4xl px-4 pb-6 pt-2 sm:px-6">
        <h1 className="sr-only">{active.title}</h1>
        {active.node}
      </motion.div>
    );
  }

  return (
    <div className="arc-venancor mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 pb-6 pt-2 sm:px-6">
      <h1 className="sr-only">Configurações</h1>
      {header ? <motion.div {...enter(0)}>{header}</motion.div> : null}
      <motion.p {...enter(header ? 1 : 0)} data-tour="micro-settings-intro" className="text-sm text-(--text-secondary)">{intro}</motion.p>
      <ul data-tour="micro-settings-sections" className="overflow-hidden rounded-3xl bg-(--surface) shadow-(--shadow-resting)">
        {sections.map((section, index) => (
          <motion.li key={section.id} {...enter(index + 2)} data-tour={index === 0 ? "micro-settings-account" : undefined} className="border-b border-(--border) last:border-b-0">
            <Link href={`/settings?tab=${section.id}`} className="group flex min-h-16 items-center justify-between gap-3 px-5 py-4 transition-colors duration-150 hover:bg-(--surface-muted) active:bg-(--surface-muted) motion-reduce:transition-none">
              <span className="min-w-0">
                <span className="block text-base font-semibold text-(--foreground)">{section.title}</span>
                <span className="block text-sm text-(--text-secondary)">{section.description}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-(--text-muted) transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
            </Link>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
