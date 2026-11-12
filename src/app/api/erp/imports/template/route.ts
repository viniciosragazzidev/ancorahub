import { requireErpAccess, auditErp } from "@/features/erp/access";
import { getDatabase } from "@/shared/db";
import { safeFileHeaders } from "@/shared/http/safe-file-headers";

export async function GET() {
  try {
    const auth = await requireErpAccess("imports", "erp_import_data");
    await requireErpAccess("implantations", "erp_manage_operations");
    await auditErp(getDatabase(), { tenantId: auth.context.tenantId, actorId: auth.context.userId, action: "erp.import.template_downloaded", entityType: "erp_export", entityId: "implantations-v1" });
    return new Response("\uFEFFnegocio_id;referencia;etapa;apolice;inicio_cobertura;evidencia_id;motivo\r\n", { headers: safeFileHeaders({ mimeType: "text/csv", filename: "modelo-implantacao.csv" }) });
  } catch { return new Response("Modelo indisponível para seu acesso.", { status: 403 }); }
}
