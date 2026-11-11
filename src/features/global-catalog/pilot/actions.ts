"use server";
import { z } from "zod";
import { quoteInputSchema, type PlanDetail, type NetworkData } from "./contracts";
import { fold, simulate } from "./engine";
import { requirePilot, loadPilotIndex, loadPlanShard, auditPilot } from "./server";

export async function simulateCatalogAction(input: unknown) {
  try {
    const { context, config } = await requirePilot(); const parsed = quoteInputSchema.parse(input); const index = await loadPilotIndex(config);
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const data = simulate(index.plans, parsed, date, new Set(config.reviewedPlanIds), new Set(config.hiddenPlanIds), config.release);
    await auditPilot(context.userId, context.tenantId, "quote_catalog.simulated", { release: config.release, modality: parsed.modality, lives: parsed.lives.length, results: data.total });
    return { data };
  } catch (error) { return { error: error instanceof z.ZodError ? error.issues[0]?.message : "Não foi possível consultar os planos. Confira se o acesso está liberado e tente novamente." }; }
}
export async function getCatalogPlanAction(id: string) {
  try { const parsed = z.string().uuid().parse(id); const { config } = await requirePilot(); return { data: await loadPlanShard(config, "details", parsed) as PlanDetail }; }
  catch { return { error: "Não foi possível consultar as condições deste plano." }; }
}
const networkInput = z.object({ id: z.string().uuid(), query: z.string().max(120).default(""), city: z.string().max(120).default(""), type: z.string().max(80).default(""), specialty: z.string().max(120).default(""), page: z.number().int().min(1).max(10000).default(1) });
export async function getCatalogNetworkAction(input: unknown) {
  try {
    const parsed = networkInput.parse(input); const { config } = await requirePilot(); const raw = await loadPlanShard(config, "network", parsed.id) as NetworkData;
    const all = raw.unidades;
    const filtered = all.filter(u => (!parsed.city || fold(u.cidade ?? "") === fold(parsed.city)) && (!parsed.type || fold(u.tipo ?? "") === fold(parsed.type)) && (!parsed.specialty || fold(JSON.stringify([u.especialidades, u.grupos_servico, u.servicos_inclusos])).includes(fold(parsed.specialty))) && (!parsed.query || fold([u.nome, u.bairro, u.endereco, u.cidade, u.cep].join(" ")).includes(fold(parsed.query))));
    const pages = Math.max(1, Math.ceil(filtered.length / 40)); const page = Math.min(parsed.page, pages);
    return { data: { units: filtered.slice((page - 1) * 40, page * 40), total: filtered.length, overall: all.length, page, pages, cities: [...new Set(all.map(u => u.cidade).filter((v): v is string => Boolean(v)))].sort(), types: [...new Set(all.map(u => u.tipo).filter((v): v is string => Boolean(v)))].sort(), competence: raw.competencia, checkedAt: raw.ultima_conferencia, level: raw.nivel_detalhe, sources: raw.fontes } };
  } catch { return { error: "Não foi possível consultar a rede. Tente novamente." }; }
}
