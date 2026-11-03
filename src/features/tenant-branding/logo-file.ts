import { parseAvatarDataUrl } from "@/features/user-profile/avatar-file";

/**
 * Logo da empresa fora da linha `tenants` (03/11, Egress do Supabase): o layout lê essa linha em toda
 * navegação e recarga de todo mundo, e a logo em base64 tinha até ~700 KB. A imagem vai para o R2 e
 * `tenants.logo_url` guarda só o endereço curto da rota que a serve, com o hash do conteúdo no nome do
 * arquivo (troca de logo = endereço novo, então o navegador pode guardar a imagem para sempre).
 * Mesmo desenho das fotos de perfil (avatar-file.ts).
 */

export const parseLogoDataUrl = parseAvatarDataUrl;

/** Nome do arquivo na rota: 16 hex do sha256 do conteúdo + extensão conhecida. */
export const LOGO_FILE_NAME = /^([a-f0-9]{16})\.(png|jpg|webp|svg)$/;
const LOGO_PATH = /^\/api\/tenants\/([A-Za-z0-9_-]{1,128})\/logo\/([a-f0-9]{16}\.(?:png|jpg|webp|svg))$/;

export function logoStorageKey(tenantId: string, fileName: string) {
  return `logos/tenants/${tenantId}/${fileName}`;
}

/** O que fica em `tenants.logo_url`: endereço relativo, pequeno, servido pela rota com cache longo. */
export function logoPublicPath(tenantId: string, fileName: string) {
  return `/api/tenants/${encodeURIComponent(tenantId)}/logo/${fileName}`;
}

/** The tenant and file of a stored logo path, or null for anything else (data URL, https, another path). */
export function parseLogoPublicPath(value: string | null | undefined) {
  const match = value ? LOGO_PATH.exec(value) : null;
  return match ? { tenantId: match[1], fileName: match[2] } : null;
}
