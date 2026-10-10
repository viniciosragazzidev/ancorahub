/**
 * Writes the voice-over script of the broker app tour from the steps in code:
 *   npx tsx scripts/generate-tour-narration.ts
 * Output: docs/onboarding/narracao-tour-lite.md (one block per step, with the
 * file name the audio must have in public/onboarding/narracao/).
 */
import { writeFileSync } from "node:fs";

import { TOUR_STEPS } from "../src/components/chat/tour/tour-steps";

const lines: string[] = [
  "# Roteiro de narração: tour do app do corretor (modo Lite)",
  "",
  "Gerado de `src/components/chat/tour/tour-steps.ts` com `npx tsx scripts/generate-tour-narration.ts`. Não edite à mão: mude os passos no código e gere de novo.",
  "",
  "## Como usar",
  "1. Grave (ou gere com a ferramenta de voz) um áudio por passo, com o texto de **Narração**.",
  "2. Salve cada um como **MP3** com o nome indicado em `public/onboarding/narracao/` (ex.: `00-apresentacao.mp3`).",
  "3. Pronto: o tour toca o áudio sozinho ao entrar no passo. Sem o arquivo, o passo segue em silêncio. O corretor pode silenciar pelo botão de som.",
  "",
  "Dica de voz: tom de colega, animado e calmo, 150 a 165 palavras por minuto; cada áudio com no máximo uns 20 segundos.",
  "",
];
for (const step of TOUR_STEPS) {
  const words = step.narration.split(/\s+/).length;
  lines.push(`## ${step.id}.mp3 · ${step.title}`);
  lines.push("");
  lines.push(`- Tipo: ${step.kind}${step.target ? ` · destaque: \`${step.target}\`` : ""} · ${step.xp} XP`);
  lines.push(`- Texto na tela: ${step.body}`);
  lines.push(`- Duração estimada: ${Math.max(4, Math.round((words / 160) * 60))}s (${words} palavras)`);
  lines.push("");
  lines.push("**Narração:**");
  lines.push("");
  lines.push(`> ${step.narration}`);
  lines.push("");
}
writeFileSync("docs/onboarding/narracao-tour-lite.md", `${lines.join("\n")}\n`);
console.log(`ok: ${TOUR_STEPS.length} passos`);
