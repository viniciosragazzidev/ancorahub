/**
 * Hub da área Atendimento IA (/ia, 25/11/2026), no espírito do hub "Agente de IA" do DeskComm (Montar, Ensinar,
 * Acompanhar; docs/research/deskcomm-crm-engenharia-reversa.md §4.3 e §7.3). Regra pura: as linhas vêm das abas
 * da área em nav-registry (mesmo nome, endereço e permissão), com uma frase do que cada uma faz e, quando faz
 * sentido, um número. Toda aba da área que não está na fileira do topo aparece aqui, então nada fica sem caminho.
 */
import { NAV_AREAS, canShowNavTab, type NavAccessUser, type NavTab } from "@/shared/navigation/nav-registry";

export type AiHubCounts = {
  activeAlerts?: number | null;
  activeQualifications?: number | null;
  failures24h?: number | null;
};

export type AiHubSectionId = "configurar" | "ensinar" | "acompanhar";

type HubEntry = { tabId: string; description: string; count?: (counts: AiHubCounts) => string | null };

function plural(value: number, one: string, many: string) {
  return `${value.toLocaleString("pt-BR")} ${value === 1 ? one : many}`;
}

const HUB_SECTIONS: ReadonlyArray<{ id: AiHubSectionId; title: string; description: string; entries: readonly HubEntry[] }> = [
  {
    id: "configurar",
    title: "Configurar",
    description: "Como a IA fala, o que ela pode fazer e por onde a conversa passa.",
    entries: [
      { tabId: "comportamento", description: "Nome da assistente, mensagem de abertura e instruções da conversa." },
      { tabId: "permissoes", description: "O que a IA pode consultar e fazer sozinha." },
      { tabId: "follow-up", description: "Lembretes para quem parou de responder no meio da qualificação." },
      { tabId: "perguntas", description: "As perguntas que a IA faz e a ordem delas." },
      { tabId: "fluxos", description: "Fluxos automáticos de mensagem no WhatsApp." },
    ],
  },
  {
    id: "ensinar",
    title: "Ensinar",
    description: "O que a IA sabe responder sobre planos, operadoras e situações do dia a dia.",
    entries: [
      { tabId: "situacoes", description: "Respostas prontas para dúvidas e situações comuns." },
      { tabId: "mensagens", description: "Modelos da Meta, textos livres e respostas da IA." },
      { tabId: "base", description: "Fatos revisados de cada operadora e plano que a IA usa." },
    ],
  },
  {
    id: "acompanhar",
    title: "Acompanhar",
    description: "O que a IA está fazendo agora e onde ela precisa de ajuda.",
    entries: [
      { tabId: "leads-qualificacao", description: "Onde cada lead está na conversa e o que falta.", count: (counts) => (counts.activeQualifications ? `${plural(counts.activeQualifications, "lead", "leads")} agora` : null) },
      { tabId: "recuperacao", description: "Leads parados que a IA tenta retomar." },
      { tabId: "turbo", description: "Qualificação em lote para uma lista de leads." },
      { tabId: "alertas", description: "Problemas da operação, com o que fazer em cada um.", count: (counts) => (counts.activeAlerts ? plural(counts.activeAlerts, "alerta", "alertas") : null) },
      { tabId: "execucoes", description: "Cada resposta da IA, com a falha explicada.", count: (counts) => (counts.failures24h ? `${plural(counts.failures24h, "falha", "falhas")} em 24 h` : null) },
      { tabId: "simulador", description: "Teste a conversa sem mandar nada ao cliente." },
      { tabId: "conectividade", description: "Conexão do WhatsApp, webhook e chave da Meta." },
    ],
  },
];

export const AI_AREA_ID = "atendimento-ia" as const;
/** Aba da própria página de entrada: não entra na lista. */
export const AI_HUB_TAB_ID = "inicio";

export function aiAreaTabs(): readonly NavTab[] {
  return NAV_AREAS.find((area) => area.id === AI_AREA_ID)?.tabs ?? [];
}

/** Ids de aba listados no hub (para o teste de que nenhuma aba fica sem caminho). */
export function aiHubTabIds() {
  return HUB_SECTIONS.flatMap((section) => section.entries.map((entry) => entry.tabId));
}

export type AiHubRow = { id: string; label: string; href: string; description: string; count: string | null };
export type AiHubSection = { id: AiHubSectionId; title: string; description: string; rows: AiHubRow[] };

/** Seções do hub para quem está vendo: só as linhas que a pessoa pode abrir; seção vazia some. */
export function buildAiHubSections(user: NavAccessUser | null, counts: AiHubCounts = {}): AiHubSection[] {
  const tabs = new Map(aiAreaTabs().map((tab) => [tab.id, tab]));
  return HUB_SECTIONS.map((section) => ({
    id: section.id,
    title: section.title,
    description: section.description,
    rows: section.entries.flatMap((entry) => {
      const tab = tabs.get(entry.tabId);
      if (!tab || !canShowNavTab(tab, user)) return [];
      return [{ id: tab.id, label: tab.label, href: tab.href, description: entry.description, count: entry.count?.(counts) ?? null }];
    }),
  })).filter((section) => section.rows.length > 0);
}

export type AiHubSummaryItem = { id: "status" | "qualifying" | "alerts" | "failures"; label: string; value: string; tone?: "success" | "warning" | "danger"; href?: string };

/** Resumo vivo do topo: IA ligada ou pausada, leads em qualificação, alertas ativos e falhas em 24 h. */
export function buildAiHubSummary(input: { enabled: boolean | null; activeQualifications: number | null; activeAlerts: number | null; failures24h: number | null }): AiHubSummaryItem[] {
  const number = (value: number | null) => (value === null ? "Indisponível" : value.toLocaleString("pt-BR"));
  return [
    { id: "status", label: "IA", value: input.enabled === null ? "Indisponível" : input.enabled ? "Ligada" : "Pausada", tone: input.enabled ? "success" : input.enabled === false ? "warning" : undefined, href: "/qualificacao" },
    { id: "qualifying", label: "Em qualificação agora", value: number(input.activeQualifications), href: "/qualificacao/leads" },
    { id: "alerts", label: "Alertas ativos", value: number(input.activeAlerts), tone: input.activeAlerts ? "warning" : undefined, href: "/ia/alertas" },
    { id: "failures", label: "Falhas em 24 h", value: number(input.failures24h), tone: input.failures24h ? "danger" : undefined, href: "/ia/execucoes?falhas=1" },
  ];
}
