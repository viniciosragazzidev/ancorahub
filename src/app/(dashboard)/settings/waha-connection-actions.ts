"use server";


import { changeOwnWahaConnection, createOwnWahaConnection, refreshOwnWahaConnection, updateOwnWahaCapabilities } from "@/features/waha-cadence/connection-service";

function done() {
}

export async function createWahaConnectionAction(formData: FormData) {
  try {
    const result = await createOwnWahaConnection({ label: String(formData.get("label") ?? "") });
    done();
    return { success: true as const, result };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Não foi possível iniciar a conexão." };
  }
}

export async function refreshWahaConnectionAction(id: string) {
  try { const result = await refreshOwnWahaConnection(id); done(); return { success: true as const, result }; }
  catch (error) { return { success: false as const, error: error instanceof Error ? error.message : "Não foi possível atualizar a conexão." }; }
}

export async function changeWahaConnectionAction(id: string, operation: "pause" | "resume" | "disconnect") {
  try { const result = await changeOwnWahaConnection(id, operation); done(); return { success: true as const, result }; }
  catch (error) { return { success: false as const, error: error instanceof Error ? error.message : "Não foi possível alterar a conexão." }; }
}

export async function updateWahaCapabilitiesAction(id: string, formData: FormData) {
  try {
    const capabilities = await updateOwnWahaCapabilities(id, { inbound: formData.get("inbound") === "true", cadence: formData.get("cadence") === "true", ai: formData.get("ai") === "true" });
    done();
    return { success: true as const, capabilities };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Não foi possível atualizar as funções." };
  }
}
