/**
 * Catálogo dos recursos que ligam e desligam para uma corretora (25/11).
 *
 * Uma fonte só para os nomes e o que cada recurso faz: o super-admin usa `BROKER_NEWS_RESOURCES` no cartão
 * "Novidades do corretor" (mesmos campos, mesma ordem, mesmo comportamento) e /settings › Recursos mostra a
 * situação de tudo para o diretor e o gestor, só leitura. Funções puras: sem banco, sem segredo, sem chave.
 */
import { FEATURE_FLAGS, type FeatureFlagDefinition } from "@/shared/feature-flags/catalog";

export type ResourceGroupId = "plataforma" | "empresa" | "unidade";
export type ResourceDecider = "Plataforma" | "Diretor";

/** Um recurso já resolvido para a corretora: só nome, texto, quem decide e se está ligado. */
export type ResourceEntry = {
  id: string;
  group: ResourceGroupId;
  title: string;
  detail: string;
  decidedBy: ResourceDecider;
  enabled: boolean;
  /** Onde o diretor ajusta (só quando ele mesmo decide). */
  adjustHref?: string;
  /** Unidade dona do recurso, no grupo "Por unidade". */
  unitName?: string;
};

export type ResourceGroup = { id: ResourceGroupId; title: string; items: ResourceEntry[] };

export type BrokerNewsResource = {
  /** Campo do formulário do super-admin (updateBrokerNewsSettingsAction). */
  field: string;
  needsTables: boolean;
  flag: FeatureFlagDefinition;
  title: string;
  detail: string;
};

