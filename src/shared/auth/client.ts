import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";

export const authClient = createAuthClient({
  plugins: [twoFactorClient({ twoFactorPage: "/2fa" }), passkeyClient()],
});

export const { signIn, signOut, useSession } = authClient;
