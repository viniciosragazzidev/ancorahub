import { AnimatedBadge, type AnimatedBadgeStatus } from "@/components/motion/animated-badge";
import { normalizeTeamMemberStatus } from "@/features/team/status";
import { LEAD_QUALIFICATION_LABELS, type LeadQualificationStatus } from "@/features/leads/qualification-status";
import { Fire, Snowflake, Sun } from "@phosphor-icons/react";

export function LeadQualificationBadge({ status }: { status: string }) {
  const norm = (status || "").trim().toLowerCase();

  if (norm === "hot" || norm.includes("quente")) {
    return (
      <AnimatedBadge status="danger" size="sm">
        <Fire aria-hidden="true" className="size-3" weight="fill" />
        Quente
      </AnimatedBadge>
    );
  }
  if (norm === "warm" || norm.includes("morno")) {
    return (
      <AnimatedBadge status="warning" size="sm">
        <Sun aria-hidden="true" className="size-3" weight="fill" />
        Morno
      </AnimatedBadge>
    );
  }
  if (norm === "cold" || norm.includes("frio")) {
    return (
      <AnimatedBadge status="info" size="sm">
        <Snowflake aria-hidden="true" className="size-3" weight="bold" />
        Frio
      </AnimatedBadge>
    );
  }
  if (norm === "disqualified" || norm.includes("desqualificado")) {
    return (
      <AnimatedBadge status="neutral" size="sm">
        Desqualificado
      </AnimatedBadge>
    );
  }
  if (norm === "qualified") {
    return (
      <AnimatedBadge status="success" size="sm">
        Qualificado
      </AnimatedBadge>
    );
  }
  if (norm === "qualifying") {
    return (
      <AnimatedBadge status="loading" size="sm">
        Em Qualificação
      </AnimatedBadge>
    );
  }
  if (norm === "ia_disabled") {
    return (
      <AnimatedBadge status="neutral" size="sm">
        IA Desativada
      </AnimatedBadge>
    );
  }

  const value = (status in LEAD_QUALIFICATION_LABELS ? status : "pending") as LeadQualificationStatus;
  return <AnimatedBadge status="neutral" size="sm">{LEAD_QUALIFICATION_LABELS[value] ?? status}</AnimatedBadge>;
}

export function LeadStatusBadge({ status }: { status: string }) {
  const normalizedStatus = status.trim().toLowerCase();

  switch (normalizedStatus) {
    case "new":
      return <AnimatedBadge status="info" size="sm">Novo</AnimatedBadge>;
    case "distributed":
      return <AnimatedBadge status="info" size="sm">Distribuído</AnimatedBadge>;
    case "in_contact":
      return <AnimatedBadge status="warning" size="sm">Em atendimento</AnimatedBadge>;
    case "quote_sent":
      return <AnimatedBadge status="info" size="sm">Cotação</AnimatedBadge>;
    case "negotiation":
      return <AnimatedBadge status="warning" size="sm">Negociação</AnimatedBadge>;
    case "documentation_pending":
      return <AnimatedBadge status="warning" size="sm">Documentos</AnimatedBadge>;
    case "under_analysis":
      return <AnimatedBadge status="loading" size="sm">Em análise</AnimatedBadge>;
    case "converted":
      return <AnimatedBadge status="success" size="sm">Convertido</AnimatedBadge>;
    case "lost":
      return <AnimatedBadge status="danger" size="sm">Perdido</AnimatedBadge>;
    default:
      return <AnimatedBadge status="neutral" size="sm">{status}</AnimatedBadge>;
  }
}

/** Venda: Ativa / Cancelada */
export function SaleStatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return <AnimatedBadge status="success" size="sm">Ativa</AnimatedBadge>;
  }
  return <AnimatedBadge status="neutral" size="sm">Cancelada</AnimatedBadge>;
}

/** Parcela de comissão: Pago / A pagar / Cancelado */
export function ScheduleStatusBadge({ status }: { status: string }) {
  if (status === "paid") {
    return <AnimatedBadge status="success" size="sm">Pago</AnimatedBadge>;
  }
  if (status === "cancelled") {
    return <AnimatedBadge status="neutral" size="sm">Cancelado</AnimatedBadge>;
  }
  return <AnimatedBadge status="warning" size="sm">A pagar</AnimatedBadge>;
}

/** Documento: Aprovado / Aguardando revisão / Rejeitado */
export function DocumentStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "approved":
      return <AnimatedBadge status="success" size="sm">Aprovado</AnimatedBadge>;
    case "rejected":
      return <AnimatedBadge status="danger" size="sm">Rejeitado</AnimatedBadge>;
    case "pending":
      return <AnimatedBadge status="warning" size="sm">Pendente</AnimatedBadge>;
    default:
      return <AnimatedBadge status="neutral" size="sm">{status}</AnimatedBadge>;
  }
}

/** Recuperação de senha: Pendente / Aprovada / Rejeitada / Concluída */
export function RecoveryStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "requested":
      return <AnimatedBadge status="warning" size="sm">Pendente</AnimatedBadge>;
    case "approved":
      return <AnimatedBadge status="success" size="sm">Aprovada</AnimatedBadge>;
    case "rejected":
      return <AnimatedBadge status="danger" size="sm">Rejeitada</AnimatedBadge>;
    case "completed":
      return <AnimatedBadge status="success" size="sm">Concluída</AnimatedBadge>;
    default:
      return <AnimatedBadge status="neutral" size="sm">{status}</AnimatedBadge>;
  }
}

export function MemberStatusBadge({ status }: { status: "active" | "pending" | "inactive" | string }) {
  switch (normalizeTeamMemberStatus(status)) {
    case "active":
      return <AnimatedBadge status="success" size="sm">Ativo</AnimatedBadge>;
    case "pending":
      return <AnimatedBadge status="warning" size="sm">Pendente</AnimatedBadge>;
    case "disabled":
    default:
      return <AnimatedBadge status="neutral" size="sm">Inativo</AnimatedBadge>;
  }
}

export function RoleBadge({ role, jobTitle }: { role: string; jobTitle?: string | null }) {
  const effectiveKey = (jobTitle && jobTitle !== "broker" ? jobTitle : role).toLowerCase();
  switch (effectiveKey) {
    case "director":
      return <AnimatedBadge status="info" size="sm">Diretor</AnimatedBadge>;
    case "manager":
      return <AnimatedBadge status="info" size="sm">Gestor</AnimatedBadge>;
    case "supervisor":
      return <AnimatedBadge status="info" size="sm">Supervisor</AnimatedBadge>;
    case "marketing":
      return <AnimatedBadge status="warning" size="sm">Marketing</AnimatedBadge>;
    case "support":
    case "suporte":
      return <AnimatedBadge status="warning" size="sm">Suporte</AnimatedBadge>;
    case "finance":
    case "financeiro":
      return <AnimatedBadge status="success" size="sm">Financeiro</AnimatedBadge>;
    case "operations":
    case "operacoes":
      return <AnimatedBadge status="warning" size="sm">Operações</AnimatedBadge>;
    case "broker":
      return <AnimatedBadge status="neutral" size="sm">Corretor</AnimatedBadge>;
    default:
      return <AnimatedBadge status="neutral" size="sm">{jobTitle || role}</AnimatedBadge>;
  }
}
