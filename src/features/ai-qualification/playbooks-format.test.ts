import { describe, expect, it } from "vitest";

import {
  joinLegacyInstructions,
  PLAYBOOK_METADATA_HEADER,
  resolveInstructionsForSave,
  splitLegacyInstructions,
  stripPlaybooksFromInstructions,
  validPlaybookList,
} from "./playbooks-format";

const PLAYBOOKS = [
  { id: "preco", title: "Pergunta de preço", enabled: true },
  { id: "carencia", title: "Carência", enabled: false },
];
const GUIDELINES = "Seja cordial e objetiva.\nNunca peça CPF no chat.";
/** Exatamente o que o saveTenantPlaybooks antigo gravava. */
const LEGACY = `${GUIDELINES}\n\n${PLAYBOOK_METADATA_HEADER}\n${JSON.stringify(PLAYBOOKS, null, 2)}`;

describe("playbooks fora do texto livre", () => {
  it("lê o formato antigo: texto do diretor de um lado, playbooks do outro", () => {
    const parts = splitLegacyInstructions(LEGACY);
    expect(parts.instructions).toBe(GUIDELINES);
    expect(parts.playbooks).toEqual(PLAYBOOKS);
    expect(parts.hadMarker).toBe(true);
  });

  it("ida e volta com o formato antigo não perde nada", () => {
    const parts = splitLegacyInstructions(LEGACY);
    const rebuilt = joinLegacyInstructions(parts.instructions, parts.playbooks!);
    expect(rebuilt).toBe(LEGACY);
    expect(splitLegacyInstructions(rebuilt)).toEqual(parts);
  });

  it("texto sem marcador continua igual e sem playbooks", () => {
    expect(splitLegacyInstructions(`  ${GUIDELINES}  `)).toEqual({ instructions: GUIDELINES, playbooks: null, hadMarker: false });
    expect(splitLegacyInstructions(null)).toEqual({ instructions: "", playbooks: null, hadMarker: false });
  });

  it("JSON quebrado depois do marcador: o texto sai limpo e os playbooks ficam nos padrões", () => {
    const parts = splitLegacyInstructions(`${GUIDELINES}\n\n${PLAYBOOK_METADATA_HEADER}\n[{"id": "x"`);
    expect(parts).toEqual({ instructions: GUIDELINES, playbooks: null, hadMarker: true });
  });

  it("o campo Diretrizes e o prompt nunca recebem o bloco antigo", () => {
    expect(stripPlaybooksFromInstructions(LEGACY)).toBe(GUIDELINES);
    expect(stripPlaybooksFromInstructions(`${PLAYBOOK_METADATA_HEADER}\n[]`)).toBe("");
  });

  it("só playbooks, sem texto: o formato antigo começa no marcador", () => {
    expect(joinLegacyInstructions("", PLAYBOOKS).startsWith(PLAYBOOK_METADATA_HEADER)).toBe(true);
  });

  it("valida item a item e cai nos padrões quando nada sobra", () => {
    const parse = (item: unknown) => (item && typeof item === "object" && "id" in item ? (item as { id: string }) : null);
    expect(validPlaybookList([{ id: "a" }, 3, null], parse)).toEqual([{ id: "a" }]);
    expect(validPlaybookList([3], parse)).toBeNull();
    expect(validPlaybookList("nada", parse)).toBeNull();
  });
});

describe("salvar o Prompt e comportamento", () => {
  it("com a tabela nova: texto limpo e os playbooks antigos migram uma vez", () => {
    expect(resolveInstructionsForSave({ incoming: "Novo tom", stored: LEGACY, playbooksTableReady: true, tableHasPlaybooks: false }))
      .toEqual({ customInstructions: "Novo tom", migratePlaybooks: PLAYBOOKS });
    expect(resolveInstructionsForSave({ incoming: "Novo tom", stored: LEGACY, playbooksTableReady: true, tableHasPlaybooks: true }))
      .toEqual({ customInstructions: "Novo tom", migratePlaybooks: null });
  });

  it("sem a tabela (migration não aplicada): o bloco antigo volta para o fim e nada se perde", () => {
    const saved = resolveInstructionsForSave({ incoming: "Novo tom", stored: LEGACY, playbooksTableReady: false, tableHasPlaybooks: false });
    expect(saved.migratePlaybooks).toBeNull();
    expect(splitLegacyInstructions(saved.customInstructions)).toEqual({ instructions: "Novo tom", playbooks: PLAYBOOKS, hadMarker: true });
  });

  it("tela antiga que manda o texto cru não duplica o bloco", () => {
    const saved = resolveInstructionsForSave({ incoming: LEGACY, stored: LEGACY, playbooksTableReady: false, tableHasPlaybooks: false });
    expect(saved.customInstructions).toBe(LEGACY);
    expect(saved.customInstructions.split(PLAYBOOK_METADATA_HEADER)).toHaveLength(2);
  });

  it("sem playbooks gravados, o texto passa como veio", () => {
    expect(resolveInstructionsForSave({ incoming: " Só o tom ", stored: "antigo", playbooksTableReady: false, tableHasPlaybooks: false }))
      .toEqual({ customInstructions: "Só o tom", migratePlaybooks: null });
  });
});
