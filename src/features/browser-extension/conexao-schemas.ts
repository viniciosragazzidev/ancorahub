import { z } from "zod";

// Id de extensão do Chrome: 32 letras de "a" a "p". Só aceita esse formato antes de falar com a extensão.
export const conexaoParamsSchema = z.object({
  ext: z.string().regex(/^[a-p]{32}$/, "Extensão inválida"),
  device: z.uuid("Aparelho inválido"),
});
export type ConexaoParams = z.infer<typeof conexaoParamsSchema>;
