/**
 * Textos e tom de cada momento do pareamento do WhatsApp — ÚNICO lugar para
 * ajustar o feedback visual sem mexer em componentes.
 *
 * - `tone` segue os Callouts do design system (neutral/info/success/warning/
 *   destructive → docs/design-system.md § Callout / Alert panel).
 * - `icon` escolhe o ícone entre os que o painel sabe renderizar.
 * - `steps` vira uma lista numerada; `hint` é o texto de apoio em caption.
 * - `{phone}` em `body` é substituído por "número final 1234" quando conhecido
 *   (e removido quando não).
 */
export type PairingTone = "neutral" | "info" | "success" | "warning" | "destructive";
export type PairingIcon = "lock" | "spinner" | "phone" | "check" | "warning";

/** How the broker links the phone: scanning a QR or typing a pairing code in WhatsApp. */
export type PairingMethod = "qr" | "code";

export type PairingCopyKey =
  | "codeIntro"
  | "code"
  | "codeError"
  | "idle"
  | "starting"
  | "renewing"
  | "qr"
  | "pairing"
  | "stalled"
  | "ready"
  | "error"
  | "unreachable"
  | "unauthorized";

export type PairingCopy = {
  tone: PairingTone;
  icon: PairingIcon;
  title: string;
  body?: string;
  steps?: string[];
  hint?: string;
};

export const PAIRING_COPY: Record<PairingCopyKey, PairingCopy> = {
  codeIntro: {
    tone: "neutral",
    icon: "phone",
    title: "Conecte com um código",
    body: "Confirme seu número e gere o código. Você digita ele no próprio WhatsApp, sem precisar ler QR Code.",
  },
  code: {
    tone: "info",
    icon: "phone",
    title: "Digite o código no WhatsApp",
    steps: [
      "Abra o WhatsApp do número informado.",
      "Toque em Dispositivos conectados e depois em Conectar dispositivo.",
      "Toque em Conectar com número de telefone e digite o código.",
    ],
    hint: "O código vale por cerca de 2 minutos. Se expirar, gere outro.",
  },
  codeError: {
    tone: "destructive",
    icon: "warning",
    title: "Não foi possível conectar",
    body: "O código expirou ou o WhatsApp recusou o vínculo. Gere um novo código e tente de novo.",
  },
  idle: {
    tone: "neutral",
    icon: "lock",
    title: "WhatsApp desconectado",
    body: "Gere um QR Code e vincule o WhatsApp do seu celular para atender seus leads por aqui.",
  },
  starting: {
    tone: "neutral",
    icon: "spinner",
    title: "Preparando sua conexão…",
    body: "Estamos abrindo uma sessão segura. Leva poucos segundos.",
  },
  renewing: {
    tone: "neutral",
    icon: "spinner",
    title: "Renovando o QR Code…",
    body: "O código anterior expirou. Estamos gerando um novo automaticamente.",
  },
  qr: {
    tone: "info",
    icon: "phone",
    title: "Escaneie o QR Code",
    steps: [
      "Abra o WhatsApp no celular.",
      "Toque em Dispositivos conectados e depois em Conectar dispositivo.",
      "Aponte a câmera para o código ao lado.",
    ],
    hint: "O código se renova sozinho — pode escanear a qualquer momento.",
  },
  pairing: {
    tone: "info",
    icon: "spinner",
    title: "Celular conectado — finalizando…",
    body: "Mantenha o WhatsApp aberto no celular. Estamos sincronizando sua conta.",
  },
  stalled: {
    tone: "warning",
    icon: "warning",
    title: "Está demorando mais que o normal",
    body: "Se o celular já mostra o WhatsApp vinculado, aguarde mais um pouco. Caso contrário, gere um novo QR Code.",
  },
  ready: {
    tone: "success",
    icon: "check",
    title: "WhatsApp conectado",
    body: "Tudo pronto para os atendimentos{phone}.",
  },
  error: {
    tone: "destructive",
    icon: "warning",
    title: "Não foi possível conectar",
    body: "O QR Code expirou sem ser lido ou o WhatsApp recusou o vínculo. Gere um novo código e tente de novo.",
  },
  unreachable: {
    tone: "warning",
    icon: "warning",
    title: "Sem resposta do servidor WhatsApp",
    body: "Continuamos tentando reconectar automaticamente.",
  },
  unauthorized: {
    tone: "warning",
    icon: "warning",
    title: "Serviço WhatsApp precisa de atenção",
    body: "A credencial do serviço foi recusada. Avise o administrador — continuamos verificando.",
  },
};

