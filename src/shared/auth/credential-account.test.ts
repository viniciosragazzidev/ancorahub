import { describe, expect, it } from "vitest";

import {
  buildCredentialAccount,
  buildCredentialAccountPasswordUpdate,
  CREDENTIAL_ACCOUNT_ISSUER,
  CREDENTIAL_PROVIDER_ID,
} from "./credential-account";

describe("credential account contract", () => {
  it("matches the local credential identity required by Better Auth", () => {
    const account = buildCredentialAccount({
      id: "account-1",
      userId: "user-1",
      password: "hashed-password",
    });

    expect(account).toMatchObject({
      providerId: CREDENTIAL_PROVIDER_ID,
      issuer: CREDENTIAL_ACCOUNT_ISSUER,
      accountId: "user-1",
      userId: "user-1",
    });
  });

  it("repairs the Better Auth identity whenever a password is replaced", () => {
    const update = buildCredentialAccountPasswordUpdate("user-1", "new-hash");

    expect(update).toMatchObject({
      accountId: "user-1",
      issuer: CREDENTIAL_ACCOUNT_ISSUER,
      password: "new-hash",
    });
  });
});
