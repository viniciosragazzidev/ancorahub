/** "Ver como" constants shared by the proxy (edge) and the server (see view-as.ts). */
export const VIEW_AS_COOKIE = "corretop_view_as";
/** Two hours, then it ends by itself. */
export const VIEW_AS_MAX_AGE_SECONDS = 60 * 60 * 2;
/** Routes that still accept writes while viewing as someone (start, stop and sign out). */
export const VIEW_AS_WRITE_ALLOWED_PREFIXES = ["/api/super-admin/view-as", "/api/auth"] as const;
/** Gestor too since 20/10 (Vinicios: "por que não aparece o Robson"). */
export const VIEW_AS_ROLES = ["broker", "supervisor", "manager"] as const;
export const VIEW_AS_READ_ONLY_MESSAGE = "Você está vendo como outro usuário: só visualização. Volte ao seu acesso para agir.";

/** A write (anything but GET/HEAD/OPTIONS) that "Ver como" must refuse. */
export function isViewAsBlockedWrite(method: string, pathname: string) {
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return false;
  return !VIEW_AS_WRITE_ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
