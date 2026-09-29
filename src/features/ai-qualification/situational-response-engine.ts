import {
  getDefaultPlaybooks,
  interpolatePlaybookVariables,
  type InterpolationVariables,
} from "./situations-catalog";
import type { SituationalPlaybookItem } from "@/shared/domain-root/situational-playbooks-root";

export interface BuildSituationalPromptSectionInput {
  playbooks?: SituationalPlaybookItem[] | null;
  variables: InterpolationVariables;
}

/**
 * Constrói a seção de Roteiros Situacionais e Respostas Polidas
 * para ser injetada no System Prompt do AI Agent.
 */
export function buildSituationalPromptSection(
  input: BuildSituationalPromptSectionInput,
): string {
  const playbooks = (input.playbooks && input.playbooks.length > 0)
    ? input.playbooks.filter((p) => p.enabled)
    : getDefaultPlaybooks().filter((p) => p.enabled);

  if (playbooks.length === 0) return "";

  const formattedPlaybooks = playbooks.map((p, idx) => {
    const interpolated = interpolatePlaybookVariables(p.recommendedResponse, input.variables);
    return `### SITUAÇÃO ${idx + 1}: ${p.title.toUpperCase()}
- Gatilho: ${p.triggerCondition}
- Exemplo do Cliente: "${p.exampleCustomerInput}"
- Resposta Polida de Referência: "${interpolated}"`;
  }).join("\n\n");

  return `═══════════════════════════════════════════════
DIRETRIZES DE ATENDIMENTO SITUACIONAL & POLIDEZ
═══════════════════════════════════════════════

Você DEVE agir de forma empática, acolhedora e natural no WhatsApp.
NUNCA faça perguntas secas, brutas ou isoladas como "Qual seu nome?" ou "Quantas vidas?" sem antes cumprimentar, apresentar a corretora ou demonstrar interesse genuíno.

Abaixo estão os modelos de resposta e conduta para cada situação comercial:

${formattedPlaybooks}

REGRA DE ADAPTAÇÃO COM MEMÓRIA:
- Se o cliente já informou dados na mensagem (ex: nome, idades, vidas, operadora ou cidade), JAMAIS pergunte esses mesmos dados novamente.
- Agradeça a informação fornecida e passe para o próximo passo de forma fluida.`;
}

/**
 * Identifica se a mensagem do cliente corresponde prioritariamente a alguma situação catalogada.
 */
export function matchBestPlaybook(
  messageText: string,
  playbooks: SituationalPlaybookItem[],
): SituationalPlaybookItem | null {
  const normalized = messageText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  for (const playbook of playbooks) {
    if (!playbook.enabled) continue;
    for (const keyword of playbook.keywords) {
      const normKeyword = keyword.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (normalized.includes(normKeyword)) {
        return playbook;
      }
    }
  }

  return null;
}
