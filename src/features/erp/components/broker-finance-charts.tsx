"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

import { formatBrokerCents, type BrokerFinanceMonthPoint } from "../broker-finance-core";
import { formatCompetence } from "../ui/format";
import styles from "./broker-finance.module.css";

type TooltipProps = { active?: boolean; payload?: Array<{ payload: BrokerFinanceMonthPoint }> };

function MonthTooltip({ active, payload }: TooltipProps) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;
  return (
    <div className={styles.tooltip}>
      <span>{formatCompetence(point.period, "long")}</span>
      <strong>{formatBrokerCents(point.cents)}</strong>
    </div>
  );
}

/**
 * Barras por mês do Meu financeiro. Uma cor só (a ação do tema): cheia para o que já foi pago, mais clara para o
 * previsto, como pede o design system para série secundária. O mês atual fica destacado.
 */
export function BrokerFinanceMonthChart({ points, tone, label, currentPeriod }: { points: BrokerFinanceMonthPoint[]; tone: "paid" | "forecast"; label: string; currentPeriod: string }) {
  const summary = points.map((point) => `${point.label}: ${formatBrokerCents(point.cents)}`).join("; ");
  return (
    <div className={styles.chartBox} role="img" aria-label={`${label}. ${summary}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 8, right: 0, bottom: 0, left: 0 }} barCategoryGap="22%">
          <XAxis dataKey="label" axisLine={{ stroke: "var(--border)" }} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 11 }} interval={0} />
          <Tooltip content={<MonthTooltip />} cursor={{ fill: "var(--surface)", opacity: 0.6 }} />
          <Bar
            dataKey="cents"
            radius={[6, 6, 0, 0]}
            fill="var(--chat-action, #2563eb)"
            isAnimationActive
            animationDuration={420}
            shape={(props: unknown) => {
              const { x, y, width, height, payload } = props as { x: number; y: number; width: number; height: number; payload: BrokerFinanceMonthPoint };
              const current = payload.period === currentPeriod;
              const opacity = tone === "paid" ? (current ? 1 : 0.85) : current ? 0.55 : 0.35;
              const h = Math.max(height, payload.cents > 0 ? 3 : 0);
              const r = Math.min(6, width / 2, h);
              const top = y + height - h;
              return <path d={`M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + width - r} Q${x + width},${top} ${x + width},${top + r} V${top + h} Z`} fill="var(--chat-action, #2563eb)" fillOpacity={opacity} />;
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
