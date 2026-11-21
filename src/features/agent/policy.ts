import type { ConfirmLevel, ToolRisk } from "./types";

/**
 * Política central do agente (plano §5.3). Pura: quem chama passa o que sabe do pedido.
 * Roda ao montar o catálogo (o modelo nem vê o que não pode), no toolApproval (pede confirmação) e dentro da ferramenta.
 */
export type PolicyTool = {
  name: string;
  risk: ToolRisk;
  roles: ReadonlyArray<string>;
  confirm: ConfirmLevel | ((input: Record<string, unknown>) => ConfirmLevel);
};

export type PolicyViewer = {
  role: string;
  /** "Ver como" do Super-admin: só leitura. */
  viewAs: boolean;
  /** Chave da empresa `agent_director_writes_<tenantId>` (desligada até o piloto). */
  writesEnabled: boolean;
};

export type PolicyTurn = {
  /** O turno já leu conversa ou texto livre de cliente (anti-injeção: escrita só com confirmação). */
  readUntrustedText?: boolean;
  /** Pedido veio por voz com transcrição duvidosa. */
  lowConfidenceVoice?: boolean;
};

/** Se a ferramenta entra no catálogo deste usuário. */
export function isToolVisible(tool: PolicyTool, viewer: PolicyViewer) {
  if (!tool.roles.includes(viewer.role)) return false;
  if (tool.risk.readOnly) return true;
  return !viewer.viewAs && viewer.writesEnabled;
}

const ORDER: Record<ConfirmLevel, number> = { direto: 0, toque: 1, forte: 2 };

function atLeast(level: ConfirmLevel, floor: ConfirmLevel): ConfirmLevel {
  return ORDER[level] >= ORDER[floor] ? level : floor;
}

/** O nível final de uma chamada: o da ferramenta, subido pelas regras do turno. */
export function confirmLevelFor(tool: PolicyTool, input: Record<string, unknown>, turn: PolicyTurn = {}): ConfirmLevel {
  if (tool.risk.readOnly) return "direto";
  let level = typeof tool.confirm === "function" ? tool.confirm(input) : tool.confirm;
  if (tool.risk.external) level = "forte";
  if (tool.risk.destructive) level = atLeast(level, "toque");
  if (turn.readUntrustedText || turn.lowConfidenceVoice) level = atLeast(level, "toque");
  return level;
}

export type ApprovalDecision = { type: "approved" | "user-approval" | "denied"; reason?: string };

/** O que o toolApproval do ai@7 devolve para esta chamada. */
export function approvalFor(tool: PolicyTool, viewer: PolicyViewer, input: Record<string, unknown>, turn: PolicyTurn = {}): ApprovalDecision {
  if (!tool.roles.includes(viewer.role)) return { type: "denied", reason: "Seu papel não libera esta ação." };
  if (tool.risk.readOnly) return { type: "approved" };
  if (viewer.viewAs) return { type: "denied", reason: "No \"Ver como\" o agente só consulta." };
  if (!viewer.writesEnabled) return { type: "denied", reason: "As ações do agente ainda não estão liberadas nesta empresa." };
  return confirmLevelFor(tool, input, turn) === "direto" ? { type: "approved" } : { type: "user-approval" };
}
