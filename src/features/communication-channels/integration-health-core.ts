/** Saúde de uma integração pelo último lead recebido (puro, testável; servidor e cliente). */
export type IntegrationKey = "meta" | "whatsapp" | "forms";

export type IntegrationHealth = {
  state: "receiving" | "quiet" | "silent";
  /** ISO do último lead, ou null sem lead em 30 dias. */
  lastLeadAt: string | null;
  lastDay: number;
  /** Texto curto do status ("Recebendo leads", "Sem leads há 3 dias", "Sem leads em 30 dias"). */
  label: string;
  /** Rodapé do cartão ("Último lead há 2 h · 34 nas últimas 24 h"). */
  detail: string;
};

const HOUR_MS = 60 * 60 * 1000;

export function ago(from: Date, now: Date): string {
  const minutes = Math.max(0, Math.round((now.getTime() - from.getTime()) / 60000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  return `há ${days} ${days === 1 ? "dia" : "dias"}`;
}

/** Recebendo: lead nas últimas 24 h. Parado: último lead entre 1 e 30 dias. Sem leads: nada em 30 dias. */
export function classifyIntegrationHealth(last: Date | null, lastDay: number, now: Date): IntegrationHealth {
  if (!last) return { state: "silent", lastLeadAt: null, lastDay: 0, label: "Sem leads em 30 dias", detail: "Nenhum lead chegou por aqui nos últimos 30 dias." };
  const fresh = now.getTime() - last.getTime() <= 24 * HOUR_MS;
  const count = `${lastDay.toLocaleString("pt-BR")} nas últimas 24 h`;
  return fresh
    ? { state: "receiving", lastLeadAt: last.toISOString(), lastDay, label: "Recebendo leads", detail: `Último lead ${ago(last, now)} · ${count}` }
    : { state: "quiet", lastLeadAt: last.toISOString(), lastDay, label: `Sem leads ${ago(last, now)}`, detail: `Último lead ${ago(last, now)}. Vale conferir a conexão.` };
}
