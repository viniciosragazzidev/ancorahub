"use client";

/**
 * Fila de conquistas do Lite (15/11/2026, FEEDBACK.md §3 nível 3): presença confirmada no plantão e WhatsApp
 * conectado abrem a tela de conquista do capitão (a mesma da venda), no estilo do Duolingo.
 *
 * Quem conquista chama `announceAchievement`; o anfitrião (montado no app do corretor) mostra uma de cada vez,
 * espera a oferta de lead sair e qualquer diálogo fechar (o roteiro do WhatsApp segue até o fim) e respeita o
 * limite diário e o interruptor "Comemorações". Sem anfitrião montado, `announceAchievement` devolve false e a
 * tela de origem dá a confirmação normal.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { LEAD_OFFER_STATE_EVENT } from "@/components/providers/realtime-sync-provider";
import { fireFeedback, fireFeedbackOnce } from "@/lib/feedback/use-feedback";

import { SaleCelebration, type SaleCelebrationStat } from "./sale-celebration";

export type Achievement =
  | { kind: "duty"; key: string; scheduleName: string; until: string; mode: "online" | "presencial"; startInterval?: boolean }
  | { kind: "whatsapp"; key: string; phoneSuffix?: string | null };

const EVENT = "ancora:achievement";
let hosts = 0;

/** Anuncia a conquista. Devolve true quando há um anfitrião para comemorar (o chamador não toca outro som). */
export function announceAchievement(achievement: Achievement): boolean {
  if (typeof window === "undefined" || hosts === 0) return false;
  window.dispatchEvent(new CustomEvent<Achievement>(EVENT, { detail: achievement }));
  return true;
}

const DUTY_ART = { src: "/mascote/desempenho-mirando.webp", width: 1145, height: 1374 };
const WHATSAPP_ART = { src: "/mascote/desempenho-subindo.webp", width: 1145, height: 1374 };

function screenOf(achievement: Achievement): { title: string; message: string; stats: SaleCelebrationStat[]; art: { src: string; width: number; height: number }; badge: "check" | "whatsapp"; continueLabel: string } {
  if (achievement.kind === "whatsapp") {
    return {
      title: "WhatsApp conectado!",
      message: "Agora você conversa com seus clientes direto por aqui, sem trocar de app.",
      stats: achievement.phoneSuffix ? [{ label: "Número", value: `final ${achievement.phoneSuffix}` }] : [],
      art: WHATSAPP_ART,
      badge: "whatsapp",
      continueLabel: "Continuar",
    };
  }
  return {
    title: "Presença confirmada!",
    message: achievement.startInterval
      ? "Você está no plantão. Enquanto os colegas confirmam, chega um lead a cada 8 min, até 3."
      : "Você está no plantão. Fique de olho: os leads já podem chegar.",
    stats: [
      { label: "Plantão", value: achievement.scheduleName },
      { label: "Até", value: achievement.until },
      { label: "Modalidade", value: achievement.mode === "presencial" ? "Presencial" : "Online" },
    ],
    art: DUTY_ART,
    badge: "check",
    continueLabel: "Bora receber leads",
  };
}

/** Diálogo aberto (o roteiro do WhatsApp, uma folha): a conquista espera ele fechar. */
const dialogOpen = () => Boolean(document.querySelector('[role="dialog"][aria-modal="true"]:not([data-sale-celebration])'));

export function AchievementHost() {
  const [queue, setQueue] = useState<Achievement[]>([]);
  const [current, setCurrent] = useState<Achievement | null>(null);
  const [offerActive, setOfferActive] = useState(false);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    hosts += 1;
    const onAchievement = (event: Event) => {
      const achievement = (event as CustomEvent<Achievement>).detail;
      if (!achievement || seen.current.has(achievement.key)) return;
      seen.current.add(achievement.key);
      setQueue((items) => [...items, achievement]);
    };
    window.addEventListener(EVENT, onAchievement);
    return () => { hosts -= 1; window.removeEventListener(EVENT, onAchievement); };
  }, []);

  useEffect(() => {
    setOfferActive(document.documentElement.dataset.leadOffer === "1");
    const onOffer = (event: Event) => setOfferActive(Boolean((event as CustomEvent<{ active: boolean }>).detail?.active));
    window.addEventListener(LEAD_OFFER_STATE_EVENT, onOffer);
    return () => window.removeEventListener(LEAD_OFFER_STATE_EVENT, onOffer);
  }, []);

  // Uma de cada vez: espera a oferta de lead sair e os diálogos fecharem; respeita o limite e as preferências.
  useEffect(() => {
    if (current || !queue.length || offerActive) return;
    let timer = 0;
    const tryShow = () => {
      if (dialogOpen()) { timer = window.setTimeout(tryShow, 400); return; }
      const [next, ...rest] = queue;
      setQueue(rest);
      const plan = fireFeedbackOnce(`achievement:${next.key}`, "celebrate", { budgetKey: next.kind === "duty" ? "plantao-presenca" : "whatsapp-conectado" });
      if (plan.celebrate) setCurrent(next);
      else fireFeedback("confirm");
    };
    timer = window.setTimeout(tryShow, 250);
    return () => window.clearTimeout(timer);
  }, [current, queue, offerActive]);

  const close = useCallback(() => setCurrent(null), []);
  if (!current) return null;
  const screen = screenOf(current);
  return (
    <SaleCelebration open onClose={close} celebrationKey={current.key} feedback={false}
      title={screen.title} message={screen.message} stats={screen.stats} art={screen.art} badge={screen.badge}
      continueLabel={screen.continueLabel} statsLabel={current.kind === "duty" ? "Resumo do plantão" : "WhatsApp"} />
  );
}
