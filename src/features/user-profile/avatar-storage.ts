import "server-only";

import { uploadR2Object } from "@/shared/storage/r2-storage";

import { avatarPublicPath, avatarStorageKey, parseAvatarDataUrl } from "./avatar-file";

/** Sobe a foto (data URL já validada) para o R2 e devolve o endereço curto que vai em `user.image`. */
export async function storeUserAvatar(userId: string, dataUrl: string): Promise<string> {
  const parsed = parseAvatarDataUrl(dataUrl);
  if (!parsed) throw new Error("Imagem inválida.");
  const fileName = `${parsed.hash}.${parsed.extension}`;
  await uploadR2Object(avatarStorageKey(userId, fileName), parsed.bytes, parsed.contentType);
  return avatarPublicPath(userId, fileName);
}
