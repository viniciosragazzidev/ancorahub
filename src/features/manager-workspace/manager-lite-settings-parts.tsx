"use client";

import Image from "next/image";
import Link from "next/link";
import { Buildings, WifiHigh } from "@/components/huge-icons";
import { ChevronRight, LogOut, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { startLiteTour } from "@/components/chat/tour/lite-tour";
import { signOut } from "@/shared/auth/client";

const initialsOf = (name: string) => name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("pt-BR") ?? "").join("");

/** Profile card at the top of the manager's Lite settings: who they are and which unit they run. */
export function ManagerLiteSettingsHeader({ user, branchName }: { user: { name: string; image: string | null }; branchName: string | null }) {
  return (
    <header className="flex items-center gap-4 rounded-3xl bg-(--surface) p-5 shadow-(--shadow-resting)">
      <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-(--surface-muted) text-lg font-semibold">
        {user.image ? <Image src={user.image} alt="" width={64} height={64} unoptimized className="size-full object-cover" /> : initialsOf(user.name)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xl font-semibold text-(--foreground)">{user.name}</span>
        <span className="block text-sm text-(--text-secondary)">Gestor{branchName ? ` · ${branchName}` : ""}</span>
      </span>
    </header>
  );
}

export type ManagerLiteUnit = {
  name: string;
  active: boolean;
  acceptingLeads: boolean;
  autoDistribute: boolean;
  brokers: number;
  supervisors: number;
};

/**
 * "Minha unidade" in the manager's Lite settings. Read only: receiving leads, auto distribution,
 * queues and rules stay with the general director (Central de Distribuição).
 */
export function ManagerLiteUnitSection({ unit }: { unit: ManagerLiteUnit | null }) {
  if (!unit) {
    return (
      <div className="grid place-items-center gap-3 rounded-3xl bg-(--surface) px-6 py-10 text-center shadow-(--shadow-resting)">
        <span className="grid size-14 place-items-center rounded-full bg-(--surface-muted) text-(--text-muted)"><Buildings aria-hidden="true" className="size-6" /></span>
        <p className="text-base font-semibold text-(--foreground)">Você ainda não está em uma unidade</p>
        <p className="max-w-sm text-sm text-(--text-secondary)">Peça ao diretor para vincular você à sua unidade. Até lá, as telas de gestão ficam vazias.</p>
      </div>
    );
  }
  const facts = [
    { label: "Corretores", value: unit.brokers },
    { label: "Supervisores", value: unit.supervisors },
  ];
  return (
    <div className="grid gap-4">
      <section className="rounded-3xl bg-(--surface) p-5 shadow-(--shadow-resting)" aria-labelledby="manager-unit-title">
        <div className="flex items-start gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-(--surface-muted) text-(--foreground)"><Buildings aria-hidden="true" className="size-5" /></span>
          <span className="min-w-0">
            <h2 id="manager-unit-title" className="truncate text-lg font-semibold text-(--foreground)">{unit.name}</h2>
            <span className="mt-1 flex flex-wrap gap-2 text-xs font-medium">
              <span className={unit.active ? "rounded-full bg-(--success-soft,#e7f6ec) px-2.5 py-1 text-(--success-ink,#166534)" : "rounded-full bg-(--surface-muted) px-2.5 py-1 text-(--text-secondary)"}>{unit.active ? "Unidade ativa" : "Unidade inativa"}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-(--surface-muted) px-2.5 py-1 text-(--text-secondary)"><WifiHigh aria-hidden="true" className="size-3" />{unit.acceptingLeads ? "Recebendo leads" : "Pausada para leads"}</span>
            </span>
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {facts.map((fact) => (
            <div key={fact.label} className="rounded-2xl bg-(--surface-muted) px-4 py-3">
              <span className="block text-2xl font-semibold tabular-nums text-(--foreground)">{fact.value}</span>
              <span className="text-sm text-(--text-secondary)">{fact.label}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-(--text-secondary)">
          Distribuição automática {unit.autoDistribute ? "ligada" : "desligada"}. Filas, regras e o recebimento de leads da unidade são definidos pela diretoria.
        </p>
      </section>
      <Link href="/equipe" className="group flex min-h-16 items-center justify-between gap-3 rounded-3xl bg-(--surface) px-5 py-4 shadow-(--shadow-resting) transition-colors duration-150 hover:bg-(--surface-muted) motion-reduce:transition-none">
        <span>
          <span className="block text-base font-semibold text-(--foreground)">Equipe da unidade</span>
          <span className="block text-sm text-(--text-secondary)">Corretores, supervisores e convites</span>
        </span>
        <ChevronRight aria-hidden="true" className="size-4 text-(--text-muted) transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" />
      </Link>
    </div>
  );
}

/** Tour and sign out, at the end of the manager's settings list (same as the supervisor's). */
export function ManagerLiteSettingsFooter() {
  return (
    <div className="mx-auto grid w-full max-w-4xl gap-3 px-4 pb-8 sm:px-6">
      <Button variant="outline" size="lg" onClick={() => { if (window.location.pathname === "/dashboard") startLiteTour(); else window.location.assign("/dashboard?tour=1"); }}><Play className="size-4" /> Ver o tour do app</Button>
      <Button variant="secondary" size="lg" onClick={() => void signOut()}><LogOut className="size-4" /> Sair da conta</Button>
    </div>
  );
}
