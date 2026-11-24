/**
 * Respostas diretas do Sasá sobre o ecossistema do corretor (19/11). Puro: recebe os fatos que as ferramentas
 * de leitura trouxeram (com os números das próprias telas) e responde as perguntas reconhecíveis sem IA
 * (grátis, instantâneo, sem inventar). O que não reconhecer devolve null e vai para a camada de IA limitada.
 * Sem acesso a uma área (ex.: Meu financeiro desligado), diz isso em vez de inventar.
 */
import type { ChatBlock } from "@/components/chat/types";
import { SASA_ASK_PREFIX } from "@/features/broker-workspace/chat/assistant-scripts";

import type { SasaArea } from "./ecosystem-areas";
import { spDayStart } from "./limits";
import { normalizePtBr } from "./parse-when";

const TZ = "America/Sao_Paulo";
export const sasaHhmm = (date: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
export const sasaDdmm = (date: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" }).format(date);
const weekday = (date: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "short", day: "2-digit", month: "2-digit" }).format(date);
/** "R$ 1.290,00" com espaço comum (o Intl usa um espaço especial). */
export const sasaBrl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/\s/g, " ");
const money = (cents: number | null) => (cents === null ? "sem dado ainda" : sasaBrl(cents / 100));
const first = (name: string) => name.trim().split(/\s+/)[0] ?? name;
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const waited = (minutes: number | null) => (minutes === null ? "" : minutes < 60 ? ` há ${minutes} min` : minutes < 48 * 60 ? ` há ${Math.round(minutes / 60)} h` : ` há ${Math.round(minutes / 1440)} dias`);
const duration = (seconds: number | null) => (seconds === null ? "sem dado" : seconds < 90 ? `${Math.round(seconds)} s` : seconds < 5400 ? `${Math.round(seconds / 60)} min` : `${Math.round(seconds / 3600)} h`);

export const STAGE_LABEL: Record<string, string> = {
  new: "novo", distributed: "aguardando atendimento", in_contact: "em atendimento", contacted: "entrei em contato", quote_sent: "cotação enviada", negotiation: "em negociação",
  documentation_pending: "documentação pendente", under_analysis: "em análise", awaiting_reply: "aguardando resposta", converted: "convertido", lost: "perdido",
};

export type SasaFacts = {
  leads?: {
    active: number; byStatus: Record<string, number>; newCount: number; receivedToday: number; acceptedToday: number;
    waiting: Array<{ name: string; reason: "respondeu" | "lead novo" | "1º contato"; minutes: number | null; urgent: boolean }>;
  };
  lead?:
    | { kind: "none"; asked: string | null }
    | { kind: "many"; names: string[]; leads?: Array<{ id: string; name: string }> }
    | {
      kind: "one"; id?: string; name: string; status: string; /** Desde quando está com o corretor (chegada na fila dele). */ since?: Date | null; tipo: string | null; arrivedAt: Date; summary: string | null; nextStep: string | null; objections: string[];
      lastMessage: { from: "cliente" | "corretor" | "qualificação"; text: string; at: Date } | null; notes: Array<{ at: Date; text: string }>;
    };
  wallet?: { total: number; attention: number; renewalCount: number; hasRenewalData: boolean; renewals: Array<{ name: string; from: string }>; anniversaries: Array<{ name: string; on: Date; years: number }> };
  duty?: {
    active: Array<{ name: string; startsAt: Date; endsAt: Date; paused: boolean; presence: "confirmed" | "pending" | "not_required" }>;
    next: { name: string; startsAt: Date; endsAt: Date } | null;
    /** null: a escala (agenda de plantões) não está liberada para o corretor. */
    week: Array<{ name: string; startsAt: Date; endsAt: Date }> | null;
    presenceAsk: { name: string; status: "pending" | "awaiting_release" | "confirmed" } | null;
  };
  agenda?: { items: Array<{ lead: string; title: string; dueAt: Date | null }> };
  performance?: {
    today: { received: number; accepted: number; returnsDue: number; awaiting: number };
    goal: { name: string; current: string; target: string; percentage: number } | null;
    /** null: a jornada (estatísticas da semana) está desligada. */
    week: { offered: number; accepted: number; started: number; medianAcceptSeconds: number | null; medianStartSeconds: number | null } | null;
    ranks: Array<{ position: number; total: number; label: string }>;
  };
  finance?:
    | { access: false }
    | { access: true; periodLabel: string; receivableCents: number | null; receivedThisMonthCents: number | null; openAdvancesCents: number | null; forecast: Array<{ label: string; cents: number }>; nextInstallment: { label: string; cents: number; client: string } | null };
  sales?: { monthLabel: string; monthCount: number; monthValue: number; totalCount: number; totalValue: number; last: Array<{ on: Date; client: string; plan: string | null; value: number }> };
  quotes?: { quotes: Array<{ lead: string; status: string; total: number | null; at: Date }>; proposals: Array<{ lead: string; title: string; status: string; total: number; at: Date }> };
  notifications?: { unread: number; items: Array<{ title: string; at: Date; unread: boolean }> };
  account?: { whatsapp: string; connectedAt: Date | null; availability: "available" | "paused" | "offline" };
};

