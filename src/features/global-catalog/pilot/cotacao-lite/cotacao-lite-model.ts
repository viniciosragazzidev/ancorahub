import type { QuoteInput, QuoteResult } from "../contracts";

/**
 * Regras da cotação no Lite: passos, validação das vidas, perfil da empresa e da adesão, orçamento
 * e texto das condições pendentes. Sem I/O e sem contrato novo: o que chega ao servidor continua
 * sendo QuoteInput, com os mesmos campos que o engine já lê.
 */

export const PASSOS = ["modalidade", "cidade", "perfil", "vidas", "refino"] as const;
export type Passo = (typeof PASSOS)[number];

export const ROTULO_PASSO: Record<Passo, string> = {
  modalidade: "Modalidade",
  cidade: "Município",
  perfil: "Perfil",
  vidas: "Vidas",
  refino: "Filtros",
};

/** PME e adesão pedem perfil (empresa ou entidade) antes das vidas; pessoa física não. */
export function temPerfil(modality: QuoteInput["modality"]) {
  return modality.startsWith("PME") || modality.startsWith("ADESAO");
}

/** Lista de passos da modalidade escolhida. Antes da escolha, mostra o caminho mais curto. */
export function passosDaModalidade(modality: QuoteInput["modality"] | null): readonly Passo[] {
  return modality && temPerfil(modality) ? PASSOS : PASSOS.filter((passo) => passo !== "perfil");
}

export type Vida = { key: number; age: string; holder: boolean; relationship: string };

/** Idades preenchidas e um único titular. Retorna a primeira mensagem para o campo, ou null quando está pronto. */
export function validarVidas(vidas: readonly Vida[]): string | null {
  if (vidas.filter((vida) => vida.holder).length !== 1) return "Indique exatamente um titular.";
  const semIdade = vidas.find((vida) => vida.age.trim() === "");
  if (semIdade) return textoIdadeFaltando(semIdade, vidas);
  const invalida = vidas.find((vida) => {
    const idade = Number(vida.age);
    return !Number.isInteger(idade) || idade < 0 || idade > 120;
  });
  if (invalida) return "Confira as idades: informe um número inteiro entre 0 e 120.";
  return null;
}

function textoIdadeFaltando(vida: Vida, vidas: readonly Vida[]) {
  if (vida.holder) return "Informe a idade do titular para calcular os valores.";
  const posicao = vidas.filter((item) => !item.holder).findIndex((item) => item.key === vida.key) + 1;
  return `Informe a idade do dependente ${posicao} para calcular os valores.`;
}

/** PME exige o município de comercialização (mesma regra do contrato). Retorna a mensagem ou null. */
export function validarCidade(modality: QuoteInput["modality"], city: string): string | null {
  return modality.startsWith("PME") && city.trim() === "" ? "Informe o município de comercialização." : null;
}

export type Perfil = { businessProfile: string; businessMonths: string; profession: string; entity: string };

/**
 * PME: tipo de empresa e tempo de empresa são obrigatórios (sem eles o engine marca o plano como pendente).
 * Adesão: profissão e entidade são opcionais, mas o tempo de empresa não se aplica.
 */
export function validarPerfil(modality: QuoteInput["modality"], perfil: Perfil): string | null {
  if (!modality.startsWith("PME")) return null;
  if (!perfil.businessProfile) return "Escolha o tipo de empresa.";
  const meses = perfil.businessMonths.trim();
  if (meses === "" || !Number.isInteger(Number(meses)) || Number(meses) < 0 || Number(meses) > 2400) {
    return "Informe o tempo de empresa em meses, com um número inteiro entre 0 e 2400.";
  }
  return null;
}

/**
 * Orçamento em reais digitado ("1.500,00", "1500") para centavos. Vazio = sem orçamento (null).
 * Inválido ou zero devolve "invalido" para o campo mostrar a mensagem.
 */
export function orcamentoEmCentavos(texto: string): number | null | "invalido" {
  const bruto = texto.trim();
  if (!bruto) return null;
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(bruto)) return "invalido";
  const [inteiro, centavos = ""] = bruto.replaceAll(".", "").split(",");
  const cents = Number(inteiro) * 100 + Number(centavos.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : "invalido";
}

export function dinheiro(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Texto curto e claro para uma condição pendente (o contrato traz `reasons` em texto técnico). */
export function explicarPendencia(plano: Pick<QuoteResult, "state" | "reasons">): string {
  if (plano.state !== "pending") return "";
  const motivo = plano.reasons[0]?.trim();
  if (!motivo) return "Falta confirmar uma condição deste plano antes de gerar a proposta.";
  return `Falta confirmar: ${motivo.replace(/\.$/, "")}. Confirme com a operadora ou com a sua equipe antes de gerar a proposta.`;
}

/** Todos os motivos do plano, em texto claro, para o detalhe. Sem repetir o primeiro ponto. */
export function motivosDoPlano(plano: Pick<QuoteResult, "state" | "reasons">): string[] {
  return plano.reasons.map((motivo) => motivo.trim().replace(/\.$/, "")).filter(Boolean);
}

/** Pode gerar proposta em PDF? Só planos prontos (condições confirmadas). */
export function podeGerarProposta(plano: Pick<QuoteResult, "state">) {
  return plano.state === "ready";
}

export type EntradaCotacao = {
  modality: QuoteInput["modality"];
  vidas: readonly Vida[];
  city: string;
  perfil: Perfil;
  budget: string;
  query: string;
  includeIncompatible: boolean;
};

/** Monta a entrada do contrato a partir do que a pessoa preencheu. Presume que as validações já passaram. */
export function montarEntrada(entrada: EntradaCotacao, page: number): QuoteInput {
  const orcamento = orcamentoEmCentavos(entrada.budget);
  const pme = entrada.modality.startsWith("PME");
  const adesao = entrada.modality.startsWith("ADESAO");
  return {
    modality: entrada.modality,
    city: entrada.city.trim(),
    lives: entrada.vidas.map((vida) => ({ age: Number(vida.age), holder: vida.holder, relationship: vida.holder ? "Titular" : vida.relationship })),
    operator: "",
    administrator: "",
    profession: adesao ? entrada.perfil.profession.trim() : "",
    entity: adesao ? entrada.perfil.entity : "",
    businessProfile: pme ? entrada.perfil.businessProfile : "",
    businessMonths: pme && entrada.perfil.businessMonths.trim() !== "" ? Number(entrada.perfil.businessMonths) : null,
    accommodation: "",
    coparticipation: "",
    coverage: "",
    dental: "",
    query: entrada.query.trim(),
    budgetCents: typeof orcamento === "number" ? orcamento : null,
    includeIncompatible: entrada.includeIncompatible,
    page,
  };
}