/** Legenda curta do painel do QR por fase (abaixo/ao lado da imagem). */
export const PAIRING_QR_CAPTIONS = {
  starting: "Gerando QR Code…",
  idle: "Clique em Conectar",
  pairing: { title: "Finalizando vínculo…", hint: "Não feche o WhatsApp no celular." },
  ready: "Dispositivo conectado",
  error: "Pareamento falhou",
  qrRefreshing: "Atualizando código…",
} as const;

/** Textos do painel do código de pareamento. */
export const PAIRING_CODE_CAPTIONS = {
  phoneLabel: "Número do WhatsApp",
  phoneMissing: "Informe o número do WhatsApp que você vai conectar.",
  change: "Alterar",
  generate: "Gerar código",
  generating: "Gerando código…",
  regenerate: "Gerar novo código",
  copy: "Copiar código",
  copied: "Código copiado",
  openWhatsApp: "Abrir WhatsApp",
  expired: "O código expirou. Gere um novo para continuar.",
} as const;

/** Rótulos do selo de status por fase. */
export const PAIRING_BADGE_LABELS = {
  idle: "Desconectado",
  starting: "Preparando",
  qr: "Aguardando leitura",
  code: "Aguardando código",
  pairing: "Finalizando",
  ready: "Conectado",
  error: "Falha",
} as const;

/** Feedbacks pontuais (toasts). */
export const PAIRING_TOASTS = {
  connected: "WhatsApp conectado com sucesso!",
  connectedBackground: "Seu WhatsApp foi conectado.",
} as const;

export function resolvePairingCopyBody(body: string | undefined, phoneSuffix?: string | null) {
  if (!body) return undefined;
  return body.replace("{phone}", phoneSuffix ? ` · número final ${phoneSuffix}` : "");
}

/**
 * Tutorial do código de pareamento no celular (05/11, presença exige WhatsApp): o caminho muda entre
 * Android e iPhone até "Dispositivos conectados"; dali em diante é igual.
 */
export const PAIRING_CODE_TUTORIAL = {
  title: "Como digitar o código no WhatsApp",
  platforms: [
    { value: "android", label: "Android" },
    { value: "iphone", label: "iPhone" },
  ],
  steps: {
    android: [
      "Abra o WhatsApp no celular do número informado.",
      "Toque nos três pontinhos (⋮), no canto de cima, e em Dispositivos conectados.",
      "Toque em Conectar dispositivo.",
      "Embaixo do leitor de QR Code, toque em Conectar com número de telefone.",
      "Digite o código de 8 letras e números que aparece aqui.",
    ],
    iphone: [
      "Abra o WhatsApp no celular do número informado.",
      "Toque em Configurações, embaixo à direita, e em Dispositivos conectados.",
      "Toque em Conectar dispositivo.",
      "Embaixo do leitor de QR Code, toque em Conectar com número de telefone.",
      "Digite o código de 8 letras e números que aparece aqui.",
    ],
  },
  hint: "Dica: copie o código aqui antes de abrir o WhatsApp. Se ele expirar (cerca de 2 minutos), gere outro.",
} as const;

export type PairingTutorialPlatform = keyof typeof PAIRING_CODE_TUTORIAL.steps;

/**
 * Conexão pedida ao confirmar presença no plantão (05/11): tom de vantagem, curto, e a promessa de
 * privacidade conferida no código (waha-cadence/inbound.ts descarta conversa que não é de lead ou cliente
 * do corretor; grupos e status são ignorados; a IA só lê conversa ligada a um lead).
 */
