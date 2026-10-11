import type { MascotShape } from "../types";

/**
 * Guided tour of the broker app (Lite). Pure data: the engine (lite-tour.tsx)
 * spotlights `target` (a [data-tour] element on the Início) and shows the card.
 * `narration` is the voice-over script; the audio file, when it exists, lives at
 * /onboarding/narracao/{id}.mp3 and plays on entering the step. The full script
 * is exported to docs/onboarding/narracao-tour-lite.md.
 */
export type TourStepKind = "intro" | "spotlight" | "demo-reply" | "demo-notice" | "finale";

export type TourStep = {
  id: string;
  kind: TourStepKind;
  /** [data-tour] value on the page; the step is skipped when it is not on screen. */
  target?: string;
  title: string;
  /** What the card says (short, on screen). */
  body: string;
  /** What the narrator says (can be a bit longer, spoken tone). */
  narration: string;
  xp: number;
  mascot: { shape: MascotShape; hue: number | null };
};

export type MicroTourId = "jornada" | "minha-fila" | "lead" | "plantoes" | "settings";
export type MicroTour = { id: MicroTourId; steps: TourStep[] };

const microStep = (id: string, target: string, title: string, body: string, shape: MascotShape = "logo", hue: number | null = null): TourStep => ({
  id: `micro-${id}`,
  kind: "spotlight",
  target,
  title,
  body,
  narration: body,
  xp: 5,
  mascot: { shape, hue },
});

export const MICRO_TOURS: Record<MicroTourId, TourStep[]> = {
  jornada: [
    microStep("jornada-resumo", "micro-journey-summary", "Seu resumo da semana", "Aqui você vê seu nível e os pontos que já conquistou.", "favo", 85),
    microStep("jornada-missoes", "micro-journey-missions", "Missões para hoje", "Acompanhe o que falta e veja seu avanço em cada missão.", "mochi", 212),
    microStep("jornada-extrato", "micro-journey-ledger", "Seus pontos, item por item", "No extrato você confere de onde veio cada ponto.", "favo", 85),
  ],
  "minha-fila": [
    microStep("fila-busca", "micro-queue-search", "Encontre um atendimento", "Busque pelo nome, telefone ou produto.", "mochi", 212),
    microStep("fila-etapas", "micro-queue-tabs", "Organize sua fila", "Alterne entre novos, atendimentos, retornos e prazos em risco.", "cubo", 150),
    microStep("fila-lead", "micro-queue-lead", "Veja o que pede atenção", "Leads com uma ação pendente aparecem primeiro.", "mochi", 212),
  ],
  lead: [
    microStep("lead-identidade", "micro-lead-identity", "A ficha do cliente", "Nome, etapa e prazo de aceite ficam no começo.", "mochi", 212),
    microStep("lead-detalhes", "micro-lead-details", "Contexto do atendimento", "Confira as informações que ajudam na próxima conversa.", "cubo", 150),
    microStep("lead-acoes", "micro-lead-actions", "Próximo passo", "Use a barra para chamar no WhatsApp, ligar ou atualizar a etapa.", "mochi", 212),
  ],
  plantoes: [
    microStep("plantao-proximo", "micro-duty-highlight", "Seu próximo plantão", "Veja o horário e a unidade do próximo turno.", "onigiri", 28),
    microStep("plantao-calendario", "micro-duty-calendar", "Confira outras datas", "Escolha um dia para abrir os detalhes da escala.", "cubo", 150),
    microStep("plantao-proximos", "micro-duty-upcoming", "A semana à frente", "Os próximos turnos ficam reunidos nesta lista.", "onigiri", 28),
  ],
  settings: [
    microStep("settings-intro", "micro-settings-intro", "Seu espaço", "Aqui você ajusta sua conta e as ferramentas do app.", "logo", null),
    microStep("settings-sections", "micro-settings-sections", "Abra uma seção", "Toque no assunto que quer revisar.", "cubo", 150),
    microStep("settings-account", "micro-settings-account", "Seus dados", "Conta, segurança e preferências ficam nas configurações.", "logo", null),
  ],
};

