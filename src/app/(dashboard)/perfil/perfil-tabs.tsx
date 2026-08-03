"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ActivityIcon,
  FingerPrintIcon,
  Shield01Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";

import { ProfileHeader } from "./_components/profile-header";
import { PersonalDataSection } from "./_components/personal-data-section";
import { SecuritySummarySection } from "./_components/security-summary-section";
import { SessionsSection } from "./_components/sessions-section";
import { ActivityLogSection } from "./_components/activity-log-section";

export type PerfilData = {
  currentUserId: string;
  user: {
    name: string;
    email: string;
    image: string | null;
    emailVerified: boolean;
    twoFactorEnabled: boolean;
    createdAt: Date | string;
  } | undefined;
  membership: {
    role: string;
    jobTitle: string;
    branchId: string | null;
    availabilityStatus: string;
    status: string;
    createdAt: Date | string;
    branchName: string | null;
    customRoleName: string | null;
  } | undefined;
  brokerProfile: {
    professionalName: string;
    phone: string | null;
    cpf: string | null;
    internalCode: string | null;
  } | null;
  auditLogs: { id: string; acao: string; entidade: string; entidadeId: string; createdAt: string }[];
  sessions: { id: string; token: string; ipAddress: string | null; userAgent: string | null; createdAt: string; expiresAt: string }[];
  branches: { id: string; name: string }[];
};

type TabId = "visao-geral" | "seguranca" | "sessoes" | "atividades";

const tabs: { id: TabId; label: string; icon: typeof UserCircleIcon }[] = [
  { id: "visao-geral", label: "Visão geral", icon: UserCircleIcon },
  { id: "seguranca", label: "Segurança", icon: Shield01Icon },
  { id: "sessoes", label: "Sessões ativas", icon: FingerPrintIcon },
  { id: "atividades", label: "Registro de atividades", icon: ActivityIcon },
];

export function PerfilTabs({ data }: { data: PerfilData }) {
  const [active, setActive] = useState<TabId>("visao-geral");

  return (
    <div className="grid gap-5 lg:grid-cols-[13.5rem_1fr]">
      <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Seções do perfil">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors ${
              active === tab.id
                ? "border border-border/80 bg-secondary font-semibold text-foreground shadow-2xs"
                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
            }`}
          >
            <HugeiconsIcon icon={tab.icon} size={16} />
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="min-w-0">
        <ProfileHeader data={data} />
        {active === "visao-geral" ? (
          <div className="mt-5 grid gap-5">
            <PersonalDataSection data={data} />
          </div>
        ) : null}
        {active === "seguranca" ? (
          <div className="mt-5">
            <SecuritySummarySection data={data} />
          </div>
        ) : null}
        {active === "sessoes" ? (
          <div className="mt-5">
            <SessionsSection data={data} />
          </div>
        ) : null}
        {active === "atividades" ? (
          <div className="mt-5">
            <ActivityLogSection data={data} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
