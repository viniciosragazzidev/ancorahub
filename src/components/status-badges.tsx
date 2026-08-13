import {
  CheckCircle,
  CheckIcon,
  Clock,
  FileText,
  Handshake,
  Lightning,
  MagnifyingGlass,
  PaperPlaneTilt,
  Phone,
  ShieldCheck,
  UserPlus,
  XCircle,
} from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { normalizeTeamMemberStatus, teamMemberStatusLabels } from "@/features/team/status";
import { LEAD_QUALIFICATION_LABELS, type LeadQualificationStatus } from "@/features/leads/qualification-status";

export function LeadQualificationBadge({ status }: { status: string }) {
  const value = (status in LEAD_QUALIFICATION_LABELS ? status : "pending") as LeadQualificationStatus;
  const variant = value === "hot" ? "destructive" : value === "warm" ? "warning" : value === "qualified" ? "success" : "outline";
  return <Badge variant={variant} className="px-2 py-0.5">{LEAD_QUALIFICATION_LABELS[value]}</Badge>;
}

export function LeadStatusBadge({ status }: { status: string }) {
  const normalizedStatus = status.trim().toLowerCase();

  switch (normalizedStatus) {
    case "new":
      return (
        <Badge variant="info" className="gap-1 px-2 py-0.5">
          <Lightning className="size-3 text-blue-500 fill-blue-500/10" />
          Novo
        </Badge>
      );
    case "distributed":
      return (
        <Badge variant="indigo" className="gap-1 px-2 py-0.5">
          <UserPlus className="size-3 text-indigo-500" />
          Distribuído
        </Badge>
      );
    case "in_contact":
      return (
        <Badge variant="warning" className="gap-1 px-2 py-0.5">
          <Phone className="size-3 text-warning" />
          Em atendimento
        </Badge>
      );
    case "quote_sent":
      return (
        <Badge variant="purple" className="gap-1 px-2 py-0.5">
          <PaperPlaneTilt className="size-3 text-purple-500" />
          Cotação
        </Badge>
      );
    case "negotiation":
      return (
        <Badge variant="pink" className="gap-1 px-2 py-0.5">
          <Handshake className="size-3 text-pink-500" />
          Negociação
        </Badge>
      );
    case "documentation_pending":
      return (
        <Badge variant="orange" className="gap-1 px-2 py-0.5">
          <FileText className="size-3 text-orange-500" />
          Documentos
        </Badge>
      );
    case "under_analysis":
      return (
        <Badge variant="cyan" className="gap-1 px-2 py-0.5">
          <MagnifyingGlass className="size-3 text-cyan-500" />
          Em análise
        </Badge>
      );
    case "converted":
      return (
        <Badge variant="success" className="gap-1 px-2 py-0.5">
          <CheckCircle className="size-3 text-success fill-success/10" />
          Convertido
        </Badge>
      );
    case "lost":
      return (
        <Badge variant="destructive" className="gap-1 px-2 py-0.5">
          <XCircle className="size-3 text-destructive" />
          Perdido
        </Badge>
      );
    default:
      return <Badge variant="outline" className="px-2 py-0.5">{status}</Badge>;
  }
}

/** Venda: Ativa / Cancelada */
export function SaleStatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <Badge variant="success" className="gap-1 px-2.5 py-0.5 font-mono text-[11px] rounded-full">
        ✓ Ativa
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1 px-2.5 py-0.5 font-mono text-[11px] rounded-full text-muted-foreground">
      - Cancelada
    </Badge>
  );
}

/** Parcela de comissão: Pago / A pagar / Cancelado */
export function ScheduleStatusBadge({ status }: { status: string }) {
  if (status === "paid") {
    return (
      <Badge variant="success" className="gap-1 px-2.5 py-0.5 font-mono text-[11px] rounded-full">
        ✓ Pago
      </Badge>
    );
  }
  if (status === "cancelled") {
    return (
      <Badge variant="secondary" className="gap-1 px-2.5 py-0.5 font-mono text-[11px] rounded-full text-muted-foreground">
        - Cancelado
      </Badge>
    );
  }
  return (
    <Badge variant="warning" className="gap-1 px-2.5 py-0.5 font-mono text-[11px] rounded-full">
      • A pagar
    </Badge>
  );
}