/** Novidades do corretor: o mesmo texto que o super-admin lê ao ligar cada uma. */
export const BROKER_NEWS_RESOURCES: readonly BrokerNewsResource[] = [
    { field: "brokerNowFloatingEnabled", needsTables: false, flag: FEATURE_FLAGS.BROKER_NOW_FLOATING, title: "Agora em painel flutuante no Lite", detail: "O corretor abre suas pendências pelo botão Agora. Desativar restaura o bloco acima das conversas, sem alterar ordem, dados, prazos ou ações." },
    { field: "whatsappPlantaoNoticeEnabled", needsTables: false, flag: FEATURE_FLAGS.WHATSAPP_PLANTAO_NOTICE, title: "Aviso de WhatsApp para leads do plantão", detail: "Mostra ao corretor sem conexão o aviso diário e o lembrete fixo na conversa com Sasá. Desativar esconde os dois avisos sem alterar a distribuição de leads." },
    { field: "relationshipCenterEnabled", needsTables: true, flag: FEATURE_FLAGS.RELATIONSHIP_CENTER, title: "Central de relacionamento", detail: "Rota /relacionamento: direção manda avisos para corretores, unidades, plantões ou equipes e vê quem leu; corretor ganha o Mural da gestão." },
    { field: "brokerEngagementEnabled", needsTables: true, flag: FEATURE_FLAGS.BROKER_ENGAGEMENT, title: "Jornada do corretor (pontos, ranking e missão de etapa)", detail: "Liga o extrato de pontos (cron /api/internal/jobs/engagement), a posição do próprio corretor no Início e no perfil, e a missão \"registre a etapa\". Requer parecer jurídico antes de ligar para todos (ranking e corretor autônomo)." },
    { field: "supervisorTeamScopeEnabled", needsTables: false, flag: FEATURE_FLAGS.SUPERVISOR_TEAM_SCOPE, title: "Supervisor vê só a equipe dele", detail: "Leads, clientes, busca, central de atenção, Equipe, perfil e metas do supervisor ficam limitados aos corretores que ele supervisiona (Equipe → Editar membro). Avise os supervisores antes: leads de fora da equipe somem da lista deles." },
    { field: "supervisorLiteEnabled", needsTables: false, flag: FEATURE_FLAGS.SUPERVISOR_LITE, title: "Lite do supervisor", detail: "O supervisor entra no app Lite com Início em conversas: Equipe, Leads da equipe, Desempenho da equipe e Âncora. Só vale com \"Supervisor vê só a equipe dele\" ligado." },
    { field: "teamManagementEnabled", needsTables: false, flag: FEATURE_FLAGS.TEAM_MANAGEMENT, title: "Métricas da Gestão de Equipes", detail: "Habilita a camada de métricas, saúde e alertas para gestor da unidade e supervisor da própria equipe. A tela /gestao do gestor Lite e as métricas de equipe ficam disponíveis quando esta flag estiver ativa." },
    { field: "brokerPerformanceLiteEnabled", needsTables: false, flag: FEATURE_FLAGS.BROKER_PERFORMANCE_LITE, title: "Desempenho do corretor no Lite", detail: "A tela Desempenho do corretor passa a mostrar os próprios leads, cotações, vendas e receita (Hoje, 7 e 30 dias), o funil, a meta do mês e as vendas por operadora, pelas mesmas métricas do /gestao. Sem ranking nem comparação com a equipe. Desligada, volta o resumo do dia." },
    { field: "brokerJourneyEnabled", needsTables: true, flag: FEATURE_FLAGS.BROKER_JOURNEY, title: "Jornada v2: Minha jornada, missões e celebrações", detail: "Corretor ganha /jornada (nível, missões do dia e da semana, pódio da unidade, conquistas, extrato), a conversa Jornada, o aviso +pts e as celebrações. Já liga a coleta de pontos. Precisa da migração 0193. Comece com um corretor piloto." },
    { field: "brokerHomeActionsEnabled", needsTables: false, flag: FEATURE_FLAGS.BROKER_HOME_ACTIONS, title: "Início do corretor organizado", detail: "Ações rápidas fixas (Registrar venda e Novo contato; Cotação e Agenda seguem no Mais) logo abaixo das pendências, cartão Meu mês quando o financeiro do ERP está liberado e Sua semana no fim. Sai o botão flutuante repetido de novo atendimento. Desligado, volta o Início anterior." },
    { field: "brokerNavReorgEnabled", needsTables: false, flag: FEATURE_FLAGS.BROKER_NAV_REORG, title: "Início do corretor reorganizado", detail: "Plano do modo corretor. Etapa 1: o Início fica com Sasá, Meus leads, Minha carteira, Plantão, Agenda, Desempenho e Cotação (sai Dicas de Atendimento e Jornada) e o menu Mais ganha Agenda e Desempenho. Etapa 2: Desempenho por período, resultados, atendimento e conversão, metas e Minha jornada. Etapa 3: Plantão e Mais abrem Plantões em uma entrada única. Etapa 4a: Minha carteira com Em negociação, Clientes, Precisa de atenção, Arquivados e Novo interessado (precisa também da carteira Lite ligada). Etapa 5: Perfil do cliente com Histórico, Sobre, Contratos e Documentos. Etapa 6: Agenda agrupada por dia, abrindo o lead ou o perfil. Desligado, volta tudo ao anterior." },
    { field: "callAncoraVisualEnabled", needsTables: false, flag: FEATURE_FLAGS.CALL_ANCORA_VISUAL, title: "Demonstração visual do Call Âncora", detail: "Desligada por padrão. Ao ligar, libera aos corretores a tela com contatos fictícios, pareamento temporário e estados de ligação simulados. Admins da plataforma e desenvolvimento continuam com acesso. Não cria leads nem usa a base real." },
    { field: "supervisorLeadImportEnabled", needsTables: false, flag: FEATURE_FLAGS.SUPERVISOR_LEAD_IMPORT, title: "Lista interna da equipe (supervisor)", detail: "Em Leads da equipe, o supervisor importa até 50 contatos por vez (300 por dia) e escolhe quantos vão para cada corretor da equipe dele; nada é distribuído antes de tocar em Distribuir. Os leads ficam fora da distribuição automática e do plantão, sem mensagem ao cliente e sem WhatsApp ao corretor (só aviso no CRM). Sem migração." },
    { field: "brokerPriorClientsEnabled", needsTables: false, flag: FEATURE_FLAGS.BROKER_PRIOR_CLIENTS, title: "Cliente que já possuo (carteira anterior)", detail: "Etapa 4b do plano do modo corretor (DEC-187): em Minha carteira, Adicionar contato ganha Cliente que já possuo, com contratos anteriores e renovação em Precisa de atenção. Não gera venda, comissão, conversão nem pontos. Só vale com o Início reorganizado e a carteira Lite ligados, e precisa da migração 0231. Desligar esconde a opção sem apagar os cadastros." },
    { field: "brokerQuickSaleEnabled", needsTables: false, flag: FEATURE_FLAGS.BROKER_QUICK_SALE, title: "Registrar venda em dois toques", detail: "Em Minha carteira, Registrar venda lista os leads do próprio corretor em negociação (os mais adiantados no funil primeiro); tocar num lead abre a tela dele já no registro de venda, com as mesmas regras e aprovações de hoje. Desligar some o acesso e a tela do lead ignora o atalho." },
    { field: "teamRankingEnabled", needsTables: true, flag: FEATURE_FLAGS.TEAM_RANKING, title: "Placar entre equipes", detail: "Supervisor ganha /equipe/desempenho (pódio da equipe e disputa entre equipes da unidade, por média de pontos por corretor ativo) e o diretor vê unidades e equipes na Jornada da equipe." },
    { field: "engagementCampaignsEnabled", needsTables: true, flag: FEATURE_FLAGS.ENGAGEMENT_CAMPAIGNS, title: "Campanhas, regras e auditoria de pontos", detail: "Diretor cria campanhas com bônus para um público, ajusta as regras de pontos e audita pontos fora do padrão (com estorno). Gestor e supervisor criam campanhas só no próprio escopo." },
    { field: "welcomeVideoEnabled", needsTables: false, flag: FEATURE_FLAGS.WELCOME_VIDEO, title: "Vídeo de boas-vindas no primeiro acesso", detail: "Antes do card de boas-vindas e do tour, o corretor vê um vídeo de 1 minuto (narrado, legendado) com o que o app faz. Pode pular a qualquer momento e só aparece uma vez por aparelho." },
    { field: "brokerLiteFinanceEnabled", needsTables: false, flag: FEATURE_FLAGS.BROKER_LITE_FINANCE, title: "Meu financeiro do corretor no Lite", detail: "Tela /meu-financeiro e cartão Meu mês, somente leitura: a receber, recebido no mês e adiantamentos em aberto do próprio corretor, com comissões por venda, repasses e recibos. Só aparece quando a direção liberou o módulo financeiro do ERP e o corretor pode ver a própria comissão. Desligar volta a rota ao Início sem apagar dados." },
    { field: "brokerAiAssistantsEnabled", needsTables: false, flag: FEATURE_FLAGS.BROKER_AI_ASSISTANTS, title: "IA nos assistentes do corretor", detail: "Texto livre nos assistentes do Lite responde com IA. Precisa das chaves (Groq/OpenRouter) no Coolify; a conversa do lead só usa provedor pago." },
];

