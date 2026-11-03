import "server-only";

import { downloadR2Object, uploadR2Object } from "@/shared/storage/r2-storage";

import { logoPublicPath, logoStorageKey, parseLogoDataUrl, parseLogoPublicPath } from "./logo-file";

/** Sobe a logo (data URL já validada) para o R2 e devolve o endereço curto que vai em `tenants.logo_url`. */
export async function storeTenantLogo(tenantId: string, dataUrl: string): Promise<string> {
  const parsed = parseLogoDataUrl(dataUrl);
  if (!parsed) throw new Error("Imagem inválida.");
  const fileName = `${parsed.hash}.${parsed.extension}`;
  await uploadR2Object(logoStorageKey(tenantId, fileName), parsed.bytes, parsed.contentType);
  return logoPublicPath(tenantId, fileName);
}

/** The bytes of a logo stored by storeTenantLogo (PDF reports run on the server and cannot fetch a relative path). */
export async function readStoredTenantLogo(logoUrl: string): Promise<Uint8Array | null> {
  const stored = parseLogoPublicPath(logoUrl);
  if (!stored) return null;
  const blob = await downloadR2Object(logoStorageKey(stored.tenantId, stored.fileName)).catch(() => null);
  return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
}
