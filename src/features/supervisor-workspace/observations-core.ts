export type SupervisorObservationScope = {
  role: string;
  tenantId: string;
  branchId: string | null;
  supervisorId: string;
  teamBrokerIds: readonly string[];
};

export type SupervisorObservationSource = {
  tenantId: string;
  branchId: string | null;
  leadOwnerId: string | null;
  authorId: string | null;
};

export function pageSupervisorObservationRows<T extends { id: string; createdAtCursor: string }>(rows: readonly T[], pageSize: number) {
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const pageRows = rows.slice(0, safePageSize);
  const hasMore = rows.length > safePageSize;
  const last = pageRows.at(-1);
  return {
    pageRows,
    hasMore,
    next: hasMore && last ? { beforeAt: last.createdAtCursor, beforeId: last.id } : null,
  };
}

const STATUS_KEYS = new Set(["new", "distributed", "in_contact", "contacted", "quote_sent", "negotiation", "documentation_pending", "under_analysis", "awaiting_reply", "converted", "lost"]);
const STATUS_BY_LABEL: Record<string, string> = {
  novo: "new", distribuido: "distributed", "em atendimento": "in_contact", "entrei em contato": "contacted",
  "cotacao enviada": "quote_sent", negociacao: "negotiation", "documentacao pendente": "documentation_pending",
  "em analise": "under_analysis", "aguardando retorno": "awaiting_reply", convertido: "converted", perdido: "lost",
};

export function isSupervisorTeamBrokerObservation(input: { actorRole: string | null; isCurrentTeamMember: boolean }) {
  return input.actorRole === "broker" && input.isCurrentTeamMember;
}

/** Defesa final do resultado: lead e autor precisam continuar na equipe ativa e na unidade do supervisor. */
export function isSupervisorObservationInScope(scope: SupervisorObservationScope, row: SupervisorObservationSource) {
  return scope.role === "supervisor"
    && Boolean(scope.branchId)
    && row.tenantId === scope.tenantId
    && row.branchId === scope.branchId
    && Boolean(row.leadOwnerId && scope.teamBrokerIds.includes(row.leadOwnerId))
    && Boolean(row.authorId && scope.teamBrokerIds.includes(row.authorId));
}

/** Observações anteriores ao campo JSON ficam completas na linha do tempo com este marcador. */
export function readSupervisorObservation(metadata: unknown, content: string | null | undefined): string | null {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const observation = (metadata as Record<string, unknown>).observation;
    if (typeof observation === "string" && observation.trim()) return observation.trim();
  }
  const marker = "Como foi o contato:";
  const index = content?.indexOf(marker) ?? -1;
  const value = index >= 0 ? content!.slice(index + marker.length).trim() : "";
  return value || null;
}

export function readSupervisorObservationStage(metadata: unknown, content: string | null | undefined): string | null {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const stage = (metadata as Record<string, unknown>).toStatus;
    if (typeof stage === "string" && STATUS_KEYS.has(stage)) return stage;
  }
  if (content?.startsWith("Novo contato registrado")) return "contacted";
  const label = content?.match(/^Status alterado:.*?→\s*([^.]+)\./u)?.[1];
  const normalized = label?.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR").trim();
  return normalized ? STATUS_BY_LABEL[normalized] ?? null : null;
}
