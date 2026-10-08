"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";

export type LightSettingsSection = {
  id: "conta" | "disponibilidade" | "whatsapp" | "seguranca" | "extensao";
  title: string;
  description: string;
  node: ReactNode;
};

/**
 * Configurações of the broker app. Without ?tab it lists the sections as cards; with ?tab it shows
 * that section (the app header carries the title and the back button). The section content comes
 * from the server page, so passkey and 2FA keep their own components and logic.
 */
export function LightSettings({ sections }: { sections: LightSettingsSection[] }) {
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

  if (active) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 pb-6 pt-2 sm:px-6">
        <h1 className="sr-only">{active.title}</h1>
        {active.node}
      </div>
    );
  }

  return (
    <div className="arc-venancor mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 pb-6 pt-2 sm:px-6">
      <h1 className="sr-only">Configurações</h1>
      <p className="text-sm text-(--text-secondary)">Sua conta, sua disponibilidade e a segurança do acesso.</p>
      <ul className="overflow-hidden rounded-3xl bg-(--surface) shadow-(--shadow-resting)">
        {sections.map((section) => (
          <li key={section.id} className="border-b border-(--border) last:border-b-0">
            <Link href={`/settings?tab=${section.id}`} className="flex min-h-16 items-center justify-between gap-3 px-5 py-4 active:bg-(--surface-muted)">
              <span className="min-w-0">
                <span className="block text-base font-semibold text-(--foreground)">{section.title}</span>
                <span className="block text-sm text-(--text-secondary)">{section.description}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-(--text-muted)" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
