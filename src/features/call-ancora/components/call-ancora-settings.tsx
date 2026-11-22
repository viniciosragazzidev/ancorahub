"use client";

import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";

import { Button } from "@/components/arc/button/button";
import { Switch } from "@/components/arc/switch/switch";
import { useFeedback } from "@/lib/feedback/use-feedback";

import type { CallAncoraSettings } from "../settings-rules";

type NumberKey = {
  [K in keyof CallAncoraSettings]: CallAncoraSettings[K] extends number ? K : never;
}[keyof CallAncoraSettings];

const NUMBER_FIELDS: { key: NumberKey; label: string; hint: string; min: number; max: number; suffix: string }[] = [
  { key: "dailyContactsPerBroker", label: "Contatos por corretor por dia", hint: "Cada ligação classificada conta um contato.", min: 1, max: 1000, suffix: "contatos" },
  { key: "tenantDailyCredits", label: "Créditos diários da empresa", hint: "Total de contatos por dia somando todos os corretores. 0 é sem limite.", min: 0, max: 100000, suffix: "créditos" },
  { key: "leadPeriodMaxAgeDays", label: "Leads criados há no máximo", hint: "Período dos leads: o frio mais antigo que entra na fila.", min: 1, max: 3650, suffix: "dias" },
  { key: "leadPeriodMinAgeDays", label: "Leads criados há pelo menos", hint: "0 inclui os frios de hoje.", min: 0, max: 3650, suffix: "dias" },
  { key: "maxAttemptsPerLead", label: "Tentativas por lead", hint: "Depois disso o lead sai do Call Âncora.", min: 1, max: 10, suffix: "tentativas" },
  { key: "attemptCooldownHours", label: "Intervalo entre tentativas", hint: "Tempo mínimo antes de ligar de novo para o mesmo lead.", min: 1, max: 168, suffix: "horas" },
  { key: "windowStartHour", label: "Início das ligações", hint: "Horário de São Paulo.", min: 0, max: 23, suffix: "h" },
  { key: "windowEndHour", label: "Fim das ligações", hint: "As ligações param neste horário.", min: 1, max: 24, suffix: "h" },
];

/** Tela do diretor: limites e regras do Call Âncora da empresa. */
export function CallAncoraSettingsPanel() {
  const fire = useFeedback();
  const [settings, setSettings] = useState<CallAncoraSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/call-ancora/settings", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { settings?: CallAncoraSettings; error?: string };
        if (!response.ok || !payload.settings) throw new Error(payload.error || "Não foi possível carregar as configurações.");
        if (!cancelled) setSettings(payload.settings);
      })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Não foi possível carregar as configurações."); });
    return () => { cancelled = true; };
  }, []);

  const update = <K extends keyof CallAncoraSettings>(key: K, value: CallAncoraSettings[K]) => {
    setSaved(false);
    setSettings((current) => (current ? { ...current, [key]: value } : current));
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/call-ancora/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
      const payload = await response.json() as { settings?: CallAncoraSettings; error?: string };
      if (!response.ok || !payload.settings) throw new Error(payload.error || "Não foi possível salvar.");
      setSettings(payload.settings);
      setSaved(true);
      fire("confirm");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mb-6 rounded-2xl border border-(--border) bg-(--surface) p-4 md:p-5" aria-labelledby="call-ancora-settings-title">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-(--accent-subtle) text-(--accent-strong)"><Settings2 className="size-5" aria-hidden="true" /></span>
        <div>
          <h2 id="call-ancora-settings-title" className="font-semibold text-(--foreground)">Configurações do Call Âncora</h2>
          <p className="text-xs text-(--text-secondary)">Valem para todos os corretores da empresa. Só o diretor altera.</p>
        </div>
      </div>

      {error ? <p className="mt-4 rounded-xl border border-(--danger)/25 bg-(--danger)/5 px-4 py-3 text-sm text-(--danger)" role="alert">{error}</p> : null}
      {!settings ? (
        !error ? <p className="mt-4 text-sm text-(--text-secondary)" role="status">Carregando…</p> : null
      ) : (
        <>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {NUMBER_FIELDS.map((field) => (
              <label key={field.key} className="flex flex-col gap-1">
                <span className="text-sm font-medium text-(--foreground)">{field.label}</span>
                <span className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={field.min}
                    max={field.max}
                    value={settings[field.key]}
                    onChange={(event) => update(field.key, Number(event.target.value))}
                    className="min-h-11 w-32 rounded-xl border border-(--border) bg-(--background) px-3 text-sm tabular-nums text-(--foreground)"
                  />
                  <span className="text-sm text-(--text-secondary)">{field.suffix}</span>
                </span>
                <span className="text-xs leading-5 text-(--text-muted)">{field.hint}</span>
              </label>
            ))}
          </div>

          <div className="mt-5 grid gap-3">
            <div className="flex items-center justify-between gap-4 rounded-xl bg-(--surface-muted) px-4 py-3">
              <div>
                <p id="call-ancora-saturday" className="text-sm font-medium text-(--foreground)">Ligar aos sábados</p>
                <p className="text-xs text-(--text-secondary)">Domingo nunca tem ligação.</p>
              </div>
              <Switch aria-labelledby="call-ancora-saturday" checked={settings.saturdayEnabled} onCheckedChange={(checked) => update("saturdayEnabled", checked)} />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-xl bg-(--surface-muted) px-4 py-3">
              <div>
                <p id="call-ancora-autodial-default" className="text-sm font-medium text-(--foreground)">Discagem automática</p>
                <p className="text-xs text-(--text-secondary)">Depois do feedback, o celular liga para o próximo sozinho após a contagem. O corretor não muda isso.</p>
              </div>
              <Switch aria-labelledby="call-ancora-autodial-default" checked={settings.autoDialByDefault} onCheckedChange={(checked) => update("autoDialByDefault", checked)} />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button className="min-h-11 rounded-full" loading={saving} disabled={saving} onClick={() => void save()}>Salvar configurações</Button>
            {saved ? <span className="text-sm text-(--success)" role="status">Configurações salvas.</span> : null}
          </div>
        </>
      )}
    </section>
  );
}
