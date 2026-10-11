/**
 * Broker assistance (plan jornada-ranking-v2 §5, E1/E2/E4): one catalog of
 * screens and actions, with the words the broker actually uses, and the help
 * of each Lite screen. Pure data and functions (shared by the search, the "?"
 * sheet and the Âncora intents).
 */

export type AssistCapability = "journey" | "quoteSimulator" | "dutyCalendar" | "relationshipCenter";

export type AssistEntry = {
  id: string;
  kind: "screen" | "action";
  title: string;
  description: string;
  href: string;
  /** Extra words people type for it (synonyms, slang, typos). */
  keywords: string[];
  requires?: AssistCapability;
};

export const ASSIST_ENTRIES: readonly AssistEntry[] = [
  { id: "home", kind: "screen", title: "Início", description: "Suas conversas, o resumo do dia e a próxima coisa a fazer.", href: "/dashboard", keywords: ["inicio", "home", "começo", "tela principal", "resumo"] },
  { id: "queue", kind: "screen", title: "Minha fila", description: "Leads esperando você aceitar ou atender.", href: "/minha-fila", keywords: ["fila", "leads novos", "aceitar lead", "ofertas", "lead chegando"] },
  { id: "leads", kind: "screen", title: "Meus leads", description: "Todos os leads com você, por etapa.", href: "/leads", keywords: ["leads", "clientes em atendimento", "funil", "etapas", "carteira"] },
  { id: "clients", kind: "screen", title: "Clientes", description: "Quem já fechou com você.", href: "/clientes", keywords: ["clientes", "vendidos", "fechados", "carteira"] },
  { id: "journey", kind: "screen", title: "Minha jornada", description: "Pontos, missões, conquistas e o placar da unidade.", href: "/jornada", keywords: ["pontos", "missoes", "missão", "ranking", "placar", "nivel", "conquistas", "selos", "xp"], requires: "journey" },
  { id: "ledger", kind: "screen", title: "De onde vieram meus pontos", description: "O extrato de cada ponto que você ganhou.", href: "/jornada#extrato", keywords: ["extrato", "historico de pontos", "por que ganhei", "pontos sumiram", "estorno"], requires: "journey" },
  { id: "duty", kind: "screen", title: "Plantões", description: "Seus plantões do mês e a presença.", href: "/plantoes", keywords: ["plantao", "escala", "horario", "turno", "agenda"], requires: "dutyCalendar" },
  { id: "quote", kind: "screen", title: "Cotação", description: "Simular o valor de um plano.", href: "/cotacao", keywords: ["cotar", "simular", "preço", "valor do plano", "tabela"], requires: "quoteSimulator" },
  { id: "mural", kind: "screen", title: "Mural da gestão", description: "Avisos e reconhecimentos da direção.", href: "/relacionamento", keywords: ["avisos", "recados", "mural", "comunicados", "gestao"], requires: "relationshipCenter" },
  { id: "notifications", kind: "screen", title: "Notificações", description: "Tudo que o sistema avisou para você.", href: "/notificacoes", keywords: ["notificacoes", "avisos", "sino", "alertas"] },
  { id: "settings", kind: "screen", title: "Configurações", description: "Conta, disponibilidade, WhatsApp e segurança.", href: "/settings", keywords: ["configuracoes", "ajustes", "perfil", "conta"] },
  { id: "pause", kind: "action", title: "Pausar ou voltar a receber leads", description: "Toque no seu status no topo do Início.", href: "/dashboard", keywords: ["pausar", "parar de receber", "sumir da fila", "nao quero leads", "intervalo", "almoço", "voltar a receber", "disponivel"] },
  { id: "availability", kind: "action", title: "Ajustar minha disponibilidade", description: "Dias e horários em que você recebe leads.", href: "/settings?tab=disponibilidade", keywords: ["horario de trabalho", "dias que trabalho", "disponibilidade", "folga"] },
  { id: "whatsapp", kind: "action", title: "Conectar meu WhatsApp", description: "Para mandar a primeira mensagem pelo sistema.", href: "/settings?tab=whatsapp", keywords: ["whatsapp", "zap", "conectar", "qr code", "numero"] },
  { id: "photo", kind: "action", title: "Trocar minha foto", description: "Em Configurações, Minha conta.", href: "/settings?tab=conta", keywords: ["foto", "avatar", "imagem do perfil"] },
  { id: "password", kind: "action", title: "Trocar a senha", description: "Em Configurações, Segurança.", href: "/settings?tab=seguranca", keywords: ["senha", "trocar senha", "esqueci", "seguranca"] },
  { id: "board-privacy", kind: "action", title: "Sair do placar da unidade", description: "Você continua vendo a sua posição; os outros não veem você.", href: "/settings?tab=placar", keywords: ["sair do ranking", "esconder do placar", "privacidade", "nao aparecer"], requires: "journey" },
  { id: "tour", kind: "action", title: "Rever o tour do app", description: "No menu Mais, Fazer o tour.", href: "/dashboard?tour=1", keywords: ["tour", "tutorial", "como usa", "ajuda", "me ensina", "aprender"] },
  { id: "register-contact", kind: "action", title: "Registrar o contato com o cliente", description: "Abra o lead e toque em Registrar contato.", href: "/leads", keywords: ["registrar contato", "liguei", "falei com o cliente", "primeiro contato"] },
  { id: "change-step", kind: "action", title: "Mudar a etapa de um lead", description: "Abra o lead e toque na etapa atual.", href: "/leads", keywords: ["etapa", "mudar etapa", "cotacao enviada", "negociacao", "avançar lead"] },
  { id: "schedule-return", kind: "action", title: "Agendar um retorno", description: "Abra o lead e toque em Agendar retorno.", href: "/leads", keywords: ["retorno", "lembrete", "ligar depois", "agendar", "follow up"] },
];