export function getMicroTourForPath(pathname: string): MicroTour | null {
  const path = pathname.split("?")[0]?.replace(/\/+$/, "") || "/";
  const id: MicroTourId | null = path === "/jornada" ? "jornada"
    : path === "/minha-fila" ? "minha-fila"
      : /^\/leads\/(?!distribuicao(?:\/|$)|arquivados(?:\/|$)|dashboard(?:\/|$))[^/]+$/.test(path) ? "lead"
        : path === "/plantoes" ? "plantoes"
          : path === "/settings" ? "settings"
            : null;
  return id ? { id, steps: MICRO_TOURS[id] } : null;
}

export const TOUR_VERSION = "2026-10-lite-tour-v1";
export const TOUR_STORAGE_KEY = `ancora:${TOUR_VERSION}`;
export const narrationSrc = (id: string) => `/onboarding/narracao/${id}.mp3`;

export const TOUR_STEPS: TourStep[] = [
  {
    id: "00-apresentacao",
    kind: "intro",
    title: "Seu novo jeito de atender",
    body: "Em uns 3 minutos você conhece o app. A cada passo você ganha XP, e no fim leva o selo de pronto para atender.",
    narration:
      "Olá! Que bom ter você aqui. O app do corretor da Âncora mudou: agora tudo funciona como uma conversa. Seus assistentes te dizem o que fazer, e você resolve com um toque. Vamos dar uma volta rápida? São uns três minutinhos, e no final você ganha o seu selo de pronto para atender.",
    xp: 10,
    mascot: { shape: "logo", hue: null },
  },
  {
    id: "01-inicio",
    kind: "spotlight",
    target: "home-header",
    title: "Este é o seu Início",
    body: "Tudo começa aqui: a lista das suas conversas. O que espera por você aparece primeiro.",
    narration:
      "Este é o seu Início. Ele funciona como a lista de conversas de um aplicativo de mensagem: o que está esperando por você sobe para o topo, então você nunca precisa procurar o que fazer.",
    xp: 10,
    mascot: { shape: "logo", hue: null },
  },
  {
    id: "02-abas",
    kind: "spotlight",
    target: "home-tabs",
    title: "Assistentes e Leads",
    body: "Em Assistentes ficam as áreas do seu trabalho. Em Leads, cada cliente é uma conversa própria.",
    narration:
      "Aqui você alterna entre duas visões. Em Assistentes ficam as áreas do seu trabalho, cada uma com um ajudante. Em Leads, cada cliente vira uma conversa: o número azul mostra quantos estão esperando você.",
    xp: 10,
    mascot: { shape: "mochi", hue: 212 },
  },
  {
    id: "03-leads",
    kind: "spotlight",
    target: "thread-leads",
    title: "Leads: quem chegou e quem espera",
    body: "Avisa o lead novo, o primeiro contato que está atrasando e quem respondeu. Aceitar é um toque.",
    narration:
      "Este é o assistente de Leads. Ele avisa quando chega um lead novo, quando o prazo do primeiro contato está apertando e quando um cliente respondeu. Para aceitar, recusar ou chamar no WhatsApp, é só tocar na resposta.",
    xp: 10,
    mascot: { shape: "mochi", hue: 212 },
  },
  {
    id: "04-plantao",
    kind: "spotlight",
    target: "thread-plantao",
    title: "Plantão: seu plantão",
    body: "Mostra o plantão de agora ou o próximo: horário, fila e unidade. Pausar e voltar a receber ficam aqui.",
    narration:
      "No Plantão você vê o seu plantão de agora, ou o próximo: horário, fila e unidade. Precisou sair um pouco? Pause por aqui, e volte a receber leads quando quiser, com um toque.",
    xp: 10,
    mascot: { shape: "onigiri", hue: 28 },
  },
  {
    id: "05-agenda",
    kind: "spotlight",
    target: "thread-agenda",
    title: "Agenda: seus retornos",
    body: "Lista os retornos do dia, avisa o que venceu e deixa reagendar sem sair da conversa.",
    narration:
      "A Agenda junta os seus retornos do dia e te avisa quando algum venceu. Dá para falar com o cliente ou reagendar ali mesmo, sem abrir outra tela.",
    xp: 10,
    mascot: { shape: "cubo", hue: 150 },
  },
  {
    id: "06-cotacao",
    kind: "spotlight",
    target: "thread-cotacao",
    title: "Cotação guiada",
    body: "Seis perguntas rápidas e você tem os planos mais em conta, prontos para mandar no WhatsApp.",
    narration:
      "Na Cotação você responde seis perguntas rápidas, como para quem é, quantas vidas e a região, e recebe os planos mais em conta. Escolheu? Manda direto no WhatsApp do cliente.",
    xp: 10,
    mascot: { shape: "favo", hue: 268 },
  },
  {
    id: "07-desempenho",
    kind: "spotlight",
    target: "thread-desempenho",
    title: "Desempenho: seu dia em números",
    body: "Recebidos, aceitos, em atendimento e a sua meta, com um comentário rápido sobre o seu ritmo.",
    narration:
      "Desempenho mostra o seu dia em números: quantos leads chegaram, quantos você aceitou e como está a sua meta. Ele ainda comenta o seu ritmo, para você saber onde focar.",
    xp: 10,
    mascot: { shape: "nuvem", hue: 330 },
  },
  {
    id: "08-insights",
    kind: "spotlight",
    target: "thread-insights",
    title: "Insights: o que fazer na conversa",
    body: "A IA lê suas conversas e te diz quem responder primeiro, o próximo passo e dicas práticas.",
    narration:
      "Insights é o seu analista. A inteligência artificial lê as conversas com os clientes e te diz quem responder primeiro, qual é o próximo passo e dá dicas práticas, como tratar uma objeção ou quando propor o fechamento.",
    xp: 10,
    mascot: { shape: "salte", hue: 200 },
  },
  {
    id: "09-ancora",
    kind: "spotlight",
    target: "thread-ancora",
    title: "Âncora: os avisos da empresa",
    body: "Escala publicada, recados da gestão e alertas chegam aqui, em ordem, como mensagens.",
    narration:
      "Este é o canal oficial da Âncora. Escala publicada, recados da gestão e alertas importantes chegam aqui, em ordem, como mensagens. O selo azul mostra que é a empresa falando.",
    xp: 10,
    mascot: { shape: "logo", hue: null },
  },
  {
    id: "10-desafio",
    kind: "demo-reply",
    title: "Desafio rápido",
    body: "Chegou Maria, PME, 3 vidas, há 2 minutos. O que você faz?",
    narration:
      "Agora é a sua vez! Chegou a Maria, plano empresarial, três vidas, há dois minutos. Escolha a melhor resposta. Acertou, ganha bônus.",
    xp: 30,
    mascot: { shape: "mochi", hue: 212 },
  },
  {
    id: "11-aviso",
    kind: "demo-notice",
    title: "Lead novo chega assim",
    body: "O aviso desce do topo da tela. Toque em Atender e a conversa abre. Se não puder agora, ele fica guardado no topo.",
    narration:
      "Quando um lead novo chega, o aviso desce do topo da tela, como no seu celular. Toque em Atender e a conversa já abre. Se não der para ver na hora, ele fica guardado como uma pílula no topo, sem se perder.",
    xp: 10,
    mascot: { shape: "mochi", hue: 212 },
  },
  {
    id: "12-botao",
    kind: "spotlight",
    target: "home-pill",
    title: "O botão da próxima ação",
    body: "Ele sempre mostra o que fazer agora: atender quem espera ou começar um novo atendimento.",
    narration:
      "Esse botão azul é o atalho da próxima ação. Se alguém está esperando, ele mostra o nome: é só tocar para atender. Se está tudo em dia, ele abre um novo atendimento.",
    xp: 10,
    mascot: { shape: "mochi", hue: 212 },
  },
  {
    id: "13-busca",
    kind: "spotlight",
    target: "home-tools",
    title: "Buscar e criar",
    body: "A lupa procura pelo nome na aba aberta. O mais abre os atalhos: buscar um lead, ver o plantão e, quando liberada, a cotação.",
    narration:
      "A lupa procura pelo nome dentro da aba que está aberta, assistentes ou leads. E o botão de mais abre os atalhos: buscar um lead, ver o seu plantão e, quando estiver liberada para você, fazer uma cotação.",
    xp: 10,
    mascot: { shape: "favo", hue: 268 },
  },
  {
    id: "14-mais",
    kind: "spotlight",
    target: "home-me",
    title: "Seu menu",
    body: "Nas suas iniciais ficam disponibilidade, clientes, configurações, este tour e o que mais estiver liberado para você.",
    narration:
      "Tocando nas suas iniciais você abre o seu menu: a sua disponibilidade para receber leads, clientes, configurações, o que mais estiver liberado para você, e este tour, se quiser rever.",
    xp: 10,
    mascot: { shape: "logo", hue: null },
  },
  {
    id: "15-final",
    kind: "finale",
    title: "Pronto para atender!",
    body: "Você concluiu o tour e ganhou o selo. Agora é com você: o que espera por você está no topo.",
    narration:
      "Parabéns! Você concluiu o tour e ganhou o selo de pronto para atender. A partir de agora, é só abrir o app: o que precisa de você vai estar sempre no topo. Boas vendas!",
    xp: 20,
    mascot: { shape: "logo", hue: null },
  },
];

