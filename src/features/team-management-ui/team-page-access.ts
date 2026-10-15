export type TeamPageAccess = "off" | "render" | "denied" | "notFound";

/**
 * Acesso à página /gestao/equipes/[supervisorId].
 * Flag desligada = a rota não existe. Gestor Lite: só equipes da própria unidade. Supervisor Lite: só a própria equipe.
 */
export function resolveTeamPageAccess(input: {
  flagOn: boolean;
  role: string;
  audience: "broker" | "supervisor" | "manager" | null;
  requestedSupervisorId: string;
  viewerUserId: string;
  teamFound: boolean;
  teamInViewerUnit: boolean;
}): TeamPageAccess {
  if (!input.flagOn) return "off";
  if (input.role === "manager" && input.audience === "manager") {
    return input.teamFound && input.teamInViewerUnit ? "render" : "notFound";
  }
  if (input.role === "supervisor" && input.audience === "supervisor") {
    if (input.requestedSupervisorId !== input.viewerUserId) return "notFound";
    return input.teamFound ? "render" : "notFound";
  }
  return "denied";
}
