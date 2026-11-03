/**
 * Depois da rotação do token, o anterior segue aceito por uma janela curta: requisições que já saíram com ele
 * (inclusive a resposta que o worker ainda não recebeu) não viram 401. A janela não estende expiresAt, e a
 * sessão continua valendo só se estiver ativa (revogação e ociosidade valem na mesma hora).
 * Por processo, como os limites de rate limit: um segundo processo não enxerga a janela.
 */
export const ROTATION_GRACE_MS = 60_000;

export function createPreviousTokenWindow(graceMs = ROTATION_GRACE_MS) {
  const anteriores = new Map<string, { sessionId: string; ateMs: number }>();
  return {
    /** Guarda o hash do token que acabou de ser trocado, com o id da sessão dona dele. */
    registrar(tokenHashAnterior: string, sessionId: string, agoraMs: number) {
      for (const [hash, item] of anteriores) if (item.ateMs <= agoraMs) anteriores.delete(hash);
      anteriores.set(tokenHashAnterior, { sessionId, ateMs: agoraMs + graceMs });
    },
    /** Id da sessão, se o hash é um token trocado há menos de graceMs. */
    sessaoDoTokenAnterior(tokenHash: string, agoraMs: number): string | null {
      const item = anteriores.get(tokenHash);
      if (!item) return null;
      if (item.ateMs <= agoraMs) {
        anteriores.delete(tokenHash);
        return null;
      }
      return item.sessionId;
    },
  };
}

export const janelaTokenAnterior = createPreviousTokenWindow();
