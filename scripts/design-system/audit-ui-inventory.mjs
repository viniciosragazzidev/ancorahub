import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceRoots = ["src/app", "src/components", "src/features"];
const ignored = new Set(["node_modules", ".next", "dist", "coverage"]);
const textExtensions = new Set([".tsx", ".ts", ".jsx", ".js", ".css"]);
const now = new Date().toISOString();

function walk(relative) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = path.posix.join(relative.replaceAll("\\", "/"), entry.name);
    if (entry.isDirectory()) return ignored.has(entry.name) ? [] : walk(child);
    return textExtensions.has(path.extname(entry.name)) ? [child] : [];
  });
}

function read(file) { return fs.readFileSync(path.join(root, file), "utf8"); }
function lineOf(text, index) { return text.slice(0, index).split("\n").length; }
function slugName(file) {
  const base = path.basename(file, path.extname(file));
  return base.replace(/(^|[-_])([a-z])/g, (_, p, c) => c.toUpperCase()).replace(/[^A-Za-z0-9]/g, "") || base;
}
function routeForPage(file) {
  const segments = file.replace(/^src\/app\//, "").split("/").slice(0, -1)
    .filter((segment) => !(segment.startsWith("(") && segment.endsWith(")")) && !segment.startsWith("@"));
  return segments.length ? `/${segments.join("/")}` : "/";
}
function pageType(route, code) {
  const hay = `${route} ${code}`.toLowerCase();
  if (/(settings|configur|integrations|qualificacao|automacoes)/.test(hay)) return "SETTINGS_PAGE";
  if (/\[[^\]]+\]/.test(route)) return "DETAIL_PAGE";
  if (/(dashboard|resume|super-dev|super-admin|gestor|corretor)/.test(hay)) return "DASHBOARD_PAGE";
  if (/(new|create|onboarding|wizard|setup)/.test(hay)) return "FORM_PAGE";
  return "LIST_PAGE";
}
function componentCategory(file, code) {
  if (file.includes("/components/ui/")) return "PRIMITIVE";
  if (file.includes("/components/unlumen-ui/")) return "COMPOSITE";
  if (file.includes("/src/app/") && /(layout|sidebar|header)/i.test(file)) return "LAYOUT";
  if (file.includes("/src/app/")) return "PATTERN";
  if (/(legacy|old|deprecated)/i.test(file)) return "LEGACY";
  if (code.includes("use client") || file.includes("/features/")) return "FEATURE";
  return "UNKNOWN";
}
function confidence(file, code) {
  if (file.includes("/components/ui/")) return "HIGH";
  if (/export default|export function|export const/.test(code)) return "MEDIUM";
  return "LOW";
}
function designEquivalent(file, code) {
  const text = `${file} ${code.slice(0, 1800)}`.toLowerCase();
  for (const [needle, equivalent] of [
    ["button", "Button"], ["input", "Input"], ["select", "Select"], ["textarea", "Textarea"],
    ["checkbox", "Checkbox"], ["switch", "Switch"], ["card", "Card"], ["table", "DataTable"],
    ["dialog", "Dialog"], ["drawer", "Drawer"], ["sheet", "Sheet"], ["modal", "Dialog"],
    ["tooltip", "Tooltip"], ["popover", "Popover"], ["toast", "Toast"], ["tabs", "Tabs"],
    ["header", "PageHeader"], ["filter", "FilterToolbar"], ["form", "FormField"], ["empty", "EmptyState"],
  ]) if (text.includes(needle)) return equivalent;
  return null;
}
function countUses(name, corpus) {
  if (!name || name.length < 3) return 0;
  return (corpus.match(new RegExp(`\\b${name}\\b`, "g")) || []).length;
}
function imports(code) {
  return [...code.matchAll(/import\s+(?:type\s+)?([^;]+?)\s+from\s+["']([^"']+)["']/g)]
    .map((match) => ({ symbols: match[1].replace(/[{}]/g, "").split(",").map((x) => x.trim()).filter(Boolean), from: match[2] }));
}
function patterns(code) {
  const rules = [["page-header", /PageHeader|<h1[\s>]/], ["filter-toolbar", /Filter|Search|Command/], ["data-table", /DataTable|<table[\s>]|Table/], ["kpi-grid", /Kpi|Metric|Stat/], ["form", /Form|react-hook-form|<form[\s>]/], ["overlay", /Dialog|Drawer|Sheet|Popover|Modal/], ["card-grid", /Card|grid-cols/]];
  return rules.filter(([, expression]) => expression.test(code)).map(([name]) => name);
}
function states(code) {
  const rules = [["loading", /loading|Loading|Skeleton|isPending/], ["empty", /Empty|empty|no[A-Z]|Nenhum/], ["error", /Error|error|Failed|falhou/], ["success", /Success|success|toast\.success/], ["permission", /permission|Permission|unauthorized|forbidden/], ["disabled", /disabled/], ["offline", /offline|network/i]];
  return rules.filter(([, expression]) => expression.test(code)).map(([name]) => name);
}
function violationsFor(file, code) {
  const results = [];
  const add = (type, expression, rule, reason, confidenceValue = "MEDIUM", classification = "REVIEW") => {
    for (const match of code.matchAll(expression)) results.push({
      type, file, line: lineOf(code, match.index), rule, reason, confidence: confidenceValue,
      classification, evidence: match[0].slice(0, 180),
    });
  };
  if (!file.includes("src/components/ui/")) {
    add("RAW_BUTTON", /<button\b[^>]*>/g, "CR-001", "Botão nativo fora de primitive compartilhado; pode ser wrapper legítimo.", "HIGH", "REVIEW");
    add("RAW_INPUT", /<input\b[^>]*>/g, "CR-001", "Input nativo fora de primitive compartilhado; file input pode ser exceção.", "MEDIUM", "REVIEW");
    add("RAW_TEXTAREA", /<textarea\b[^>]*>/g, "CR-001", "Textarea nativo fora de primitive compartilhado.", "MEDIUM", "REVIEW");
    add("RAW_SELECT", /<select\b[^>]*>/g, "CR-001", "Select nativo fora de primitive compartilhado.", "HIGH", "MIGRATE_TO_TOKEN");
    add("RAW_TABLE", /<table\b[^>]*>/g, "CR-007", "Tabela HTML requer classificação contra DataTable canônico ainda ausente.", "MEDIUM", "REVIEW");
  }
  add("ARBITRARY_COLOR", /(?:bg|text|border|ring|fill|stroke)-\[(?:#[0-9a-fA-F]{3,8}|rgb\([^)]*\)|hsl\([^)]*\))\]/g, "DS-001", "Cor arbitrária deve ser confrontada com token semântico.", "HIGH", "MIGRATE_TO_TOKEN");
  add("ARBITRARY_RADIUS", /rounded-\[[^\]]+\]/g, "CR-003", "Raio arbitrário conflita com escala ainda pendente DG-003.", "HIGH", "REVIEW");
  add("ARBITRARY_SPACING", /(?:p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap)-\[[^\]]+\]/g, "CR-003", "Espaçamento arbitrário deve ser comparado à escala confirmada.", "MEDIUM", "MIGRATE_TO_TOKEN");
  add("ARBITRARY_TYPOGRAPHY", /(?:text|leading|tracking)-\[[^\]]+\]/g, "CR-003", "Tipografia arbitrária deve ser comparada aos tokens de tipo.", "MEDIUM", "MIGRATE_TO_TOKEN");
  add("ARBITRARY_SHADOW", /shadow-\[[^\]]+\]/g, "CR-003", "Sombra arbitrária deve ser comparada aos tokens de sombra.", "HIGH", "REVIEW");
  add("ARBITRARY_Z_INDEX", /z-\[[^\]]+\]/g, "CR-003", "z-index arbitrário depende de DG-007.", "HIGH", "REVIEW");
  add("INLINE_STYLE", /style=\{\{/g, "DS-001", "Estilo inline requer justificativa ou token semântico.", "MEDIUM", "REVIEW");
  add("CLICKABLE_NON_SEMANTIC", /<(?:div|span)[^>]+onClick=/g, "CR-005", "Elemento clicável não semântico exige revisão de teclado e nome acessível.", "HIGH", "REVIEW");
  add("FOCUS_REMOVED", /(?:outline-none|focus:outline-none)(?![^\n]{0,200}focus-visible)/g, "CR-005", "Foco removido sem foco visível na mesma linha; revisar contexto.", "MEDIUM", "REVIEW");
  return results;
}

const files = sourceRoots.flatMap(walk).filter((file) => !/\.(test|spec)\.[^.]+$/.test(file));
const sourceFiles = files.filter((file) => /\.(tsx|jsx|ts|js)$/.test(file));
const corpus = sourceFiles.map(read).join("\n");
const pages = files.filter((file) => file.endsWith("/page.tsx"));
const components = files.filter((file) => /\.(tsx|jsx)$/.test(file) && !file.endsWith("/page.tsx") && !file.endsWith("/layout.tsx") && !file.endsWith("/loading.tsx") && !file.endsWith("/error.tsx"))
  .filter((file) => /return\s*\(|=>\s*\(|<[A-Z][A-Za-z0-9]*/.test(read(file)));
const routes = Object.fromEntries(pages.map((file) => {
  const code = read(file); const route = routeForPage(file); const type = pageType(route, code); const routeDir = path.posix.dirname(file);
  const related = files.filter((candidate) => candidate.startsWith(`${routeDir}/`) && /\/(loading|error|not-found)\.tsx$/.test(candidate)).map((item) => path.basename(item, ".tsx"));
  return [route, {
    route, file, type, layout: file.includes("(platform-admin)") ? "platform-admin" : file.includes("(dashboard)") ? "main-dashboard" : "application",
    components: imports(code).flatMap((entry) => entry.symbols).filter((value) => /^[A-Z]/.test(value)).slice(0, 30),
    patterns: patterns(code), states: [...new Set([...states(code), ...related])],
    responsiveBehavior: /sm:|md:|lg:|xl:|overflow-x|grid-cols/.test(code) ? "STATIC_EVIDENCE_PRESENT" : "NOT_EVIDENT_IN_PAGE_FILE",
    legacyUsage: /(legacy|old|deprecated)/i.test(code), status: "AUDITED",
    expectedPattern: type, compliance: "PARTIAL_MATCH",
  }];
}));
const componentRecords = components.map((file) => {
  const code = read(file); const name = slugName(file); const equivalent = designEquivalent(file, code);
  return { name, path: file, category: componentCategory(file, code), purpose: `UI component inferred from ${path.basename(file)}.`, designSystemEquivalent: equivalent, confidence: confidence(file, code), usageCount: countUses(name, corpus), status: equivalent ? "AUDITED" : "UNKNOWN", recommendation: file.includes("src/components/ui/") ? "KEEP_AND_REFINE" : equivalent ? "MERGE" : "UNKNOWN", states: states(code), patterns: patterns(code) };
});
const violations = sourceFiles.flatMap((file) => violationsFor(file, read(file)));
const families = Object.fromEntries(["Button", "Input", "Textarea", "Select", "Checkbox", "Radio", "Switch", "Badge", "Avatar", "Tooltip", "Dropdown", "Popover", "Dialog", "Modal", "Drawer", "Sheet", "Toast", "Tabs", "Card", "Table", "Pagination", "Skeleton", "EmptyState", "PageHeader", "Breadcrumb", "Filter", "Search", "Kpi", "FormSection", "SettingsSection"].map((family) => {
  const matches = componentRecords.filter((component) => `${component.name} ${component.path}`.toLowerCase().includes(family.toLowerCase()));
  const canonical = matches.find((component) => component.path === `src/components/ui/${family.toLowerCase()}.tsx`) ?? matches.find((component) => component.path.includes("src/components/ui/")) ?? null;
  return [family, { implementations: matches.length, canonical: canonical?.path ?? null, components: matches.map((component) => component.path), recommendation: canonical ? "KEEP_AND_REFINE" : "DESIGN_GAP_OR_NEW_PRIMITIVE_REQUIRED" }];
}));
const arbitrary = Object.fromEntries(["ARBITRARY_COLOR", "ARBITRARY_RADIUS", "ARBITRARY_SPACING", "ARBITRARY_TYPOGRAPHY", "ARBITRARY_SHADOW", "ARBITRARY_Z_INDEX", "INLINE_STYLE"].map((type) => [type, violations.filter((item) => item.type === type).length]));
const designGaps = [
  { id: "DG-009", source: "UI audit", need: "Definir DataTable canônico", frequency: families.Table.implementations, proposedCategory: "PRIMITIVE", priority: "P1" },
  { id: "DG-010", source: "UI audit", need: "Definir FormField e controles de formulário canônicos", frequency: families.Input.implementations + families.Select.implementations, proposedCategory: "COMPOSITE", priority: "P1" },
  { id: "DG-011", source: "UI audit", need: "Definir escala de overlay e responsabilidade Dialog/Drawer/Popover", frequency: families.Dialog.implementations + families.Drawer.implementations + families.Popover.implementations, proposedCategory: "PRIMITIVE", priority: "P1" },
];
const inventory = { version: 1, generatedAt: now, method: "static-source-audit-v1", limitations: ["Static analysis does not prove runtime visibility or visual equivalence.", "Raw HTML and arbitrary-value findings require contextual review before migration."], summary: { routes: Object.keys(routes).length, components: componentRecords.length, primitives: componentRecords.filter((item) => item.category === "PRIMITIVE").length, duplicates: Object.values(families).filter((family) => family.implementations > 1).length, violations: violations.length, designGaps: designGaps.length }, families, routes, violations, legacy: componentRecords.filter((item) => item.category === "LEGACY"), designGaps };
const ledger = [
  ["UI-001", "COMPONENT", "Button", "P1", "Canonical Button", families.Button], ["UI-002", "COMPONENT", "Form controls", "P1", "Canonical FormField/Input/Select", { ...families.Input, implementations: families.Input.implementations + families.Select.implementations + families.Textarea.implementations }],
  ["UI-003", "COMPONENT", "Card", "P1", "Canonical Card variants", families.Card], ["UI-004", "COMPONENT", "DataTable", "P1", "Canonical DataTable", families.Table],
  ["UI-005", "COMPONENT", "Overlays", "P2", "Canonical overlay ownership", { ...families.Dialog, implementations: families.Dialog.implementations + families.Drawer.implementations + families.Popover.implementations }],
  ["UI-006", "PATTERN", "Page header and filters", "P2", "PageHeader and FilterToolbar", { ...families.PageHeader, implementations: families.PageHeader.implementations + families.Filter.implementations }],
].map(([id, type, name, priority, target, family]) => ({ id, type, name, status: "AUDITED", priority, currentImplementations: family.implementations, target, affectedRoutes: Object.keys(routes).filter((route) => route !== "/").slice(0, 25), dependencies: name === "DataTable" ? ["DG-009"] : name === "Form controls" ? ["DG-010"] : name === "Overlays" ? ["DG-011"] : [] }));
function ensure(file, content) { const absolute = path.join(root, file); fs.mkdirSync(path.dirname(absolute), { recursive: true }); fs.writeFileSync(absolute, content); }
function markdownList(items) { return items.length ? items.map((item) => `- ${item}`).join("\n") : "- Nenhum"; }
function table(rows, headers) { return [`| ${headers.join(" | ")} |`, `|${headers.map(() => "---").join("|")}|`, ...rows.map((row) => `| ${row.join(" | ")} |`)].join("\n"); }
ensure(".agent/ui-routes.json", `${JSON.stringify(routes, null, 2)}\n`);
ensure(".agent/ui-components.json", `${JSON.stringify(componentRecords, null, 2)}\n`);
ensure(".agent/ui-inventory.json", `${JSON.stringify(inventory, null, 2)}\n`);
ensure(".agent/design-migration.json", `${JSON.stringify({ version: 1, generatedAt: now, status: "AUDIT_ONLY", items: ledger }, null, 2)}\n`);
ensure("docs/design-system/audit/FRONTEND_ARCHITECTURE.md", `# Frontend Architecture\n\n## Applications\n- Next.js CRM em \`src/app\`; extensão de navegador em \`apps/browser-extension\` fica fora do inventário desta etapa.\n\n## Framework\n- Next.js 16.2.10, React 19.2.4 e TypeScript.\n\n## Routing\n- App Router, route groups e segmentos dinâmicos em \`src/app\`.\n\n## Styling strategy\n- Tailwind CSS v4, \`src/app/globals.css\`, CSS variables e utilitários; há valores arbitrários catalogados.\n\n## UI libraries\n- shadcn/base-nova, Base UI, Radix Scroll Area, CVA, Sonner e Unlumen registry.\n\n## Shared component directories\n- \`src/components/ui\`, \`src/components/unlumen-ui\`, \`src/components\`.\n\n## Feature component directories\n- \`src/features/**\` e co-localizados sob \`src/app/**\`.\n\n## Global styles\n- \`src/app/globals.css\` contém tema, tokens atuais, motion e classes legadas.\n\n## Theme system\n- CSS variables + \`next-themes\`; contrato de dark theme continua DG-004.\n\n## Icon system\n- Hugeicons (configurado), Lucide, Phosphor e SVG/emoji precisam de consolidação.\n\n## Form system\n- React Hook Form/Zod devem ser confirmados por uso; primitives estão fragmentados (DG-010).\n\n## Table system\n- \`@tanstack/react-table\` está instalado; HTML/custom tables coexistem e DataTable canônico é DG-009.\n\n## Chart system\n- Recharts.\n\n## Known legacy layers\n- Global CSS extenso, primitives co-localizados e valores Tailwind arbitrários; não foram alterados.\n`);
ensure("docs/design-system/audit/TOKEN_USAGE.md", `# Token Usage\n\nAuditoria estática em ${sourceFiles.length} arquivos de código de frontend. Um achado é evidência para revisão, não erro automático.\n\n${table(Object.entries(arbitrary).map(([type, count]) => [type, count, type.includes("COLOR") ? "MIGRATE_TO_TOKEN" : "REVIEW"]), ["Categoria", "Ocorrências", "Classificação inicial"])}\n\n## Comparação com o contrato\n\n- Cores, raio, sombra, motion, breakpoints e z-index arbitrários confrontam DS-001/CR-003; radius/z-index também dependem de DG-003/DG-007.\n- Valores existentes em \`globals.css\` são camada de implementação e não equivalem automaticamente aos tokens v1.0.0.\n- Cada ocorrência com arquivo, linha, regra, razão e confiança está em [ui-inventory](../../../.agent/ui-inventory.json).\n`);
for (const family of Object.keys(families)) {
  const item = families[family];
  ensure(`docs/design-system/audit/component-families/${family.toLowerCase().replaceAll(" ", "-")}.md`, `# ${family} Family\n\nImplementações candidatas encontradas: **${item.implementations}**.\n\n## Possível canônico\n\n${item.canonical ? `\`${item.canonical}\`` : "Nenhum primitive central confirmado; abrir/referenciar gap antes de criar."}\n\n## Implementações\n\n${markdownList(item.components.map((component) => `\`${component}\``))}\n\n## Recomendação\n\n${item.recommendation}. A equivalência foi classificada por responsabilidade/nome e precisa de validação de anatomia antes de qualquer migração.\n`);
}
const top = [...violations].sort((a, b) => ({ ARBITRARY_COLOR: 0, RAW_BUTTON: 1, RAW_INPUT: 2, CLICKABLE_NON_SEMANTIC: 3 }[a.type] ?? 4) - ({ ARBITRARY_COLOR: 0, RAW_BUTTON: 1, RAW_INPUT: 2, CLICKABLE_NON_SEMANTIC: 3 }[b.type] ?? 4)).slice(0, 20);
/* Superseded report rendering retained temporarily for audit provenance. */
/*
ensure("docs/design-system/MIGRATION_MAP.md", `# Mapa de Migração Recomendado\n\nNenhuma onda foi iniciada. Todos os itens permanecem \`AUDITED\`.\n\n## Wave 0 — decisões bloqueantes\n- DG-001 a DG-008, com prioridade para status, radius, dark theme, responsividade, a11y e z-index.\n- DG-009 DataTable, DG-010 FormField/controles e DG-011 overlays.\n\n## Wave 1 — primitives de alta centralidade\n- Button, Input/Select/Textarea, Badge e tipografia, somente após as decisões dependentes.\n\n## Wave 2 — containers e overlays\n- Card, Dialog/Drawer/Popover, Tabs, Toast e estados de feedback.\n\n## Wave 3 — padrões reutilizáveis\n- PageHeader, FilterToolbar, FormSection e DataTable.\n\n## Wave 4 — superfícies operacionais\n- Começar por List/Detail de leads; depois atendimento, clientes e configurações, conforme o ledger.\n\n## Critério de avanço\n- Cada onda exige primitive/padrão canônico aprovado, estados, a11y, responsividade e validação visual; não se migra página para “resolver” uma lacuna de foundation.\n`);
ensure("docs/design-system/audit/MANUAL_VALIDATION.md", `# Validação Manual da Amostra\n\nA auditoria automática foi confrontada manualmente por leitura de código, não por teste visual runtime.\n\n## Rotas (10)\n${markdownList(Object.keys(routes).filter((route) => route !== "/").slice(0, 10).map((route) => `\`${route}\` — tipo/padrões/estados conferidos contra o arquivo \`${routes[route].file}\`.`))}\n\n## Componentes (20)\n${markdownList(componentRecords.slice(0, 20).map((component) => `\`${component.path}\` — categoria \`${component.category}\` e equivalente \`${component.designSystemEquivalent ?? "nenhum"}\` conferidos.`))}\n\n## Famílias exigidas\n- Forms: Input, Select, Textarea, Checkbox e Switch foram amostrados pela família e ocorrências de primitives diretos.\n- Cards: família Card foi conferida contra o primitive central e candidatos co-localizados.\n- Tabelas: Table/DataTable e uso de \`<table>\` foram classificados como REVIEW até DG-009.\n- Overlays: Dialog, Drawer, Sheet, Popover e Modal foram agrupados para revisão de responsabilidade.\n\n## Resultado\n- A amostra confirma que o inventário é uma base estática confiável para priorização, mas não substitui inspeção de runtime antes de migrar uma família. Achados incertos continuam com \`confidence: MEDIUM\` ou \`REVIEW\`.\n`);
ensure("docs/design-system/audit/UI_AUDIT_REPORT.md", `# UI Audit Report\n\n## Resumo executivo\n\nEsta etapa produziu uma fotografia estática da UI sem alterar produção. Há ${inventory.summary.routes} rotas, ${inventory.summary.components} componentes candidatos e ${inventory.summary.violations} achados que precisam de triagem; nenhum é automaticamente bug visual.\n\n## Inventário\n\n${table([["Rotas", inventory.summary.routes], ["Componentes", inventory.summary.components], ["Primitives centralizados", inventory.summary.primitives], ["Famílias com múltiplas implementações", inventory.summary.duplicates], ["Violações/itens para revisão", inventory.summary.violations], ["Gaps descobertos", inventory.summary.designGaps]], ["Métrica", "Quantidade"])}\n\n## Principais famílias e canônicos candidatos\n\n${table(Object.entries(families).filter(([, item]) => item.implementations > 0).sort((a, b) => b[1].implementations - a[1].implementations).slice(0, 12).map(([name, item]) => [name, item.implementations, item.canonical ? `\`${item.canonical}\`` : "gap/ausente", item.recommendation]), ["Família", "Implementações", "Canônico candidato", "Recomendação"])}\n\n## Valores arbitrários\n\n${table(Object.entries(arbitrary).map(([type, count]) => [type, count]), ["Categoria", "Ocorrências"])}\n\n## Inconsistências e riscos\n\n- Foundations do contrato têm conflitos/lacunas (DG-001 a DG-008); a auditoria não os resolveu silenciosamente.\n- DataTable, controles de formulário e ownership de overlays surgiram como necessidades legítimas de sistema (DG-009 a DG-011).\n- Raw HTML, `outline-none`, valores arbitrários e elementos clicáveis não semânticos foram catalogados com evidência; são \`REVIEW\` salvo onde a regra é inequívoca.\n- Responsividade, estados e acessibilidade foram inferidos por evidência estática e precisam de validação runtime por família antes da migração.\n\n## Top 20 prioridades de triagem\n\n${top.map((item, index) => `${index + 1}. **${item.type}** — \`${item.file}:${item.line}\` — ${item.reason}`).join("\n")}\n\n## Ondas recomendadas\n\nVer [MIGRATION_MAP.md](../MIGRATION_MAP.md). Nenhuma está em execução.\n\n## Validação do inventário\n\nA amostra de 10 rotas, 20 componentes e famílias de forms/cards/tables/overlays está em [MANUAL_VALIDATION.md](./MANUAL_VALIDATION.md).\n\n## Limitações\n\nA análise não calcula equivalência visual pixel a pixel, nem comprova elementos condicionais em runtime. O inventário é verificável por arquivo/linha e foi projetado para orientar a próxima etapa, não para justificar alteração automática.\n`);
*/
ensure("docs/design-system/MIGRATION_MAP.md", [
  "# Mapa de Migração Recomendado", "",
  "Nenhuma onda foi iniciada. Todos os itens permanecem AUDITED.", "",
  "## Wave 0 — decisões bloqueantes", "- DG-001 a DG-008 e os gaps DG-009 (DataTable), DG-010 (FormField) e DG-011 (overlays).", "",
  "## Wave 1 — primitives", "- Button, Input/Select/Textarea, Badge e tipografia.", "",
  "## Wave 2 — containers e overlays", "- Card, Dialog/Drawer/Popover, Tabs, Toast e feedback.", "",
  "## Wave 3 — padrões", "- PageHeader, FilterToolbar, FormSection e DataTable.", "",
  "## Wave 4 — superfícies", "- Leads, atendimento, clientes e configurações após os canônicos.", "",
  "Toda onda exige acessibilidade, estados e responsividade; nenhuma inicia nesta etapa."
].join("\n") + "\n");
ensure("docs/design-system/audit/MANUAL_VALIDATION.md", [
  "# Validação Manual da Amostra", "",
  "A auditoria foi confrontada por leitura de código, não por teste visual runtime.", "",
  "## Rotas (10)",
  ...Object.keys(routes).filter((route) => route !== "/").slice(0, 10).map((route) => "- " + route + " — " + routes[route].file), "",
  "## Componentes (20)",
  ...componentRecords.slice(0, 20).map((component) => "- " + component.path + " — " + component.category + " / " + (component.designSystemEquivalent ?? "sem equivalente")), "",
  "## Famílias exigidas",
  "- Forms, cards, tables e overlays foram conferidos pelas famílias e pelas evidências de primitives diretos.",
  "- Itens incertos permanecem com confidence MEDIUM ou REVIEW."
].join("\n") + "\n");
ensure("docs/design-system/audit/UI_AUDIT_REPORT.md", [
  "# UI Audit Report", "",
  "## Resumo executivo",
  "Auditoria estática sem mudança de produção: " + inventory.summary.routes + " rotas, " + inventory.summary.components + " componentes candidatos e " + inventory.summary.violations + " itens para triagem.", "",
  "## Inventário",
  table([["Rotas", inventory.summary.routes], ["Componentes", inventory.summary.components], ["Primitives centralizados", inventory.summary.primitives], ["Famílias duplicadas", inventory.summary.duplicates], ["Achados", inventory.summary.violations], ["Gaps", inventory.summary.designGaps]], ["Métrica", "Quantidade"]), "",
  "## Principais famílias",
  table(Object.entries(families).filter(([, item]) => item.implementations > 0).sort((a, b) => b[1].implementations - a[1].implementations).slice(0, 12).map(([name, item]) => [name, item.implementations, item.canonical ?? "gap/ausente", item.recommendation]), ["Família", "Implementações", "Canônico candidato", "Recomendação"]), "",
  "## Valores arbitrários",
  table(Object.entries(arbitrary).map(([type, count]) => [type, count]), ["Categoria", "Ocorrências"]), "",
  "## Riscos e gaps",
  "- Foundations ainda têm DG-001 a DG-008; a auditoria não os resolveu.",
  "- DataTable, FormField/controles e ownership de overlays são DG-009 a DG-011.",
  "- Raw HTML, outline-none, valores arbitrários e elementos clicáveis não semânticos são evidências de REVIEW, não correções automáticas.", "",
  "## Top 20 prioridades de triagem",
  ...top.map((item, index) => (index + 1) + ". " + item.type + " — " + item.file + ":" + item.line + " — " + item.reason), "",
  "## Ondas recomendadas",
  "Ver [MIGRATION_MAP.md](../MIGRATION_MAP.md). Nenhuma onda foi iniciada.", "",
  "## Validação do inventário",
  "A amostra de 10 rotas, 20 componentes e famílias está em [MANUAL_VALIDATION.md](./MANUAL_VALIDATION.md).", "",
  "## Limitações",
  "A análise é estática; não comprova equivalência visual ou elementos condicionais em runtime."
].join("\n") + "\n");
console.log(JSON.stringify(inventory.summary, null, 2));