export const PRESENCE_WHATSAPP_COPY = {
  title: "Conecte seu WhatsApp e confirme sua presença",
  benefits: [
    "Seus leads chegam e você atende direto pelo seu WhatsApp.",
    "A IA te ajuda no atendimento e melhora a qualidade dos leads que você recebe.",
    "Leva 1 minuto e não precisa baixar nada.",
  ],
  privacyTitle: "Suas conversas pessoais são só suas",
  privacy: "Elas não são salvas nem lidas por ninguém. Só as conversas com os seus leads e clientes ficam no sistema, para a IA ajudar no seu atendimento.",
  start: "Gerar meu código",
  watchTutorial: "Assistir tutorial",
  tutorialDescription: "Vídeo de 1 minuto e meio mostrando como conectar o WhatsApp e confirmar a presença.",
  openWhatsApp: "Copiar código e abrir o WhatsApp",
  openOnPhone: "Abra o WhatsApp no seu celular e siga os passos.",
  autoConfirm: "Assim que conectar, sua presença é confirmada sozinha.",
  showSteps: "Ver passo a passo",
  hideSteps: "Esconder passo a passo",
  connected: "WhatsApp conectado! Confirmando sua presença…",
  demo: [
    "Abra o WhatsApp e toque em ⋮ (no iPhone, em Configurações).",
    "Toque em Dispositivos conectados.",
    "Toque em Conectar dispositivo.",
    "Toque em Conectar com número de telefone.",
    "Digite o código que aparece aqui.",
    "Pronto! Sua presença é confirmada sozinha.",
  ],
} as const;

/**
 * Roteiro guiado da presença (09/11, plano 2026-11-09-roteiro-guiado-presenca-whatsapp.md): uma ideia e um botão
 * por tela, conduzido pelo mascote do Plantão. Único lugar dos textos do roteiro.
 * "Tela inicial" (09/11): nenhum link abre o WhatsApp na lista de conversas; o celular volta para a última tela
 * usada, então o roteiro pede para conferir a tela "Conversas" antes do caminho.
 */
