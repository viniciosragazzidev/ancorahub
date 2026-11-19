export const CALL_ANCORA_MOBILE_SESSION_ENDED_MESSAGE = "Sessão encerrada. Gere um novo QR.";

export function isCallAncoraMobileSessionEndedStatus(status: number) {
  return status === 401 || status === 403;
}
