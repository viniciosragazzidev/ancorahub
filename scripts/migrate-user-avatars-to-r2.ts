/**
 * Move as fotos de perfil em base64 de `user.image` para o R2 (26/10, Egress do Supabase).
 * O login lê a linha `user` inteira a cada requisição; com a foto no R2, a coluna guarda só o endereço curto.
 *
 * Simulação (padrão, não grava nada):
 *   npx tsx --conditions=react-server scripts/migrate-user-avatars-to-r2.ts
 * Aplicar:
 *   npx tsx --conditions=react-server scripts/migrate-user-avatars-to-r2.ts --apply
 *
 * Precisa de DATABASE_URL (ou SUPABASE_DB_URL) e das variáveis R2_* no ambiente. Idempotente: só toca
 * quem ainda tem data URL, e só troca a coluna se ela não mudou durante a cópia.
 */
import { loadEnvConfig } from "@next/env";
import { and, eq, like } from "drizzle-orm";

import { avatarPublicPath, avatarStorageKey, parseAvatarDataUrl } from "../src/features/user-profile/avatar-file";
import { getDatabase, schema } from "../src/shared/db/client";
import { uploadR2Object } from "../src/shared/storage/r2-storage";

loadEnvConfig(process.cwd());

async function main() {
  const apply = process.argv.includes("--apply");
  const db = getDatabase();
  const users = await db
    .select({ id: schema.user.id, name: schema.user.name, image: schema.user.image })
    .from(schema.user)
    .where(like(schema.user.image, "data:image/%"));

  let moved = 0;
  let bytes = 0;
  for (const user of users) {
    const parsed = user.image ? parseAvatarDataUrl(user.image) : null;
    if (!parsed) {
      console.log(`- ${user.id}: formato não reconhecido, mantido como está`);
      continue;
    }
    const fileName = `${parsed.hash}.${parsed.extension}`;
    const path = avatarPublicPath(user.id, fileName);
    bytes += user.image!.length;
    if (!apply) {
      console.log(`- ${user.id}: ${Math.round(user.image!.length / 1024)} KB -> ${path}`);
      continue;
    }
    await uploadR2Object(avatarStorageKey(user.id, fileName), parsed.bytes, parsed.contentType);
    const updated = await db
      .update(schema.user)
      .set({ image: path, updatedAt: new Date() })
      .where(and(eq(schema.user.id, user.id), eq(schema.user.image, user.image!)))
      .returning({ id: schema.user.id });
    if (updated.length) moved += 1;
    console.log(`- ${user.id}: ${updated.length ? "movida" : "mudou durante a cópia, mantida"}`);
  }

  console.log(`${apply ? "Movidas" : "A mover"}: ${apply ? moved : users.length} foto(s), ${Math.round(bytes / 1024)} KB saindo da linha do usuário.`);
  if (!apply) console.log("Simulação: rode de novo com --apply para gravar.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