export const PRESENCE_GUIDE_COPY = {
  welcome: {
    title: "Para receber leads hoje, conecte o seu WhatsApp.",
    titleReconnect: "Seu WhatsApp desconectou. Vamos conectar de novo, é rápido.",
    sub: "Leva 1 minuto e você só faz isso uma vez.",
    /** Texto da voz de introdução (igual a PRESENCE_GUIDE_NARRATION["boas-vindas"]). */
    voice: "Oi! Vamos conectar o seu WhatsApp. Você só faz isso uma vez, e suas mensagens pessoais ficam protegidas. É só seguir cada tela.",
    listen: "Ouvir a explicação",
    stop: "Parar a voz",
    /** Botão pequeno da voz, no topo de todas as etapas. */
    listenShort: "Ouvir a explicação desta etapa",
    benefits: ["Os leads chegam e você atende pelo seu WhatsApp.", "A IA te ajuda no atendimento.", "Depois é só confirmar sua presença."],
    privacyTitle: "Suas conversas pessoais são só suas",
    privacy: "Ninguém lê nem salva. Só as conversas com os seus leads e clientes ficam no sistema.",
    cta: "Vamos lá",
  },
  phone: { title: "Qual é o número do WhatsApp deste celular?", sub: "É nele que você vai receber os leads.", label: "Número do WhatsApp com DDD", cta: "Continuar" },
  code: {
    generating: "Estou gerando o seu código…",
    /** Carregamento enquanto o código não chega (10/11). */
    loading: "Só um instante…",
    loadingHint: "Pode levar até 30 segundos. Não feche esta tela.",
    loadingQr: "Gerando o QR Code…",
    title: "Este é o seu código. Toque em Copiar código.",
    copiedTitle: "Pronto, código copiado!",
    sub: "Daqui a pouco você vai usar esse código dentro do WhatsApp.",
    copied: "Código copiado",
    cta: "Copiar código",
    next: "Continuar",
  },
  // Tutorial antes de abrir (09/11): primeiro o que fazer no WhatsApp; ele só abre no fim do caminho.
  home: {
    title: "Antes de abrir o WhatsApp, veja o que fazer lá. Primeiro: ir para a lista de Conversas.",
    sub: "Conversas é a primeira tela do WhatsApp, com todas as suas conversas. Se ele abrir dentro de uma conversa, volte para essa lista.",
    captions: { android: "Para voltar, toque na seta ←, no canto de cima, à esquerda.", iphone: "Para voltar, toque em ‹, no canto de cima, à esquerda." },
    cta: "Entendi, próximo passo",
  },
  path: {
    title: "Depois, na lista de Conversas, toque em 4 lugares, nesta ordem:",
    sub: (n: number) => `Toque ${n} de 4`,
    steps: {
      android: ["Toque nos 3 pontinhos ⋮, no canto de cima, à direita.", "No menu que abrir, toque em Dispositivos conectados.", "Toque no botão Conectar dispositivo.", "Embaixo da câmera, toque em Conectar com número de telefone. Depois digite o código que você copiou."],
      iphone: ["Toque em Configurações, no canto de baixo, à direita.", "Toque em Dispositivos conectados.", "Toque no botão Conectar dispositivo.", "Embaixo da câmera, toque em Conectar com número de telefone. Depois digite o código que você copiou."],
    },
    next: "Próximo toque",
    cta: "Abrir o WhatsApp",
  },
  waiting: { title: "Digitou o código no WhatsApp? Agora é só esperar uns segundos.", sub: "Deixe esta tela aberta. Quando conectar, eu sigo sozinho.", label: "Esperando o WhatsApp…", cta: "Abrir o WhatsApp de novo", again: "Ver o caminho de novo" },
  desktop: {
    qrTitle: "Aponte a câmera do WhatsApp para este código.",
    codeTitle: "Digite este código no WhatsApp do celular.",
    sub: "Faça no celular e deixe esta tela aberta. Eu aviso quando conectar.",
    steps: (qr: boolean, platform: "android" | "iphone") => [
      "No celular, abra o WhatsApp e vá para a lista de Conversas (se abrir numa conversa, toque na seta ←).",
      platform === "android" ? "Toque nos três pontinhos, em cima, e em Dispositivos conectados." : "Toque em Configurações, embaixo, e em Dispositivos conectados.",
      "Toque em Conectar dispositivo.",
      qr ? "Aponte a câmera para o código ao lado." : "Toque em Conectar com número de telefone e digite o código.",
    ],
    phoneIs: "Seu celular é",
    waiting: "Esperando o celular…",
    useCode: "Prefiro usar um código",
    useQr: "Prefiro ler o QR Code",
  },
  connected: { title: "Pronto, seu WhatsApp está conectado!", sub: "Agora falta só confirmar sua presença.", cta: "Seguindo…" },
  /** Só conectar, pelo botão do WhatsApp no topo (10/11): sem a parte da presença. */
  connectOnly: {
    title: "Vamos conectar o seu WhatsApp.",
    benefits: ["Os leads chegam e você atende pelo seu WhatsApp.", "A IA te ajuda no atendimento.", "Fica conectado: não precisa repetir todo dia."],
    doneSub: "Os leads do plantão já podem chegar no seu WhatsApp.",
    doneCta: "Pronto",
  },
  confirm: {
    online: { title: "Agora é só confirmar sua presença.", sub: "Um toque e os leads deste plantão podem chegar.", cta: "Confirmar presença" },
    presencial: { title: "Agora tire uma foto do local do plantão.", sub: "O diretor vê a foto e libera você.", cta: "Tirar foto do local" },
    sending: "Confirmando…",
  },
  done: {
    title: (at: string | null) => (at ? `Presença confirmada às ${at}.` : "Presença confirmada."),
    sub: "Os leads deste plantão já podem chegar para você.",
    waitingTitle: "Foto enviada!",
    waitingSub: "Agora o diretor valida e libera você. Até lá você fica pausado, sem receber leads.",
    waitingPill: "Aguardando o diretor liberar",
    cta: "Ir para o Plantão",
  },
  errors: {
    expired: { title: "Esse código venceu. Já fiz outro para você.", sub: "É só copiar de novo e colar no WhatsApp.", cta: "Copiar o novo código" },
    cooldown: { title: "Espere um pouquinho para eu pedir outro código.", sub: "O WhatsApp limita quantos códigos saem seguidos.", cta: "Gerar outro código", wait: (s: number) => `Aguarde ${s} s` },
    issue: { title: "Não consegui gerar o código agora.", sub: "Confira a internet do celular e toque em Tentar de novo.", cta: "Tentar de novo" },
    rejected: { title: "O WhatsApp não aceitou o código.", sub: (phone: string) => `O número tem que ser o do WhatsApp deste celular. O número cadastrado é ${phone}.`, cta: "Corrigir o número" },
    stalled: { title: "Está demorando. Deixe o WhatsApp aberto mais um pouco.", sub: "Se nada mudar, peça um código novo e tente outra vez.", cta: "Gerar outro código" },
    notOpened: { title: "Não abriu? Abra o WhatsApp pelo ícone na tela do celular.", sub: "Depois volte aqui, eu fico esperando.", cta: "Já abri" },
    copyBlocked: { title: "Não consegui copiar. Anote o código:", sub: "Você vai digitar ele no WhatsApp.", cta: "Anotei" },
    unstable: { title: "O WhatsApp está instável agora. Pode confirmar sua presença mesmo assim.", sub: "Quando ele voltar, peço para você conectar.", cta: "Confirmar presença" },
    confirm: { cta: "Tentar de novo" },
  },
  /** Aparece ao tocar em "Abrir o WhatsApp", antes de sair do app: o que fazer assim que o WhatsApp abrir. */
  beforeOpen: {
    title: "Quando o WhatsApp abrir:",
    steps: {
      android: ["Vá para a lista de Conversas. Se abrir numa conversa, toque na seta ←, em cima.", "Na lista de Conversas, toque nos 3 pontinhos ⋮, no canto de cima, à direita.", "Siga os 4 toques que você acabou de ver."],
      iphone: ["Vá para a lista de Conversas. Se abrir numa conversa, toque em ‹, em cima.", "Na lista de Conversas, toque em Configurações, no canto de baixo, à direita.", "Siga os 4 toques que você acabou de ver."],
    },
    cta: "Entendi, abrir o WhatsApp",
    back: "Voltar",
  },
  help: {
    title: "Precisa de ajuda?",
    video: ["Ver o vídeo", "1 minuto e meio mostrando cada toque."],
    steps: ["Ler o passo a passo", "O caminho em texto, para Android e iPhone."],
  },
  exit: {
    title: "Sair agora?",
    sub: "Sem o WhatsApp conectado você não recebe leads do plantão. Depois você continua de onde parou.",
    stay: "Continuar conectando",
    leave: "Sair",
  },
  progress: (at: number, total: number) => `${at} de ${total}`,
  close: "Sair do roteiro",
} as const;

