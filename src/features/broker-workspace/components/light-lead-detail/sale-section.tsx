"use client";

import { Button } from "@/components/arc/button/button";

import { stageLabel } from "./format";
import type { LeadDetailController } from "./use-lead-detail";

/** Current stage and the sale documentation flow (register, in review, approved, rejected). */
export function SaleSection({ c }: { c: LeadDetailController }) {
  const {
    isDistributed,
    leadStatus,
    whatsappOpenedAt,
    approvedDocument,
    rejectedDocument,
    requestingSale,
    handleRequestSale,
    setShowSaleConfirm,
  } = c;

  if (isDistributed) return null;

  const canRegisterSale =
    !approvedDocument &&
    !rejectedDocument &&
    leadStatus !== "converted" &&
    leadStatus !== "lost" &&
    leadStatus !== "documentation_pending";

  return (
    <section aria-labelledby="stage-heading" className="arc-venancor flex flex-col gap-4 rounded-3xl bg-(--surface) p-5 shadow-(--shadow-resting)">
      <div>
        <h2 id="stage-heading" className="text-base font-semibold text-(--foreground)">
          Etapa atual
        </h2>
        <p className="mt-1 text-sm text-(--text-secondary)">{stageLabel(leadStatus)}</p>
        {whatsappOpenedAt ? (
          <p className="mt-1 text-sm tabular-nums text-(--success)">Contato aberto às {whatsappOpenedAt}</p>
        ) : null}
      </div>

      {approvedDocument && leadStatus !== "converted" ? (
        <div className="flex flex-col gap-3 border-t border-(--border) pt-4">
          <p className="text-sm font-medium text-(--success)">Documentação aprovada pelo supervisor</p>
          <p className="text-sm text-(--text-secondary)">
            O documento &quot;{approvedDocument.filename}&quot; foi aprovado. Confirme a venda para finalizar.
          </p>
          <Button variant="secondary" onClick={() => setShowSaleConfirm(true)}>
            Confirmar venda
          </Button>
        </div>
      ) : null}

      {!approvedDocument && rejectedDocument && leadStatus !== "converted" ? (
        <div className="flex flex-col gap-3 border-t border-(--border) pt-4">
          <p className="text-sm font-medium text-(--warning)">Documentação rejeitada pelo supervisor</p>
          <p className="text-sm text-(--text-secondary)">
            O documento &quot;{rejectedDocument.filename}&quot; foi rejeitado. Reenvie a documentação corrigida.
          </p>
          <Button variant="secondary" onClick={handleRequestSale} disabled={requestingSale}>
            Reenviar documentação
          </Button>
        </div>
      ) : null}

      {!approvedDocument && !rejectedDocument && leadStatus === "documentation_pending" ? (
        <div className="border-t border-(--border) pt-4">
          <p className="text-sm font-medium text-(--foreground)">Documentação em análise</p>
          <p className="mt-1 text-sm text-(--text-secondary)">Aguardando aprovação do supervisor.</p>
        </div>
      ) : null}

      {canRegisterSale ? (
        <div className="border-t border-(--border) pt-4">
          <Button variant="secondary" onClick={handleRequestSale} loading={requestingSale} disabled={requestingSale}>
            Registrar venda
          </Button>
        </div>
      ) : null}
    </section>
  );
}