type TenantFlagResource = { id: string; flag: FeatureFlagDefinition; onValues?: readonly string[]; title: string; detail: string };

/** Ligados pela plataforma só para esta corretora (a chave real leva o id da empresa; nunca aparece na tela). */
export const TENANT_FLAG_RESOURCES: readonly TenantFlagResource[] = [
  { id: "broker-ad-context", flag: FEATURE_FLAGS.BROKER_AD_CONTEXT, title: "De onde veio o lead", detail: "O corretor vê o plano anunciado e o título, o texto e a imagem do anúncio. Nunca a verba nem o nome da campanha." },
  { id: "live-status-strip", flag: FEATURE_FLAGS.LIVE_STATUS_STRIP, title: "Agora na operação", detail: "Faixa com a situação ao vivo no Painel e na Distribuição." },
  { id: "lite-accept-handoff", flag: FEATURE_FLAGS.LITE_ACCEPT_HANDOFF, title: "Aceite com contador", detail: "Ao aceitar o lead, o corretor vê os dados dele e o WhatsApp abre sozinho em 30 segundos." },
  { id: "customer-waiting-guard", flag: FEATURE_FLAGS.CUSTOMER_WAITING_GUARD, onValues: ["observe"], title: "Cliente aguardando o corretor", detail: "Registra no histórico do lead quando o cliente espera resposta, sem enviar nada, e mostra a espera em Negociações." },
  { id: "ai-audio-transcription", flag: FEATURE_FLAGS.AI_AUDIO_TRANSCRIPTION, title: "IA ouve áudios na qualificação", detail: "A IA transcreve os 2 primeiros áudios de cada lead em qualificação, até 2 minutos." },
  { id: "auto-sale", flag: FEATURE_FLAGS.AUTO_SALE, title: "Venda Automatizada", detail: "A IA conduz a venda de um lead quente por vez, escolhido pelo gestor, em Simulação ou Copiloto." },
  { id: "auto-sale-autopilot", flag: FEATURE_FLAGS.AUTO_SALE_AUTOPILOT, title: "Autopiloto da Venda Automatizada", detail: "A IA envia sozinha, com limites e só planos revisados. O gestor escolhe o modo em cada negociação." },
  { id: "duty-reminder-24h", flag: FEATURE_FLAGS.DUTY_SHIFT_REMINDER_24H, title: "Lembrete do plantão no dia anterior", detail: "Envia pelo WhatsApp da empresa um lembrete 24 horas antes do plantão." },
];

/** Chave de uma flag por empresa, no padrão `<chave>_<tenantId>` de cada feature. */
export function tenantFlagKey(flag: FeatureFlagDefinition, tenantId: string) {
  return `${flag.key}_${tenantId}`;
}

/** Modo da etapa pela IA (conversation-intelligence/stage-mode): mesma chave por empresa, padrão "auto". */
export function aiStageModeKey(tenantId: string) {
  return `ai_stage_mode_${tenantId}`;
}

/** Ligado quando o valor salvo (ou o padrão do catálogo) é um dos valores de "ligado". */
export function flagIsOn(stored: string | undefined, defaultValue: string, onValues: readonly string[] = ["true"]) {
  return onValues.includes(stored ?? defaultValue);
}

