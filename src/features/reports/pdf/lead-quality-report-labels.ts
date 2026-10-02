import { LEAD_ORIGINS, type LeadOrigin } from "../metrics/lead-quality-contract";
import { LEAD_QUALITY_TIMEZONE } from "../metrics/lead-quality-period";

/** Labels shared by the lead quality PDF and spreadsheet. */

export function numberLabel(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function percentLabel(value: number) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

export function durationLabel(seconds: number | null) {
  if (seconds == null) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}min` : `${hours}h`;
}

const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: LEAD_QUALITY_TIMEZONE });

export function dateTimeLabel(value: Date) {
  return dateTime.format(value);
}

const shortDateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: LEAD_QUALITY_TIMEZONE });

/** "02/10 10:28" — compact, for table cells. */
export function shortDateTimeLabel(value: Date) {
  return shortDateTime.format(value).replace(",", "");
}

export function originLabel(origin: LeadOrigin) {
  return LEAD_ORIGINS.find((entry) => entry.key === origin)?.label ?? origin;
}

export function temperatureLabel(status: string | null | undefined, short = false) {
  return ({ hot: "Quente", warm: "Morno", cold: "Frio" } as Record<string, string>)[status ?? ""] ?? (short ? "—" : "Sem classificação");
}

export function leadStatusLabel(status: string) {
  const labels: Record<string, string> = {
    new: "Novo", distributed: "Distribuído", in_contact: "Em atendimento", quote_sent: "Cotação enviada",
    negotiation: "Em negociação", documentation_pending: "Documentação pendente", under_analysis: "Em análise",
    converted: "Convertido", lost: "Perdido",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

export function sourceLabel(value: string) {
  const labels: Record<string, string> = {
    meta_lead_ads: "Meta (anúncios)", landing_page: "Página de captura", website: "Site", manual: "Cadastro manual",
    webhook: "Integração", facebook: "Facebook", instagram: "Instagram", meta: "Meta", whatsapp: "WhatsApp",
    referral: "Indicação", __unknown__: "Origem não identificada",
  };
  return labels[value] ?? value.replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/** "3:14" (weekday:hour) → "Quarta · 14h". */
export function hourSlotLabel(key: string) {
  const [day, hour] = key.split(":").map(Number);
  return `${WEEKDAYS[day] ?? "—"} · ${String(hour).padStart(2, "0")}h`;
}
