"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { AppSelect } from "@/components/ui/select";
import { setUnitPresencePhotoDefaultAction } from "@/features/lead-distribution/duty-actions";
import type { UnitPresencePhotoDefault } from "@/features/lead-distribution/duty-presence-domain";

import { plantaoDone, plantaoFailed, plantaoTap } from "./plantao-feedback";
import { PlSelect, PlSheet, pl } from "./plantoes-1a1-kit";

type UnitChoice = "default" | UnitPresencePhotoDefault;

export const UNIT_PHOTO_OPTIONS: { value: UnitChoice; label: string }[] = [
  { value: "default", label: "Padrão da modalidade" },
  { value: "always", label: "Sempre exigir foto" },
  { value: "never", label: "Nunca exigir foto" },
];

/**
 * "Foto por unidade" (25/11): o padrão de foto na confirmação de cada unidade. Plantão com escolha própria
 * continua vencendo; os outros seguem a unidade e, sem regra na unidade, a modalidade. O servidor confere
 * a permissão (Diretor: qualquer unidade; Gestor: só a dele).
 */
export function UnitPhotoDefaultsButton({ branches, defaults, disabled }: {
  branches: { id: string; name: string }[];
  defaults: Record<string, UnitPresencePhotoDefault>;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [savingId, setSavingId] = useState<string | null>(null);
  if (!branches.length) return null;

  function choose(branchId: string, branchName: string, value: UnitChoice) {
    if ((defaults[branchId] ?? "default") === value) return;
    plantaoTap();
    setSavingId(branchId);
    startTransition(async () => {
      const result = await setUnitPresencePhotoDefaultAction({ branchId, value }).catch((error: unknown) => ({ ok: false as const, reason: error instanceof Error ? error.message : "" }));
      setSavingId(null);
      if (!result.ok) {
        plantaoFailed(result.reason, "Não foi possível salvar a foto da unidade.", { keeps: "A regra anterior da unidade continua valendo." });
        return;
      }
      plantaoDone(`${branchName}: ${UNIT_PHOTO_OPTIONS.find((option) => option.value === value)?.label.toLocaleLowerCase("pt-BR")}.`);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="outline" disabled={disabled} onClick={() => setOpen(true)}>
        {branches.length === 1 ? "Foto da unidade" : "Foto por unidade"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>Foto na confirmação por unidade</DialogTitle>
            <DialogDescription>
              Vale para os plantões que estão em &quot;Padrão da unidade&quot;. Plantão com escolha própria continua com ela.
              No padrão da modalidade, presencial pede foto e online confirma com um toque.
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[55vh] gap-2 overflow-y-auto">
            {branches.map((branch) => (
              <div key={branch.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-card)] border border-border p-2.5">
                <span className="min-w-0 truncate text-sm font-medium">{branch.name}</span>
                <AppSelect
                  aria-label={`Foto na confirmação: ${branch.name}`}
                  className="w-52 max-w-full"
                  value={defaults[branch.id] ?? "default"}
                  disabled={pending && savingId === branch.id}
                  onValueChange={(value) => choose(branch.id, branch.name, value === "always" || value === "never" ? value : "default")}
                  options={UNIT_PHOTO_OPTIONS}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </>
  );
}

/**
 * Lite 1:1 (27/11/2026): "Foto na confirmação por unidade" no molde de gaveta do artifact "Distribuição · Plantões",
 * aberta pelo menu "Configurações". Mesma ação e mesmos textos do diálogo acima.
 */
export function UnitPhotoDefaultsSheet({ open, onOpenChange, branches, defaults }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: { id: string; name: string }[];
  defaults: Record<string, UnitPresencePhotoDefault>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [savingId, setSavingId] = useState<string | null>(null);

  function choose(branchId: string, branchName: string, value: UnitChoice) {
    if ((defaults[branchId] ?? "default") === value) return;
    plantaoTap();
    setSavingId(branchId);
    startTransition(async () => {
      const result = await setUnitPresencePhotoDefaultAction({ branchId, value }).catch((error: unknown) => ({ ok: false as const, reason: error instanceof Error ? error.message : "" }));
      setSavingId(null);
      if (!result.ok) {
        plantaoFailed(result.reason, "Não foi possível salvar a foto da unidade.", { keeps: "A regra anterior da unidade continua valendo." });
        return;
      }
      plantaoDone(`${branchName}: ${UNIT_PHOTO_OPTIONS.find((option) => option.value === value)?.label.toLocaleLowerCase("pt-BR")}.`);
      router.refresh();
    });
  }

  return (
    <PlSheet
      open={open}
      onOpenChange={onOpenChange}
      title={branches.length === 1 ? "Foto na confirmação da unidade" : "Foto na confirmação por unidade"}
      description="Vale para os plantões que estão em “Padrão da unidade”. Plantão com escolha própria continua com ela. No padrão da modalidade, presencial pede foto e online confirma com um toque."
      footer={<button type="button" className={`${pl.pill} ${pl.pillQuiet} ${pl.pillWide}`} onClick={() => onOpenChange(false)}>Fechar</button>}
    >
      <ul className={pl.rows}>
        {branches.map((branch) => (
          <li key={branch.id} className={pl.row}>
            <span className={pl.rowBody}>
              <span className={pl.rowName}>{branch.name}</span>
              {pending && savingId === branch.id ? <span className={pl.rowMeta}>Salvando…</span> : null}
            </span>
            <PlSelect
              aria-label={`Foto na confirmação: ${branch.name}`}
              style={{ width: 210, flex: "none" }}
              value={defaults[branch.id] ?? "default"}
              disabled={pending && savingId === branch.id}
              onChange={(value) => choose(branch.id, branch.name, value === "always" || value === "never" ? value : "default")}
              options={UNIT_PHOTO_OPTIONS}
            />
          </li>
        ))}
      </ul>
    </PlSheet>
  );
}
