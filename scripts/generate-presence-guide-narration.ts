/**
 * Gera a narração de cada etapa do roteiro guiado de presença (10/11) com a CLI da ElevenLabs:
 *   npx tsx scripts/generate-presence-guide-narration.ts            (só as que ainda não existem)
 *   npx tsx scripts/generate-presence-guide-narration.ts --all      (todas de novo)
 *   npx tsx scripts/generate-presence-guide-narration.ts toque-2    (só uma)
 * Precisa da CLI `elevenlabs` instalada e logada. Voz Liam (TX3LPaxmHKxFdv7VOQHJ), eleven_multilingual_v2, pt.
 * Saída: public/onboarding/narracao/presenca/{chave}.mp3. Os textos ficam em PRESENCE_GUIDE_NARRATION.
 */
import { execFileSync, execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { PRESENCE_GUIDE_NARRATION } from "../src/features/waha-cadence/pairing-copy";

const OUT = join("public", "onboarding", "narracao", "presenca");
// No Windows o `elevenlabs` do npm é um .cmd (precisa de shell, que estraga as aspas do JSON): chama o .exe direto.
const BIN = process.env.ELEVENLABS_BIN ?? (process.platform === "win32"
  ? join(execSync("npm root -g").toString().trim(), "@elevenlabs", "cli", "node_modules", "@elevenlabs", "cli-win32-x64", "elevenlabs.exe")
  : "elevenlabs");
const VOICE = "TX3LPaxmHKxFdv7VOQHJ";
const args = process.argv.slice(2);
const all = args.includes("--all");
const only = args.filter((arg) => !arg.startsWith("--"));

mkdirSync(OUT, { recursive: true });
for (const [key, text] of Object.entries(PRESENCE_GUIDE_NARRATION)) {
  const file = join(OUT, `${key}.mp3`);
  if (only.length && !only.includes(key)) continue;
  if (!all && !only.length && existsSync(file)) continue;
  const params = JSON.stringify({ voice_id: VOICE, model_id: "eleven_multilingual_v2", language_code: "pt", output_format: "mp3_44100_128", text });
  execFileSync(BIN, ["text-to-speech", "convert", "--params", params, "-o", file, "-q"], { stdio: "inherit" });
  console.log(`ok ${key}`);
}
