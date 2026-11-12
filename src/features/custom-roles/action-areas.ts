import type { PermissionKey } from "@/shared/auth/permissions";

/**
 * Fronteira dos cargos nas ações de servidor (04/11, F2, revisão do Vigia).
 *
 * O Next grava no manifesto de cada build o arquivo de origem de toda ação (`filename`). Para quem tem
 * cargo, a ação só roda se a área daquele arquivo estiver liberada: rota do catálogo (`route:<key>` +
 * piso do papel) ou capacidade. Não depende da URL enviada pelo cliente. Arquivo sem regra: negado
 * (fail closed). Sem cargo nada disso roda.
 */
export type ActionRequirement =
  | { kind: "livre" }
  | { kind: "route"; key: string }
  | { kind: "cap"; permission: PermissionKey }
  | { kind: "negado" };

type Regra = [prefixo: string, requisito: ActionRequirement];

const livre: ActionRequirement = { kind: "livre" };
const rota = (key: string): ActionRequirement => ({ kind: "route", key });
const cap = (permission: PermissionKey): ActionRequirement => ({ kind: "cap", permission });

/** Do mais específico para o mais geral; o primeiro prefixo que casar vale. */
const REGRAS: readonly Regra[] = [
  // Sessão, perfil e avisos da própria pessoa.
  ["src/app/(auth)/", livre],
  ["src/app/primeiro-acesso/", livre],
  ["src/shared/auth/", livre],
  ["src/shared/utils/", livre],
  ["src/features/user-profile/", livre],
  ["src/features/notifications/", livre],
  ["src/features/onboarding/", livre],
  ["src/features/broker-availability/", livre],
  ["src/app/(dashboard)/notificacoes/", livre],
  ["src/app/(dashboard)/settings/security-actions", livre],
  // Plataforma: têm a própria guarda de super-admin, fora do tenant.
  ["src/app/(platform-admin)/", livre],
  ["src/features/super-admin/", livre],
  ["src/features/system-report/", livre],
  ["src/features/erp/platform-actions", livre],
  ["src/features/erp/governance-actions", cap("erp_manage_modules")],
  ["src/features/erp/import-actions", cap("erp_import_data")],
  ["src/features/erp/implantation-actions", cap("erp_manage_operations")],
  ["src/features/erp/finance-actions", cap("erp_view_finance")],

  // Telas do tenant.
  ["src/app/(dashboard)/equipe/", rota("equipe")],
  ["src/app/(dashboard)/leads/", rota("leads")],
  ["src/app/(dashboard)/relatorios/", rota("relatorios")],
  ["src/app/(dashboard)/integrations/", rota("integracoes")],
  ["src/app/(dashboard)/settings/actions", cap("configurar_white_label")],
  ["src/app/(dashboard)/settings/feedback-actions", cap("gerenciar_configuracoes_unidade")],
  ["src/app/(dashboard)/settings/integrations-actions", cap("acessar_integracao_meta")],
  ["src/app/(dashboard)/settings/waha-connection-actions", rota("whatsapp")],
  ["src/app/(dashboard)/settings/whatsapp-actions", rota("whatsapp")],

  ["src/features/leads/", rota("leads")],
  // Dispara aviso de lead atribuído (push/WhatsApp): é da área de Leads, não livre (revisão do Vigia).
  ["src/utils/plugins/", rota("leads")],
  ["src/features/lead-tags/", rota("leads")],
  ["src/features/manager-workspace/", rota("leads")],
  ["src/features/post-sale/", rota("leads")],
  ["src/features/broker-workspace/", rota("minha-fila")],
  ["src/features/lead-distribution/", rota("distribuicao")],
  ["src/features/whatsapp-plantao-notice/", rota("distribuicao")],
  ["src/features/conversations/", rota("conversas")],
  ["src/features/browser-extension/", rota("extensao")],
  ["src/features/communication-channels/", rota("whatsapp")],
  ["src/features/waha-group-capture/", rota("whatsapp")],
  ["src/features/supervisor-workspace/", rota("equipe")],
  ["src/features/branches/", rota("filiais")],
  ["src/features/conversation-intelligence/", rota("negociacoes")],
  ["src/features/negotiations/", rota("negociacoes")],
  ["src/features/documents/", rota("documentos")],
  ["src/features/quotes/", rota("cotacao")],
  ["src/features/proposals/", rota("propostas")],
  ["src/features/sales/", rota("vendas")],
  // Venda Automatizada (DEC-182): ações do diretor na área de vendas; as do Super-admin têm a própria guarda.
  ["src/features/auto-sale/super-admin-actions", livre],
  ["src/features/auto-sale/", rota("vendas")],
  ["src/features/sales-tools/", rota("ferramentas")],
  ["src/features/promotional-materials/", rota("ferramentas")],
  ["src/features/relationship/", rota("relacionamento")],
  ["src/features/post-sale-audit/", rota("equipe")],
  ["src/features/journey/", rota("jornada")],
  ["src/features/performance/", rota("desempenho")],
  ["src/features/tenant-intelligence/", rota("dashboard")],
  ["src/features/goals/", cap("gerenciar_metas")],
  ["src/features/commissions/", rota("configuracoes")],
  ["src/features/catalog/", rota("settings")],
  ["src/features/global-catalog/", rota("settings")],
  ["src/features/operator-catalog/", rota("settings")],
  ["src/features/meta-ads/", rota("campanhas")],
  ["src/features/marketing-import/", rota("marketing")],
  ["src/features/message-library/", rota("mensagens")],
  ["src/features/automations/", rota("fluxos-whatsapp")],
  ["src/features/ai-gateway/", rota("assistente")],
  ["src/features/ai-qualification/", rota("qualificacao")],
  ["src/features/ai-agent/", rota("qualificacao")],
  ["src/features/agent-training/", rota("qualificacao")],
  ["src/features/qualification-flow/", rota("qualificacao")],
  ["src/features/qualification-turbo/", rota("qualificacao")],
  ["src/features/situation-learning/", rota("qualificacao")],
  ["src/features/attendance-flows/", rota("atendimento")],
  ["src/features/attendance-situations/", rota("atendimento")],
];

/** Caminho do arquivo da ação a partir de `src/` (o manifesto traz caminho absoluto, com \ no Windows). */
export function normalizarArquivoDaAcao(filename: string): string | null {
  const caminho = filename.split("\\").join("/");
  const inicio = caminho.lastIndexOf("/src/");
  if (inicio >= 0) return caminho.slice(inicio + 1);
  return caminho.startsWith("src/") ? caminho : null;
}

export function requisitoDaAcao(filename: string | null | undefined): ActionRequirement {
  const arquivo = filename ? normalizarArquivoDaAcao(filename) : null;
  if (!arquivo) return { kind: "negado" };
  const regra = REGRAS.find(([prefixo]) => arquivo.startsWith(prefixo));
  return regra ? regra[1] : { kind: "negado" };
}
