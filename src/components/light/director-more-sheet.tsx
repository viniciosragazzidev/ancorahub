"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Bell,
  Bot,
  CircleHelp,
  Download,
  LogOut,
  Search,
  Settings2,
  UserRound,
} from "lucide-react";

import { Avatar } from "@/components/arc/avatar/avatar";
import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { Button } from "@/components/arc/button/button";
import { SuperAdminRoleSwitcher } from "@/components/super-admin-role-switcher";
import { ViewAsButton } from "@/features/super-admin/components/view-as";
import { signOut } from "@/shared/auth/client";
import { cn } from "@/lib/utils";

import { useDirectorChrome } from "./director-chrome-context";

function openLayer(eventName: string) {
  window.dispatchEvent(new Event(eventName));
}

export function DirectorMoreSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const chrome = useDirectorChrome();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const profile = chrome?.profile;
  const canSettings = Boolean(profile?.permissions?.includes("acessar_configuracoes")
    || profile?.permissions?.includes("acessar_configuracoes_pessoais")
    || profile?.roleKey === "director");

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut({ fetchOptions: { onSuccess: () => router.replace("/login") } });
    } finally {
      router.replace("/login");
    }
  }

  const rowClass = "director-more-row flex min-h-11 w-full items-center gap-3 rounded-full px-3 text-left text-sm font-medium text-(--foreground) transition-colors hover:bg-(--surface-muted) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)";

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="Mais" detents={[0.62, 0.92]} initialDetent={1} closeLabel="Fechar" className="arc-venancor">
      <div className="flex flex-col gap-3 pb-3">
        <div className="flex min-w-0 items-center gap-3 rounded-3xl bg-(--surface-muted) p-3">
          <Avatar name={chrome?.shellUser?.name || "Diretor"} size="lg" className="light-avatar" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-(--foreground)">{chrome?.shellUser?.name || "Diretor"}</p>
            <p className="truncate text-xs text-(--text-secondary)">{chrome?.shellUser?.email || ""}</p>
          </div>
        </div>

        <nav aria-label="Mais opções" className="flex flex-col gap-1">
          <button type="button" className={rowClass} onClick={() => { onOpenChange(false); openLayer("open-command-palette"); }}>
            <Search className="size-4 text-(--text-secondary)" aria-hidden="true" /> Buscar
          </button>
          <button type="button" className={rowClass} onClick={() => { onOpenChange(false); openLayer("open-agent-drawer"); }}>
            <Bot className="size-4 text-(--text-secondary)" aria-hidden="true" /> Agente IA
          </button>
          <button type="button" className={rowClass} onClick={() => { onOpenChange(false); openLayer("open-system-feedback"); }}>
            <CircleHelp className="size-4 text-(--text-secondary)" aria-hidden="true" /> Reportar problema
          </button>
          {profile?.userProfileEnabled ? (
            <Link href="/settings?tab=conta" onClick={() => onOpenChange(false)} className={rowClass}>
              <UserRound className="size-4 text-(--text-secondary)" aria-hidden="true" /> Meu perfil
            </Link>
          ) : null}
          {canSettings ? (
            <Link href="/settings" onClick={() => onOpenChange(false)} className={rowClass}>
              <Settings2 className="size-4 text-(--text-secondary)" aria-hidden="true" /> Configurações
            </Link>
          ) : null}
          <button type="button" className={rowClass} onClick={() => { onOpenChange(false); openLayer("director-pwa-install"); }}>
            <Download className="size-4 text-(--text-secondary)" aria-hidden="true" /> Instalar app
          </button>
          <Link href="/notificacoes" onClick={() => onOpenChange(false)} className={rowClass}>
            <Bell className="size-4 text-(--text-secondary)" aria-hidden="true" /> Todas as notificações
          </Link>
        </nav>

        {chrome?.viewAs.canViewAs || profile?.isPlatformAdmin ? <div className="rounded-3xl bg-(--surface-muted) p-2">
          {chrome?.viewAs.canViewAs ? <ViewAsButton state={chrome.viewAs} onNavigate={() => onOpenChange(false)} /> : null}
          {profile?.isPlatformAdmin ? (
            <div className="mt-1"><SuperAdminRoleSwitcher activeOverride={profile.activeRoleOverride} compact /></div>
          ) : null}
        </div> : null}

        <Button
          variant="secondary"
          size="lg"
          disabled={signingOut}
          onClick={() => void handleSignOut()}
          className={cn("min-h-11", signingOut && "opacity-70")}
        >
          <LogOut className="size-4" aria-hidden="true" /> {signingOut ? "Saindo…" : "Sair"}
        </Button>
      </div>
    </BottomSheet>
  );
}
