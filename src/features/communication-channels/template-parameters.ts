import { getMetaWhatsAppTemplateVariableNames, splitMetaWhatsAppTemplateVariables } from "./templates";

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

type TemplateComponent = {
  type?: string;
  text?: string;
  example?: { body_text_named_params?: Array<{ param_name?: string }> };
};

/**
 * The named parameters an approved template's BODY declares, in the order
 * Meta lists them (its named-param example, else first appearance). `null`
 * for positional ({{1}}) or parameterless bodies, which keep the legacy
 * positional contract.
 */
export function declaredNamedBodyParameters(componentsJson: unknown): string[] | null {
  const components = (Array.isArray(componentsJson) ? componentsJson : []) as TemplateComponent[];
  const body = components.find((component) => component.type === "BODY");
  if (!body?.text) return null;
  const inText: string[] = [];
  for (const match of body.text.matchAll(PLACEHOLDER)) {
    if (!inText.includes(match[1])) inText.push(match[1]);
  }
  if (!inText.length || inText.every((name) => /^\d+$/.test(name))) return null;
  const declared = (body.example?.body_text_named_params ?? [])
    .map((param) => param.param_name?.trim())
    .filter((name): name is string => Boolean(name));
  return declared.length && inText.every((name) => declared.includes(name)) ? declared : inText;
}

const text = (value: string | undefined, fallback: string) => value?.trim() || fallback;

/**
 * Every value the CRM can offer for a purpose, under each parameter name an
 * approved template is known to use for it — so a template can be swapped
 * (e.g. `lead_assignment_confirmed` → `lead_informations`) without code.
 */
export function buildNamedTemplateValues(purpose: string, rawVariables: string[]): Record<string, string> {
  if (purpose === "leadAssignmentConfirmed") {
    const [corretor, cliente, telefone, interesse, tipo, dependentes, cidade] = rawVariables;
    const values = {
      corretor: text(corretor, "Corretor(a)"),
      cliente: text(cliente, "Cliente"),
      telefone: text(telefone, "Sem telefone"),
      interesse: text(interesse, "Plano de saúde"),
      tipo: text(tipo, "Individual"),
      dependentes: text(dependentes, "0"),
      cidade: text(cidade, "Não informada"),
    };
    return {
      nome_corretor: values.corretor, corretor: values.corretor, corretor_nome: values.corretor,
      nome_cliente: values.cliente, cliente: values.cliente, nome: values.cliente, nome_lead: values.cliente, lead_nome: values.cliente,
      telefone_cliente: values.telefone, telefone: values.telefone, contato: values.telefone,
      interesse: values.interesse, produto_interesse: values.interesse,
      tipo: values.tipo,
      n_dependentes: values.dependentes, dependentes: values.dependentes,
      cidade: values.cidade,
    };
  }

  const { bodyVariables } = splitMetaWhatsAppTemplateVariables(purpose, rawVariables);
  const names = getMetaWhatsAppTemplateVariableNames(purpose) ?? [];
  const values: Record<string, string> = Object.fromEntries(names.map((name, index) => [name, bodyVariables[index] ?? ""]));
  if (purpose === "newLeadAssignment" || purpose === "brokerLeadNotification") {
    const [, corretor, lead] = bodyVariables;
    Object.assign(values, { corretor, nome_corretor: corretor, nome_lead: lead, nome: lead });
  }
  return Object.fromEntries(Object.entries(values).filter(([, value]) => typeof value === "string" && value.trim()));
}

export type TemplateBodyParameters =
  | { ok: true; variables: string[]; variableNames: string[] }
  | { ok: false; missing: string[] };

/** Fills exactly the named parameters the approved template declares, or reports which ones the CRM has no value for. */
export function resolveNamedTemplateBodyParameters(input: { purpose: string; rawVariables: string[]; componentsJson: unknown }): TemplateBodyParameters | null {
  const declared = declaredNamedBodyParameters(input.componentsJson);
  if (!declared) return null;
  const values = buildNamedTemplateValues(input.purpose, input.rawVariables);
  const missing = declared.filter((name) => !(name in values));
  if (missing.length) return { ok: false, missing };
  return { ok: true, variables: declared.map((name) => values[name]), variableNames: declared };
}
