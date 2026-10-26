import { createHash } from "node:crypto";

/**
 * Foto de perfil fora da linha do usuário (26/10, Egress do Supabase): o login lê `user` inteiro a
 * cada requisição, e fotos em base64 de até 600 KB iam junto em cada clique. A imagem vai para o R2 e
 * `user.image` guarda só o endereço curto da rota que a serve, com o hash do conteúdo no nome do arquivo
 * (troca de foto = endereço novo, então o navegador pode guardar a imagem para sempre).
 */

const MIME_EXTENSION = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg" } as const;
export type AvatarExtension = (typeof MIME_EXTENSION)[keyof typeof MIME_EXTENSION];
export const AVATAR_CONTENT_TYPE: Record<AvatarExtension, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml" };

const DATA_URL = /^data:(image\/(?:png|jpeg|webp|svg\+xml));base64,([A-Za-z0-9+/]+={0,2})$/;
/** Nome do arquivo na rota: 16 hex do sha256 do conteúdo + extensão conhecida. */
export const AVATAR_FILE_NAME = /^([a-f0-9]{16})\.(png|jpg|webp|svg)$/;

export function isAvatarDataUrl(value: string | null | undefined): value is string {
  return typeof value === "string" && value.startsWith("data:image/");
}

export function parseAvatarDataUrl(dataUrl: string): { bytes: Buffer; extension: AvatarExtension; contentType: string; hash: string } | null {
  const match = DATA_URL.exec(dataUrl);
  if (!match) return null;
  const contentType = match[1] as keyof typeof MIME_EXTENSION;
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0) return null;
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  return { bytes, extension: MIME_EXTENSION[contentType], contentType, hash };
}

export function avatarStorageKey(userId: string, fileName: string) {
  return `avatars/users/${userId}/${fileName}`;
}

/** O que fica em `user.image`: endereço relativo, pequeno, servido pela rota com cache longo. */
export function avatarPublicPath(userId: string, fileName: string) {
  return `/api/users/${encodeURIComponent(userId)}/avatar/${fileName}`;
}
