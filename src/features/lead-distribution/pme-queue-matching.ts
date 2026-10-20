/**
 * Filas reconhecidas pelo nome (não há tipo de fila no banco): "FILA PF",
 * "Fila Premium", "FILA PF - RENAN" são de pessoa física; "Fila PME",
 * "FILA PME - RENAN" são de empresa. Lead empresa numa fila de pessoa física
 * vai para a fila PME correspondente.
 */
const PERSON_TOKENS = new Set(["pf", "premium", "individual", "familiar"]);
const COMPANY_TOKENS = new Set(["pme", "pj", "empresarial", "empresa", "empresas"]);
const KIND_TOKENS = new Set([...PERSON_TOKENS, ...COMPANY_TOKENS, "fila", "plano", "planos", "pessoa", "fisica", "juridica", "de", "do", "da"]);
/** Filas de nome livre que também são de pessoa física (Vinicios, 20/10: lead Nilta Souza na FILA TATIANA). */
const PERSON_QUEUE_NAMES = new Set(["fila tatiana"]);
/** Toda empresa desviada vai para esta fila PME quando ela existe (Vinicios, 20/10). */
const PME_DESTINATION_NAME = "fila pme renan";

function tokens(name: string | null | undefined) {
  return (name ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

export function isPmeQueueName(name: string | null | undefined) {
  return tokens(name).some((token) => COMPANY_TOKENS.has(token));
}

export function isPersonQueueName(name: string | null | undefined) {
  const parts = tokens(name);
  if (parts.some((token) => COMPANY_TOKENS.has(token))) return false;
  const text = parts.join(" ");
  return parts.some((token) => PERSON_TOKENS.has(token)) || /\bpessoa fisica\b/.test(text) || PERSON_QUEUE_NAMES.has(text);
}

/** O que sobra do nome sem as palavras do tipo: "FILA PF - RENAN" → "renan". */
function queueOwnerPart(name: string | null | undefined) {
  return tokens(name).filter((token) => !KIND_TOKENS.has(token)).join(" ");
}

export type QueueCandidate = { id: string; name: string; branchId: string | null };

/**
 * A fila PME que corresponde à fila de pessoa física: a "FILA PME - RENAN" quando existe
 * (decisão de 20/10); sem ela, mesmo "dono" no nome
 * ("FILA PF - RENAN" → "FILA PME - RENAN"), depois a mesma unidade, depois a
 * PME sem dono ("Fila PME"). Null quando a origem não é PF/Premium ou não há PME.
 */
export function pickPmeQueue(source: QueueCandidate, candidates: readonly QueueCandidate[]): QueueCandidate | null {
  if (!isPersonQueueName(source.name)) return null;
  const fixed = candidates.find((queue) => queue.id !== source.id && tokens(queue.name).join(" ") === PME_DESTINATION_NAME);
  if (fixed) return fixed;
  const owner = queueOwnerPart(source.name);
  let best: { queue: QueueCandidate; score: number } | null = null;
  for (const queue of candidates) {
    if (queue.id === source.id || !isPmeQueueName(queue.name)) continue;
    const candidateOwner = queueOwnerPart(queue.name);
    const score = (owner && candidateOwner === owner ? 4 : 0)
      + (queue.branchId === source.branchId ? 2 : 0)
      + (!candidateOwner ? 1 : 0);
    if (!best || score > best.score) best = { queue, score };
  }
  return best?.queue ?? null;
}
