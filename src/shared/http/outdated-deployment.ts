/**
 * Página aberta antes de um deploy chama uma Server Action que não existe mais no servidor.
 * O Next responde `Server Action "<id>" was not found on the server. Read more:
 * https://nextjs.org/docs/messages/failed-to-find-server-action` (com hífens no link) ou, em
 * alguns navegadores, "An unexpected response was received from the server.". 12/11, caso Rogério:
 * o filtro antigo procurava "failed to find server action" com espaços e nunca reconhecia o erro,
 * então o roteiro de presença mostrava a mensagem em inglês em vez de recarregar a página.
 */
const OUTDATED_DEPLOYMENT_PATTERN =
  /failed[- ]to[- ]find[- ]server[- ]action|server action .* was not found on the server|older or newer deployment|version skew|unexpected response was received from the server/i;

export function isOutdatedDeploymentError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return OUTDATED_DEPLOYMENT_PATTERN.test(message);
}

const RELOAD_KEY = "corretop:outdated-deployment-reload";
const RELOAD_GUARD_MS = 30_000;

/**
 * Recarrega a página uma vez. Se já recarregou nos últimos 30 s e o erro voltou, não entra em
 * laço: devolve `false` para a tela pedir que a pessoa feche e abra o app.
 */
export function reloadForNewDeployment(delayMs = 500): boolean {
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < RELOAD_GUARD_MS) return false;
    window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    /* sem armazenamento: recarrega mesmo assim */
  }
  window.setTimeout(() => window.location.reload(), delayMs);
  return true;
}
