import { createBrowserClient } from "@supabase/ssr";

export type SupabaseRealtimeDiagnostic = {
  event: "client_created" | "subscribe_requested" | "subscription_status" | "network_status";
  projectRef: string | null;
  hostname: string | null;
  status?: string;
  errorPresent?: boolean;
};

function getSupabaseProjectIdentity(url: string | undefined) {
  if (!url) return { projectRef: null, hostname: null };

  try {
    const hostname = new URL(url).hostname;
    const projectRef = hostname.endsWith(".supabase.co")
      ? hostname.slice(0, -".supabase.co".length)
      : null;

    return { projectRef, hostname };
  } catch {
    return { projectRef: null, hostname: null };
  }
}

/**
 * Browser-only, opt-in diagnostics for a Realtime incident. It intentionally
 * excludes the key, access token, channel topic and event payload.
 */
export function logSupabaseRealtimeDiagnostic(input: Omit<SupabaseRealtimeDiagnostic, "projectRef" | "hostname">) {
  if (process.env.NEXT_PUBLIC_REALTIME_DIAGNOSTICS !== "true") return;

  const identity = getSupabaseProjectIdentity(process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.info("[supabase-realtime]", { ...identity, ...input });
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required to use Supabase.",
    );
  }

  const client = createBrowserClient(url, publishableKey);
  logSupabaseRealtimeDiagnostic({ event: "client_created" });
  return client;
}
