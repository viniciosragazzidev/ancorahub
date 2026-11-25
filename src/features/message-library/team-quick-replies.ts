/**
 * Respostas rápidas da equipe: textos que diretor e gestor cadastram na
 * biblioteca de mensagens e que quem atende insere no composer de /conversas
 * (botão ou "/" no começo do campo). Lógica pura, sem I/O.
 *
 * Ficam na tabela message_templates com a categoria TEAM_QUICK_REPLY_CATEGORY.
 * O atalho opcional vai no próprio campo variables, como "atalho:<atalho>",
 * ao lado das variáveis do texto. Sem migração.
 */

export const TEAM_QUICK_REPLY_CATEGORY = "resposta_rapida_equipe";

/** Variáveis que o composer preenche com o nome do lead. */
export const TEAM_QUICK_REPLY_VARIABLES: ReadonlyArray<{ key: string; label: string; example: string }> = [
  { key: "primeiro_nome", label: "Primeiro nome do cliente", example: "Torquato" },
  { key: "nome", label: "Nome completo do cliente", example: "Torquato Silva" },
];

export type TeamQuickReply = {
  id: string;
  title: string;
  shortcut: string | null;
  text: string;
};

/** Sugestão inicial da empresa que ainda não cadastrou nenhuma resposta. */
export const DEFAULT_TEAM_QUICK_REPLIES: ReadonlyArray<TeamQuickReply & { key: string }> = [
  {
    key: "boas_vindas",
    id: "default:boas_vindas",
    title: "Boas-vindas",
    shortcut: "ola",
    text: "Olá, {{primeiro_nome}}! Sou da equipe de atendimento e vou te ajudar a encontrar o plano de saúde certo para você. Para começar, o plano é só para você ou para mais pessoas?",
  },
  {
    key: "documentos",
    id: "default:documentos",
    title: "Pedir documentos",
    shortcut: "docs",
    text: "{{primeiro_nome}}, para montar a proposta preciso de foto legível do RG ou CNH e de um comprovante de residência recente de cada pessoa do plano. Pode mandar por aqui mesmo.",
  },
  {
    key: "cotacao",
    id: "default:cotacao",
    title: "Cotação pronta",
    shortcut: "cotacao",
    text: "{{primeiro_nome}}, sua cotação está pronta. Separei as opções com melhor custo e rede credenciada perto de você. Posso te mostrar agora?",
  },
  {
    key: "carencia",
    id: "default:carencia",
    title: "Ligação sobre carência",
    shortcut: "carencia",
    text: "{{primeiro_nome}}, podemos falar 5 minutos por telefone? Assim explico carências, rede e valores com calma e tiro suas dúvidas. Qual o melhor horário para você?",
  },
];

const SHORTCUT_PREFIX = "atalho:";
const SHORTCUT_MAX = 30;

function fold(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Atalho em forma única: minúsculo, sem acento, só letras, números, - e _. Vazio vira null. */
export function normalizeShortcut(raw: string | null | undefined) {
  const value = fold(String(raw ?? "").trim().replace(/^\/+/, ""))
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, SHORTCUT_MAX);
  return value || null;
}

/** O atalho guardado no campo variables, ou null. */
export function shortcutFromVariables(variables: unknown) {
  if (!Array.isArray(variables)) return null;
  const entry = variables.find((item): item is string => typeof item === "string" && item.startsWith(SHORTCUT_PREFIX));
  return entry ? normalizeShortcut(entry.slice(SHORTCUT_PREFIX.length)) : null;
}

/** Variáveis do texto que não são o atalho. */
export function textVariablesFromStored(variables: unknown) {
  if (!Array.isArray(variables)) return [];
  return variables.filter((item): item is string => typeof item === "string" && !item.startsWith(SHORTCUT_PREFIX));
}

