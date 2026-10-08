"use client";

import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { Button } from "@/components/arc/button/button";
import { FileDropzone } from "@/components/arc/file-dropzone/file-dropzone";
import { Input } from "@/components/arc/input/input";
import { RadioCards } from "@/components/arc/radio-cards/radio-cards";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";

import type { LightLeadDetailData, LiteRequirement } from "./types";
import type { LeadDetailController } from "./use-lead-detail";

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

/** Upload of the sale document: type, owner (titular or dependent), file and the closing flag. */
export function SaleDocSheet({
  lead,
  c,
  requirements,
}: {
  lead: LightLeadDetailData;
  c: LeadDetailController;
  requirements: LiteRequirement[];
}) {
  const {
    saleDocOpen,
    setSaleDocOpen,
    docRequirementId,
    setDocRequirementId,
    docBeneficiaryId,
    setDocBeneficiaryId,
    docFile,
    setDocFile,
    docObservation,
    setDocObservation,
    isSaleClosing,
    setIsSaleClosing,
    requestingSale,
    handleSubmitSaleDocument,
  } = c;
  const beneficiaries = lead.beneficiaries ?? [];

  return (
    <BottomSheet
      open={saleDocOpen}
      onOpenChange={setSaleDocOpen}
      title="Documentação da venda"
      description="Envie o documento de comprovação para o supervisor aprovar."
      detents={[0.92]}
      closeLabel="Fechar"
      className="arc-venancor"
    >
      <div className="flex flex-col gap-5 pb-2">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-(--foreground)">Tipo de documento</p>
          {requirements.length ? (
            <RadioCards
              aria-label="Tipo de documento"
              layout="list"
              options={requirements.map((requirement) => ({
                value: requirement.id,
                label: requirement.name,
                description: requirement.description ?? undefined,
              }))}
              value={docRequirementId || null}
              onValueChange={setDocRequirementId}
            />
          ) : (
            <p className="text-sm text-(--text-secondary)">Nenhum tipo de documento configurado.</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-(--foreground)">Dono do documento</p>
          {beneficiaries.length ? (
            <RadioCards
              aria-label="Dono do documento"
              layout="list"
              options={beneficiaries.map((beneficiary) => ({
                value: beneficiary.id,
                label: beneficiary.name,
                description: beneficiary.isHolder ? "Titular" : "Dependente",
              }))}
              value={docBeneficiaryId || null}
              onValueChange={setDocBeneficiaryId}
            />
          ) : (
            <p className="text-sm text-(--warning)">Cadastre o titular ou dependentes antes de enviar documentos.</p>
          )}
        </div>

        <FileDropzone
          label="Arquivo da venda"
          description="PDF, JPG ou PNG até 10 MB"
          accept="application/pdf,image/jpeg,image/png"
          multiple={false}
          maxFiles={1}
          maxSize={MAX_DOCUMENT_BYTES}
          onFilesChange={(files) => setDocFile(files[0] ?? null)}
        />

        <Input
          label="Observação (opcional)"
          placeholder="Ex.: contrato assinado pelo titular"
          value={docObservation}
          onChange={(event) => setDocObservation(event.target.value)}
        />

        <div className="flex flex-col gap-2">
          <SegmentedControl
            label="Uso do documento"
            options={[
              { value: "closing", label: "Fechamento da venda" },
              { value: "other", label: "Outro documento" },
            ]}
            value={isSaleClosing ? "closing" : "other"}
            onValueChange={(value) => setIsSaleClosing(value === "closing")}
          />
          <p className="text-sm text-(--text-secondary)">
            {isSaleClosing
              ? "Registra como documento de venda e envia para a aprovação do supervisor."
              : "Anexado como comprovação, sem pedir a aprovação da venda."}
          </p>
        </div>

        <Button size="lg" loading={requestingSale} disabled={requestingSale || !docFile || beneficiaries.length === 0} onClick={handleSubmitSaleDocument}>
          Enviar documentação
        </Button>
      </div>
    </BottomSheet>
  );
}