/** Todas as chaves que a seção Recursos precisa ler para uma empresa. */
export function resourceSettingKeys(tenantId: string) {
  return [
    ...BROKER_NEWS_RESOURCES.map((item) => item.flag.key),
    ...TENANT_FLAG_RESOURCES.map((item) => tenantFlagKey(item.flag, tenantId)),
    aiStageModeKey(tenantId),
  ];
}

export type CompanyToggles = { feedbackToastEnabled: boolean; feedbackPushEnabled: boolean; feedbackRequiredEnabled: boolean };
export type UnitToggles = { id: string; name: string; acceptingLeads: boolean; autoDistribute: boolean };

const ATENDIMENTO_HREF = "/settings?tab=atendimento";
const UNITS_HREF = "/distribuicao?view=filas";

/** Monta a lista de recursos da empresa a partir do que já foi lido do banco. Só booleanos saem daqui. */
export function buildResourceEntries(input: {
  tenantId: string;
  settings: ReadonlyMap<string, string>;
  company: CompanyToggles | null;
  units: readonly UnitToggles[];
}): ResourceEntry[] {
  const { tenantId, settings } = input;
  const platform: ResourceEntry[] = BROKER_NEWS_RESOURCES.map((item) => ({
    id: item.field,
    group: "plataforma",
    title: item.title,
    detail: item.detail,
    decidedBy: "Plataforma",
    enabled: flagIsOn(settings.get(item.flag.key), item.flag.defaultValue),
  }));
  const perCompany: ResourceEntry[] = TENANT_FLAG_RESOURCES.map((item) => ({
    id: item.id,
    group: "empresa",
    title: item.title,
    detail: item.detail,
    decidedBy: "Plataforma",
    enabled: flagIsOn(settings.get(tenantFlagKey(item.flag, tenantId)), item.flag.defaultValue, item.onValues),
  }));
  const director: ResourceEntry[] = [
    ...(input.company ? [
      { id: "feedback-toast", title: "Aviso de feedback na tela", detail: "Aviso no canto da tela com \"Registrar agora\" e \"Lembrar depois\".", enabled: input.company.feedbackToastEnabled },
      { id: "feedback-push", title: "Notificação push de feedback", detail: "Notificação no navegador quando o corretor está ausente.", enabled: input.company.feedbackPushEnabled },
      { id: "feedback-required", title: "Feedback obrigatório", detail: "O corretor registra o feedback no prazo. Vencido, o lead pode ser redistribuído.", enabled: input.company.feedbackRequiredEnabled },
    ] : []),
    { id: "ai-stage-mode", title: "Etapa do lead pela IA", detail: "A IA lê a conversa e move ou sugere a etapa do atendimento.", enabled: (settings.get(aiStageModeKey(tenantId)) ?? "auto") !== "off" },
  ].map((item) => ({ ...item, group: "empresa" as const, decidedBy: "Diretor" as const, adjustHref: ATENDIMENTO_HREF }));
  const units: ResourceEntry[] = input.units.flatMap((unit) => [
    { id: `unit-${unit.id}-accepting`, title: "Recebe leads", detail: "A unidade entra na distribuição de novos leads.", enabled: unit.acceptingLeads },
    { id: `unit-${unit.id}-auto`, title: "Distribuição automática", detail: "Os leads da unidade vão para os corretores sem passar pela gestão.", enabled: unit.autoDistribute },
  ].map((item) => ({ ...item, group: "unidade" as const, decidedBy: "Diretor" as const, adjustHref: UNITS_HREF, unitName: unit.name })));
  return [...platform, ...perCompany, ...director, ...units];
}

const GROUP_ORDER: readonly { id: ResourceGroupId; title: string }[] = [
  { id: "plataforma", title: "Da plataforma" },
  { id: "empresa", title: "Da empresa" },
  { id: "unidade", title: "Por unidade" },
];

/**
 * Agrupa na ordem fixa (plataforma, empresa, unidade), sem grupo vazio. Dentro do grupo, o que o diretor decide
 * vem antes e a ordem do catálogo se mantém. Sem `canAdjust` (gestor), nenhum "Ajustar" aparece.
 */
export function groupResources(entries: readonly ResourceEntry[], options: { canAdjust: boolean }): ResourceGroup[] {
  return GROUP_ORDER.map(({ id, title }) => {
    const inGroup = entries.filter((entry) => entry.group === id);
    const ordered = [...inGroup.filter((entry) => entry.decidedBy === "Diretor"), ...inGroup.filter((entry) => entry.decidedBy !== "Diretor")];
    const items = ordered.map((entry) => {
      if (options.canAdjust && entry.decidedBy === "Diretor") return entry;
      const { adjustHref: _drop, ...rest } = entry;
      void _drop;
      return rest;
    });
    return { id, title, items };
  }).filter((group) => group.items.length > 0);
}

export function resourceStateLabel(enabled: boolean) {
  return enabled ? "Ligado" : "Desligado";
}