/** Lower case, no accents, single spaces: "Cotação " → "cotacao". */
export function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Ranks entries for a query: title start > title word > keyword phrase >
 * keyword word > description. Entries behind a capability the user does not
 * have are left out. Empty query returns the screens.
 */
export function searchAssist(query: string, capabilities: Partial<Record<AssistCapability, boolean>> = {}, entries: readonly AssistEntry[] = ASSIST_ENTRIES, limit = 8) {
  const visible = entries.filter((entry) => !entry.requires || capabilities[entry.requires]);
  const q = normalize(query);
  if (!q) return visible.filter((entry) => entry.kind === "screen").slice(0, limit);
  const words = q.split(" ").filter((word) => word.length > 1);
  const scored = visible.map((entry) => {
    const title = normalize(entry.title);
    const keywords = entry.keywords.map(normalize);
    const description = normalize(entry.description);
    let score = 0;
    if (title.startsWith(q)) score += 100;
    else if (title.includes(q)) score += 70;
    if (keywords.some((keyword) => keyword === q)) score += 160;
    else if (keywords.some((keyword) => keyword.includes(q) || q.includes(keyword))) score += 60;
    for (const word of words) {
      if (title.split(" ").some((part) => part.startsWith(word))) score += 12;
      if (keywords.some((keyword) => keyword.split(" ").some((part) => part.startsWith(word)))) score += 9;
      if (description.includes(word)) score += 3;
    }
    return { entry, score };
  });
  return scored.filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title, "pt-BR")).slice(0, limit).map((item) => item.entry);
}

export type ScreenHelp = { title: string; intro: string; steps: [string, string, string]; related: { label: string; href: string }[] };

