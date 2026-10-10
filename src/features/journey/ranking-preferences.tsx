"use client";

import { useId, useState, useTransition } from "react";
import { Switch } from "@/components/arc/switch/switch";
import { setRankingOptOutAction } from "./actions";
import type { JourneyActionResult } from "./actions";
import css from "./ranking-preferences.module.css";

export function RankingPreferences({ initialOptOut, schemaReady = true, saveAction = setRankingOptOutAction }: { initialOptOut: boolean; schemaReady?: boolean; saveAction?: (optOut: boolean) => Promise<JourneyActionResult> }) {
  const [optOut, setOptOut] = useState(initialOptOut);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const descriptionId = useId();
  const statusId = useId();
  function change(visible: boolean) {
    setMessage(""); setError(false);
    startTransition(async () => {
      try {
        const result = await saveAction(!visible);
        if (!result.ok) { setError(true); setMessage(result.message); return; }
        setOptOut(!visible);
        setMessage(visible ? "Você aparece no placar da unidade." : "Você saiu do placar público. Seus pontos continuam na sua jornada.");
      } catch {
        setError(true); setMessage("Não foi possível salvar. Tente novamente.");
      }
    });
  }
  return (
    <section className={`arc-venancor ${css.root}`} aria-label="Privacidade do placar">
      <p id={descriptionId} className={css.purpose}>O placar compartilha seu nome e seus pontos com a unidade para reconhecer o trabalho da equipe. Você escolhe se aparece e pode mudar isso a qualquer momento. Sair do placar mantém seus pontos, missões e conquistas na sua jornada.</p>
      <div className={css.control} data-pending={pending || undefined} data-error={error || undefined}>
        <Switch label="Aparecer no placar da unidade" checked={!optOut} onCheckedChange={change} disabled={pending || !schemaReady} aria-busy={pending} aria-invalid={error || undefined} aria-describedby={`${descriptionId} ${statusId}`} />
        <p id={statusId} className={css.status} role={error ? "alert" : "status"}>
          {pending ? "Salvando sua escolha…" : !schemaReady ? "O placar ainda está sendo preparado. Volte daqui a pouco." : message}
        </p>
      </div>
    </section>
  );
}
