import { requireErpAccess, auditErp, canSeeAgencyBooks } from "@/features/erp/access";
import { getDatabase } from "@/shared/db";
import { safeFileHeaders } from "@/shared/http/safe-file-headers";

const TEMPLATES = {
  implantations: { header: "negocio_id;referencia;etapa;apolice;inicio_cobertura;evidencia_id;motivo", filename: "modelo-implantacao.csv" },
  finance: { header: "referencia;tipo;venda_id;unidade_id;beneficiario_id;valor;vencimento;competencia;descricao", filename: "modelo-financeiro.csv" },
} as const;

export async function GET(request: Request) {
  try {
    const domain = new URL(request.url).searchParams.get("domain") === "finance" ? "finance" : "implantations";
    const auth = await requireErpAccess("imports", "erp_import_data");
    if (domain === "finance") { const finance = await requireErpAccess("finance", "erp_prepare_finance"); if (!canSeeAgencyBooks(finance.context)) throw new Error("denied"); }
    else await requireErpAccess("implantations", "erp_manage_operations");
    await auditErp(getDatabase(), { tenantId: auth.context.tenantId, actorId: auth.context.userId, action: "erp.import.template_downloaded", entityType: "erp_export", entityId: `${domain}-v1` });
    return new Response(`﻿${TEMPLATES[domain].header}\r\n`, { headers: safeFileHeaders({ mimeType: "text/csv", filename: TEMPLATES[domain].filename }) });
  } catch { return new Response("Modelo indisponível para seu acesso.", { status: 403 }); }
}