/** Conteúdo do campo variables: as variáveis do texto, mais o atalho quando houver. */
export function buildStoredVariables(content: string, shortcut: string | null) {
  const variables = [...new Set([...content.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((match) => match[1]!))];
  const normalized = normalizeShortcut(shortcut);
  return normalized ? [...variables, `${SHORTCUT_PREFIX}${normalized}`] : variables;
}

/**
 * O que a pessoa está buscando quando o campo começa com "/": o texto logo
 * depois da barra, sem espaço nem quebra de linha. Fora disso, null.
 * "/contato" fica de fora, porque já é o atalho de avisar quem vai ligar.
 */
export function slashQuery(text: string) {
  const match = /^\/([^\s/]*)$/.exec(text);
  if (!match) return null;
  const query = match[1]!;
  if (fold(query) === "contato") return null;
  return query;
}

/**
 * Respostas que combinam com a busca, na ordem: atalho que começa com a
 * busca, título que começa com ela, atalho ou título que a contém. Busca
 * vazia devolve todas, na ordem original.
 */
export function filterTeamQuickReplies<T extends Pick<TeamQuickReply, "title" | "shortcut">>(items: readonly T[], query: string, limit = 8): T[] {
  const needle = fold(query.trim());
  if (!needle) return items.slice(0, limit);
  const scored: Array<{ item: T; score: number; index: number }> = [];
  items.forEach((item, index) => {
    const shortcut = item.shortcut ? fold(item.shortcut) : "";
    const title = fold(item.title);
    let score = -1;
    if (shortcut.startsWith(needle)) score = 0;
    else if (title.startsWith(needle)) score = 1;
    else if (shortcut.includes(needle) || title.includes(needle)) score = 2;
    if (score >= 0) scored.push({ item, score, index });
  });
  return scored.sort((a, b) => a.score - b.score || a.index - b.index).slice(0, limit).map((entry) => entry.item);
}

const PLACEHOLDER_NAMES = new Set(["sem nome", "cliente", "lead", "contato", "desconhecido", "whatsapp", "cliente whatsapp", "novo lead", "null", "undefined"]);

/** Nome que dá para usar numa mensagem: tem letras e não é um rótulo genérico. */
export function usableLeadName(raw: string | null | undefined) {
  const name = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!name || !/\p{L}{2,}/u.test(name)) return null;
  if (PLACEHOLDER_NAMES.has(fold(name))) return null;
  // Nome todo em maiúsculas ou todo em minúsculas vira "Maria da Silva".
  if (name === name.toUpperCase() || name === name.toLowerCase()) {
    return name.toLowerCase().split(" ").map((word, index) => (index > 0 && /^(da|de|do|das|dos|e)$/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1))).join(" ");
  }
  return name;
}

/**
 * Troca {{nome}} pelo nome do lead e {{primeiro_nome}} pelo primeiro nome.
 * Sem nome utilizável, a variável sai junto com a vírgula em volta
 * ("Olá, {{primeiro_nome}}!" vira "Olá!"), e nenhuma variável fica crua.
 */
export function fillTeamQuickReply(text: string, leadName: string | null | undefined) {
  const name = usableLeadName(leadName);
  const values: Record<string, string> = name ? { nome: name, primeiro_nome: name.split(" ")[0]! } : {};
  let result = text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (token, key: string) => values[key] ?? token);
  if (!/\{\{/.test(result)) return result;

  // Sobrou variável sem valor: tira com a pontuação que a acompanha.
  const token = String.raw`\{\{\s*[\w.]+\s*\}\}`;
  result = result
    .replace(new RegExp(String.raw`[ \t]*,[ \t]*${token}(?=[ \t]*[!?.,:;]|[ \t]*$)`, "gm"), "")
    .replace(new RegExp(String.raw`(^|[.!?][ \t]+)${token}[ \t]*,[ \t]*`, "gm"), "$1")
    .replace(new RegExp(token, "g"), "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([!?.,:;])/g, "$1")
    .replace(/^[ \t]+/gm, "");
  // Frase que passou a começar em minúscula volta a ter maiúscula.
  return result.replace(/(^|[.!?]\s+)(\p{Ll})/gu, (_match, before: string, letter: string) => `${before}${letter.toUpperCase()}`);
}
