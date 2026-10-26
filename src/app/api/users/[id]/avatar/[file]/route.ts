import { and, eq } from "drizzle-orm";

import { AVATAR_CONTENT_TYPE, AVATAR_FILE_NAME, avatarStorageKey, type AvatarExtension } from "@/features/user-profile/avatar-file";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { downloadR2Object } from "@/shared/storage/r2-storage";

export const runtime = "nodejs";

/**
 * Foto de perfil guardada no R2 (ver avatar-file.ts). Só quem é da mesma empresa vê; o nome do arquivo
 * é o hash do conteúdo, então o navegador guarda a imagem e não volta a pedir até a foto mudar.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; file: string }> }) {
  const { id, file } = await params;
  const match = AVATAR_FILE_NAME.exec(file);
  if (!match || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) return new Response(null, { status: 404 });

  const context = await getRequiredTenantContext().catch(() => null);
  if (!context) return new Response(null, { status: 401 });

  if (id !== context.userId) {
    const [member] = await getDatabase()
      .select({ userId: schema.tenantMemberships.userId })
      .from(schema.tenantMemberships)
      .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.userId, id)))
      .limit(1);
    if (!member) return new Response(null, { status: 404 });
  }

  const blob = await downloadR2Object(avatarStorageKey(id, file)).catch(() => null);
  if (!blob) return new Response(null, { status: 404 });

  return new Response(blob, {
    headers: {
      "Content-Type": AVATAR_CONTENT_TYPE[match[2] as AvatarExtension],
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      // SVG enviado pelo usuário: sem script nem recurso externo.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
