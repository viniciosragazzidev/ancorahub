const SERVER_BACKED_VIEWS = new Set(["sem-atribuicao"]);

/**
 * Views other than "Sem atribuição" are projections of the leads already
 * present in the current server payload. They must not trigger another RSC
 * render just to switch tabs.
 */
export function leadsViewRequiresServerData(nextView: string, currentView: string | null): boolean {
  return SERVER_BACKED_VIEWS.has(nextView) || SERVER_BACKED_VIEWS.has(currentView ?? "");
}
