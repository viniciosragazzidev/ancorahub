/**
 * Unified Toast System — Single entry point for all toast notifications.
 *
 * Usage:
 *   import { toast } from "@/lib/toast";
 *
 *   toast.success("Lead salvo com sucesso.");
 *   toast.error("Não foi possível conectar.");
 *   toast.warning("Atenção: ação irreversível.");
 *   toast.info("Nova versão disponível.");
 *   toast.loading("Processando...");
 *
 * Presets for recurring scenarios:
 *   toast.leadAssigned("João Silva");
 *   toast.actionCompleted("Lead deletado");
 *   toast.syncError("Falha na sincronização");
 *   toast.permissionDenied();
 */

import { toast as baseToast } from "@/components/ui/sonner";

type ToastOptions = Parameters<typeof baseToast>[1];

/** Re-export the base toast with additional preset methods */
export const toast = Object.assign(
  (message: string, options?: ToastOptions) => baseToast(message, options),
  {
    success: baseToast.success,
    error: baseToast.error,
    warning: baseToast.warning,
    info: baseToast.info,
    loading: baseToast.loading,
    message: baseToast.message,
    dismiss: baseToast.dismiss,

    // ─── Presets ──────────────────────────────────────────────────────

    /** Lead was assigned to a broker */
    leadAssigned: (leadName: string) =>
      baseToast.success(`Lead "${leadName}" atribuído com sucesso.`),

    /** Generic action completed successfully */
    actionCompleted: (actionDescription: string) =>
      baseToast.success(actionDescription),

    /** Sync/realtime error */
    syncError: (detail?: string) =>
      baseToast.error(detail ?? "Falha na sincronização. Tente novamente.", {
        duration: 8000,
      }),

    /** Permission denied — user tried something they can't do */
    permissionDenied: () =>
      baseToast.warning("Você não tem permissão para executar essa ação."),

    /** Save failed */
    saveFailed: (entity?: string) =>
      baseToast.error(
        entity
          ? `Não foi possível salvar ${entity}. Tente novamente.`
          : "Não foi possível salvar. Tente novamente.",
        { duration: 8000 },
      ),

    /** Connection issue */
    connectionError: (service?: string) =>
      baseToast.error(
        service
          ? `Falha na conexão com ${service}.`
          : "Falha na conexão. Verifique sua internet.",
        { duration: 8000 },
      ),
  },
);

export type { ToastT } from "sonner";
