"use client";

import { Button } from "@/components/ui/button";
import { AppSelect } from "@/components/ui/select";
import { Dialog, DialogPopup, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { type LightLeadDetailData, type LiteRequirement } from "./types";
import type { LeadDetailController } from "./use-lead-detail";

export function SaleDocDialog({ lead, c, requirements }: { lead: LightLeadDetailData; c: LeadDetailController; requirements: LiteRequirement[] }) {
  const { requestingSale, saleDocOpen, setSaleDocOpen, docRequirementId, setDocRequirementId, docBeneficiaryId, setDocBeneficiaryId, docFile, setDocFile, docObservation, setDocObservation, isSaleClosing, setIsSaleClosing, fileInputRef, handleSubmitSaleDocument } = c;
  return (
    <>
      {/* Sale Documentation Dialog */}
      <Dialog open={saleDocOpen} onOpenChange={setSaleDocOpen}>
        <DialogPopup className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Documentação da venda</DialogTitle>
            <DialogDescription className="text-xs">
              Envie o documento de comprovação da venda para o supervisor aprovar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-1">
            {/* Tipo de documento */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground block">
                Tipo de documento
              </span>
              <AppSelect
                value={docRequirementId}
                onValueChange={setDocRequirementId}
                placeholder={
                  requirements.length ? "Selecione o tipo de documento" : "Nenhum tipo configurado"
                }
                options={
                  requirements.length
                    ? requirements.map((req) => ({ value: req.id, label: req.name }))
                    : [{ value: "__none__", label: "Nenhum tipo configurado", disabled: true }]
                }
              />
            </div>

            {/* Dono do documento */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground block">
                Dono do documento
              </span>
              <AppSelect
                value={docBeneficiaryId}
                onValueChange={setDocBeneficiaryId}
                placeholder="Selecione o titular ou dependente"
                options={(lead.beneficiaries ?? []).map((b) => ({
                  value: b.id,
                  label: b.isHolder ? `${b.name} (Titular)` : `${b.name} (Dependente)`,
                }))}
              />
              {(lead.beneficiaries ?? []).length === 0 ? (
                <p className="text-[11px] text-amber-600">
                  Cadastre o titular ou dependentes antes de enviar documentos.
                </p>
              ) : null}
            </div>

            {/* Arquivo */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground block">
                Arquivo (PDF, JPG ou PNG até 10 MB)
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-primary/10 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-primary"
              />
            </div>

            {/* Observação */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground block">
                Observação (opcional)
              </span>
              <input
                type="text"
                placeholder="Ex: Contrato assinado pelo titular"
                value={docObservation}
                onChange={(e) => setDocObservation(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs"
              />
            </div>

            {/* Fechamento de venda */}
            <label className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={isSaleClosing}
                onChange={(e) => setIsSaleClosing(e.target.checked)}
                className="mt-0.5 accent-primary"
              />
              <span>
                <span className="font-semibold text-foreground block">
                  Este documento é o fechamento da venda
                </span>
                <span className="text-muted-foreground text-[11px] block">
                  Marque para registrar como documento de venda e enviar para aprovação do
                  supervisor.
                </span>
              </span>
            </label>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={requestingSale}
              onClick={() => setSaleDocOpen(false)}
              className="flex-1 text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={requestingSale || !docFile || (lead.beneficiaries ?? []).length === 0}
              onClick={handleSubmitSaleDocument}
              className="flex-1 text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {requestingSale ? "Enviando..." : "ENVIAR DOCUMENTAÇÃO"}
            </Button>
          </div>
        </DialogPopup>
      </Dialog>
    </>
  );
}
