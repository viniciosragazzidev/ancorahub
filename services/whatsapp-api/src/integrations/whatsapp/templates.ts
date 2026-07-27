export type TemplateDraft = {
  name: string;
  language: string;
  category: "UTILITY" | "MARKETING" | "AUTHENTICATION";
  body: string;
};

// O adapter de criação/listagem será conectado após a aprovação das permissões.
// O contrato fica aqui para evitar que a UI ou o CRM montem payloads da Meta diretamente.
export function normalizeTemplateDraft(input: TemplateDraft): TemplateDraft {
  return { ...input, name: input.name.trim().toLowerCase(), body: input.body.trim() };
}
