import { NextResponse } from "next/server";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { readBoundedFormData, MultipartLimitError } from "@/shared/http/bounded-form-data";
import { isSameOriginRequest } from "@/shared/http/same-origin";
import { previewErpImport } from "@/features/erp/imports";
import { ErpError } from "@/features/erp/contracts";

export async function POST(request: Request) {
  if (!isSameOriginRequest({ origin: request.headers.get("origin"), secFetchSite: request.headers.get("sec-fetch-site"), requestHost: new URL(request.url).host })) return NextResponse.json({ ok: false, message: "Origem não permitida." }, { status: 403 });
  try {
    await getRequiredTenantContext();
    const form = await readBoundedFormData(request, 3 * 1024 * 1024);
    for (const key of form.keys()) if (!["domain", "file"].includes(key) || form.getAll(key).length !== 1) throw new ErpError("Confira os campos enviados.");
    const domain = form.get("domain");
    if (domain !== "implantations" && domain !== "finance") throw new ErpError("Tipo de importação indisponível.");
    const file = form.get("file"); if (!(file instanceof File)) throw new ErpError("Selecione um arquivo.");
    const result = await previewErpImport(domain, file);
    return NextResponse.json({ ok: true, id: result.id, message: result.alreadyApplied ? "Este arquivo já foi aplicado. Consulte o lote existente." : result.superseded ? "Prévia reaberta para nova conferência. Outra pessoa autorizada deve conferir e aplicar o lote." : "Prévia pronta. Outra pessoa autorizada deve conferir e aplicar o lote." });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof ErpError || error instanceof MultipartLimitError ? error.message : "Não foi possível preparar o arquivo. Confira seu acesso e o modelo." }, { status: 400 });
  }
}
