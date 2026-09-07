export type MetaCloudChannelActivationState = {
  phoneNumberId: string | null;
  registrationStatus: string | null | undefined;
  hasCredentials: boolean;
};

export function getMetaCloudChannelActivationError(
  channel: MetaCloudChannelActivationState,
): string | null {
  if (!channel.phoneNumberId || !channel.hasCredentials) {
    return "Este canal foi desconectado. Reconecte o número pela Meta para restaurar a autorização.";
  }
  if (channel.registrationStatus !== "registered") {
    return "O número oficial ainda não concluiu o registro na Cloud API.";
  }
  return null;
}
