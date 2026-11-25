# Ícones de marcador (2026-11-25)

Pedido: redesenhar os ícones do sistema com a skill `draw-icons` (instalada globalmente em `~/.claude/skills/draw-icons`), no estilo "feito à mão, como marcador no quadro branco".

## Decisões (com o usuário)

- Estilo A: traço 2,5, pontas e junções redondas, cantos circulares 3 e 1,5 (`icons.yaml` na raiz). A skill desenha com geometria limpa; o efeito de marcador é uma textura igual para todos, o filtro SVG `#marcador` (`MarkerFilterDefs` no layout raiz).
- Por lotes: primeiro a navegação, depois o resto. Só no preview até o usuário aprovar; **não vai para `feat/diretor-visual-lite` (produção)** antes disso.
- Tamanhos desenhados: 16, 20 e 24 px.

## Lote 1: navegação (19 ícones)

- Fontes em `src/components/icons/source/`, SVGs construídos em `src/components/icons/`, componentes React em `src/components/icons/marker-icons.tsx` (gerado por `node scripts/icons-to-tsx.mjs` depois de `icons.js build`).
- Trocados: áreas do menu lateral (`corretop-sidebar.tsx`: Início, Conversas, Leads, Distribuição, Comercial, Equipe, Atendimento IA, Marketing, Configurações, Financeiro, ERP, Call Âncora e Agente) e a barra inferior e o trilho lateral do Lite (`light-tab-icons.tsx`).
- Comercial deixou o círculo com cifrão por uma cédula (regra `avoid`); Call Âncora virou um celular.
- O estado ativo não troca mais para ícone cheio (Phosphor `fill`): o marcador fica só em traço; o ativo continua marcado pelo fundo da linha.
- Desenhados e ainda não ligados: `chevron-down`, `sign-out`, `user-circle` (menu da conta, que usa 12 e 16 px; entram no próximo lote).
- Laboratório: `/dev/laboratorio`, fluxo "Ícones de marcador" (conjunto em 16/20/24 px e a barra inferior real).

## Lote 2: os mais usados (27 novos, 46 no total)

- Novos: check-circle, check, x, x-circle, plus, arrow-right, arrow-left, arrow-up-right, trash, clock, building, file-text, download, refresh, warning, phone, lock, target, magnifier, copy, pencil, chart-bar, trend-up, warning-circle, bell, gear, calendar.
- Ligados dentro de `src/components/huge-icons.tsx` (mapa `MARKER_ICONS`): quando o nome exportado tem desenho de marcador, o wrapper mostra ele no lugar do Hugeicons, na mesma caixa. Assim cada ícone desenhado vale para os ~245 arquivos que importam de `@/components/huge-icons` sem mexer neles. Ex.: CheckCircle, ArrowRight, Plus, Trash, Clock, Users, Buildings, X, FileText, FileArrowDown, ArrowsClockwise, Warning, ChatCircleText, Phone, LockKey, XCircle, Target, Sparkle, MagnifyingGlass, Copy, PencilSimple, ChartBar, WarningCircle, ShieldCheck, Bell, Gear, CalendarBlank, TrendUp.
- Ficam como estão: o logo do WhatsApp (marca), o spinner (`Loader2Icon`) e os ícones de outros conceitos ainda sem desenho.
- O snapshot de `bulk-dialogs.legacy.test.tsx` foi atualizado: muda só o SVG do ícone.

## Falta

Os ~70 nomes restantes do `huge-icons.tsx` e os ícones importados direto de `lucide-react` (175 nomes em 236 arquivos) e `@phosphor-icons/react` (33), em lotes. Para o lucide, o caminho com menos risco é o mesmo do `huge-icons`: um módulo intermediário com os mesmos nomes.

## Verificação

- `icons.js lint all`: 19 ícones, 0 erros, 0 avisos (avisos aceitos com motivo no próprio SVG).
- `npx tsc --noEmit` limpo; `vitest` em `src/components/light`: 21 arquivos, 71 testes passando.
- Conferido no laboratório num dev server do worktree (a 3005 estava fora do ar).
