import { NextResponse } from "next/server";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { readBoundedFormData, MultipartLimitError } from "@/shared/http/bounded-form-data";
import { isSameOriginRequest } from "@/shared/http/same-origin";
import { uploadErpEvidence } from "@/features/erp/documents";
import { ErpError } from "@/features/erp/contracts";

export async function POST(request: Request) {
  if (!isSameOriginRequest({ origin: request.headers.get("origin"), secFetchSite: request.headers.get("sec-fetch-site"), requestHost: new URL(request.url).host })) return NextResponse.json({ ok: false, message: "Origem não permitida." }, { status: 403 });
  try {
    await getRequiredTenantContext();
    const form = await readBoundedFormData(request, 6 * 1024 * 1024);
    const allowed = new Set(["module", "leadId", "entryId", "payoutId", "file"]);
    for (const key of form.keys()) if (!allowed.has(key) || form.getAll(key).length !== 1) throw new ErpError("Confira os campos enviados.");
    const file = form.get("file"); if (!(file instanceof File)) throw new ErpError("Selecione um arquivo.");
    const id = await uploadErpEvidence({ module: form.get("module"), leadId: form.get("leadId") || null, entryId: form.get("entryId") || null, payoutId: form.get("payoutId") || null }, file);
    return NextResponse.json({ ok: true, id, message: "Evidência enviada. Confira os dados antes de aprovar." });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof ErpError || error instanceof MultipartLimitError ? error.message : "Não foi possível enviar a evidência. Confira o arquivo e seu acesso ao módulo." }, { status: 400 });
  }
}
