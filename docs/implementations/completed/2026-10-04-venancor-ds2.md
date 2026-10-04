# Venancor DS2 na linha atual do CRM

Base: `design/venancor` a partir de `perf/crons-n1`. Fonte visual: `docs/design-system/venancor.md`. A estrutura do menu, dashboard, ordem e agrupamento das telas foi preservada.

- Tokens: paletas light/dark, superfícies, estados, gráficos, raios e sombras em `src/app/globals.css`; Plus Jakarta Sans no layout e Amil disponível apenas como `--font-logo`. Logos atuais são imagens/SVG. Tema claro permanece padrão; o cookie do layout foi alinhado ao `ThemeProvider`.
- Primitivos: tratamento visual de `14c12afa` adaptado às APIs atuais de `src/components/ui/`, inclusive o `SheetBody` com rolagem nativa.
- Telas: classes de shell, sidebars, dashboard, leads, plantão/distribuição, atendimento, conversas e minha-fila alinhadas aos tokens. Nenhum handler, query, dado, ordem de JSX ou agrupamento foi alterado.

Correções de integração: `dashboard-header.tsx`, `app-shell.tsx` e `corretop-sidebar.tsx` seguem a estrutura restaurada por Vinicios em `2be18408`. O canvas do dashboard fica branco (`#ffffff`), e os hovers do sidebar usam o grupo nomeado `group/navitem`. Os tokens `ds-*` do tema claro seguem o mapeamento Venancor de `1e1f13f7`. Superfícies interativas escuras remanescentes em plantão e tooltip foram trocadas por superfícies claras e seleção primária suave.

Densidade do CRM: alturas, larguras, paddings, tamanhos de ícones e fontes dos primitivos seguem `origin/perf/crons-n1`. O tratamento Venancor dos primitivos altera somente cor, raio, borda e sombra; os aumentos iniciais em input, select, textarea, checkbox, switch, tabs, dialog, sheet e sidebar foram removidos.

Verificação: typecheck isolado de `src/` passou após tokens, primitivos e telas. Lint dos primitivos: 0 erros, 11 avisos preexistentes. Lint das telas com `--quiet`: passou. Vitest: 7 testes dos primitivos e 11 de calendário/planejamento de plantão passaram. `git diff --check` passou. A comparação AST de 58 arquivos de tela contra `HEAD`, neutralizando apenas valores de `className` e `triggerClassName`, encontrou 0 diferenças externas às classes. `src/components/ui/sidebar.tsx` teve apenas strings de classes alteradas, conferidas no diff.

Build a cargo do Vinicios, conforme instrução explícita. O comando `agent:context` foi tentado e falhou por `ENOMEM`; o contexto mínimo foi lido manualmente. `agent:verify --level full` executaria `build`, então não foi usado.

Após as correções de integração: typecheck isolado de `src/`, ESLint dos três arquivos ajustados com `--quiet`, Vitest (3 arquivos, 15 testes), `git diff --check` e comparação AST de 55 arquivos de tela contra `HEAD` passaram; a comparação encontrou 0 mudanças fora de classes.
