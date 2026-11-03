/** Identidade estável deste navegador: o mesmo deviceId vai no código de conexão e na troca por sessão. */
export async function obterDeviceId(): Promise<string> {
  const { deviceId } = await chrome.storage.local.get("deviceId");
  if (typeof deviceId === "string" && deviceId) return deviceId;
  const novo = crypto.randomUUID();
  await chrome.storage.local.set({ deviceId: novo });
  return novo;
}
