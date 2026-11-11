"use client";

import { QuotePaused } from "@/features/broker-workspace/chat/quote-paused";
import { CotacaoLiteWorkspace } from "./cotacao-lite-workspace";
import type { PlanDetail, QuoteResponse, QuoteResult } from "../contracts";
import type { NetworkPage } from "./cotacao-lite-detalhe";

/** Dados falsos para a prévia: operadoras e planos inventados, sem relação com a base real. */
function plano(id: string, name: string, totalCents: number, state: QuoteResult["state"], reasons: string[], extra: Partial<QuoteResult> = {}): QuoteResult {
  return {
    id, name, code: id.slice(0, 6), operator: "Operadora Exemplo A", operatorId: "op-exemplo-a", administrator: "",
    modality: "PESSOA_FISICA", accommodation: "Enfermaria", coparticipation: "Sem coparticipação", coverage: "Nacional",
    entity: "", dental: null, minAge: null, maxAge: null, holderMin: null, holderMax: null, dependentMin: null,
    dependentMax: null, minLives: null, maxLives: null, minHolders: null, ageConfirmed: true, eligibilityConfirmed: true,
    businessConfirmed: true, from: null, to: null, networkCount: 120, detailCount: 4,
    totalCents, perLife: [{ age: 35, holder: true, priceId: "p1", cents: totalCents, from: null, to: null }],
    state, reasons, ...extra,
  };
}

const RESULTADOS: QuoteResult[] = [
  plano("11111111-1111-4111-8111-111111111111", "Plano Exemplo Essencial", 38990, "ready", [], { accommodation: "Apartamento", dental: true, networkCount: 180 }),
  plano("22222222-2222-4222-8222-222222222222", "Plano Exemplo Plus", 52410, "pending", ["Idade limite não confirmada.", "Vínculo de empresa a comprovar."], { accommodation: "Apartamento", coparticipation: "Parcial", networkCount: 95 }),
  plano("33333333-3333-4333-8333-333333333333", "Plano Exemplo Master", 79900, "incompatible", ["Modalidade não atende ao perfil."], { accommodation: "Apartamento", coparticipation: "Total", coverage: "Regional", networkCount: 60 }),
];

const FIXTURE_OK: QuoteResponse = {
  results: RESULTADOS, total: RESULTADOS.length, page: 1, pages: 2, compatible: 1, pending: 1, incompatible: 1,
  release: "previa", date: "2026-11-11",
};

const FIXTURE_VAZIO: QuoteResponse = { results: [], total: 0, page: 1, pages: 1, compatible: 0, pending: 0, incompatible: 0, release: "previa", date: "2026-11-11" };

const CONDICOES: PlanDetail = {
  plan: {},
  details: [
    { id: "c1", titulo: "Carências", conteudo: "Consultas e exames simples: 30 dias. Internação, parto e urgências: 180 dias. Valores de exemplo.", ativo: true, vigencia_inicio: "2026-01-01" },
    { id: "c2", titulo: "Reembolso", conteudo: "Reembolso de consultas em rede não credenciada, mediante nota fiscal. Dados fictícios.", ativo: true, vigencia_inicio: "2026-01-01" },
    { id: "c3", titulo: "Documentação exigida", conteudo: "Documento com foto, comprovante de endereço e declaração de saúde. Dados fictícios.", ativo: true, vigencia_inicio: "2026-01-01" },
  ],
};

const REDE: NetworkPage = {
  units: [
    { id: "u1", nome: "Hospital Exemplo Central", tipo: "Hospital", cidade: "São Paulo", bairro: "Centro", endereco: "Rua Exemplo, 100", cep: "00000-000", telefone: "(11) 0000-0000" },
    { id: "u2", nome: "Clínica Exemplo Norte", tipo: "Clínica", cidade: "São Paulo", bairro: "Norte", endereco: "Avenida Exemplo, 200", telefone: "(11) 0000-0001" },
  ],
  total: 2, overall: 120, page: 1, pages: 1, cities: ["São Paulo", "Rio de Janeiro"],
};

const OPCOES = {
  cities: ["Rio de Janeiro", "São Paulo", "Belo Horizonte"],
  businessProfiles: ["ME", "EPP", "TODOS_CNPJS"],
  entities: ["Sindicato Exemplo A", "Associação Exemplo B"],
};

export function CotacaoLitePreview({ estado }: { estado: string }) {
  if (estado === "pausado") {
    return (
      <main className="min-h-dvh bg-background">
        <QuotePaused />
      </main>
    );
  }
  return (
    <main className="min-h-dvh bg-background">
      <CotacaoLiteWorkspace
        options={OPCOES}
        counts={{ plans: 1250 }}
        sourceDate="2026-11-01"
        cidadesPopulares={["São Paulo", "Rio de Janeiro", "Belo Horizonte"]}
        simular={async () => {
          await new Promise(resolve => setTimeout(resolve, 400));
          if (estado === "erro") return { error: "Não foi possível consultar os planos. Confira se o acesso está liberado e tente novamente." };
          return { data: estado === "vazio" ? FIXTURE_VAZIO : FIXTURE_OK };
        }}
        carregarPlano={async () => {
          await new Promise(resolve => setTimeout(resolve, 300));
          return { data: CONDICOES };
        }}
        carregarRede={async () => {
          await new Promise(resolve => setTimeout(resolve, 300));
          return { data: REDE };
        }}
        exportarProposta={async () => ({ ok: true })}
      />
    </main>
  );
}
