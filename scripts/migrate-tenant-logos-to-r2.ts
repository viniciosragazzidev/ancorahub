/**
 * Move as logos de empresa em base64 de `tenants.logo_url` para o R2 (03/11, Egress do Supabase).
 * O layout lê a linha da empresa em toda navegação e recarga; com a logo no R2, a coluna guarda só o endereço curto.
 *
 * Simulação (padrão, não grava nada):
 *   npx tsx --conditions=react-server scripts/migrate-tenant-logos-to-r2.ts
 * Aplicar:
 *   npx tsx --conditions=react-server scripts/migrate-tenant-logos-to-r2.ts --apply
 *
 * Precisa de DATABASE_URL (ou SUPABASE_DB_URL) e das variáveis R2_* no ambiente. Idempotente: só toca
 * quem ainda tem data URL, e só troca a coluna se ela não mudou durante a cópia.
 */
import { loadEnvConfig } from "@next/env";
import { and, eq, like } from "drizzle-orm";

import { logoPublicPath, logoStorageKey, parseLogoDataUrl } from "../src/features/tenant-branding/logo-file";
import { getDatabase, schema } from "../src/shared/db/client";
import { uploadR2Object } from "../src/shared/storage/r2-storage";

loadEnvConfig(process.cwd());

async function main() {
  const apply = process.argv.includes("--apply");
  const db = getDatabase();
  const tenants = await db
    .select({ id: schema.tenants.id, logoUrl: schema.tenants.logoUrl })
    .from(schema.tenants)
    .where(like(schema.tenants.logoUrl, "data:image/%"));

  let moved = 0;
  let bytes = 0;
  for (const tenant of tenants) {
    const parsed = tenant.logoUrl ? parseLogoDataUrl(tenant.logoUrl) : null;
    if (!parsed) {
      console.log(`- ${tenant.id}: formato não reconhecido, mantido como está`);
      continue;
    }
    const fileName = `${parsed.hash}.${parsed.extension}`;
    const path = logoPublicPath(tenant.id, fileName);
    bytes += tenant.logoUrl!.length;
    if (!apply) {
      console.log(`- ${tenant.id}: ${Math.round(tenant.logoUrl!.length / 1024)} KB -> ${path}`);
      continue;
    }
    await uploadR2Object(logoStorageKey(tenant.id, fileName), parsed.bytes, parsed.contentType);
    const updated = await db
      .update(schema.tenants)
      .set({ logoUrl: path, updatedAt: new Date() })
      .where(and(eq(schema.tenants.id, tenant.id), eq(schema.tenants.logoUrl, tenant.logoUrl!)))
      .returning({ id: schema.tenants.id });
    if (updated.length) moved += 1;
    console.log(`- ${tenant.id}: ${updated.length ? "movida" : "mudou durante a cópia, mantida"}`);
  }

  console.log(`${apply ? "Movidas" : "A mover"}: ${apply ? moved : tenants.length} logo(s), ${Math.round(bytes / 1024)} KB saindo da linha da empresa.`);
  if (!apply) console.log("Simulação: rode de novo com --apply para gravar.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
