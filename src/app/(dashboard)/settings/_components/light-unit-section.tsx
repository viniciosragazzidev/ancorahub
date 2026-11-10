"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import BottomSheet from "@/components/arc/bottom-sheet/bottom-sheet";
import { Button } from "@/components/arc/button/button";
import RadioCards from "@/components/arc/radio-cards/radio-cards";
import { changeOwnBranchAction, type ChangeOwnBranchState } from "@/features/broker-unit-change/actions";
import type { OwnUnitChangeOptions } from "@/features/broker-unit-change/queries";

type Props = OwnUnitChangeOptions & {
  changeAction?: (branchId: string) => Promise<ChangeOwnBranchState>;
};

const slotsText = (count: number) => (count === 1 ? "1 vaga de plantão" : `${count} vagas de plantão`);

/**
 * Configurações > Minha unidade of the broker app (DEC-171). One choice and one confirmation:
 * the broker picks another active unit and confirms in a sheet that says what changes.
 * The server checks role, tenant, active unit and the global flag again.
 */
export function LightUnitSection({ current, options, openDutySlots, changeAction = changeOwnBranchAction }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<{ message: string; error: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const selected = options.find((option) => option.id === selectedId) ?? null;

  function confirm() {
    if (!selected) return;
    startTransition(async () => {
      const response = await changeAction(selected.id);
      setConfirmOpen(false);
      if (!response.ok) {
        setResult({ message: response.error, error: true });
        return;
      }
      const left = response.releasedAssignments ? ` Você saiu de ${slotsText(response.releasedAssignments)} em ${current?.name ?? "sua unidade anterior"}.` : "";
      setResult({ message: `Pronto, agora você está em ${response.branchName}.${left}`, error: false });
      setSelectedId(null);
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="unit-heading" className="arc-venancor flex flex-col gap-4 rounded-3xl bg-(--surface) p-5 shadow-(--shadow-resting)">
      <div>
        <h2 id="unit-heading" className="text-base font-medium text-(--foreground)">Sua unidade</h2>
        <p className="mt-1 text-sm text-(--text-secondary)">
          {current ? <>Hoje você está em <span className="font-medium text-(--foreground)">{current.name}</span>.</> : "Seu cadastro está sem unidade. Peça à gestão para corrigir."}
        </p>
      </div>

      {current && options.length ? (
        <>
          <div className="flex flex-col gap-2">
            <p id="unit-choice" className="text-sm font-medium text-(--foreground)">Para qual unidade você quer ir?</p>
            <RadioCards
              aria-labelledby="unit-choice"
              layout="list"
              options={options.map((option) => ({ value: option.id, label: option.name }))}
              value={selectedId}
              onValueChange={(value) => { setSelectedId(value); setResult(null); }}
              disabled={pending}
            />
          </div>
          <Button type="button" variant="secondary" disabled={!selected || pending} onClick={() => setConfirmOpen(true)} className="self-start">
            {selected ? `Trocar para ${selected.name}` : "Trocar de unidade"}
          </Button>
        </>
      ) : current ? (
        <p className="text-sm text-(--text-secondary)">Não há outra unidade ativa na sua corretora.</p>
      ) : null}

      {result ? (
        <p role={result.error ? "alert" : "status"} className={`text-sm ${result.error ? "text-(--danger)" : "text-(--success)"}`}>{result.message}</p>
      ) : null}

      <BottomSheet
        open={confirmOpen}
        onOpenChange={(open) => { if (!pending) setConfirmOpen(open); }}
        title={selected ? `Trocar para ${selected.name}?` : "Trocar de unidade?"}
        description="A troca vale na hora."
        detents={[0.6, 0.9]}
        closeLabel="Fechar"
        className="arc-venancor"
      >
        <div className="flex flex-col gap-5 px-1 pb-4">
          <ul className="flex flex-col gap-2 text-sm text-(--text-secondary)">
            <li>{openDutySlots ? `Você sai de ${slotsText(openDutySlots)} em ${current?.name}.` : `Você não tem plantões pela frente em ${current?.name}.`}</li>
            <li>Seus leads e atendimentos continuam com você.</li>
            <li>Se você está na equipe de um supervisor, sai dela.</li>
            <li>A gestão das duas unidades recebe um aviso.</li>
          </ul>
          <div className="flex flex-col gap-2">
            <Button type="button" variant="primary" loading={pending} disabled={pending} onClick={confirm}>
              Trocar de unidade
            </Button>
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </BottomSheet>
    </section>
  );
}
