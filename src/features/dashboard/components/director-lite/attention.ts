/**
 * "Precisa de atenção" do Painel (skill `interface-enxuta`, referência P3 do Jubayer): no máximo 3 itens, cada um
 * com um verbo só, em ordem fixa de prioridade. Só usa o que o painel essencial já carrega; nada de consulta nova.
 */
import type { EssentialDashboard } from "@/features/dashboard/essential/essential-data";

export type AttentionItem = {
  id: string;
  title: string;
  detail: string;
  /** O verbo do item ("Ver plantão", "Distribuir"). */
  action: string;
  href: string;
  tone: "danger" | "warning" | "neutral";
};

export const ATTENTION_LIMIT = 3;

const fmt = (value: number) => value.toLocaleString("pt-BR");
const plural = (value: number, one: string, many: string) => `${fmt(value)} ${value === 1 ? one : many}`;
const share = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

export function attentionItems(data: EssentialDashboard): AttentionItem[] {
  const items: AttentionItem[] = [];

  // 1. Plantão rodando abaixo do mínimo de corretores: lead chega e ninguém atende.
  for (const duty of data.duties.running) {
    if (!duty.belowMinimum) continue;
    items.push({
      id: `duty-${duty.scheduleId}`,
      title: `${duty.name} abaixo do mínimo`,
      detail: `${duty.activeBrokers}/${duty.brokerCount} corretores confirmados · ${plural(duty.available, "lead esperando", "leads esperando")}`,
      action: "Ver plantão",
      href: `/leads/distribuicao/plantao/${duty.scheduleId}`,
      tone: "danger",
    });
  }

  // 2. Leads esperando corretor.
  const waiting = data.queues.totals.waiting;
  if (waiting > 0) {
    items.push({
      id: "waiting",
      title: `${plural(waiting, "lead aguardando", "leads aguardando")} corretor`,
      detail: `Entraram ${data.queues.label} e ainda não foram distribuídos.`,
      action: "Distribuir",
      href: "/leads?view=sem-atribuicao",
      tone: "warning",
    });
  }

  // 3. Fila com muitos frios (40%+ com pelo menos 5 entradas).
  const coldest = data.queues.rows
    .filter((row) => row.arrived >= 5 && share(row.cold, row.arrived) >= 40)
    .sort((a, b) => b.cold / b.arrived - a.cold / a.arrived)[0];
  if (coldest) {
    items.push({
      id: `cold-${coldest.id ?? "none"}`,
      title: `${coldest.name} com ${share(coldest.cold, coldest.arrived)}% de frios`,
      detail: `${plural(coldest.cold, "frio", "frios")} de ${plural(coldest.arrived, "lead", "leads")} ${data.queues.label}.`,
      action: "Ver fila",
      href: coldest.id ? `/leads?fila=${encodeURIComponent(coldest.id)}` : "/leads",
      tone: "neutral",
    });
  }

  // 4. Menos da metade dos corretores com WhatsApp conectado.
  const { total, connected } = data.whatsapp;
  if (total > 0 && connected * 2 < total) {
    items.push({
      id: "whatsapp",
      title: `${plural(total - connected, "corretor sem", "corretores sem")} WhatsApp conectado`,
      detail: `${fmt(connected)} de ${fmt(total)} conectaram o WhatsApp pessoal.`,
      action: "Ver corretores",
      href: "/equipe",
      tone: "neutral",
    });
  }

  return items.slice(0, ATTENTION_LIMIT);
}
