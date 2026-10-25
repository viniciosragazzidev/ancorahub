"use client";

/**
 * Equipe no visual Lite (/equipe, visão Membros). Mesmos dados e ações da tela atual: números, pedidos de
 * transferência, lista de acessos com busca, filtro de unidade, seleção em lote (ativar, desativar, pausar e
 * retomar o recebimento) e, por linha, editar, ativar ou desativar, convite, senha, transferir leads e excluir.
 */
import Link from "next/link";
import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, ShieldCheck, UserPlus } from "lucide-react";

import { StatCard } from "@/components/dashboard/metric-card";
import { LiteBulkBar, LiteMenu, LiteSelect, type LiteMenuItem } from "@/components/lite/controls";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { LitePagination, useLitePages } from "@/components/lite/data/pagination";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import { liteDateFormatter } from "@/components/lite/format/date";
import page from "@/components/lite/page/lite-page.module.css";
import { toast } from "@/components/ui/sonner";
import { useMultiSelect } from "@/hooks/use-multi-select";
import { setBrokersAvailabilityAction } from "@/features/branches/actions";
import { decideBrokerTransferAction, type PendingTransferRequest } from "@/features/supervisor-workspace/transfer-actions";
import { formatLeadPhone } from "@/features/leads/format-lead-phone";
import type { TenantRole } from "@/shared/db/schema";

import { bulkToggleTeamMemberStatusAction, resendInviteAction, revokeInviteAction, toggleTeamMemberStatusAction } from "../actions";
import { TeamInviteLite } from "./team-invite-lite";
import { DeleteMemberLite, EditMemberLite, JOB_TITLE_LABELS, ROLE_LABELS, ResetPasswordLite, STATUS_LABELS, TransferLeadsLite, type BranchOption, type CustomRoleOption, type TeamMemberLite } from "./member-sheets-lite";
import styles from "./team-lite.module.css";

export type TeamLiteStats = { total: number; active: number; unassignedLeads: number; salesTotal: number; membersTrend: number[]; leadsTrend: number[]; salesTrend: number[] };

const STATUS_TONE: Record<TeamMemberLite["status"], "success" | "warning" | undefined> = { active: "success", pending: "warning", disabled: undefined };
const transferDate = liteDateFormatter({ dateStyle: "medium", timeStyle: "short" });
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Abas da área de equipe: membros e unidades (a visão Unidades segue a tela atual). */
export function TeamTabsLite({ active }: { active: "membros" | "unidades" }) {
  return (
    <nav className={styles.tabs} aria-label="Equipe e unidades">
      <Link href="/equipe" className={styles.tab} aria-current={active === "membros" ? "page" : undefined}>Membros</Link>
      <Link href="/equipe?visao=unidades" className={styles.tab} aria-current={active === "unidades" ? "page" : undefined}>Unidades</Link>
    </nav>
  );
}

/** Ações do cabeçalho: cargos e permissões (diretor) e novo funcionário em painel lateral. */
export function TeamHeaderActionsLite({ isDirector, branches, customRoles }: { isDirector: boolean; branches: BranchOption[]; customRoles: CustomRoleOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <span className={styles.headerActions}>
      {isDirector ? <Link href="/equipe/cargos" className={page.button} aria-label="Cargos e permissões"><ShieldCheck aria-hidden="true" size={16} /><span className={styles.longLabel}>Cargos e permissões</span></Link> : null}
      <button type="button" className={page.primaryButton} aria-label="Novo funcionário" onClick={() => setOpen(true)}><UserPlus aria-hidden="true" size={16} /><span className={styles.longLabel}>Novo funcionário</span></button>
      <LiteSidePanel open={open} onOpenChange={setOpen} title="Novo funcionário" description={isDirector ? "Você pode criar diretores, gestores e corretores." : "Você pode criar apenas corretores."}>
        <TeamInviteLite branches={branches} canInviteManager={isDirector} canInviteDirector={isDirector} customRoles={customRoles} onDone={() => setOpen(false)} />
      </LiteSidePanel>
    </span>
  );
}

