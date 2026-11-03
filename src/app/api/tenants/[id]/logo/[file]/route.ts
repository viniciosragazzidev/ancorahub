import { AVATAR_CONTENT_TYPE, type AvatarExtension } from "@/features/user-profile/avatar-file";
import { LOGO_FILE_NAME, logoStorageKey } from "@/features/tenant-branding/logo-file";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { downloadR2Object } from "@/shared/storage/r2-storage";

export const runtime = "nodejs";

/**
 * Logo da empresa guardada no R2 (ver logo-file.ts). Só quem é da própria empresa vê; o nome do arquivo
 * é o hash do conteúdo, então o navegador guarda a imagem e não volta a pedir até a logo mudar.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; file: string }> }) {
  const { id, file } = await params;
  const match = LOGO_FILE_NAME.exec(file);
  if (!match || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) return new Response(null, { status: 404 });

  const context = await getRequiredTenantContext().catch(() => null);
  if (!context) return new Response(null, { status: 401 });
  if (id !== context.tenantId) return new Response(null, { status: 404 });

  const blob = await downloadR2Object(logoStorageKey(id, file)).catch(() => null);
  if (!blob) return new Response(null, { status: 404 });

  return new Response(blob, {
    headers: {
      "Content-Type": AVATAR_CONTENT_TYPE[match[2] as AvatarExtension],
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      // SVG enviado pelo diretor: sem script nem recurso externo.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
