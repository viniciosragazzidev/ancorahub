"use server";

import { z } from "zod";

import { quoteInputSchema, type NetworkData, type PlanDetail } from "@/features/global-catalog/pilot/contracts";
import { fold, simulate } from "@/features/global-catalog/pilot/engine";
import { loadPilotIndex, loadPlanShard, readPilotConfig } from "@/features/global-catalog/pilot/server";

/** Dev-only: as ações da cotação sem a checagem de usuário do piloto, para ver a tela com o catálogo real. */
async function devConfig() {
  if (process.env.NODE_ENV !== "development") throw new Error("Somente em desenvolvimento.");
  const config = await readPilotConfig();
  if (!config) throw new Error("Catálogo não configurado.");
  return config;
}

export async function devSimulate(input: unknown) {
  try {
    const config = await devConfig();
    const index = await loadPilotIndex(config);
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    return { data: simulate(index.plans, quoteInputSchema.parse(input), date, new Set(config.reviewedPlanIds), new Set(config.hiddenPlanIds), config.release) };
  } catch (error) { return { error: error instanceof z.ZodError ? error.issues[0]?.message : "Não foi possível consultar os planos." }; }
}

export async function devPlan(id: string) {
  try { return { data: await loadPlanShard(await devConfig(), "details", id) as PlanDetail }; } catch { return { error: "Não foi possível consultar as condições deste plano." }; }
}

export async function devNetwork(input: { id: string; query?: string; city?: string; type?: string; page?: number }) {
  try {
    const raw = await loadPlanShard(await devConfig(), "network", input.id) as NetworkData;
    const all = raw.unidades;
    const filtered = all.filter(u => (!input.city || fold(u.cidade ?? "") === fold(input.city)) && (!input.type || fold(u.tipo ?? "") === fold(input.type)) && (!input.query || fold([u.nome, u.bairro, u.endereco, u.cidade].join(" ")).includes(fold(input.query))));
    const pages = Math.max(1, Math.ceil(filtered.length / 40)); const page = Math.min(input.page ?? 1, pages);
    return { data: { units: filtered.slice((page - 1) * 40, page * 40), total: filtered.length, overall: all.length, page, pages, cities: [...new Set(all.map(u => u.cidade).filter((v): v is string => Boolean(v)))].sort(), types: [...new Set(all.map(u => u.tipo).filter((v): v is string => Boolean(v)))].sort() } };
  } catch { return { error: "Não foi possível consultar a rede." }; }
}
