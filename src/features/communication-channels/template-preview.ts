import { getMetaWhatsAppTemplateVariableNames, splitMetaWhatsAppTemplateVariables } from "./templates";
import { buildNamedTemplateValues } from "./template-parameters";

/** What the recipient actually sees for a sent Meta template: text only, button URLs deliberately left out (they can carry secret tokens). */
export type TemplateMessagePreview = {
  header: string | null;
  body: string;
  footer: string | null;
  buttons: string[];
};

type TemplateComponent = {
  type?: string;
  format?: string;
  text?: string;
  buttons?: Array<{ text?: string }>;
};

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

const stringArray = (value: unknown) => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === "string")
  : [];

/**
 * Fills a synchronized template's components with the exact variables the
 * outbox sent to Meta — `providerVariables` when the message plan set them,
 * otherwise the purpose's default split (same precedence as the sender) — so
 * the director's conversation view matches the broker's WhatsApp.
 */
export function renderTemplatePreview(input: {
  purpose: string;
  componentsJson: unknown;
  variables: unknown;
  providerVariables?: unknown;
  templateVariableNames?: unknown;
}): TemplateMessagePreview | null {
  const components = (Array.isArray(input.componentsJson) ? input.componentsJson : []) as TemplateComponent[];
  const bodyComponent = components.find((component) => component.type === "BODY");
  if (!bodyComponent?.text) return null;

  const configured = stringArray(input.providerVariables);
  // Without a message-plan override the sender fills named parameters by
  // name (see template-parameters.ts), so the preview reads the same map.
  const named = configured.length > 0 ? {} : buildNamedTemplateValues(input.purpose, stringArray(input.variables));
  const values = configured.length > 0
    ? configured
    : splitMetaWhatsAppTemplateVariables(input.purpose, stringArray(input.variables)).bodyVariables;
  const configuredNames = stringArray(input.templateVariableNames);
  const names = configuredNames.length > 0 ? configuredNames : getMetaWhatsAppTemplateVariableNames(input.purpose) ?? [];

  // Named placeholders map by name when the sender knew it, else by order of
  // first appearance (how Meta pairs a positional parameter list).
  const order: string[] = [];
  for (const match of bodyComponent.text.matchAll(PLACEHOLDER)) {
    if (!/^\d+$/.test(match[1]) && !order.includes(match[1])) order.push(match[1]);
  }
  const fill = (text: string) => text.replace(PLACEHOLDER, (placeholder, key: string) => {
    if (key in named) return named[key];
    const index = /^\d+$/.test(key) ? Number(key) - 1 : names.includes(key) ? names.indexOf(key) : order.indexOf(key);
    return values[index] ?? placeholder;
  });

  const header = components.find((component) => component.type === "HEADER" && (!component.format || component.format === "TEXT"));
  const footer = components.find((component) => component.type === "FOOTER");
  const buttons = components
    .filter((component) => component.type === "BUTTONS")
    .flatMap((component) => component.buttons ?? [])
    .map((button) => button.text?.trim())
    .filter((text): text is string => Boolean(text));

  return {
    header: header?.text ? fill(header.text) : null,
    body: fill(bodyComponent.text),
    footer: footer?.text?.trim() || null,
    buttons,
  };
}