/** Help of each Lite screen (the "?" on top). First match wins, most specific first. */
const HELP: readonly { match: RegExp; help: ScreenHelp }[] = [
  { match: /^\/jornada/, help: { title: "Minha jornada", intro: "Seus pontos vêm só do que você fez de verdade no atendimento.", steps: ["Cumpra as missões de hoje: cada uma dá pontos de bônus.", "O placar da unidade zera toda segunda; o seu nível nunca zera.", "Toque num selo para ver quanto falta para ganhar."], related: [{ label: "De onde vieram meus pontos", href: "/jornada#extrato" }, { label: "Sair do placar", href: "/settings?tab=placar" }] } },
  { match: /^\/minha-fila/, help: { title: "Minha fila", intro: "Aqui chegam os leads oferecidos para você.", steps: ["Aceite rápido: a oferta tem tempo para expirar.", "Depois de aceitar, mande a primeira mensagem no prazo.", "Se não puder atender agora, pause no topo do Início."], related: [{ label: "Meus leads", href: "/leads" }] } },
  { match: /^\/leads\/[^/]+/, help: { title: "Lead", intro: "Tudo sobre este cliente e o que fazer agora.", steps: ["Registre o contato assim que falar com o cliente.", "Mude a etapa conforme o atendimento avança.", "Agende um retorno para não esquecer do cliente."], related: [{ label: "Voltar aos meus leads", href: "/leads" }] } },
  { match: /^\/leads/, help: { title: "Meus leads", intro: "Todos os leads com você, organizados por etapa.", steps: ["Toque num lead para abrir e atender.", "Os que precisam de você aparecem primeiro.", "Use a busca para achar pelo nome ou telefone."], related: [{ label: "Minha fila", href: "/minha-fila" }] } },
  { match: /^\/plantoes/, help: { title: "Plantões", intro: "Sua escala e a presença de cada plantão.", steps: ["Veja os dias e horários do mês.", "Confirme a presença quando o plantão começar.", "Durante o plantão você recebe leads na fila."], related: [{ label: "Disponibilidade", href: "/settings?tab=disponibilidade" }] } },
  { match: /^\/settings/, help: { title: "Configurações", intro: "Sua conta e como você recebe leads.", steps: ["Minha conta: nome e foto.", "Disponibilidade e WhatsApp: como os leads chegam até você.", "Segurança: senha e acesso."], related: [{ label: "Rever o tour", href: "/dashboard?tour=1" }] } },
  { match: /^\/relacionamento/, help: { title: "Mural da gestão", intro: "Recados da direção para você.", steps: ["Os mais novos ficam em cima.", "Quando pedirem, toque em Ciente para confirmar.", "Reconhecimentos aparecem aqui e na sua jornada."], related: [{ label: "Notificações", href: "/notificacoes" }] } },
  { match: /^\/notificacoes/, help: { title: "Notificações", intro: "Tudo que o sistema avisou para você.", steps: ["Toque num aviso para ir direto ao assunto.", "Marque como lido para limpar a lista.", "Ofertas de lead também chegam aqui."], related: [{ label: "Minha fila", href: "/minha-fila" }] } },
  { match: /^\/(dashboard)?$/, help: { title: "Início", intro: "Suas conversas e a próxima coisa a fazer.", steps: ["Cada assistente cuida de um assunto: leads, plantão, jornada.", "O topo mostra se você está recebendo leads; toque para pausar.", "Em Mais você acha o resto do app."], related: [{ label: "Rever o tour", href: "/dashboard?tour=1" }] } },
];

export function helpForRoute(pathname: string): ScreenHelp | null {
  const path = pathname.split(/[?#]/)[0] ?? pathname;
  return HELP.find((item) => item.match.test(path))?.help ?? null;
}

const QUESTION_NOISE = /\b(onde|fica|cade|como|faco|faço|eu|meu|minha|meus|minhas|vejo|ver|acho|achar|posso|consigo|tem|o|a|os|as|de|do|da|para|pra|no|na|um|uma|que|e|é)\b/g;

/**
 * The single best entry for a free-text question ("onde vejo meus pontos?",
 * "como pauso?"), or null when nothing is a confident match. Used by the
 * Âncora conversation to answer "where is it" without an AI.
 */
export function bestAssistMatch(question: string, capabilities: Partial<Record<AssistCapability, boolean>> = {}) {
  const core = normalize(question).replace(/[?!.,;:]/g, " ").replace(QUESTION_NOISE, " ").replace(/\s+/g, " ").trim();
  if (core.length < 3) return null;
  const [first, second] = searchAssist(core, capabilities, ASSIST_ENTRIES, 2);
  if (!first) return null;
  // Confident only when the words point at one entry (a tie means "ask the search").
  const words = core.split(" ");
  const hits = (entry: AssistEntry) => words.filter((word) => word.length > 2 && [entry.title, ...entry.keywords].some((text) => normalize(text).includes(word))).length;
  const exact = [first.title, ...first.keywords].map(normalize).includes(core);
  if (!hits(first) || (!exact && second && hits(second) === hits(first) && first.kind === second.kind)) return null;
  return first;
}
