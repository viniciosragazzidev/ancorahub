import type { WahaUiStatus } from "./status";

/**
 * Fases visíveis do pareamento do WhatsApp do corretor (modo Lite).
 *
 * O WAHA só expõe STOPPED/STARTING/SCAN_QR_CODE/WORKING/FAILED; a interface
 * precisa de mais nuance para dar feedback correto:
 *
 * - `idle`     — sem sessão; nada em andamento.
 * - `starting` — sessão subindo ou QR ainda sendo gerado.
 * - `qr`       — QR válido na tela, aguardando o celular.
 * - `pairing`  — o QR já foi exibido e o WAHA saiu de SCAN_QR_CODE: o celular
 *                leu o código e o WhatsApp está finalizando o vínculo.
 * - `ready`    — conectado.
 * - `error`    — falha (QR expirado 6x, autenticação recusada etc.).
 */
export type PairingPhase = "idle" | "starting" | "qr" | "pairing" | "ready" | "error";

export type PairingPhaseInput = {
  status: WahaUiStatus | "recovering" | (string & {});
  /** Status bruto do WAHA, quando o Fastify informa. */
  providerStatus?: string | null;
  hasQr: boolean;
  /** Um QR já foi exibido nesta tentativa de conexão. */
  sawQr: boolean;
};

export function derivePairingPhase(input: PairingPhaseInput): PairingPhase {
  const provider = (input.providerStatus ?? "").toUpperCase();

  if (input.status === "ready") return "ready";
  if (input.status === "error") return "error";
  if (input.status === "recovering") return "starting";

  if (provider === "SCAN_QR_CODE") return input.hasQr ? "qr" : "starting";

  if (input.status === "initializing") {
    // Fastify antigo (sem providerStatus): a presença do QR é o único sinal.
    if (!provider && input.hasQr) return "qr";
    // Saiu de SCAN_QR_CODE depois de ter mostrado QR = celular leu o código.
    return input.sawQr ? "pairing" : "starting";
  }

  return "idle";
}

/**
 * Janelas de expiração do QR no WAHA: o primeiro vale 60s e os seguintes 20s
 * (até 6 tentativas, quando a sessão vira FAILED).
 */
export const FIRST_QR_LIFETIME_SECONDS = 60;
export const ROTATED_QR_LIFETIME_SECONDS = 20;

/** Pareamento parado além disto (pós-scan) merece um aviso e a opção de recomeçar. */
export const PAIRING_STALL_SECONDS = 90;