/**
 * Narração de cada etapa do roteiro guiado (10/11): simples, direta e amigável, até ~10 s cada.
 * Áudios em public/onboarding/narracao/presenca/{chave}.mp3, gerados com
 * `npx tsx scripts/generate-presence-guide-narration.ts` (ElevenLabs, voz Liam, pt-BR, uso interno).
 * Mudou um texto? Gere de novo o áudio dele.
 */
export const PRESENCE_GUIDE_NARRATION = {
  "boas-vindas": "Oi! Vamos conectar o seu WhatsApp. Você só faz isso uma vez, e suas mensagens pessoais ficam protegidas. É só seguir cada tela.",
  numero: "Agora digite o número do WhatsApp deste celular, com o DDD. Depois é só tocar em Continuar.",
  codigo: "Esse é o seu código. Toque em Copiar código. Daqui a pouco você vai usar ele no WhatsApp.",
  "codigo-computador-qr": "Pegue o seu celular e abra o WhatsApp. Siga os passos ao lado e aponte a câmera para esse código.",
  "codigo-computador-numero": "Pegue o seu celular e abra o WhatsApp. Siga os passos ao lado e digite esse código no celular.",
  "tela-inicial": "Antes de abrir o WhatsApp, veja o caminho. Primeiro, vá para a lista de Conversas. Se cair numa conversa, é só tocar na seta de voltar.",
  "toque-1-android": "Na lista de Conversas, toque nos três pontinhos, lá no canto de cima, à direita.",
  "toque-1-iphone": "Na lista de Conversas, toque em Configurações, lá no canto de baixo, à direita.",
  "toque-2": "Agora toque em Dispositivos conectados.",
  "toque-3": "Depois, toque no botão Conectar dispositivo.",
  "toque-4": "Por último, toque em Conectar com número de telefone e digite o seu código. Agora é só tocar em Abrir o WhatsApp.",
  esperando: "Digitou o código? Agora é só esperar uns segundinhos. Pode deixar essa tela aberta, que eu sigo sozinho.",
  conectado: "Prontinho, seu WhatsApp está conectado!",
  "conectado-so-conectar": "Prontinho, seu WhatsApp está conectado! Agora os leads do plantão podem chegar para você.",
  confirmar: "Agora é só tocar em Confirmar presença, e os leads começam a chegar.",
  "confirmar-presencial": "Agora tire uma foto do local do plantão. O diretor vê a foto e libera você.",
  pronto: "Presença confirmada! Os leads do plantão já podem chegar para você. Bom plantão!",
  "pronto-presencial": "Foto enviada! Agora é só esperar o diretor liberar você. Bom plantão!",
} as const;
