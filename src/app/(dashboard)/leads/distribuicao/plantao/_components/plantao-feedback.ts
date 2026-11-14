"use client";

/**
 * Feedback das ações do plantão (docs/design-system/FEEDBACK.md). O plantão é um painel de diálogos e
 * listas que o servidor redesenha (router.refresh), então o resultado continua no toast, agora com as
 * camadas do padrão: nível 1 vibra na confirmação; a falha toca o som de erro e mostra a causa
 * normalizada (nunca texto técnico), o que continua valendo e, quando dá, "Tentar de novo".
 * Publicar a escala do mês é nível 2 (`milestone`, uma vez por dia na chave "escala-mes").
 */
import { toast } from "@/components/ui/sonner";
import { actionErrorMessage, normalizeActionError } from "@/lib/feedback/action-error";
import { fireFeedback } from "@/lib/feedback/use-feedback";

/** Toque numa ação do plantão que vai ao servidor. */
export function plantaoTap() {
  fireFeedback("tap");
}

/** Sucesso confirmado pelo servidor. `milestone` só para a escala publicada. */
export function plantaoDone(message: string, options: { milestone?: boolean } = {}) {
  if (options.milestone) fireFeedback("milestone", { budgetKey: "escala-mes" });
  else fireFeedback("confirm");
  toast.success(message);
}

/** Falha: causa legível + o que continua valendo + "Tentar de novo" quando houver como refazer. */
export function plantaoFailed(cause: unknown, fallback: string, options: { keeps?: string; retry?: () => void } = {}) {
  const info = normalizeActionError(cause, fallback);
  fireFeedback("error");
  const message = actionErrorMessage(info, options.keeps);
  if (options.retry && info.retryable) toast.error(message, { action: { label: "Tentar de novo", onClick: options.retry } });
  else toast.error(message);
  return message;
}
