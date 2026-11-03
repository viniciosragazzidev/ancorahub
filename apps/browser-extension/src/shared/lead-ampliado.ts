import type { EstadoGaveta, LeadAmpliado, Temperatura } from "./types";

const TEMPERATURAS: readonly Temperatura[] = ["quente", "morno", "frio", "sem-dados"];

const texto = (valor: unknown) => (typeof valor === "string" && valor.trim() ? valor.trim() : undefined);
const numero = (valor: unknown) => (typeof valor === "number" && Number.isFinite(valor) ? valor : undefined);
const objeto = (valor: unknown) => (valor && typeof valor === "object" ? (valor as Record<string, unknown>) : undefined);

/**
 * Lê o payload do resolve. Campos novos são opcionais: o que não vier fica undefined e a gaveta mostra um traço.
 * Devolve null quando não há identidade mínima (id, versão e nome).
 */
export function leadAmpliadoDe(raw: Record<string, unknown>): LeadAmpliado | null {
  const id = texto(raw.id);
  const name = texto(raw.name);
  if (!id || !name || typeof raw.version !== "number") return null;
  const temperatura = TEMPERATURAS.find((valor) => valor === raw.temperatura);
  const proximo = objeto(raw.nextAction);
  const historico = Array.isArray(raw.historico)
    ? raw.historico.flatMap((item) => {
        const entrada = objeto(item);
        const tipo = texto(entrada?.tipo);
        const data = texto(entrada?.data);
        return tipo && data ? [{ tipo, data }] : [];
      }).slice(0, 5)
    : undefined;
  return {
    id,
    version: raw.version,
    name,
    phoneMasked: texto(raw.phoneMasked) ?? "",
    etapaId: texto(objeto(raw.currentStatus)?.id),
    etapa: texto(objeto(raw.currentStatus)?.label) ?? "Em atendimento",
    unidade: texto(objeto(raw.unit)?.name),
    corretor: texto(objeto(raw.assignedUser)?.name),
    proximoPasso: proximo && texto(proximo.title) ? { titulo: texto(proximo.title)!, prazo: texto(proximo.dueAt) ?? null } : null,
    temperatura,
    plano: texto(raw.plano),
    vidas: numero(raw.vidas),
    valorMensal: numero(raw.valorMensal),
    fila: texto(raw.fila),
    plantao: texto(raw.plantao),
    chegouEm: texto(raw.chegouEm) ?? null,
    historico,
  };
}

/** Converte o resultado do resolve no estado da gaveta. null = não mostrar a gaveta (sem conversa identificada). */
export function estadoDoResolve(resultado: { status: string; lead?: Record<string, unknown> }): EstadoGaveta | null {
  switch (resultado.status) {
    case "FOUND": {
      const lead = resultado.lead ? leadAmpliadoDe(resultado.lead) : null;
      return lead ? { tipo: "lead", lead } : { tipo: "erro" };
    }
    case "NOT_FOUND":
    case "FORBIDDEN":
      return { tipo: "sem-lead" };
    case "SESSION_EXPIRED":
      return { tipo: "sem-conexao" };
    case "OFFLINE":
    case "ERROR":
      return { tipo: "erro" };
    default:
      return null;
  }
}
