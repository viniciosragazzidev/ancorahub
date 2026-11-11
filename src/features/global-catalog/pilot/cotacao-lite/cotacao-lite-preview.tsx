"use client";

import { CotacaoLiteWorkspace } from "./cotacao-lite-workspace";
import type { QuoteResponse, QuoteResult } from "../contracts";

/** Dados falsos para a prévia: operadoras e planos inventados, sem relação com a base real. */
function plano(id: string, name: string, totalCents: number, state: QuoteResult["state"], reasons: string[]): QuoteResult {
  return {
    id, name, code: id.slice(0, 6), operator: "Operadora Exemplo A", operatorId: "op-exemplo-a", administrator: "",
    modality: "PESSOA_FISICA", accommodation: "Enfermaria", coparticipation: "Sem coparticipação", coverage: "Nacional",
    entity: "", dental: null, minAge: null, maxAge: null, holderMin: null, holderMax: null, dependentMin: null,
    dependentMax: null, minLives: null, maxLives: null, minHolders: null, ageConfirmed: true, eligibilityConfirmed: true,
    businessConfirmed: true, from: null, to: null, networkCount: 120, detailCount: 4,
    totalCents, perLife: [{ age: 35, holder: true, priceId: "p1", cents: totalCents, from: null, to: null }],
    state, reasons,
  };
}

const RESULTADOS: QuoteResult[] = [
  plano("11111111-1111-4111-8111-111111111111", "Plano Exemplo Essencial", 38990, "ready", []),
  plano("22222222-2222-4222-8222-222222222222", "Plano Exemplo Plus", 52410, "pending", ["Idade limite não confirmada."]),
  plano("33333333-3333-4333-8333-333333333333", "Plano Exemplo Master", 79900, "incompatible", ["Modalidade não atende ao perfil."]),
];

const FIXTURE_OK: QuoteResponse = {
  results: RESULTADOS, total: RESULTADOS.length, page: 1, pages: 1, compatible: 1, pending: 1, incompatible: 1,
  release: "previa", date: "2026-11-11",
};

const FIXTURE_VAZIO: QuoteResponse = { results: [], total: 0, page: 1, pages: 1, compatible: 0, pending: 0, incompatible: 0, release: "previa", date: "2026-11-11" };

const OPCOES = { cities: ["Rio de Janeiro", "São Paulo", "Belo Horizonte"] };

export function CotacaoLitePreview({ estado }: { estado: string }) {
  const simular = async () => {
    await new Promise(resolve => setTimeout(resolve, 400));
    if (estado === "erro") return { error: "Não foi possível consultar os planos. Confira se o acesso está liberado e tente novamente." };
    return { data: estado === "vazio" ? FIXTURE_VAZIO : FIXTURE_OK };
  };
  return (
    <main className="min-h-dvh bg-background">
      <CotacaoLiteWorkspace
        options={OPCOES}
        counts={{ plans: 1250 }}
        sourceDate="2026-11-01"
        simular={simular}
        onGerarProposta={() => undefined}
      />
    </main>
  );
}
