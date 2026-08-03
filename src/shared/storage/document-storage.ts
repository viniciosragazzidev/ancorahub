/**
 * Compatibilidade para os consumidores do domínio documental.
 * O provedor privado é Cloudflare R2; novos tipos de arquivo devem usar
 * `r2-storage.ts` diretamente e reservar seu próprio prefixo no bucket.
 */
export {
  R2StorageConfigurationError as DocumentStorageConfigurationError,
  downloadR2Object as downloadDocumentObject,
  uploadR2Object as uploadDocumentObject,
} from "@/shared/storage/r2-storage";
