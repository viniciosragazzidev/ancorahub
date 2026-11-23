"use client";

import { useEffect, useState, useTransition } from "react";

import { ArrowRight } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchAddList } from "@/components/ui/search-add-list";
import {
  listDutyPassOptionsAction,
  passDutySeatAction,
  type DutyPassCandidate,
  type DutyPassOptions,
  type DutyPassResult,
} from "@/features/lead-distribution/duty-pass-actions";
import { plantaoDone, plantaoFailed, plantaoTap } from "./plantao-feedback";

type Ready = Extract<DutyPassOptions, { ok: true }>;
export type DutyPassDone = Extract<DutyPassResult, { ok: true }>;

/**
 * "Passar para alguém" (23/11): quem está no plantão abre mão e outra pessoa entra, sem precisar
 * estar escalada em outro dia. Busca, cartão "Sai A, entra B" com os avisos e um único botão.
 * O toast traz Desfazer (a cadeira volta para quem saiu). Serve publicado, rascunho e avulso.
 */
export function DutyPassPicker({ occurrenceId, fromBrokerId, onDone, onCancel, embedded = false }: {
  occurrenceId: string;
  fromBrokerId: string;
  /** Depois de passar ou de desfazer: a tela recarrega o que mostra. */
  onDone: (result: DutyPassDone | null) => void;
  onCancel: () => void;
  /** Dentro de outro bloco que já tem título (ex.: "Efetuar troca"). */
  embedded?: boolean;
}) {
  const [loading, startLoading] = useTransition();
  const [saving, startSaving] = useTransition();
  const [options, setOptions] = useState<Ready | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<DutyPassCandidate | null>(null);

  useEffect(() => {
    startLoading(async () => {
      const result = await listDutyPassOptionsAction({ occurrenceId, fromBrokerId });
      if (result.ok) setOptions(result);
      else setError(result.reason);
    });
  }, [occurrenceId, fromBrokerId]);

  function undo(result: DutyPassDone) {
    void passDutySeatAction({ ...result.undo, acceptOutsideType: true, acceptOverlap: true }).then((back) => {
      if (back.ok) {
        plantaoDone(`Desfeito: ${result.fromName} voltou ao plantão.`);
        onDone(null);
      } else plantaoFailed(back.reason, "Não consegui desfazer.", { keeps: `${result.toName} continua no plantão` });
    }, (cause: unknown) => plantaoFailed(cause, "Não consegui desfazer.", { keeps: `${result.toName} continua no plantão` }));
  }

  function confirm() {
    if (!chosen) return;
    plantaoTap();
    setError(null);
    startSaving(async () => {
      try {
        const result = await passDutySeatAction({
          occurrenceId,
          fromBrokerId,
          toBrokerId: chosen.id,
          acceptOutsideType: chosen.warnings.includes("fora_do_tipo") || undefined,
          acceptOverlap: chosen.warnings.includes("mesmo_horario") || undefined,
        });
        if (!result.ok) {
          setError(result.warnings?.length ? result.warnings.join(" ") : result.reason);
          plantaoFailed(result.reason, "Não consegui passar o plantão.", { keeps: "A escala continua como estava" });
          return;
        }
        plantaoDone(result.message, { undo: () => undo(result) });
        onDone(result);
      } catch (cause) {
        plantaoFailed(cause, "Não consegui passar o plantão.", { keeps: "A escala continua como estava", retry: confirm });
      }
    });
  }

  const items = (options?.candidates ?? []).map((candidate) => ({
    id: candidate.id,
    label: candidate.name,
    hint: [candidate.code ? `Código ${candidate.code}` : null, candidate.branchName].filter(Boolean).join(" · ") || undefined,
    tag: candidate.warnings.length ? <Badge variant="warning">{candidate.warnings.includes("mesmo_horario") ? "Mesmo horário" : "Fora do tipo"}</Badge> : undefined,
    keywords: candidate.code ?? undefined,
  }));

  return (
    <section aria-label="Passar o plantão para alguém" className={embedded ? "grid gap-3" : "grid gap-3 rounded-[var(--radius-card)] border border-border/70 bg-muted/30 p-3"}>
      {!embedded ? (
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">Passar para alguém</h3>
            <p className="text-xs text-muted-foreground">
              {options ? `${options.from.name} sai de ${options.seat.label}. Escolha quem entra.` : "Escolha quem entra no lugar."}
            </p>
          </div>
          <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={onCancel}>Fechar</Button>
        </div>
      ) : options ? <p className="text-xs text-muted-foreground">{options.from.name} sai de {options.seat.label}. Quem entra não precisa estar escalado em outro dia.</p> : null}

      {options?.seat.source === "draft" ? <p className="text-xs text-muted-foreground">Este plantão está só no rascunho do mês. A mudança vale quando a escala for publicada.</p> : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {loading && !options ? <p className="text-sm text-muted-foreground">Carregando corretores…</p> : null}

      {chosen && options ? (
        <div role="alert" className="grid gap-2 rounded-lg border border-warning/50 bg-background p-3 text-sm">
          <p>Sai <strong className="font-medium">{options.from.name}</strong>, entra <strong className="font-medium">{chosen.name}</strong>.</p>
          <p className="text-xs text-muted-foreground">{options.seat.label}. Os dois recebem aviso no app.</p>
          {chosen.warningTexts.length ? (
            <ul className="grid gap-1 text-xs text-foreground">
              {chosen.warningTexts.map((text) => <li key={text}>{text}</li>)}
            </ul>
          ) : null}
          <span className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={saving} onClick={confirm}>
              {saving ? "Passando…" : chosen.warnings.length ? "Passar mesmo assim" : "Passar o plantão"}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => { setChosen(null); setError(null); }}>Voltar</Button>
          </span>
        </div>
      ) : null}

      {options && !chosen && !options.candidates.length ? <p className="text-sm text-muted-foreground">Não há corretor ativo livre para entrar neste plantão.</p> : null}
      {options && !chosen && options.candidates.length ? (
        <SearchAddList
          actionLabel="Passar para"
          actionIcon={<ArrowRight className="size-4" />}
          items={items}
          placeholder="Buscar corretor por nome ou código"
          emptyLabel="Nenhum corretor encontrado."
          addingId={null}
          disabled={saving}
          onAdd={(item) => setChosen(options.candidates.find((candidate) => candidate.id === item.id) ?? null)}
        />
      ) : null}
    </section>
  );
}