function TransferRequestsLite({ initial }: { initial: PendingTransferRequest[] }) {
  const [requests, setRequests] = useState(initial);
  const [feedback, setFeedback] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const decide = (id: string, approve: boolean) => {
    setFeedback("");
    setActiveId(id);
    startTransition(async () => {
      const result = await decideBrokerTransferAction(id, approve);
      setActiveId(null);
      if (!result.ok) {
        setFeedback(result.reason);
        return;
      }
      setRequests((current) => current.filter((request) => request.id !== id));
      setFeedback(approve ? "Transferência aprovada." : "Pedido recusado.");
    });
  };
  return (
    <section className={page.card} aria-labelledby="equipe-transferencias">
      <div className={styles.cardHeadRow}>
        <h2 id="equipe-transferencias" className={page.sectionTitle}>Pedidos de transferência</h2>
        <span className={page.badge} data-tone={requests.length ? "warning" : undefined}>{requests.length} pendente{requests.length === 1 ? "" : "s"}</span>
      </div>
      {requests.length === 0 ? <p className={page.muted}>Nenhum pedido aguardando decisão.</p> : (
        <ul className={styles.requests}>
          {requests.map((request) => (
            <li key={request.id} className={styles.request}>
              <span className={styles.requestText}>
                <span className={page.cellTitle}>{request.brokerName} · {request.branchName}</span>
                <span className={page.cellSub}>{request.fromSupervisorName} para {request.toSupervisorName} · {transferDate.format(new Date(request.createdAt))}</span>
                <span>{request.reason}</span>
              </span>
              <span className={styles.requestActions}>
                <button type="button" className={page.primaryButton} disabled={pending} onClick={() => decide(request.id, true)}>{pending && activeId === request.id ? "Aprovando..." : "Aprovar"}</button>
                <button type="button" className={page.button} disabled={pending} onClick={() => decide(request.id, false)}>Recusar</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p role="status" aria-live="polite" className={feedback ? page.muted : styles.srOnly}>{feedback}</p>
    </section>
  );
}

type Sheet = { kind: "edit" | "delete" | "transfer" | "password"; member: TeamMemberLite } | null;

export function TeamLite({ members, branches, customRoles, stats, transferRequests, showTransfers, currentRole, currentBranchId, currentUserId, canViewProfile }: {
  members: TeamMemberLite[];
  branches: BranchOption[];
  customRoles: CustomRoleOption[];
  stats: TeamLiteStats;
  transferRequests: PendingTransferRequest[];
  showTransfers: boolean;
  currentRole: TenantRole;
  currentBranchId: string | null;
  currentUserId: string;
  canViewProfile: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [overrides, setOverrides] = useState<Record<string, TeamMemberLite["status"]>>({});
  const [busy, startTransition] = useTransition();
  const canBulk = currentRole === "director" || currentRole === "manager";

  const displayed = useMemo(() => members.map((member) => ({ ...member, status: overrides[member.id] ?? member.status })), [members, overrides]);
  const rows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    const digits = needle.replace(/\D/g, "");
    return displayed
      .filter((member) => branchFilter === "all" || member.branchId === branchFilter)
      .filter((member) => !needle
        || (member.name ?? "").toLocaleLowerCase("pt-BR").includes(needle)
        || member.email.toLocaleLowerCase("pt-BR").includes(needle)
        || (digits.length > 0 && (member.phone ?? "").includes(digits)));
  }, [displayed, branchFilter, query]);
  const { pageRows, pagination } = useLitePages(rows, 10);
  const memberIds = useMemo(() => members.map((member) => member.id), [members]);
  const multiSelect = useMultiSelect(memberIds);
  const selectedBrokerIds = displayed.filter((member) => multiSelect.isSelected(member.id) && member.role === "broker" && member.status === "active" && member.userId).map((member) => member.userId!);

  const report = useCallback((result: { success?: boolean; error?: string; message?: string }, fallback: string) => {
    if (result.success) {
      toast.success(result.message ?? fallback);
      multiSelect.clear();
      router.refresh();
    }
    if (result.error) toast.error(result.error);
  }, [multiSelect, router]);

  const bulkStatus = (target: "active" | "disabled") => {
    const data = new FormData();
    for (const id of multiSelect.selectedIds) data.append("memberIds", id);
    data.set("targetStatus", target);
    startTransition(async () => report(await bulkToggleTeamMemberStatusAction({}, data), "Operação concluída."));
  };
  const bulkAvailability = (target: "paused" | "available") => {
    if (!selectedBrokerIds.length) {
      toast.error("Selecione corretores ativos para pausar ou retomar o recebimento de leads.");
      return;
    }
    const data = new FormData();
    data.set("brokerIds", selectedBrokerIds.join(","));
    data.set("target", target);
    startTransition(async () => report(await setBrokersAvailabilityAction({}, data), "Recebimento de leads atualizado."));
  };

  const toggleStatus = (member: TeamMemberLite) => {
    const next = member.status === "active" ? "disabled" : "active";
    setOverrides((current) => ({ ...current, [member.id]: next }));
    const data = new FormData();
    data.set("memberId", member.id);
    startTransition(async () => {
      const result = await toggleTeamMemberStatusAction({}, data);
      if (result.success) {
        toast.success(result.status === "disabled" ? "Membro desativado." : "Membro reativado.");
        router.refresh();
      } else {
        setOverrides((current) => {
          const copy = { ...current };
          delete copy[member.id];
          return copy;
        });
        if (result.error) toast.error(result.error);
      }
    });
  };

  const resendInvite = (member: TeamMemberLite) => {
    const data = new FormData();
    data.set("memberId", member.id);
    startTransition(async () => {
      const result = await resendInviteAction({}, data);
      if (result.success) {
        const message = result.whatsappStatus === "sent" ? "A mensagem foi enviada pelo WhatsApp corporativo."
          : result.whatsappStatus === "failed" ? "O convite foi recriado, mas não foi possível enfileirar o envio. Copie o link para compartilhar."
            : result.whatsappStatus === "queued" ? "O convite foi colocado na fila de envio do WhatsApp."
              : "O convite foi recriado. Envie o link manualmente se necessário.";
        toast.success("Convite processado.", {
          description: message,
          action: result.token ? {
            label: "Copiar link",
            onClick: () => {
              const url = new URL("/primeiro-acesso", window.location.origin);
              url.searchParams.set("token", result.token!);
              void navigator.clipboard.writeText(url.toString()).then(() => toast.success("Link de ativação copiado."), () => toast.error("Não foi possível copiar o link."));
            },
          } : undefined,
        });
        router.refresh();
      }
      if (result.error) toast.error(result.error);
    });
  };

  const revokeInvite = (member: TeamMemberLite) => {
    const data = new FormData();
    data.set("invitationId", member.id);
    startTransition(async () => {
      const result = await revokeInviteAction({ success: false }, data);
      if (result.success) {
        toast.success("Convite revogado.");
        router.refresh();
      } else {
        toast.error(result.error ?? "Erro ao revogar convite.");
      }
    });
  };

  const menuItems = (member: TeamMemberLite): LiteMenuItem[] => {
    const items: LiteMenuItem[] = [];
    if (member.canEditAuthority) items.push({ id: "edit", label: "Editar", onSelect: () => setSheet({ kind: "edit", member }) });
    if (member.canManage && member.userId !== null) items.push({ id: "toggle", label: member.status === "active" ? "Desativar acesso" : "Ativar acesso", onSelect: () => toggleStatus(member), disabled: busy });
    if (member.status === "pending" && member.canManage) {
      items.push({ id: "resend", label: "Reenviar convite", onSelect: () => resendInvite(member), disabled: busy });
      items.push({ id: "revoke", label: "Revogar convite", tone: "danger", onSelect: () => revokeInvite(member), disabled: busy });
    }
    if (member.userId !== null && canBulk) items.push({ id: "password", label: "Redefinir senha", onSelect: () => setSheet({ kind: "password", member }) });
    if (member.role === "broker" && member.userId) items.push({ id: "transfer", label: "Transferir leads", onSelect: () => setSheet({ kind: "transfer", member }) });
    items.push({ id: "delete", label: "Excluir", tone: "danger", disabled: !member.canManage, onSelect: () => setSheet({ kind: "delete", member }) });
    return items;
  };

  const columns: LiteColumn<TeamMemberLite>[] = [
    {
      id: "member",
      label: "Membro",
      primary: true,
      render: (member) => (
        <span className={styles.member}>
          {canViewProfile && member.userId ? (
            <Link href={`/equipe/${member.userId}`} className={`${page.cellTitle} ${page.cellLink}`} title={member.name ?? undefined}>{member.name ?? "Sem nome"}</Link>
          ) : <span className={page.cellTitle}>{member.name ?? "Sem nome"}</span>}
          <span className={page.cellSub}>{member.userId === currentUserId ? "Você · " : ""}{member.email || "E-mail definido no cadastro"}</span>
        </span>
      ),
    },
    { id: "phone", label: "WhatsApp", render: (member) => member.phone ? <span className={page.numeric}>{formatLeadPhone(member.phone)}</span> : <span className={page.muted}>Não informado</span> },
    {
      id: "role",
      label: "Papel",
      render: (member) => (
        <span className={styles.roleCell}>
          <span className={page.badge}>{JOB_TITLE_LABELS[member.jobTitle] ?? ROLE_LABELS[member.role]}</span>
          {member.customRoleName ? <span className={page.cellSub}>{member.customRoleName}</span> : null}
        </span>
      ),
    },
    { id: "branch", label: "Unidade", nowrap: true, render: (member) => <span title={member.branchName ?? undefined}>{member.branchId ? member.branchName ?? "Unidade vinculada" : "Geral da empresa"}</span> },
    { id: "status", label: "Status", render: (member) => <span className={page.badge} data-tone={STATUS_TONE[member.status]}>{STATUS_LABELS[member.status]}</span> },
    { id: "actions", label: "Ações", numeric: true, render: (member) => <LiteMenu label={`Ações de ${member.name ?? member.email}`} items={menuItems(member)} /> },
  ];

  const activeCount = displayed.filter((member) => member.status === "active").length;

  return (
    <div className={`arc-venancor ${page.stack}`} data-skin="diretor">
      <TeamTabsLite active="membros" />

      <div className={page.stats}>
        <StatCard label="Total de membros" value={stats.total} sublabel="últimos 6 meses" sparklineData={stats.membersTrend} sparklineColor="var(--chart-1)" />
        <StatCard label="Acessos ativos" value={stats.active} sublabel="membros com acesso" sparklineData={stats.membersTrend} sparklineColor="var(--chart-3)" />
        <StatCard label="Leads sem atendimento" value={stats.unassignedLeads} sublabel="aguardando corretor" sparklineData={stats.leadsTrend} sparklineColor="var(--chart-4)" />
        <StatCard label="Vendas acumuladas" value={currency.format(stats.salesTotal)} sublabel="últimos 6 meses" sparklineData={stats.salesTrend} sparklineColor="var(--chart-2)" />
      </div>

      {showTransfers ? <TransferRequestsLite initial={transferRequests} /> : null}

      <section className={page.group} aria-labelledby="equipe-acessos">
        <div className={page.cardHead}>
          <h2 id="equipe-acessos" className={page.sectionTitle}>Acessos vinculados</h2>
          <p className={page.muted}>{activeCount} acesso{activeCount === 1 ? "" : "s"} ativo{activeCount === 1 ? "" : "s"}. Convites pendentes ficam sinalizados até o primeiro login.</p>
        </div>
        <div className={page.toolbar}>
          <label className={page.search}>
            <Search aria-hidden="true" size={18} className={page.searchIcon} />
            <input type="search" className={page.searchInput} aria-label="Buscar colaborador" placeholder="Buscar por nome, e-mail ou WhatsApp" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          {currentRole === "director" ? (
            <div className={page.select}>
              <LiteSelect label="Filtrar por unidade" hideLabel value={branchFilter} onChange={setBranchFilter} options={[{ value: "all", label: "Todas as unidades" }, ...branches.map((branch) => ({ value: branch.id, label: branch.name }))]} />
            </div>
          ) : null}
        </div>
        <LiteResponsiveData
          caption="Acessos vinculados"
          columns={columns}
          rows={pageRows}
          rowKey={(member) => member.id}
          rowTone={(member) => (member.status === "disabled" ? "muted" : undefined)}
          selection={canBulk ? {
            isSelected: (member) => multiSelect.isSelected(member.id),
            onToggle: (member) => multiSelect.toggle(member.id),
            allSelected: multiSelect.isAllSelected,
            onToggleAll: (checked) => (checked ? multiSelect.setSelected(memberIds) : multiSelect.clear()),
            rowLabel: (member) => `Selecionar ${member.name ?? "membro"}`,
          } : undefined}
          empty={<p>Nenhum resultado encontrado.</p>}
        />
        <LitePagination label="Páginas de membros" {...pagination} />
      </section>

      {canBulk ? (
        <LiteBulkBar
          count={multiSelect.count}
          onClear={multiSelect.clear}
          actions={[
            { id: "activate", label: "Ativar", onRun: () => bulkStatus("active"), disabled: busy },
            { id: "deactivate", label: "Desativar", tone: "danger", onRun: () => bulkStatus("disabled"), disabled: busy },
            { id: "pause", label: "Pausar recebimento", shortLabel: "Pausar", onRun: () => bulkAvailability("paused"), disabled: busy },
            { id: "resume", label: "Retomar recebimento", shortLabel: "Retomar", onRun: () => bulkAvailability("available"), disabled: busy },
          ]}
        />
      ) : null}

      {sheet?.kind === "edit" ? <EditMemberLite key={sheet.member.id} member={sheet.member} open onOpenChange={(open) => { if (!open) setSheet(null); }} branches={branches} currentRole={currentRole} currentBranchId={currentBranchId} customRoles={customRoles} allMembers={members} /> : null}
      {sheet?.kind === "delete" ? <DeleteMemberLite member={sheet.member} open onOpenChange={(open) => { if (!open) setSheet(null); }} /> : null}
      {sheet?.kind === "transfer" ? <TransferLeadsLite member={sheet.member} open onOpenChange={(open) => { if (!open) setSheet(null); }} allMembers={members} /> : null}
      {sheet?.kind === "password" ? <ResetPasswordLite member={sheet.member} open onOpenChange={(open) => { if (!open) setSheet(null); }} /> : null}
    </div>
  );
}
