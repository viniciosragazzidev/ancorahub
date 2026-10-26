export type GestaoAccess = "off" | "render" | "supervisor" | "director" | "denied";

/**
 * Decisão da rota /gestao. Flag desligada = a rota não existe (notFound).
 * Gestor Lite vê a visão; supervisor Lite vai para /equipe/minha (o G2 cuida dele depois); o resto segue sem acesso.
 */
export function resolveGestaoAccess(input: { flagOn: boolean; role: string; audience: "broker" | "supervisor" | "manager" | null; directorLite?: boolean }): GestaoAccess {
  if (!input.flagOn) return "off";
  // Diretor com o visual Lite ligado escolhe a unidade e vê a gestão dela (decisão de 25/10). Sem a chave, segue sem acesso.
  if (input.role === "director" && input.directorLite) return "director";
  if (input.role === "manager" && input.audience === "manager") return "render";
  if (input.role === "supervisor" && input.audience === "supervisor") return "supervisor";
  return "denied";
}
