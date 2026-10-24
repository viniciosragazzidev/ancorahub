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
