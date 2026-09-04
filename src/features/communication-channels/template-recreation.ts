import { z } from "zod";

import type { MetaGraphTemplateComponent } from "./meta-graph-templates-client";

export const CRM_PUBLIC_ORIGIN = "https://crm.ancorasaude.cloud";

const templateButtonSchema = z
  .object({
    type: z.enum(["QUICK_REPLY", "URL", "PHONE_NUMBER"]),
    text: z.string().trim().min(1).max(25),
    url: z.string().trim().url().max(2_000).optional(),
    phone_number: z.string().trim().min(3).max(32).optional(),
  })
  .superRefine((button, context) => {
    if (button.type === "URL" && !button.url) {
      context.addIssue({ code: "custom", message: "Botões de URL exigem uma URL." });
    }
    if (button.type === "PHONE_NUMBER" && !button.phone_number) {
      context.addIssue({ code: "custom", message: "Botões de telefone exigem um número." });
    }
  });

export const recreateMetaTemplateInputSchema = z.object({
  templateId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(512),
  language: z.string().trim().min(2).max(16).optional(),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]).optional(),
  headerType: z.enum(["NONE", "TEXT", "IMAGE", "VIDEO", "DOCUMENT"]).optional(),
  headerText: z.string().trim().max(60).optional(),
  bodyText: z.string().trim().min(1).max(1_024),
  footerText: z.string().trim().max(60).optional(),
  buttons: z.array(templateButtonSchema).max(10).optional(),
});

export type RecreateMetaTemplateInput = z.infer<typeof recreateMetaTemplateInputSchema>;

function sampleValue(variable: string, position: number) {
  const value = variable.toLowerCase();
  if (value === "nome" || value === "nome_cliente" || value === "corretor_nome" || value === "lead_nome" || value === "1") return "João Silva";
  if (value === "empresa" || value === "2") return "Âncora Saúde";
  if (value === "cargo" || value === "3") return "Corretor(a)";
  if (value === "nome_bot") return "Assistente Âncora";
  if (value === "produto_interesse" || value === "interesse" || value === "plano") return "Plano de Saúde";
  if (value === "telefone_cliente") return "11999999999";
  if (value === "tipo") return "Individual";
  if (value === "n_dependentes") return "1";
  return `Valor_${position}`;
}

function convertBodyVariables(body: string) {
  const matches = [...body.matchAll(/\{\{(\d+|[a-zA-Z0-9_]+)\}\}/g)];
  if (matches.length === 0) return { text: body, samples: [] as string[] };

  const variableNames = matches.map((match) => match[1]);
  const hasNumbered = variableNames.some((name) => /^\d+$/.test(name));
  const hasNamed = variableNames.some((name) => !/^\d+$/.test(name));
  if (hasNumbered && hasNamed) {
    throw new Error("Use apenas variáveis nomeadas ou apenas variáveis numéricas no mesmo corpo de template.");
  }

  if (hasNumbered) {
    const positions = [...new Set(variableNames.map(Number))].sort((left, right) => left - right);
    if (positions.some((position, index) => position !== index + 1)) {
      throw new Error("As variáveis numéricas precisam ser sequenciais, começando em {{1}}.");
    }
    return { text: body, samples: positions.map((position) => sampleValue(String(position), position)) };
  }

  const positions = new Map<string, number>();
  let nextPosition = 1;
  const text = body.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_match, variableName: string) => {
    const normalized = variableName.toLowerCase();
    const position = positions.get(normalized) ?? nextPosition++;
    positions.set(normalized, position);
    return `{{${position}}}`;
  });
  const samples = [...positions.entries()]
    .sort(([, left], [, right]) => left - right)
    .map(([variableName, position]) => sampleValue(variableName, position));
  return { text, samples };
}

function normalizeCrmUrl(url: string) {
  // Não use URL() aqui: ela codifica `{{1}}` como `%7B%7B1%7D%7D`, que faz a
  // Meta deixar de reconhecer uma URL dinâmica de template.
  return url.replace(
    /^https?:\/\/(?:[a-z0-9-]+\.)*ancorahub\.com\.br(?=\/|$)/i,
    CRM_PUBLIC_ORIGIN,
  );
}

export function buildMetaTemplateComponents(input: RecreateMetaTemplateInput): MetaGraphTemplateComponent[] {
  const components: MetaGraphTemplateComponent[] = [];
  if (input.headerType === "TEXT" && input.headerText) {
    components.push({ type: "HEADER", format: "TEXT", text: input.headerText });
  }

  const body = convertBodyVariables(input.bodyText);
  components.push({
    type: "BODY",
    text: body.text,
    ...(body.samples.length > 0 ? { example: { body_text: [body.samples] } } : {}),
  });

  if (input.footerText) components.push({ type: "FOOTER", text: input.footerText });

  if (input.buttons && input.buttons.length > 0) {
    components.push({
      type: "BUTTONS",
      buttons: input.buttons.map((button) => ({
        type: button.type,
        text: button.text,
        ...(button.url
          ? {
              url: normalizeCrmUrl(button.url),
              ...(button.url.includes("{{")
                ? { example: [`${CRM_PUBLIC_ORIGIN}/convite/token123`] }
                : {}),
            }
          : {}),
        ...(button.phone_number ? { phone_number: button.phone_number } : {}),
      })),
    });
  }

  return components;
}
