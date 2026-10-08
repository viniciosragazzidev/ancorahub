"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/sonner";

import { SlidersHorizontal } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppSelect } from "@/components/ui/select";
import { setMetaGlobalCaptureModeAction } from "../actions";

/** Controle global de segurança. Configuração da captura e da fila fica no detalhe da campanha. */
export function MetaMasterCaptureControl({
  globalMode,
  canConfigure,
}: {
  globalMode: "all" | "selective" | "disabled";
  canConfigure: boolean;
}) {
  const [updating, setUpdating] = useState(false);
  const [currentMode, setCurrentMode] = useState(globalMode);
  const router = useRouter();

  const handleModeChange = async (newMode: "all" | "selective" | "disabled") => {
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

  return (
    <Card className="border-2 border-primary/20 bg-card shadow-none">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal className="size-5 text-primary" />
              Segurança global da captura Meta
            </CardTitle>
            <CardDescription className="text-xs">
              Este controle pausa ou libera o intake do tenant. Configure a captura e a fila de cada campanha no detalhe dela.
            </CardDescription>
          </div>
          <Badge variant={currentMode === "disabled" ? "destructive" : "success"} className="px-3 py-1 text-xs font-semibold">
            {currentMode === "disabled" ? "Captura pausada" : "Controle liberado"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <AppSelect
              aria-label="Segurança global da captura Meta"
              disabled={!canConfigure || updating}
              value={currentMode}
              onValueChange={(value) => void handleModeChange(value as "all" | "selective" | "disabled")}
              options={[
                { value: "selective", label: "Liberar campanhas configuradas" },
                { value: "all", label: "Liberar captura global" },
                { value: "disabled", label: "Pausar toda a captura" },
              ]}
            />
          </div>
          <div className="flex items-center gap-2">
            {currentMode !== "disabled" ? (
              <Button variant="destructive" size="sm" disabled={!canConfigure || updating} onClick={() => void handleModeChange("disabled")} className="w-full text-xs font-medium">
                Pausar toda a captura
              </Button>
            ) : (
              <Button variant="default" size="sm" disabled={!canConfigure || updating} onClick={() => void handleModeChange("selective")} className="w-full bg-emerald-600 text-xs font-medium text-white hover:bg-emerald-700">
                Liberar campanhas
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
