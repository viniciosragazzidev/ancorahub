"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

import { AssistantAvatar } from "@/components/chat/assistant-avatar";
import { formatDuration } from "@/features/engagement/ranking";

import css from "./duty-now-view.module.css";

export type DutyNowViewData = {
  scheduleName: string;
  queueName: string | null;
  branchName: string | null;
  startsAt: string;
  endsAt: string;
  state: "ativo" | "pausado" | "aguardando";
  leads: { leadId: string; name: string; origin: "oferta" | "atribuicao"; status: string; tone: "ok" | "wait" | "lost"; at: string; acceptSeconds: number | null; openable: boolean }[];
  totals: { offered: number; accepted: number; missed: number; started: number; medianAcceptSeconds: number | null };
};

const TIME_ZONE = "America/Sao_Paulo";
const hhmm = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
const STATE: Record<DutyNowViewData["state"], { label: string; className: string }> = {
  ativo: { label: "Recebendo leads", className: css.stateOn },
  pausado: { label: "Pausado", className: css.statePaused },
  aguardando: { label: "Aguardando liberação do gestor", className: css.statePaused },
};
const ease = [0.16, 1, 0.3, 1] as const;
const TONE_CLASS: Record<"ok" | "wait" | "lost", string> = { ok: css.badgeOk, wait: css.badgeWait, lost: css.badgeLost };

function remaining(endsAt: number, now: number) {
  const seconds = Math.max(0, Math.round((endsAt - now) / 1000));
  if (seconds === 0) return "Plantão encerrado";
  const minutes = Math.ceil(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours ? `Termina em ${hours} h ${minutes % 60} min` : `Termina em ${minutes} min`;
}

/** The plantão happening now: window, live progress, numbers and every lead received in it. */
export function DutyNowView({ data, nowIso }: { data: DutyNowViewData; nowIso: string }) {
  const reduce = useReducedMotion();
  const [now, setNow] = useState(() => new Date(nowIso).getTime());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const start = new Date(data.startsAt).getTime();
  const end = new Date(data.endsAt).getTime();
  const progress = Math.min(1, Math.max(0, (now - start) / Math.max(1, end - start)));
  const state = STATE[data.state];
  const stats = [
    { label: "Ofertas recebidas", value: String(data.totals.offered) },
    { label: "Aceitas", value: String(data.totals.accepted) },
    { label: "Perdidas", value: String(data.totals.missed), alert: data.totals.missed > 0 },
    { label: "Em atendimento", value: String(data.totals.started) },
    { label: "Tempo para aceitar", value: formatDuration(data.totals.medianAcceptSeconds) },
  ];

  return (
    <div className={`arc-venancor ${css.page}`}>
      <div className={css.inner}>
        <motion.section className={css.hero} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease }} aria-label="Seu plantão agora">
          <div className={css.heroTop}>
            <AssistantAvatar shape="onigiri" hue={28} size={48} />
            <div className={css.heroText}>
              <h1 className={css.title}>{data.scheduleName}</h1>
              <p className={css.subtitle}>{[data.queueName, data.branchName].filter(Boolean).join(" · ") || "Plantão"} · {hhmm(data.startsAt)} às {hhmm(data.endsAt)}</p>
            </div>
            <span className={`${css.state} ${state.className}`}><span className={css.stateDot} aria-hidden />{state.label}</span>
          </div>
          <div className={css.progress}>
            <span className={css.track} aria-hidden>
              <motion.span className={css.fill} initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: progress }} transition={{ duration: 0.8, ease }} />
            </span>
            <span className={css.progressText}>
              <span>{Math.round(progress * 100)}% do plantão</span>
              <span>{remaining(end, now)}</span>
            </span>
          </div>
        </motion.section>

        <dl className={css.stats}>
          {stats.map((stat, index) => (
            <motion.div key={stat.label} className={`${css.stat} ${stat.alert ? css.statAlert : ""}`} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: reduce ? 0 : 0.08 + index * 0.04 }}>
              <dt className={css.statLabel}>{stat.label}</dt>
              <dd className={css.statValue}>{stat.value}</dd>
            </motion.div>
          ))}
        </dl>

        <section aria-labelledby="duty-leads" className={css.leads}>
          <h2 id="duty-leads" className={css.sectionTitle}>Leads deste plantão <span className={css.count}>{data.leads.length}</span></h2>
          {!data.leads.length ? (
            <p className={css.empty}>{data.state === "ativo" ? "Nenhum lead ainda. Fique de olho: as ofertas chegam aqui e no seu celular." : "Nenhum lead ainda neste plantão."}</p>
          ) : (
            <ul className={css.list}>
              {data.leads.map((lead, index) => (
                <motion.li key={lead.leadId} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: reduce ? 0 : 0.12 + Math.min(index, 8) * 0.03 }}>
                  {lead.openable ? (
                    <Link href={`/leads/${lead.leadId}`} className={css.row}>
                    <span className={css.initials} aria-hidden>{lead.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")}</span>
                    <span className={css.rowText}>
                      <span className={css.rowName}>{lead.name}</span>
                      <span className={css.rowMeta}>
                        {lead.origin === "oferta" ? "Oferta do plantão" : "Atribuído a você"} · {hhmm(lead.at)}
                        {lead.acceptSeconds !== null ? ` · aceito em ${formatDuration(lead.acceptSeconds)}` : ""}
                      </span>
                    </span>
                    <span className={`${css.badge} ${TONE_CLASS[lead.tone]}`}>{lead.status}</span>
                    </Link>
                  ) : lead.tone === "wait" ? (
                    // A pending offer is answered in the offer flow (queue), not by opening the lead.
                    <Link href="/minha-fila" className={css.row}>
                    <span className={css.initials} aria-hidden>{lead.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")}</span>
                    <span className={css.rowText}>
                      <span className={css.rowName}>{lead.name}</span>
                      <span className={css.rowMeta}>
                        {lead.origin === "oferta" ? "Oferta do plantão" : "Atribuído a você"} · {hhmm(lead.at)}
                        {lead.acceptSeconds !== null ? ` · aceito em ${formatDuration(lead.acceptSeconds)}` : ""}
                      </span>
                    </span>
                    <span className={`${css.badge} ${TONE_CLASS[lead.tone]}`}>{lead.status}</span>
                    </Link>
                  ) : (
                    <div className={`${css.row} ${css.rowStatic}`}>
                    <span className={css.initials} aria-hidden>{lead.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")}</span>
                    <span className={css.rowText}>
                      <span className={css.rowName}>{lead.name}</span>
                      <span className={css.rowMeta}>
                        {lead.origin === "oferta" ? "Oferta do plantão" : "Atribuído a você"} · {hhmm(lead.at)}
                        {lead.acceptSeconds !== null ? ` · aceito em ${formatDuration(lead.acceptSeconds)}` : ""}
                      </span>
                    </span>
                    <span className={`${css.badge} ${TONE_CLASS[lead.tone]}`}>{lead.status}</span>
                    </div>
                  )}
                </motion.li>
              ))}
            </ul>
          )}
        </section>

        <div className={css.footer}>
          <Link href="/dashboard/c/plantao" className={css.link}>Pausar ou voltar a receber pela conversa do Plantão</Link>
        </div>
      </div>
    </div>
  );
}
