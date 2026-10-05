"use client";

import { useEffect, useRef, useState } from "react";
import { useInterfaceMotionEnabled } from "@/components/motion/interface-motion-provider";

type CountUpProps = {
  value: number;
  /** Formata o número exibido (default: pt-BR). */
  format?: (value: number) => string;
  durationMs?: number;
  className?: string;
};

const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

/** Conta de 0 até `value` uma única vez no mount (600ms). Reduced motion: valor final direto. */
export function CountUp({ value, format = (n) => n.toLocaleString("pt-BR"), durationMs = 600, className }: CountUpProps) {
  const enabled = useInterfaceMotionEnabled();
  const [display, setDisplay] = useState(value);
  const played = useRef(false);

  useEffect(() => {
    if (!enabled || played.current || !Number.isFinite(value) || value === 0) {
      setDisplay(value);
      return;
    }
    played.current = true;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      setDisplay(value * easeOutQuart(progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [enabled, value, durationMs]);

  const shown = Number.isInteger(value) ? Math.round(display) : display;
  return <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>{format(shown)}</span>;
}

const FORMATTED_NUMBER = /^([^\d]*?)(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?([\s\S]*)$/;

/**
 * Count-up para valores já formatados em pt-BR ("1.234", "R$ 12.500,50", "42%").
 * Anima só a parte numérica e preserva prefixo/sufixo e casas decimais; texto sem número passa direto.
 */
export function CountUpText({ text, className }: { text: string | number; className?: string }) {
  const raw = String(text);
  const match = FORMATTED_NUMBER.exec(raw);
  if (!match) return <span className={className}>{raw}</span>;
  const [, prefix, intPart, decimals = "", suffix] = match;
  if (/^0\d/.test(intPart) || /^[:/.\d-]/.test(suffix)) return <span className={className}>{raw}</span>;
  const target = Number(`${intPart.replace(/\./g, "")}${decimals ? `.${decimals}` : ""}`);
  if (!Number.isFinite(target)) return <span className={className}>{raw}</span>;
  return (
    <span className={className}>
      {prefix}
      <CountUp
        value={target}
        format={(n) => n.toLocaleString("pt-BR", { minimumFractionDigits: decimals.length, maximumFractionDigits: decimals.length })}
      />
      {suffix}
    </span>
  );
}
