"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Building06Icon, LinkSquare01Icon, SecurityCheckIcon, UserIcon, Store01Icon, Message01Icon, PuzzleIcon } from "@hugeicons/core-free-icons";
import { ScrollArea } from "@/components/ui/scroll-area";

export type TabId = "conta" | "empresa" | "unidade" | "whatsapp" | "integracoes" | "seguranca" | "atendimento" | "passkey" | "extensao";
type Tab = { id: TabId; label: string; icon: typeof UserIcon };

export function SettingsTabs({ account, company, unit, whatsapp, integrations, security, atendimento, extension, tabIds }: { account: ReactNode; company?: ReactNode; unit?: ReactNode; whatsapp: ReactNode; integrations?: ReactNode; security: ReactNode; atendimento?: ReactNode; extension?: ReactNode; tabIds: TabId[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const allTabs: Tab[] = [
    { id: "conta", label: "Minha conta", icon: UserIcon },
    { id: "empresa", label: "Empresa", icon: Building06Icon },
    { id: "unidade", label: "Unidade", icon: Store01Icon },
    { id: "atendimento", label: "Atendimento", icon: Message01Icon },
    { id: "whatsapp", label: "WhatsApp", icon: LinkSquare01Icon },
    { id: "integracoes", label: "Integrações", icon: LinkSquare01Icon },
    { id: "seguranca", label: "Segurança", icon: SecurityCheckIcon },
    { id: "extensao", label: "Extensão", icon: PuzzleIcon },
  ];
  const tabs = allTabs.filter((tab) => tabIds.includes(tab.id));
  const requested = searchParams.get("tab") as string | null;
  const isPasskeyRequested = requested === "passkey";
  const effectiveRequested = isPasskeyRequested ? "seguranca" : (requested as TabId | null);
  const active = tabs.some((tab) => tab.id === effectiveRequested) ? effectiveRequested! : tabs[0]?.id ?? "conta";

  useEffect(() => {
    if (isPasskeyRequested || window.location.hash === "#passkey-section") {
      const el = document.getElementById("passkey-section");
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: "smooth" }), 100);
      }
    }
  }, [isPasskeyRequested]);

  function selectTab(tabId: TabId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tabId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[13.5rem_1fr]">
      <ScrollArea orientation="horizontal" className="w-full whitespace-nowrap lg:hidden">
        <nav className="flex gap-1 pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => selectTab(tab.id)}
              className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors ${active === tab.id ? "bg-secondary font-semibold text-foreground border border-border/80 shadow-2xs" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"}`}
            >
              <HugeiconsIcon icon={tab.icon} size={16} />
              {tab.label}
            </button>
          ))}
        </nav>
      </ScrollArea>

      <nav className="hidden gap-1 lg:flex lg:flex-col">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => selectTab(tab.id)}
            className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors ${active === tab.id ? "bg-secondary font-semibold text-foreground border border-border/80 shadow-2xs" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"}`}
          >
            <HugeiconsIcon icon={tab.icon} size={16} />
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="min-w-0">
        {active === "conta" ? account : null}
        {active === "empresa" ? company : null}
        {active === "unidade" ? unit : null}
        {active === "whatsapp" ? whatsapp : null}
        {active === "integracoes" ? integrations : null}
        {active === "atendimento" ? atendimento : null}
        {active === "seguranca" ? security : null}
        {active === "extensao" ? extension : null}
      </div>
    </div>
  );
}