const SENT_QUOTES = new Set(["shared", "sent", "accepted"]);
const SENT_PROPOSALS = new Set(["enviada", "visualizada", "negociacao", "aprovada"]);
const PENDING_QUOTES = new Set(["draft"]);
const PENDING_PROPOSALS = new Set(["rascunho", "em_revisao", "negociacao"]);

const has = (text: string, pattern: RegExp) => pattern.test(text);

/** Resposta direta para a pergunta numa área, ou null (a IA limitada responde). */
export function answerFromFacts(question: string, area: SasaArea, facts: SasaFacts, now: Date): string | null {
  const q = normalizePtBr(question);
  switch (area) {
    case "finance": {
      const f = facts.finance;
      if (!f) return null;
      if (!f.access) return "Você não tem acesso ao Meu financeiro, então não consigo ver suas comissões. Se precisar, peça à gestão para liberar.";
      if (has(q, /\b(mes que vem|proximo mes|mes seguinte)\b/)) {
        const next = f.forecast[1];
        return next ? `Pelo cronograma das suas vendas, o previsto para ${next.label} é ${money(next.cents)}.` : "Ainda não há parcelas previstas para o mês que vem.";
      }
      if (has(q, /\b(previst\w*|previsao|proximos meses)\b/)) {
        const months = f.forecast.filter((point) => point.cents > 0);
        return months.length ? `Previsto pelo cronograma: ${months.map((point) => `${point.label} ${money(point.cents)}`).join("; ")}.` : "Não há parcelas previstas no cronograma das suas vendas.";
      }
      if (has(q, /\b(recebi|recebido|recebida|ja recebi)\b/)) return `Em ${f.periodLabel} você recebeu ${money(f.receivedThisMonthCents)} de comissão.`;
      if (has(q, /\badiantament\w*/)) return `Adiantamentos em aberto: ${money(f.openAdvancesCents)}.`;
      if (has(q, /\b(a receber|vou receber|tenho para receber|tenho pra receber)\b/)) {
        return `Você tem ${money(f.receivableCents)} de comissão a receber.${f.nextInstallment ? ` A próxima parcela é de ${money(f.nextInstallment.cents)}, de ${first(f.nextInstallment.client)}, em ${f.nextInstallment.label}.` : ""}`;
      }
      return `Suas comissões (${f.periodLabel}): ${money(f.receivableCents)} a receber, ${money(f.receivedThisMonthCents)} recebidos no mês e ${money(f.openAdvancesCents)} de adiantamentos em aberto.`;
    }
    case "sales": {
      const s = facts.sales;
      if (!s) return null;
      if (has(q, /\b(ultimas?|quais|lista)\b/)) {
        return s.last.length ? `Suas últimas vendas: ${s.last.map((sale) => `${sasaDdmm(sale.on)} ${first(sale.client)}${sale.plan ? `, ${sale.plan}` : ""}, ${sasaBrl(sale.value)}`).join("; ")}.` : "Você ainda não tem venda registrada.";
      }
      if (has(q, /\b(quanto vendi|em valor|valor|faturei|faturamento)\b/)) return `Em ${s.monthLabel} você vendeu ${sasaBrl(s.monthValue)} em ${plural(s.monthCount, "venda", "vendas")}. No total, ${sasaBrl(s.totalValue)} em ${plural(s.totalCount, "venda", "vendas")}.`;
      return `Em ${s.monthLabel} você registrou ${plural(s.monthCount, "venda", "vendas")}, somando ${sasaBrl(s.monthValue)}. No total são ${plural(s.totalCount, "venda", "vendas")}.`;
    }
    case "leads": {
      const l = facts.leads;
      if (!l) return null;
      if (has(q, /\b(esperando|aguardando|quem)\b/)) {
        if (!l.waiting.length) return "Ninguém está esperando por você agora.";
        const list = [...l.waiting].sort((a, b) => Number(b.urgent) - Number(a.urgent) || (b.minutes ?? 0) - (a.minutes ?? 0));
        return `${plural(list.length, "pessoa está", "pessoas estão")} esperando você: ${list.slice(0, 8).map((lead) => `${first(lead.name)} (${lead.reason}${waited(lead.minutes)})`).join("; ")}.`;
      }
      if (has(q, /\bnovos?\b/)) return `Você tem ${plural(l.newCount, "lead novo", "leads novos")} esperando atendimento. Hoje chegaram ${l.receivedToday} e você aceitou ${l.acceptedToday}.`;
      const stage = Object.entries(STAGE_LABEL).find(([, label]) => q.includes(normalizePtBr(label)) || (label === "em negociação" && /\bnegociac/.test(q)));
      if (stage) return `Você tem ${plural(l.byStatus[stage[0]] ?? 0, "lead", "leads")} ${stage[1]}.`;
      return `Você tem ${plural(l.active, "lead ativo", "leads ativos")}: ${Object.entries(l.byStatus).map(([status, count]) => `${count} ${STAGE_LABEL[status] ?? status}`).join(", ") || "nenhum"}.`;
    }
    case "lead": {
      const d = facts.lead;
      if (!d) return null;
      if (d.kind === "none") return d.asked ? `Não achei ${d.asked} entre os seus leads ativos.` : null;
      if (d.kind === "many") return `Achei mais de um: ${d.names.join(", ")}. Diga o sobrenome.`;
      const parts = [`${first(d.name)} está ${STAGE_LABEL[d.status] ?? d.status}${d.tipo ? ` (${d.tipo})` : ""}, chegou em ${sasaDdmm(d.arrivedAt)}.`];
      if (d.summary) parts.push(d.summary);
      if (d.lastMessage) parts.push(`Última conversa (${d.lastMessage.from}, ${sasaDdmm(d.lastMessage.at)}): "${d.lastMessage.text}".`);
      if (d.notes.length) parts.push(`Notas: ${d.notes.slice(0, 3).map((note) => `${sasaDdmm(note.at)} ${note.text}`).join("; ")}.`);
      if (d.nextStep) parts.push(`Próximo passo: ${d.nextStep}`);
      return parts.join(" ");
    }
    case "wallet": {
      const w = facts.wallet;
      if (!w) return null;
      if (has(q, /\baniversari\w*/)) {
        return w.anniversaries.length ? `Aniversários de contrato nos próximos 30 dias: ${w.anniversaries.map((item) => `${first(item.name)} em ${sasaDdmm(item.on)} (${plural(item.years, "ano", "anos")})`).join("; ")}.` : "Nenhum aniversário de contrato nos próximos 30 dias.";
      }
      if (has(q, /\brenova\w*/)) {
        if (!w.hasRenewalData) return "Ainda não há datas de renovação registradas na sua carteira.";
        return w.renewals.length ? `${plural(w.renewalCount, "cliente renova", "clientes renovam")} nos próximos 90 dias: ${w.renewals.map((item) => `${first(item.name)} (a partir de ${item.from})`).join("; ")}.` : "Nenhuma renovação nos próximos 90 dias.";
      }
      return `Sua carteira tem ${plural(w.total, "cliente", "clientes")}; ${w.attention} pedem atenção (retorno atrasado ou de hoje) e ${w.renewalCount} renovam nos próximos 90 dias.`;
    }
    case "duty": {
      const d = facts.duty;
      if (!d) return null;
      if (has(q, /\b(confirmad\w*|presenca|liberad\w*)\b/)) {
        if (d.presenceAsk) return d.presenceAsk.status === "confirmed" ? `Sua presença no ${d.presenceAsk.name} está confirmada.` : d.presenceAsk.status === "awaiting_release" ? `Sua foto do ${d.presenceAsk.name} foi enviada; falta o diretor liberar.` : `Falta confirmar sua presença no ${d.presenceAsk.name}.`;
        const active = d.active[0];
        return active ? (active.presence === "pending" ? `Falta confirmar sua presença no ${active.name}.` : `Você está confirmado no ${active.name}.`) : "Você não tem plantão para confirmar agora.";
      }
      if (has(q, /\b(semana|escala)\b/)) {
        if (!d.week) return "A escala de plantões ainda não está liberada para você. Veja o próximo plantão em Plantões.";
        return d.week.length ? `Seus plantões nos próximos 7 dias: ${d.week.map((item) => `${weekday(item.startsAt)} ${sasaHhmm(item.startsAt)} às ${sasaHhmm(item.endsAt)} (${item.name})`).join("; ")}.` : "Você não tem plantão nos próximos 7 dias.";
      }
      const active = d.active[0];
      const now = active ? `Você está no ${active.name}, das ${sasaHhmm(active.startsAt)} às ${sasaHhmm(active.endsAt)}${active.paused ? ", pausado" : ""}.` : "";
      const next = d.next ? ` ${active ? "O próximo" : "Seu próximo plantão"} é ${d.next.name}, ${weekday(d.next.startsAt)} das ${sasaHhmm(d.next.startsAt)} às ${sasaHhmm(d.next.endsAt)}.` : "";
      return (now + next).trim() || "Você não tem plantão marcado.";
    }
    case "agenda": {
      const a = facts.agenda;
      if (!a) return null;
      const endOfToday = new Date(spDayStart(now).getTime() + 86_400_000);
      const late = a.items.filter((item) => item.dueAt && item.dueAt.getTime() < now.getTime());
      const today = a.items.filter((item) => item.dueAt && item.dueAt.getTime() >= now.getTime() && item.dueAt.getTime() < endOfToday.getTime());
      const week = a.items.filter((item) => item.dueAt && item.dueAt.getTime() >= now.getTime() && item.dueAt.getTime() < now.getTime() + 7 * 86_400_000);
      const list = (items: typeof a.items) => items.slice(0, 8).map((item) => `${item.dueAt ? `${sasaDdmm(item.dueAt)} ${sasaHhmm(item.dueAt)}` : "sem hora"} ${first(item.lead)}`).join("; ");
      if (has(q, /\batrasad\w*/)) return late.length ? `${plural(late.length, "retorno atrasado", "retornos atrasados")}: ${list(late)}.` : "Nenhum retorno atrasado.";
      if (has(q, /\bsemana\b/)) return week.length ? `${plural(week.length, "retorno", "retornos")} nos próximos 7 dias: ${list(week)}.` : "Nenhum retorno nos próximos 7 dias.";
      return `Hoje: ${today.length ? list(today) : "nenhum retorno"}.${late.length ? ` Atrasados: ${list(late)}.` : ""}`;
    }
    case "performance": {
      const p = facts.performance;
      if (!p) return null;
      if (has(q, /\b(meta|falta)\b/)) {
        if (!p.goal) return "Você não tem meta ativa agora.";
        const current = Number(p.goal.current.replace(/\./g, "").replace(",", "."));
        const target = Number(p.goal.target.replace(/\./g, "").replace(",", "."));
        const left = Number.isFinite(current) && Number.isFinite(target) ? Math.max(0, target - current) : null;
        return `Meta ${p.goal.name}: ${p.goal.current} de ${p.goal.target} (${p.goal.percentage}%).${left !== null ? (left > 0 ? ` Faltam ${left.toLocaleString("pt-BR")}.` : " Meta batida!") : ""}`;
      }
      if (has(q, /\b(ranking|posicao|colocacao)\b/)) return p.ranks.length ? `Na semana: ${p.ranks.map((rank) => `${rank.position}º de ${rank.total} ${rank.label}`).join("; ")}.` : p.week ? "Você ainda não entrou no ranking da semana (precisa de mais ofertas)." : "O ranking não está ligado para a sua empresa.";
      if (!p.week) return "As estatísticas da semana não estão ligadas para a sua empresa. Hoje: " + `${p.today.received} recebidos e ${p.today.accepted} aceitos.`;
      if (has(q, /\b(primeira resposta|tempo|rapido|demora)\b/)) return `Nos últimos 7 dias, você aceitou em ${duration(p.week.medianAcceptSeconds)} e começou o atendimento em ${duration(p.week.medianStartSeconds)} (mediana).`;
      const rate = p.week.offered ? Math.round((p.week.accepted / p.week.offered) * 100) : null;
      return `Nos últimos 7 dias: ${p.week.offered} ofertas, ${p.week.accepted} aceitas${rate !== null ? ` (${rate}% de aceite)` : ""} e ${p.week.started} atendimentos iniciados.`;
    }
    case "quotes": {
      const c = facts.quotes;
      if (!c) return null;
      const label = (item: { lead: string; at: Date }) => `${sasaDdmm(item.at)} ${first(item.lead)}`;
      if (has(q, /\bpendente\w*/)) {
        const quotes = c.quotes.filter((item) => PENDING_QUOTES.has(item.status));
        const proposals = c.proposals.filter((item) => PENDING_PROPOSALS.has(item.status));
        return quotes.length + proposals.length ? `Pendentes: ${[...quotes.map((item) => `cotação ${label(item)}`), ...proposals.map((item) => `proposta ${label(item)}`)].join("; ")}.` : "Nenhuma cotação ou proposta pendente.";
      }
      if (has(q, /\b(envie\w*|enviad\w*|mandei)\b/)) {
        const quotes = c.quotes.filter((item) => SENT_QUOTES.has(item.status));
        const proposals = c.proposals.filter((item) => SENT_PROPOSALS.has(item.status));
        return quotes.length + proposals.length ? `Enviadas: ${[...quotes.map((item) => `cotação ${label(item)}`), ...proposals.map((item) => `proposta ${label(item)}`)].join("; ")}.` : "Nenhuma cotação ou proposta enviada ainda.";
      }
      return `Suas últimas cotações: ${c.quotes.length ? c.quotes.map(label).join("; ") : "nenhuma"}. Propostas: ${c.proposals.length ? c.proposals.map(label).join("; ") : "nenhuma"}.`;
    }
    case "notifications": {
      const n = facts.notifications;
      if (!n) return null;
      const unread = n.items.filter((item) => item.unread);
      return n.unread ? `Você tem ${plural(n.unread, "aviso novo", "avisos novos")}: ${unread.slice(0, 5).map((item) => item.title).join("; ")}. Estão em Notificações, no sino do Início.` : "Nenhum aviso novo.";
    }
    case "account": {
      const c = facts.account;
      if (!c) return null;
      if (has(q, /\b(whatsapp|zap|conectad\w*|desconectad\w*)\b/)) {
        return c.whatsapp === "connected" ? `Seu WhatsApp está conectado${c.connectedAt ? ` desde ${sasaDdmm(c.connectedAt)}` : ""}.` : "Seu WhatsApp não está conectado. Conecte no computador, lendo o QR code com o celular, para receber os leads do plantão.";
      }
      return c.availability === "available" ? "Você está disponível, recebendo leads." : c.availability === "paused" ? "Você está pausado: não recebe leads novos. Para voltar, diga \"volta a receber\"." : "Você está fora do ar para receber leads.";
    }
  }
}

