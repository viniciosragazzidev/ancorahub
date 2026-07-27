import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export class DocumentStorageConfigurationError extends Error {
  constructor() {
    super("Armazenamento documental nao configurado. Defina SUPABASE_SERVICE_ROLE_KEY e SUPABASE_DOCUMENTS_BUCKET no servidor.");
    this.name = "DocumentStorageConfigurationError";
  }
}

type DocumentStorage = {
  client: SupabaseClient;
  bucket: string;
};

export function getDocumentStorage(): DocumentStorage {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_DOCUMENTS_BUCKET?.trim() || "documents";

  if (!url || !serviceRoleKey) {
    throw new DocumentStorageConfigurationError();
  }

  return {
    client: createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
    bucket,
  };
}

export async function uploadDocumentObject(
  storageKey: string,
  body: Buffer,
  contentType: string,
) {
  const { client, bucket } = getDocumentStorage();
  const result = await client.storage.from(bucket).upload(storageKey, body, {
    contentType,
    cacheControl: "3600",
    upsert: false,
  });
  if (result.error) throw result.error;
}

export async function downloadDocumentObject(storageKey: string) {
  const { client, bucket } = getDocumentStorage();
  const result = await client.storage.from(bucket).download(storageKey);
  if (result.error) throw result.error;
  return result.data;
}