/** Documento: Aprovado / Aguardando revisão / Rejeitado */
export function DocumentStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "approved":
      return (
        <Badge variant="success" className="gap-1 px-2.5 py-0.5 font-mono text-[11px] rounded-full">
          ✓ Aprovado
        </Badge>
      );
    case "rejected":
      return (
        <Badge variant="destructive" className="gap-1 px-2.5 py-0.5 font-mono text-[11px] rounded-full">
          - Rejeitado
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="warning" className="gap-1 px-2.5 py-0.5 font-mono text-[11px] rounded-full">
          • Pendente
        </Badge>
      );
    default:
      return <Badge variant="outline" className="px-2.5 py-0.5 font-mono text-[11px] rounded-full">{status}</Badge>;
  }
}

/** Recuperação de senha: Pendente / Aprovada / Rejeitada / Concluída */
export function RecoveryStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "requested":
      return (
        <Badge variant="warning" className="gap-1 px-2.5 py-0.5 font-mono text-[11px] rounded-full">
          • Pendente
        </Badge>
      );
    case "approved":
      return (
        <Badge variant="success" className="gap-1 px-2.5 py-0.5 font-mono text-[11px] rounded-full">
          ✓ Aprovada
        </Badge>
      );
    case "rejected":
      return (
        <Badge variant="destructive" className="gap-1 px-2.5 py-0.5 font-mono text-[11px] rounded-full">
          - Rejeitada
        </Badge>
      );
    case "completed":
      return (
        <Badge variant="secondary" className="gap-1 px-2.5 py-0.5 font-mono text-[11px] rounded-full">
          ✓ Concluída
        </Badge>
      );
    default:
      return <Badge variant="outline" className="px-2.5 py-0.5 font-mono text-[11px] rounded-full">{status}</Badge>;
  }
}

export function MemberStatusBadge({ status }: { status: "active" | "pending" | "inactive" | string }) {
  switch (normalizeTeamMemberStatus(status)) {
    case "active":
      return (
        <Badge variant="success" className="gap-1 px-2.5 py-0.5 font-mono text-[11px] rounded-full">
          ✓ Ativo
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="warning" className="gap-1 px-2.5 py-0.5 font-mono text-[11px] rounded-full">
          • Pendente
        </Badge>
      );
    case "disabled":
      return (
        <Badge variant="secondary" className="gap-1 px-2.5 py-0.5 font-mono text-[11px] rounded-full text-muted-foreground">
          - Inativo
        </Badge>
      );
    default:
      return <Badge variant="secondary" className="px-2.5 py-0.5 font-mono text-[11px] rounded-full text-muted-foreground">- Inativo</Badge>;
  }
}

export function RoleBadge({ role, jobTitle }: { role: string; jobTitle?: string | null }) {
  const effectiveKey = (jobTitle && jobTitle !== "broker" ? jobTitle : role).toLowerCase();
  switch (effectiveKey) {
    case "director":
      return (
        <Badge variant="purple" className="gap-1 px-2 py-0.5 font-medium border-purple-500/15">
          <ShieldCheck className="size-3 text-purple-600 dark:text-purple-400" />
          Diretor
        </Badge>
      );
    case "manager":
      return (
        <Badge variant="indigo" className="gap-1 px-2 py-0.5 font-medium border-indigo-500/15">
          Gestor
        </Badge>
      );
    case "supervisor":
      return (
        <Badge variant="cyan" className="gap-1 px-2 py-0.5 font-medium border-cyan-500/15">
          Supervisor
        </Badge>
      );
    case "marketing":
      return (
        <Badge variant="pink" className="gap-1 px-2 py-0.5 font-medium border-pink-500/15">
          Marketing
        </Badge>
      );
    case "support":
    case "suporte":
      return (
        <Badge variant="orange" className="gap-1 px-2 py-0.5 font-medium border-orange-500/15">
          Suporte
        </Badge>
      );
    case "finance":
    case "financeiro":
      return (
        <Badge variant="success" className="gap-1 px-2 py-0.5 font-medium border-emerald-500/15">
          Financeiro
        </Badge>
      );
    case "operations":
    case "operacoes":
      return (
        <Badge variant="warning" className="gap-1 px-2 py-0.5 font-medium border-amber-500/15">
          Operações
        </Badge>
      );
    case "broker":
      return (
        <Badge variant="outline" className="gap-1 px-2 py-0.5 font-medium text-muted-foreground">
          Corretor
        </Badge>
      );
    default:
      return <Badge variant="outline" className="px-2 py-0.5">{jobTitle || role}</Badge>;
  }
}
