"use client";

import Image from "next/image";
import Link from "next/link";
import { LogOut, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PushNotificationManager } from "@/features/notifications/components/push-notification-manager";
import { startLiteTour } from "@/components/chat/tour/lite-tour";
import { signOut } from "@/shared/auth/client";

export function SupervisorLiteSettings({ user, branchName, team }: { user: { name: string; image: string | null }; branchName: string | null; team: { name: string; imageUrl: string | null } | null }) {
  const initials = user.name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("pt-BR") ?? "").join("");
  return <div className="arc-venancor mx-auto flex min-h-full w-full max-w-2xl flex-col gap-5 px-4 py-5 text-[var(--foreground)] sm:px-6">
    <header className="flex items-center gap-4 rounded-[var(--radius-panel)] bg-[var(--surface)] p-5 shadow-[var(--shadow-resting)]">
      <span className="grid size-16 place-items-center overflow-hidden rounded-full bg-[var(--surface-muted)] text-lg font-semibold">{user.image ? <Image src={user.image} alt="" width={64} height={64} unoptimized className="size-full object-cover" /> : initials}</span>
      <span className="min-w-0"><h1 className="truncate text-xl font-semibold">{user.name}</h1><span className="text-sm text-[var(--text-muted)]">{branchName ?? "Unidade não informada"}</span></span>
    </header>
    <section className="rounded-[var(--radius-panel)] bg-[var(--surface)] p-5 shadow-[var(--shadow-resting)]" aria-labelledby="team-shortcut-title">
      <h2 id="team-shortcut-title" className="text-sm font-medium text-[var(--text-muted)]">Sua equipe</h2>
      <Link href="/equipe/minha/configurar" className="mt-3 flex items-center gap-3 rounded-2xl bg-[var(--surface-muted)] p-3">
        <span className="grid size-12 place-items-center overflow-hidden rounded-full bg-[var(--surface)] font-semibold">{team?.imageUrl ? <Image src={team.imageUrl} alt="" width={48} height={48} unoptimized className="size-full object-cover" /> : team?.name.slice(0, 1) ?? "E"}</span>
        <span className="flex-1"><strong className="block text-sm font-semibold">{team?.name ?? "Configure sua equipe"}</strong><small className="text-[var(--text-muted)]">Abrir ajustes da equipe</small></span><span aria-hidden="true">›</span>
      </Link>
    </section>
    <section className="rounded-[var(--radius-panel)] bg-[var(--surface)] p-5 shadow-[var(--shadow-resting)]" aria-labelledby="supervisor-push-title">
      <h2 id="supervisor-push-title" className="mb-3 text-base font-semibold">Notificações</h2><PushNotificationManager variant="compact" />
    </section>
    <Button variant="outline" size="lg" onClick={() => { if (window.location.pathname === "/dashboard") startLiteTour(); else window.location.assign("/dashboard?tour=1"); }}><Play className="size-4" /> Ver o tour do app</Button>
    <Button variant="secondary" size="lg" onClick={() => void signOut()}><LogOut className="size-4" /> Sair da conta</Button>
  </div>;
}
