"use client";

import { Zap } from "lucide-react";
import { useReducedMotion } from "motion/react";

import { useInterfaceMotionEnabled } from "@/components/motion/interface-motion-provider";

import styles from "./accept-lead-button.module.css";

/**
 * Visual único do "Aceitar lead" em todo o Lite (Vinicios, 14/11: acabou o botão preto). Verde de ação
 * positiva (o mesmo token --success do "Confirmar reatribuição"), pill, 48 px de altura e o raio dentro
 * de um círculo claro. Quem tem um aceite com outra lógica (barra da ficha do lead) usa só a classe e o ícone.
 */
export const acceptLeadButtonClass = styles.accept;

/** Anel de "oferta pendente" para um gatilho que não é o botão de aceite (ex.: o "Agora" flutuante da Home). */
export const offerHaloClass = styles.halo;

/**
 * Atributos do estado "oferta pendente": `data-offer-pending` liga o anel (fica parado, sempre visível) e
 * `data-offer-loop="on"` faz o anel pulsar a cada 2 s. Movimento reduzido ou o kill-switch
 * html[data-interface-motion="off"] (useInterfaceMotionEnabled) deixam o loop em "off".
 */
export function useOfferPendingAttributes(pending: boolean) {
  const reduce = useReducedMotion();
  const motionEnabled = useInterfaceMotionEnabled();
  return {
    "data-offer-pending": pending ? "true" : undefined,
    "data-offer-loop": pending ? (motionEnabled && !reduce ? "on" : "off") : undefined,
  } as const;
}

/** O raio dentro do círculo, à esquerda do rótulo. Decorativo: o nome do botão é o texto. */
export function AcceptLeadIcon() {
  return (
    <span className={styles.icon} aria-hidden="true" data-accept-icon="">
      <Zap strokeWidth={2.4} />
    </span>
  );
}

/** Etiqueta "Oferta pendente" dentro do botão: o estado não depende só da cor ou da animação. */
export function OfferPendingTag() {
  // O ":" só para leitor de tela: o nome do botão fica "Oferta pendente: Aceitar ...".
  return <><span className={styles.pendingTag}>Oferta pendente</span><span className="sr-only">:</span>{" "}</>;
}
