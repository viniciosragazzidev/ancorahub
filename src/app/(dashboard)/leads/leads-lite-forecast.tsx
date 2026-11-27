"use client";

/**
 * Previsão do mês no topo do kanban Lite (26/11/2026). Um número discreto; o toque abre a gaveta com a conta por etapa
 * (quantidade, valor bruto, chance e valor ponderado). Só o diretor vê "Configurações", que abre a gaveta das chances.
 * Salvar é ocasional: LiteActionButton, sucesso só depois do servidor, erro com a causa e "Tentar de novo".
 */
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Input } from "@/components/arc/input/input";
import { LiteActionButton } from "@/components/lite/controls";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import { saveForecastChancesAction } from "@/features/leads/monthly-forecast-actions";
import {
  FORECAST_STAGES,
  formatForecastCents,
  normalizeForecastChancesInput,
  withoutValueLabel,
  type ForecastChances,
  type MonthlyForecast,
} from "@/features/leads/monthly-forecast";

import styles from "./leads-lite-forecast.module.css";
import a1 from "./leads-1a1.module.css";

/** `canConfigure`: só o diretor ajusta as chances por etapa. */
export type LeadsLiteForecastData = MonthlyForecast & { chances: ForecastChances; scopeLabel: string; canConfigure: boolean };

export function LeadsLiteForecast({ forecast, columnsMenu }: { forecast: LeadsLiteForecastData; columnsMenu?: ReactNode }) {
  const canConfigure = forecast.canConfigure;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const total = formatForecastCents(forecast.totalWeightedCents);
  const missing = withoutValueLabel(forecast.withoutValue);
  const hover = [`${forecast.scopeLabel}, ponderados pela chance de cada etapa.`, missing].filter(Boolean).join(" ");
  // Chance média = previsto sobre o bruto, a mesma conta da gaveta por etapa.
  const averageChance = forecast.totalGrossCents > 0 ? Math.round((forecast.totalWeightedCents / forecast.totalGrossCents) * 100) : null;

  // Cartão do artifact "Leads da gestão" (27/11/2026): previsão em 28px, bruto e chance média, "Ver por etapa" e "Colunas".
  return (
    <div className={`${a1.card} ${a1.forecast}`}>
      <button type="button" className={a1.forecastValueBtn} onClick={() => setDetailsOpen(true)} title={hover} aria-haspopup="dialog">
        <p className={a1.forecastLabel}>Previsão do mês</p>
        <p className={a1.forecastValue}>{total}</p>
      </button>
      <div className={a1.forecastFacts}>
        <span>Bruto {formatForecastCents(forecast.totalGrossCents)}</span>
        {averageChance !== null ? <span>Chance média {averageChance}%</span> : null}
        {missing ? <span>{missing}</span> : null}
      </div>
      <span className={a1.spacer} />
      <button type="button" className={`${a1.pill} ${a1.pillQuiet} ${a1.pillQuietFlat}`} onClick={() => setDetailsOpen(true)} aria-haspopup="dialog">Ver por etapa</button>
      {canConfigure ? (
        <button type="button" className={`${a1.pill} ${a1.pillQuiet} ${a1.pillQuietFlat}`} onClick={() => setSettingsOpen(true)} aria-haspopup="dialog">Configurações</button>
      ) : null}
      {columnsMenu}

      <LiteSidePanel open={detailsOpen} onOpenChange={setDetailsOpen} title="Previsão do mês" description={`${forecast.scopeLabel}. Valor mensal vezes a chance da etapa.`}>
        <ForecastBreakdown forecast={forecast} />
      </LiteSidePanel>
      {canConfigure ? (
        <LiteSidePanel open={settingsOpen} onOpenChange={setSettingsOpen} title="Chances por etapa" description="Vale para a previsão de toda a empresa.">
          <ForecastChancesForm chances={forecast.chances} />
        </LiteSidePanel>
      ) : null}
    </div>
  );
}

export function ForecastBreakdown({ forecast }: { forecast: MonthlyForecast }) {
  const missing = withoutValueLabel(forecast.withoutValue);
  return (
    <div className={styles.breakdown}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Etapa</th>
            <th scope="col" className={styles.num}>Leads</th>
            <th scope="col" className={styles.num}>Bruto</th>
            <th scope="col" className={styles.num}>Chance</th>
            <th scope="col" className={styles.num}>Previsto</th>
          </tr>
        </thead>
        <tbody>
          {forecast.stages.map((stage) => (
            <tr key={stage.status}>
              <th scope="row">{stage.label}</th>
              <td className={styles.num}>{stage.count}</td>
              <td className={styles.num}>{formatForecastCents(stage.grossCents)}</td>
              <td className={styles.num}>{stage.chance}%</td>
              <td className={styles.num}>{formatForecastCents(stage.weightedCents)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td className={styles.num}>{forecast.counted}</td>
            <td className={styles.num}>{formatForecastCents(forecast.totalGrossCents)}</td>
            <td />
            <td className={styles.num}>{formatForecastCents(forecast.totalWeightedCents)}</td>
          </tr>
        </tfoot>
      </table>
      <p className={styles.note}>{missing ?? "Todos os leads abertos têm valor."} O valor vem da proposta aberta ou, sem ela, do valor do lead.</p>
    </div>
  );
}

function ForecastChancesForm({ chances }: { chances: ForecastChances }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(FORECAST_STAGES.map((stage) => [stage.status, String(chances[stage.status] ?? stage.defaultChance)])));
  const parsed = normalizeForecastChancesInput(values);

  return (
    <div className={styles.form}>
      {FORECAST_STAGES.map((stage) => (
        <Input
          key={stage.status}
          label={`${stage.label} (%)`}
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          step={1}
          value={values[stage.status] ?? ""}
          onChange={(event) => setValues((current) => ({ ...current, [stage.status]: event.target.value }))}
          className={styles.input}
        />
      ))}
      {parsed.ok ? null : <p className={styles.note} role="status">{parsed.reason}</p>}
      <LiteActionButton
        busyLabel="Salvando…"
        doneLabel="Chances salvas"
        keeps="As chances de antes continuam valendo."
        disabled={!parsed.ok}
        onAction={async () => {
          const result = await saveForecastChancesAction(values);
          if (result.ok) router.refresh();
          return result;
        }}
      >
        Salvar chances
      </LiteActionButton>
    </div>
  );
}