const since = (date: Date, now: Date) => {
  const days = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (days >= 1) return `${days} ${days === 1 ? "dia" : "dias"}`;
  const hours = Math.floor((now.getTime() - date.getTime()) / 3_600_000);
  return hours >= 1 ? `${hours} h` : "menos de 1 h";
};

/**
 * Consulta de um lead ("tem algum lead chamado Antônia?"): um achado responde na hora, com etapa, há quanto tempo
 * está com o corretor, último contato, próximo passo e "Abrir"; vários de verdade viram escolha por toque.
 * Nunca pede sobrenome em texto nem anexa o resumo da carteira.
 */
export function leadLookupBlocks(facts: SasaFacts, now: Date, stamp: string): ChatBlock[] | null {
  const d = facts.lead;
  if (!d) return null;
  if (d.kind === "none") return [{ type: "assistant", id: `sasa-lead-none-${stamp}`, text: d.asked ? `Não achei ${d.asked} entre os seus leads ativos.` : "Não achei esse lead entre os seus leads ativos." }];
  if (d.kind === "many") {
    const options = d.leads?.length ? d.leads : d.names.map((name) => ({ id: name, name }));
    return [{
      type: "question", id: `sasa-lead-pick-${stamp}`, prompt: `Achei ${options.length}. Qual deles?`,
      choices: options.map((lead, index) => ({ id: `lead-${index}`, label: lead.name, reply: lead.name, action: { kind: "local", value: `${SASA_ASK_PREFIX}Quem é ${lead.name}?` } })),
    }];
  }
  const name = first(d.name);
  const parts = [`${d.name} está ${STAGE_LABEL[d.status] ?? d.status}${d.since ? `, com você há ${since(d.since, now)}` : ""}.`];
  parts.push(d.lastMessage ? `Último contato: ${d.lastMessage.from === "cliente" ? `${name} escreveu` : d.lastMessage.from === "corretor" ? "você escreveu" : "a qualificação escreveu"} em ${sasaDdmm(d.lastMessage.at)}: "${d.lastMessage.text}".` : "Ainda não há conversa registrada.");
  if (d.nextStep) parts.push(`Próximo passo: ${d.nextStep}`);
  const blocks: ChatBlock[] = [{ type: "assistant", id: `sasa-lead-${stamp}`, text: parts.join(" ") }];
  if (d.id) blocks.push({ type: "button", id: `sasa-lead-open-${stamp}`, label: `Abrir ${name}`, href: `/leads/${encodeURIComponent(d.id)}`, tone: "action" });
  return blocks;
}

/** Os mesmos fatos em linhas curtas, para a IA limitada (primeiros nomes e números, sem contato). */
export function factsToLines(area: SasaArea, facts: SasaFacts, now: Date): string {
  const generic = answerFromFacts(area === "lead" ? "resumo" : area === "finance" ? "comissoes" : "", area, facts, now);
  return generic ?? "Sem dados.";
}
