"use client";

/**
 * Segurança global da captura Meta no visual Lite: o mesmo modo, os mesmos avisos e a mesma Server Action do
 * MetaMasterCaptureControl. Sem permissão de configurar, o modo aparece só para leitura (no lugar do seletor desabilitado).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

import { LiteSelect } from "@/components/lite/controls";
import page from "@/components/lite/page/lite-page.module.css";
import { toast } from "@/components/ui/sonner";
import { setMetaGlobalCaptureModeAction } from "../../actions";
import styles from "./meta-lite.module.css";

type CaptureMode = "all" | "selective" | "disabled";

const MODE_OPTIONS = [
  { value: "selective", label: "Liberar campanhas configuradas" },
  { value: "all", label: "Liberar captura global" },
  { value: "disabled", label: "Pausar toda a captura" },
];

export function CaptureControlLite({ globalMode, canConfigure }: { globalMode: CaptureMode; canConfigure: boolean }) {
  const [updating, setUpdating] = useState(false);
  const [currentMode, setCurrentMode] = useState(globalMode);
  const router = useRouter();

  const handleModeChange = async (newMode: CaptureMode) => {
    setUpdating(true);
    try {
      const res = await setMetaGlobalCaptureModeAction({ mode: newMode });
      if (res.success) {
        setCurrentMode(newMode);
        toast.success(newMode === "disabled" ? "Captura Meta pausada globalmente." : "Controle global atualizado.", {
          description: newMode === "disabled"
            ? "Nenhuma campanha enviará leads ao CRM até a reativação."
            : "Cada campanha ativa precisa ter uma fila configurada na própria página; anúncios e formulários herdam essa regra.",
        });
        router.refresh();
      } else {
        toast.error(res.error || "Erro ao alterar o controle global de captura.");
      }
    } finally {
      setUpdating(false);
    }
  };

  const paused = currentMode === "disabled";
  const editable = canConfigure && !updating;

  return (
    <section className={page.card} aria-labelledby="meta-capture-title">
      <div className={styles.cardHeadRow}>
        <div className={page.cardHead}>
          <h2 id="meta-capture-title" className={page.cardTitle}>Segurança global da captura Meta</h2>
          <p className={page.cardDescription}>Este controle pausa ou libera o intake do tenant. Configure a captura e a fila de cada campanha no detalhe dela.</p>
        </div>
        <span className={page.badge} data-tone={paused ? "danger" : "success"}>{paused ? "Captura pausada" : "Controle liberado"}</span>
      </div>
      {canConfigure ? (
        <div className={styles.controlRow} aria-busy={updating || undefined}>
          <div className={styles.controlSelect}>
            <LiteSelect
              label="Segurança global da captura Meta"
              hideLabel
              value={currentMode}
              options={MODE_OPTIONS}
              onChange={(value) => { if (editable) void handleModeChange(value as CaptureMode); }}
            />
          </div>
          {paused ? (
            <button type="button" className={page.button} disabled={!editable} onClick={() => void handleModeChange("selective")}>Liberar campanhas</button>
          ) : (
            <button type="button" className={`${page.button} ${styles.dangerButton}`} disabled={!editable} onClick={() => void handleModeChange("disabled")}>Pausar toda a captura</button>
          )}
        </div>
      ) : (
        <p className={page.muted}>Modo atual: {MODE_OPTIONS.find((option) => option.value === currentMode)?.label}. Só quem configura o marketing altera este controle.</p>
      )}
    </section>
  );
}
