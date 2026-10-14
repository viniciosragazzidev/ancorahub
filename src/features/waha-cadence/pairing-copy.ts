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
