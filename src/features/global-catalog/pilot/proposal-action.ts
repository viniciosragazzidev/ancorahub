"use server";

import { createHash, randomUUID } from "node:crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { z } from "zod";
import { uploadR2Object } from "@/shared/storage/r2-storage";
import { requirePilot, loadPilotIndex, loadPlanShard, auditPilot } from "./server";
import { quoteInputSchema, type PlanDetail } from "./contracts";
import { activeAt, simulate } from "./engine";

const requestSchema = z.object({ planId: z.string().uuid(), profile: quoteInputSchema });
export async function exportCatalogProposalAction(input: unknown) {
  try {
    const { context, config } = await requirePilot();
    if (context.viewAs) return { error: "A visualização de outro usuário é somente leitura." };
    const parsed = requestSchema.parse(input);
    const index = await loadPilotIndex(config);
    const plan = index.plans.find(p => p.id === parsed.planId);
    if (!plan) return { error: "Plano indisponível." };
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    const result = simulate([plan], { ...parsed.profile, page: 1, includeIncompatible: true }, date, new Set(config.reviewedPlanIds), new Set(config.hiddenPlanIds), config.release).results[0];
    if (!result || result.state !== "ready") {
      await auditPilot(context.userId, context.tenantId, "quote_catalog.proposal_blocked", { planId: plan.id, release: config.release });
      return { error: "Proposta final bloqueada: existem condições comerciais pendentes ou incompatibilidades. A revisão deve ser feita por um administrador autorizado.", reasons: result?.reasons || ["O plano não está disponível para o perfil atual."] };
    }
    const detail = await loadPlanShard(config, "details", plan.id) as PlanDetail;
    const exportable = detail.details.filter(d => d.ativo !== false && d.exportavel_pdf === true && activeAt(d.vigencia_inicio || null, d.vigencia_fim || null, date));
    const snapshot = { schemaVersion: 1, release: config.release, date, plan: result, profile: parsed.profile, conditions: exportable };
    const id = randomUUID();
    const snapshotBuffer = Buffer.from(JSON.stringify(snapshot));
    const sha256 = createHash("sha256").update(snapshotBuffer).digest("hex");
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    let page = pdf.addPage([595, 842]), y = 790;
    function line(value: string, title = false) {
      // StandardFonts accepts Latin-1. Preserve Portuguese and replace unsupported
      // source symbols instead of failing an otherwise valid export.
      const text = value.replace(/[^\u000a\u000d\u0020-\u00ff]/g, " ");
      const size = title ? 13 : 10, face = title ? bold : font;
      for (const paragraph of text.split(/\r?\n/)) {
        let row = "";
        for (const word of paragraph.split(/\s+/)) {
          const pieces = word.length > 70 ? word.match(/.{1,70}/g) || [word] : [word];
          for (const piece of pieces) {
            const next = row ? `${row} ${piece}` : piece;
            if (face.widthOfTextAtSize(next, size) > 495 && row) { draw(row); row = piece; } else row = next;
          }
        }
        draw(row);
      }
      function draw(row: string) { if (y < 55) { page = pdf.addPage([595, 842]); y = 790; } page.drawText(row, { x: 50, y, size, font: face, color: rgb(0.08, 0.13, 0.2) }); y -= title ? 22 : 15; }
    }
    line("Ancora Corretora | Cotacao", true);
    line(`${result.operator} | ${result.name}`, true);
    line(`Consulta: ${date} | Municipio: ${parsed.profile.city}`);
    line(`Acomodacao: ${result.accommodation} | ${result.coparticipation} | ${result.coverage}`);
    line(`Administradora: ${result.administrator || "Direto"} | Entidade: ${result.entity || "Nao informada"}`);
    line(`Valor mensal total: R$ ${(result.totalCents / 100).toFixed(2).replace(".", ",")}`, true);
    result.perLife.forEach((l, i) => line(`${l.holder ? "Titular" : `Dependente ${i}`} | ${l.age} anos | R$ ${(l.cents / 100).toFixed(2).replace(".", ",")}`));
    line(`Referencia imutavel: ${id}`);
    line(`Lote: ${config.release}`);
    line("Condicoes comerciais revisadas para o perfil informado. A contratacao depende da documentacao e aceitacao da operadora.");
    for (const condition of exportable) { line(condition.titulo || condition.tipo_detalhe || "Condicao", true); line(condition.conteudo || condition.descricao || condition.resumo || ""); if (condition.fonte) line(`Fonte: ${condition.fonte}`); }
    const pdfBuffer = Buffer.from(await pdf.save());
    // Re-read the kill switch after rendering; a concurrent review revocation
    // or release replacement must not create an export from stale approval.
    const latest = await requirePilot();
    if (latest.config.release !== config.release || latest.config.indexHash !== config.indexHash || !latest.config.reviewedPlanIds.includes(plan.id) || latest.config.hiddenPlanIds.includes(plan.id)) return { error: "A liberação deste produto mudou. Consulte os planos novamente." };
    const snapshotKey = `quote-catalog-proposals/${context.tenantId}/${context.userId}/${id}.json`;
    await auditPilot(context.userId, context.tenantId, "quote_catalog.proposal_export_requested", { id, planId: plan.id, release: config.release, sha256 });
    await uploadR2Object(snapshotKey, snapshotBuffer, "application/json");
    await auditPilot(context.userId, context.tenantId, "quote_catalog.proposal_exported", { id, planId: plan.id, release: config.release, sha256, totalCents: result.totalCents, lives: result.perLife.length });
    return { data: { base64: pdfBuffer.toString("base64"), filename: `cotacao-${id}.pdf` } };
  } catch (error) { return { error: error instanceof z.ZodError ? "Confira o perfil e o plano selecionados." : "Não foi possível gerar a proposta. Tente novamente." }; }
}
