/**
 * Teto diário do Sasá (D9): 150 pedidos e 20 minutos de áudio por corretor, contados no dia de São Paulo.
 * Limpeza (D5): transcrição e resposta apagadas depois de 90 dias. Puro e testável.
 */
export const SASA_DAILY_COMMANDS = 150;
export const SASA_DAILY_AUDIO_SECONDS = 20 * 60;
/** Uma nota de voz do Sasá tem no máximo 60 s; o arquivo, no máximo 2 MB. */
export const SASA_VOICE_MAX_SECONDS = 60;
export const SASA_VOICE_MAX_BYTES = 2 * 1024 * 1024;
export const SASA_RETENTION_DAYS = 90;

const SP_OFFSET_MS = -180 * 60_000;

/** Meia-noite de hoje em São Paulo (fuso fixo -03:00). */
export function spDayStart(now: Date) {
  const shifted = new Date(now.getTime() + SP_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - SP_OFFSET_MS);
}

export function retentionCutoff(now: Date) {
  return new Date(now.getTime() - SASA_RETENTION_DAYS * 86_400_000);
}

export type SasaUsage = { commands: number; audioSeconds: number };

/** null = pode seguir; senão, o texto para o corretor. `audioSeconds` é o áudio que está chegando agora. */
export function sasaLimitMessage(usage: SasaUsage, incoming: { audioSeconds?: number } = {}): string | null {
  if (usage.commands >= SASA_DAILY_COMMANDS) return `Você chegou a ${SASA_DAILY_COMMANDS} pedidos hoje. Amanhã eu volto; até lá, as telas do app continuam funcionando.`;
  if (incoming.audioSeconds !== undefined && usage.audioSeconds + incoming.audioSeconds > SASA_DAILY_AUDIO_SECONDS) {
    return "Você usou os 20 minutos de áudio de hoje. Pode continuar escrevendo para mim.";
  }
  return null;
}