/** Supervisor Lite (2026-10-10): same engine, the team instead of the broker's own work. */
export const SUPERVISOR_TOUR_VERSION = "2026-10-supervisor-tour-v1";
export const SUPERVISOR_TOUR_STORAGE_KEY = `ancora:${SUPERVISOR_TOUR_VERSION}`;

export const SUPERVISOR_TOUR_STEPS: TourStep[] = [
  {
    id: "sup-00-apresentacao",
    kind: "intro",
    title: "Sua equipe na palma da mão",
    body: "Em uns 2 minutos você conhece o app do supervisor. Cada passo vale XP, e no fim você leva o selo de pronto para liderar.",
    narration:
      "Olá! Este é o app do supervisor da Âncora. Aqui você acompanha a sua equipe como se fosse uma conversa: os assistentes mostram quem precisa de você e o que fazer, e você age com um toque. Vamos dar uma volta rápida? São uns dois minutinhos.",
    xp: 10,
    mascot: { shape: "logo", hue: null },
  },
  {
    id: "sup-01-inicio",
    kind: "spotlight",
    target: "home-header",
    title: "Este é o seu Início",
    body: "A lista das conversas sobre a sua equipe. O que precisa de você sobe para o topo.",
    narration:
      "Este é o seu Início. Ele funciona como a lista de conversas de um aplicativo de mensagem, só que sobre a sua equipe: o que precisa da sua atenção aparece primeiro.",
    xp: 10,
    mascot: { shape: "logo", hue: null },
  },
  {
    id: "sup-02-abas",
    kind: "spotlight",
    target: "home-tabs",
    title: "Assistentes e Leads parados",
    body: "Em Assistentes ficam as áreas da supervisão. Em Leads, os leads da equipe esperando o primeiro contato.",
    narration:
      "Aqui você alterna entre duas visões. Em Assistentes ficam as áreas da supervisão. Em Leads aparecem os leads da sua equipe que ainda esperam o primeiro contato, com o nome do corretor de cada um.",
    xp: 10,
    mascot: { shape: "cubo", hue: 212 },
  },
  {
    id: "sup-03-equipe",
    kind: "spotlight",
    target: "thread-equipe",
    title: "Equipe",
    body: "Quem está disponível, quem precisa de você e a ficha de cada corretor. Também é onde você adiciona corretores livres da unidade.",
    narration:
      "A conversa Equipe mostra cada corretor: se está disponível, quantos leads tem em atendimento e quem está com lead atrasado. Tocando no nome você abre a ficha dele, com números, leads e feedbacks. E se tiver corretor da sua unidade sem supervisor, ele aparece aqui para você adicionar.",
    xp: 15,
    mascot: { shape: "mochi", hue: 150 },
  },
  {
    id: "sup-04-leads",
    kind: "spotlight",
    target: "thread-equipe-leads",
    title: "Leads da equipe",
    body: "Os leads parados, do mais atrasado para o menos. Se o corretor não puder atender, você repassa para outro da equipe, com o motivo.",
    narration:
      "Em Leads da equipe ficam os leads esperando o primeiro contato, do mais atrasado para o menos. Você abre o lead, cobra o corretor, e se ele não puder atender, repassa para outro da equipe. O motivo fica registrado no histórico.",
    xp: 15,
    mascot: { shape: "cubo", hue: 212 },
  },
  {
    id: "sup-04b-plantao",
    kind: "spotlight",
    target: "thread-equipe-plantao",
    title: "Plantão da equipe",
    body: "Quem da equipe está escalado hoje, o horário e se confirmou presença. Quem faltou aparece primeiro.",
    narration:
      "Plantão da equipe mostra quem dos seus corretores está escalado hoje, o horário e se já confirmou presença. Se alguém faltou ou ainda não confirmou, você vê aqui e já abre a ficha dele.",
    xp: 15,
    mascot: { shape: "onigiri", hue: 28 },
  },
  {
    id: "sup-05-desempenho",
    kind: "spotlight",
    target: "thread-equipe-desempenho",
    title: "Desempenho da equipe",
    body: "O placar da semana só entre os seus corretores: aceites, tempo para aceitar e atendimentos.",
    narration:
      "Desempenho da equipe é o placar da semana, só entre os seus corretores: quem mais aceita, quem aceita mais rápido e quantos atendimentos cada um fez. Bom lugar para achar quem merece um reconhecimento.",
    xp: 15,
    mascot: { shape: "nuvem", hue: 330 },
  },
  {
    id: "sup-06-ancora",
    kind: "spotlight",
    target: "thread-ancora",
    title: "Âncora",
    body: "Os avisos da empresa e os alertas da sua equipe. Às 19h chega aqui o resumo do dia.",
    narration:
      "Na Âncora chegam os avisos da empresa e os alertas da sua equipe, como lead sem contato no prazo. E todo dia às sete da noite chega aqui o resumo do dia da equipe.",
    xp: 10,
    mascot: { shape: "logo", hue: null },
  },
  {
    id: "sup-07-acoes",
    kind: "spotlight",
    target: "home-pill",
    title: "Ações da equipe",
    body: "Atalho para ver a equipe ou mandar um recado para todos, como um aviso, um parabéns ou um pedido de ciente.",
    narration:
      "Este botão abre as ações da equipe: ver a sua equipe ou mandar um recado para todos, seja um aviso, um parabéns ou um pedido de ciente. Você vê depois quem leu.",
    xp: 10,
    mascot: { shape: "logo", hue: null },
  },
  {
    id: "sup-08-menu",
    kind: "spotlight",
    target: "home-me",
    title: "Seu menu",
    body: "Nas suas iniciais ficam Minha equipe, Central de relacionamento, clientes, configurações e este tour.",
    narration:
      "Tocando nas suas iniciais você abre o seu menu: minha equipe, a central de relacionamento, os clientes da equipe, configurações, e este tour, se quiser rever.",
    xp: 10,
    mascot: { shape: "logo", hue: null },
  },
  {
    id: "sup-09-final",
    kind: "finale",
    title: "Pronto para liderar!",
    body: "Você concluiu o tour e ganhou o selo. O que precisa de você vai estar sempre no topo.",
    narration:
      "Parabéns! Você concluiu o tour e ganhou o selo de pronto para liderar. A partir de agora, é só abrir o app: quem precisa de você vai estar sempre no topo. Boa supervisão!",
    xp: 20,
    mascot: { shape: "logo", hue: null },
  },
];

/** Steps whose target is on screen (spotlights without a target are dropped). */
export function availableSteps(steps: TourStep[], hasTarget: (target: string) => boolean) {
  return steps.filter((step) => step.kind !== "spotlight" || (step.target ? hasTarget(step.target) : false));
}

export function totalXp(steps: TourStep[]) {
  return steps.reduce((sum, step) => sum + step.xp, 0);
}
