# Diretor Lite F1: pele das primitivas

Status: implementada na branch `feat/diretor-lite-f1`, aguardando revisão visual dos prints pelo Vinicios.

## Escopo realizado

- A folha `director-primitives.css` aplica a pele pelo `data-slot` dentro de `[data-skin="diretor"]`, usando tokens de superfície, cor, foco, sombra e movimento.
- As primitivas principais recebem slots e estados para botões, badges, notificações, cartões, campos, seletores, diálogos, tabelas, painéis, menus, indicadores, abas, popovers, tooltips, skeletons, checkbox, switch, progresso, separadores e áreas de rolagem.
- Os adaptadores de segmented control, empty state, avatar, switch e envio de documentos só entram com o `ArcScopeProvider` habilitado. Os caminhos existentes continuam ativos com o provider desligado.
- Botões de ação substituem o StatefulButton apenas no escopo Diretor. Os dois pontos de uso mantêm a implementação anterior fora desse escopo.
- Badges preservam seus mapas legados fora do escopo; os estados do Diretor usam os tokens semânticos.
- Os gráficos usam as séries Arc sem gradiente no escopo Diretor, mantendo a renderização anterior fora dele.
- O catálogo em `/internal/design-system` permite alternar a prévia e só abre para diretor ou super admin. `/dev/diretor-primitivas-preview` existe somente em desenvolvimento.

## Verificação

- O teste de snapshot compara as classes das seis primitivas principais com o provider ausente e desligado.
- Browser Playwright: catálogo em 1440 e 390, chave ligada e desligada. Os seis controles medidos ficaram com 44 px; sem overflow horizontal.
- Prints para revisão: `C:/Users/kyper/AppData/Local/Temp/claude/C--Users-kyper-brain/24b9384d-0a21-4b55-a4b1-9fff1a71d8e4/scratchpad/f1-prints/`.
- `npx vitest run` focado: 8 arquivos, 50 testes aprovados.
- `npx tsc --noEmit -p .`: aprovado.
- ESLint dos arquivos alterados: zero erros, 19 avisos preexistentes nos componentes compartilhados e efeitos da lista de leads.
- `node scripts/check-lite-skin.mjs`: relatório completo de 811 arquivos. No subconjunto tocado coberto pelo scanner, comparação com a base encontrou zero novos desvios visuais; as diferenças são importações Arc/UI necessárias aos adaptadores e catálogo.
- `git diff --check`: aprovado.

## Limites desta etapa

- A base não contém `src/components/ui/toggle.tsx`; os estados encontrados de toggle são cobertos pelos seletores existentes de botão, checkbox e switch.
- A checagem completa continua listando desvios antigos em outras rotas e componentes. A F1 não converteu o modo Diretor inteiro.
- A aprovação visual dos prints pelo Vinicios continua pendente. Nenhum teste de banco, migration, build ou push foi executado.

## Correções após revisão do Vigia

- Revertido o `cbdb902b`: `LightChrome`, `director-skin.css` e `director-primitives.css` permanecem estáticos no shell, conforme a solução aprovada da F0a. Os arquivos do gate dinâmico foram removidos e `layout.test.ts` voltou ao conteúdo da origin.
- Testes verificam que cada seletor da folha de primitivas inclui `[data-skin="diretor"]` e que o HTML das primitivas principais sem provider coincide com a referência da origin.
- `data-variant`, `data-size`, `data-interactive` e slots de StatCard, combobox, Sonner, ScrollArea e AnimatedBadge só aparecem com o escopo Arc ativo. Os cinco focos de menu preservam `focus:bg-accent` fora do escopo e usam `focus:bg-muted` dentro.
- A área de rolagem mantém a trilha e o conteúdo; o thumb usa raio de 999px e a barra continua com 8px pelas classes existentes.
- Revisados os codemods B: os dois pontos de uso de `StatefulButton` usam `ActionButton` somente no escopo do Diretor; segmented control, empty state, switch, avatar e upload mantêm seus caminhos legados fora dele. `AnimatedBadge` conserva o mapa legado e só condiciona os novos atributos.
- Os quatro prints foram regenerados em `C:/Users/kyper/AppData/Local/Temp/claude/C--Users-kyper-brain/24b9384d-0a21-4b55-a4b1-9fff1a71d8e4/scratchpad/f1-prints/`; aguardam aprovação visual do Vinicios.
- Validação desta correção: Vitest focado aprovou 3 arquivos e 46 testes; `npx tsc --noEmit -p .` passou; ESLint passou sem erros, com 13 avisos preexistentes; `node scripts/check-lite-skin.mjs` analisou 811 arquivos; `git diff --check` passou. A comparação das linhas de estilo alteradas registrou zero novos desvios visuais.

## Acompanhamento visual da ScrollArea

- Causa: o exemplo do catálogo aplicava `radius-control` inline no contêiner e em cada parágrafo, com fundo próprio e espaçamento entre os itens. Isso formava uma moldura grossa e linhas em forma de pílula.
- Sob `[data-skin="diretor"]`, o contêiner agora usa borda fina e `radius-panel`; as atividades são linhas sem fundo nem raio, separadas por divisórias sutis. A versão sem a chave preserva a marcação e estilos anteriores. O thumb continua fino pela barra de 8px e arredondado.
- Os quatro prints foram apagados e capturados de novo pelo servidor Next ativo às 16:27. Tamanhos: 1440 desligada 146250 bytes, 1440 ligada 162761, 390 desligada 131908, 390 ligada 151488. Prints ligados em desktop e celular conferidos visualmente.
- Validação adicional: os mesmos 46 testes focados, type-check aprovado, ESLint sem erros, guarda-corpo com 811 arquivos e zero novos desvios nas alterações, `git diff --check` aprovado.

## Última rodada de paridade com a origin

- O snapshot externo foi gerado em worktree destacado no commit `71e631f3`, conferindo os componentes com `git show origin/feat/diretor-visual-lite:<arquivo>`. A fixture cobre Button, Card, StatCard, Sonner, ScrollArea, Combobox e AnimatedBadge sem `ArcScopeProvider`; a referência também confirma que o Card legado mantém `data-slot`, `data-variant` e `data-size`.
- A comparação encontrou que o thumb da ScrollArea só era forçado no código atual. `forceMount` no thumb agora só é repassado com o escopo do Diretor ativo; sem provider, o HTML coincide com a origin.
- Auditoria dos usos de Card: 53 arquivos de Server Components usam a primitiva. Nenhum passa callback, `ref` ou spread de props aos componentes Card; os usos de `DashboardCard` observados passam apenas atributos serializáveis. Mantido o hook existente.
- Validação desta rodada: `npx vitest run src/components/arc/director-primitives.test.tsx` passou com 11 testes; `npx tsc --noEmit -p .` passou; ESLint dos dois arquivos de código passou; `node scripts/check-lite-skin.mjs` analisou 811 arquivos; `git diff --check` passou. Não executados testes de banco, build, migration ou push.
