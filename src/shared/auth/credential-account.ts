export const CREDENTIAL_PROVIDER_ID = "credential" as const;
export const CREDENTIAL_ACCOUNT_ISSUER = "local:credential" as const;

type CredentialAccountInput = {
  id: string;
  userId: string;
  password: string;
};

export function buildCredentialAccount(input: CredentialAccountInput) {
  return {
    id: input.id,
    userId: input.userId,
    providerId: CREDENTIAL_PROVIDER_ID,
    accountId: input.userId,
    password: input.password,
    issuer: CREDENTIAL_ACCOUNT_ISSUER,
  };
}

export function buildCredentialAccountPasswordUpdate(userId: string, password: string) {
  return {
    accountId: userId,
    issuer: CREDENTIAL_ACCOUNT_ISSUER,
    password,
    updatedAt: new Date(),
  };
}
