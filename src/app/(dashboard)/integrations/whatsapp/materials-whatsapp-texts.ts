/** Textos e formatos da visão de materiais do WhatsApp (tela atual e Lite). */

export const MATERIALS_CARD_TEXTS = {
  title: "Número de materiais",
  description:
    "WhatsApp que já está nos grupos das operadoras. O sistema só lê: não envia mensagens por ele e as conversas dele nunca viram lead. Recomendamos um chip dedicado, separado do canal da diretoria.",
  subject: "Número de materiais",
  pairingHint: "No celular que está nos grupos das operadoras, abra o WhatsApp.",
  idleHint: "Nenhum número conectado. Conecte o celular que já está nos grupos das operadoras para escolher quais grupos ler.",
};

/** What each capture status means for the person who selected the groups. */
export const CAPTURE_STATUS_LABELS: Record<string, string> = {
  captured: "Material publicado",
  duplicate_material: "Arquivo repetido (já publicado)",
  stored: "Mensagem registrada, sem arquivo",
  needs_ocr: "PDF escaneado, sem texto",
  needs_vision: "Imagem sem leitor de imagem configurado",
  no_text: "Imagem sem texto útil",
  too_large: "Arquivo grande demais",
  too_small: "Imagem pequena demais",
  expired: "Tabela com vigência vencida",
  error: "Erro ao processar",
};

export function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(value);
}
