/**
 * Formato dos playbooks situacionais, regras puras (26/11/2026).
 *
 * Antes da migration 0241 os playbooks moravam dentro de `custom_instructions`, depois do marcador
 * PLAYBOOK_METADATA_HEADER. Agora vão para `ai_qualification_playbooks` e o campo "Diretrizes" fica só com o texto
 * do diretor. A leitura continua aceitando o formato antigo; sem a tabela, o salvar mantém o formato antigo para
 * nunca perder dado.
 */

export const PLAYBOOK_METADATA_HEADER = "---SITUATIONAL_PLAYBOOKS_JSON---";

export type LegacyInstructionsParts = {
  /** Texto livre do diretor, sem o bloco de playbooks. */
  instructions: string;
  /** Lista crua dos playbooks no formato antigo (ainda sem validar), ou null quando não há bloco legível. */
  playbooks: unknown[] | null;
  /** Havia o marcador no texto (mesmo que o JSON estivesse quebrado). */
  hadMarker: boolean;
};

/** Separa o texto livre do bloco antigo de playbooks. */
export function splitLegacyInstructions(text: string | null | undefined): LegacyInstructionsParts {
  const raw = text ?? "";
  const index = raw.indexOf(PLAYBOOK_METADATA_HEADER);
  if (index === -1) return { instructions: raw.trim(), playbooks: null, hadMarker: false };
  const instructions = raw.substring(0, index).trim();
  const json = raw.substring(index + PLAYBOOK_METADATA_HEADER.length).trim();
  try {
    const parsed = JSON.parse(json);
    return { instructions, playbooks: Array.isArray(parsed) ? parsed : null, hadMarker: true };
  } catch {
    return { instructions, playbooks: null, hadMarker: true };
  }
}

/** Só o texto do diretor: é o que vai para o prompt e para o campo "Diretrizes". */
export function stripPlaybooksFromInstructions(text: string | null | undefined) {
  return splitLegacyInstructions(text).instructions;
}

/** Monta o formato antigo (usado só enquanto a migration 0241 não foi aplicada). */
export function joinLegacyInstructions(instructions: string, playbooks: readonly unknown[]) {
  const clean = stripPlaybooksFromInstructions(instructions);
  const payload = `${PLAYBOOK_METADATA_HEADER}\n${JSON.stringify(playbooks, null, 2)}`;
  return clean ? `${clean}\n\n${payload}` : payload;
}

/**
 * O que gravar em `custom_instructions` ao salvar o "Prompt e comportamento":
 * - o texto que chega sempre perde qualquer bloco antigo (tela velha pode mandar o texto cru);
 * - com a tabela nova, o texto sai limpo e os playbooks antigos migram para ela (só se ela ainda não tem os do tenant);
 * - sem a tabela, o bloco antigo que estava gravado volta para o fim do texto, como antes.
 */
export function resolveInstructionsForSave(input: {
  incoming: string | null | undefined;
  stored: string | null | undefined;
  playbooksTableReady: boolean;
  tableHasPlaybooks: boolean;
}): { customInstructions: string; migratePlaybooks: unknown[] | null } {
  const incoming = stripPlaybooksFromInstructions(input.incoming);
  const stored = splitLegacyInstructions(input.stored);
  if (input.playbooksTableReady) {
    return { customInstructions: incoming, migratePlaybooks: !input.tableHasPlaybooks && stored.playbooks?.length ? stored.playbooks : null };
  }
  if (stored.playbooks?.length) return { customInstructions: joinLegacyInstructions(incoming, stored.playbooks), migratePlaybooks: null };
  return { customInstructions: incoming, migratePlaybooks: null };
}

/** Valida a lista item a item; devolve null quando nada sobra (quem chama usa os padrões). */
export function validPlaybookList<T>(raw: unknown, parse: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(raw) || !raw.length) return null;
  const items = raw.map(parse).filter((item): item is T => item !== null);
  return items.length ? items : null;
}
