# Refinamento de áreas, movimento e entrada de rotas · plano

Data: 18/11/2026 · Dono: Vinicios · Status: **§8 decidido em 18/11 (recomendações adotadas); etapa 0 entregue em 18/11** (branch `feat/movimento-e0-fundacao`); etapas 1 a 10 pendentes
Padrões que mandam: `docs/design-system.md` (tokens, densidade), `docs/design-system/FEEDBACK.md` (níveis 0 a 3; vence qualquer conflito de movimento), `docs/design-system/MOTION_RULES.md` (tokens canônicos em `src/components/arc/motion-tokens.ts`), `docs/ux/motion-frequencia.md` (orçamento por frequência).
Referências: landing https://salte.app/ (estudada no navegador em 18/11) e os quatro prints enviados pelo usuário. O vídeo do X (`johny_victor_/status/2122792281380139213`) **não pôde ser visto**: o post abre, mas o player fica atrás da parede de login do X. O plano segue sem ele.

Objetivo: o AncoraHub inteiro com o acabamento da referência (blocos de área limpos, números grandes, entrada calma e em sequência, troca de abas e drawers fluidos), **sem** criar token fora do design system e sem quebrar o orçamento de movimento das telas usadas centenas de vezes por dia.

---

## 1. O que a referência faz (medido no DOM em 18/11)

| Peça | Como é feita | Tempo e curva |
|---|---|---|
| Faixa azul dos módulos | gradiente vertical azul → quase branco, grão `soft-light` 0,55, halftone em `multiply` 0,4 com máscara, pontilhado SVG 12px (`r=1.3`, branco 12%), brilho interno por `box-shadow inset`, recorte `clip-path: inset(... round 32px)` | estático |
| Abas Operacional / Financeiro / Comercial / WhatsApp | ativa `#fff`, inativa `rgba(255,255,255,.38)`, hover `.7`; troca automática com anel de progresso (`modulo-progresso`, 7 s linear, pausa fora da tela) | cor 300 ms |
| Texto da aba | sai: opacidade 300 ms + `translate` 400 ms; entra: opacidade 400 ms e `translate` 500 ms com atraso de 120 ms | `cubic-bezier(.22,1,.36,1)` |
| Tela do produto (mockup) | imagens empilhadas, só a ativa com `opacity:1` (crossfade puro, sem deslocamento) | 450 ms |
| Retrato da pessoa | caixa 250px, `radius 30px`, `box-shadow` branca externa + três `inset` brancas = borda esfumada; fica fixa sobre o mockup | estático |
| Bloco "Sugestões • Salte AI" | faixa de fundo azul muito claro, rótulo azul pequeno, números destacados em chip azul-claro dentro do texto | parte do mockup |
| Cards do mockup | borda fina, sem sombra, ícone em quadrado, rótulo pequeno, número grande, linha de contexto cinza, `(i)` à direita | estático |
| Entrada de arte | `wa-in` (8px + fade, 660 ms), `wa-pop` (escala .94, 520 ms, leve overshoot), `wa-draw` (scaleX, 420 ms), atrasos por `--d`; dispara uma vez quando entra na tela | `(.22,1,.36,1)` |
| Menus | `menu-pop`: 6px + escala .96 + fade | curto |
| Scroll | `animation-timeline: view()/scroll()` para o hero encolher e o rodapé subir; laços infinitos pausam fora da tela | — |
| Movimento reduzido | toda animação vive dentro de `@media (prefers-reduced-motion: no-preference)`; em `reduce` vira troca seca | — |

Leitura: o "acabamento" vem de **três coisas**, nenhuma delas é animação chamativa: (1) blocos com borda fina e hierarquia tipográfica forte (rótulo pequeno → número grande → contexto); (2) **uma curva só** (`.22,1,.36,1`) e deslocamentos pequenos (6 a 8px); (3) crossfade em vez de slide quando o conteúdo troca no mesmo lugar.

## 2. Estado atual do AncoraHub (inventário de 18/11)

Mapa completo das rotas e componentes levantado no worktree; os pontos que importam para este plano:

**Rotas e entrada**
- Não há `template.tsx` em nenhum grupo. A transição de rota está **desligada**: `src/components/motion/route-view-transition.tsx` só devolve `children` (a View Transition do React cancelava requisições RSC e prendia o loading). O CSS `::view-transition-*` (`src/app/globals.css:1028-1093`) e a DEC-034 (`docs/decision-log.md:624`) continuam descrevendo algo que não roda.
- Cerca de 50 rotas do `(dashboard)` têm `loading.tsx`; cerca de 30 caem no `RouteLoading` do grupo (barra + spinner central): `/atendimento/*`, `/marketing/*`, `/financeiro/*` (subpáginas), `/settings/*`, `/vendas/[id]`, `/equipe/cargos|dashboard|pos-venda|plantoes`, entre outras.

**Componentes compartilhados**
- `Card` (`src/components/ui/card.tsx`): borda + `shadow-none` + `--radius-card`; sem entrada. `SectionCardHeader`: sem movimento.
- `Sheet` (`src/components/ui/sheet.tsx` + regras globais em `src/styles/interface-motion.css:131-168`): 12px de deslize lateral, 300 ms, `--ease-smooth-out`; abaixo de 559px sobe de baixo. Conteúdo interno entra todo de uma vez.
- `DropdownMenu`/`Popover`/`Tooltip`: 4px + fade 150 ms, saída 100 ms (globais em `interface-motion.css:88-108`).
- Abas: cinco implementações (`ui/tabs` com `layoutId`, `ds-tabs`, `route-section-tabs`, `foundations/page-tabs` com `shadow-xs`, `route-tabs` do Lite). **Nenhuma faz crossfade do painel.**
- `DataTable`: duas cópias (`src/components/data-table` canônica e `src/components/ui/data-table`). A canônica usa `useRowEnter()` (300 ms, 40 ms de cascata, até 8 linhas), contra a DEC-034.
- `SearchAddList`: só `animate-spin`.
- Skeleton: cerca de nove variações (`RouteLoading`, `LitePageLoading`, `LightPageSkeleton`, `ui/Skeleton`, Arc `Skeleton`, `ShimmerSkeleton`, `foundations/PageSkeleton`, `DirectorLiteDashboardSkeleton`, `DsSkeleton`), mais `SkeletonReveal` e `LiteSkeletonToContent` para a troca.
- Estado vazio: três (`components/empty-state.tsx`, `ui/ds-empty-state.tsx`, `foundations/empty-state.tsx`) + Arc.
- Cards de número: `dashboard/metric-card.tsx` (com `CountUpText` 600 ms), `arc/metric-card`, `ds-stat-tile`, `ds-trend-stat-card`, `dashboard-card`, as views do Diretor Lite.
- Bloco de IA: `funnel-insights-panel`, `ai-conversation-insight-card`, `team-management-extras/insights-section` — três visuais diferentes.

**Tokens e infraestrutura**
- Cinco conjuntos de tokens com o mesmo nome e valores diferentes: "fast" vale 120, 150, 160, 200 ou 250 ms conforme o arquivo (`globals.css:161-189`, `lib/motion/motion-tokens.ts`, `arc/motion-tokens.ts`, `shared/animations/variants.ts`, `lite/motion/motion-tokens.css`). `.arc-venancor` sobrescreve `--duration-fast` sem avisar.
- Cascata: 32 ms (`ds-rise`), 35 ms (Arc), 40 ms (`StaggerItem`); máximo 4 em `.ct-stagger` e 8 no resto.
- Movimento reduzido tem três sinais (SO, kill switch `feature_interface_motion_enabled`, "Menos animação" em `html[data-reduce-motion]`), mas o kit Lite só lê o SO (`useReducedMotion` do `motion`), e só o Diretor Lite e o `useFeedback` leem a preferência do usuário. O `InterfaceMotionProvider` começa **desligado** até a API responder, o que mata a primeira entrada de toda tela.
- Lixo acumulado: `transition-all` em 49 arquivos; ~120 `duration-150/200/300/500/700` do Tailwind; ~160 durações inline; `animate-bounce` em `assistente-chat-client.tsx:405-407` (proibido); `hover:shadow-*` em 10 arquivos e `hover:-translate-y` em 4 (contra o "bordas definem containers").
- `/dev/laboratorio` cobre só fluxos do corretor no Lite (plantão, lead, lista, conquistas), com resultado ok/falha e atraso 400/1200/3000 ms.

## 3. Comparação direta

| Tema | Referência | AncoraHub hoje | Distância |
|---|---|---|---|
| Bloco de área | borda fina, sem sombra, rótulo → número → contexto | regra igual no DS, mas 5 cards de número e sombras no hover em 10 telas | média: unificar e limpar |
| Número grande | display grande, unidade cinza menor (`R$` esmaecido) | tamanhos variam por tela; count-up em uma, proibido em outra | média |
| Bloco de IA | uma faixa clara, rótulo fixo, números em chip | três componentes diferentes | média |
| Curva | uma só | quatro curvas e cinco "fast" | alta |
| Troca no mesmo lugar | crossfade sem deslize | aba troca seca; skeleton troca seco em muitas rotas | alta |
| Entrada de rota | — (landing) | desligada; spinner central em ~30 rotas | alta |
| Menus | 6px + .96 | 4px + fade 150 ms | baixa (já bom) |
| Movimento reduzido | tudo atrás de `no-preference` | três sinais lidos de forma desigual | alta |
| Fundo azul pontilhado, retrato esfumado | marca, landing | não existe; DS proíbe azul como superfície grande | **decisão do usuário** |

## 4. Decisões adotadas (opção recomendada)

Conforme a regra "quando houver opção recomendada, adotá-la":

1. **Um conjunto de tokens**: o canônico é `src/components/arc/motion-tokens.ts` (já citado por `MOTION_RULES.md` e `FEEDBACK.md`). Os demais viram apelidos dele ou somem.
2. **Curva de entrada** `enter = cubic-bezier(.16,1,.3,1)` e **curva padrão** `standard = cubic-bezier(.22,1,.36,1)` (é a da referência). Saída `exit = (.7,0,.84,0)`. Nada de overshoot no modo normal.
3. **Transição de rota só por CSS**, com `template.tsx` por grupo, sem View Transition do React (que quebrava o RSC).
4. **Tabelas não animam linha em filtro, ordenação ou paginação** (DEC-034). Só a primeira carga da rota entra em cascata, e linha nova em tempo real recebe destaque (`NewItemHighlight`).
5. **Números não contam do zero ao abrir a tela** (nível 0 do FEEDBACK). Quando um valor muda com a tela aberta (tempo real), o número rola (`LiteNumber`) como nível 2, com o limite diário que o FEEDBACK já define.
6. **Fundo azul, halftone e retrato esfumado ficam fora das telas do produto** até o usuário decidir (§8).

## 5. Tokens de movimento deste plano

Todos já existem em `arc/motion-tokens.ts` (ms entre parênteses). Nenhum valor novo.

| Uso | Duração | Curva | Deslocamento | Cascata |
|---|---|---|---|---|
| Pressão (botão, linha, card) | `instant` (120) | `standard` | escala `.97` / `.99` / `.985` | — |
| Troca de aba, filtro, painel de aba | `fast` (160) | `standard` | só opacidade | — |
| Saída de qualquer coisa | `exit` (180) | `exit` | — | — |
| Menu, popover | `fast` (160) | `enter` | 4px (`--distance-micro`) | — |
| Entrada de rota (bloco a bloco) | `standard` (240) | `enter` | 6px (`--distance-small`) | `stagger.item` (35), máx. 6 blocos |
| Sheet / drawer | `standard` (240) | `enter` | 12px (`--distance-medium`) | seções internas: 35, máx. 4 |
| Dialog | `standard` (240) | `enter` | escala `.98` | — |
| Skeleton → conteúdo | `fast` (160) | `standard` | só opacidade | — |
| Estado vazio | `standard` (240) | `enter` | 6px | ilustração → texto +80 → ação +160 (ritmo do FEEDBACK) |
| Número que muda ao vivo | `considered` (480) | `standard` | rolagem por dígito | nível 2 |

Teto total de entrada de uma rota: **240 + 5 × 35 = 415 ms** para o último bloco. Telas de altíssima frequência (`/leads`, `/conversas`, `/minha-fila`, `/plantoes/agora`, chat do Lite) usam só opacidade em `fast` (160), sem cascata, conforme `docs/ux/motion-frequencia.md`.

**Movimento reduzido**, em toda etapa: com qualquer um dos três sinais ligado (SO, "Menos animação", kill switch), deslocamento, escala, blur e cascata viram zero; fica só opacidade de no máximo 120 ms ou troca seca. O shimmer do skeleton vira cor fixa.

---

## 6. Etapas, em ordem

Cada etapa é uma branch própria (`feat/movimento-eN-...`), com merge em `preview/3005` depois de cada commit, conforme o CLAUDE.md global. Nenhuma etapa muda dado, rota ou texto de tela (regra "reorganizar mantém o design").

### Etapa 0 · Fundação: um token, um sinal de movimento reduzido, uma vitrine · ENTREGUE 18/11/2026

Entregue: `globals.css` com os nomes canônicos (`--duration-instant|fast|exit|standard|draw|considered`, `--duration-stagger` 35ms, `--ease-enter|standard|exit`) e os antigos como apelidos (`--duration-quick` → `fast`, `--motion-duration-normal` → `standard`, `--ease-smooth-out` → `standard`…); em `interface-motion.css` o `--duration-fast` que valia 250ms virou `--duration-standard` (240ms), então overlays, campos e toasts quase não mudam de tempo; `director-skin.css` não sobrescreve mais `--duration-fast`; `ds-rise` 240ms e cascata pela variável; `src/lib/motion/motion-tokens.ts` e `src/shared/animations/variants.ts` apontam para o canônico; teste `src/lib/motion/motion-tokens-sync.test.ts`. `useMotionAllowed()` (`src/components/motion/use-motion-allowed.ts`) junta sistema, "Menos animação" e kill switch; o provider começa ligado e marca `html[data-interface-motion="off"]` também com "Menos animação"; o kit Lite inteiro, `animated-badge`, `animated-toast` e o `useReduce` do Diretor Lite passam por ele. `light-motion.tsx` reexporta o kit (só `LiteList`/`LiteListItem` ficam lá, por serem `ul`/`li`). DEC-034 com emenda e `MOTION.md` atualizados. Laboratório: fluxo "Movimento (componentes)" com cards, tabela, drawer, menu, abas, skeleton e vazio, e interruptores "Menos animação" e "Kill switch". Diferença do plano: o hook não ficou num arquivo próprio com a lógica; mora no provider e o arquivo `use-motion-allowed.ts` só reexporta.


**O que muda**
- `globals.css:161-189`, `lib/motion/motion-tokens.ts`, `shared/animations/variants.ts` e `lite/motion/motion-tokens.css` passam a derivar de `arc/motion-tokens.ts` (variáveis CSS geradas a partir dele ou escritas uma vez com o mesmo valor e um teste que compara). `.arc-venancor` deixa de sobrescrever durações.
- Hook único `useMotionAllowed()` em `src/components/motion/` que junta SO + `data-reduce-motion` + kill switch. `LitePageEnter`, `LiteStagger`, `StaggerItem`, `useRowEnter`, `Tabs`, `Sheet` passam a usá-lo. A regra CSS equivalente vira um seletor só (`html[data-motion="reduced"]`), aplicado pelo provider.
- `InterfaceMotionProvider` começa **ligado** quando o SO permite e só desliga se a API disser que o kill switch está ativo (hoje a primeira entrada sempre se perde).
- Apagar a duplicata `src/components/light/light-motion.tsx` em favor de `src/components/lite/motion/*`.
- Atualizar a DEC-034 e o `MOTION.md` para dizer o que de fato roda.
- Nova aba **"Movimento"** em `/dev/laboratorio`: renderiza os componentes reais (Card de número, bloco de IA, `DataTable`, `Sheet`, `Tabs`, `EmptyState`, skeleton de cada forma) com os controles do painel atual (atraso 400/1200/3000 ms, resultado ok/falha) mais três interruptores: "Movimento reduzido", "Menos animação" e "Kill switch".

**Componentes afetados**: tokens acima, `interface-motion-provider.tsx`, `use-reduced-motion.ts`, `a11y-prefs.tsx`, `lite/motion/*`, `components/motion/stagger.tsx`, `lab.tsx`, `lib/dev-lab.tsx`.

**Validação**
- Teste unitário comparando os valores CSS e JS.
- No laboratório: cada interruptor desliga deslocamento e cascata (conferir com `getComputedStyle` e gravação de tela).
- No preview 3005: abrir `/dashboard` com o SO em movimento reduzido (emulação do navegador) e sem; nada deve mudar de layout, só a presença do movimento.

### Etapa 1 · Blocos de área (cards e containers) · ENTREGUE 18/11/2026

Entregue: o canônico é o `StatCard` de `src/components/dashboard/metric-card.tsx` (48 usos), não o Arc (zero usos), para não migrar 48 telas. Ele segue o § Stat / KPI Tile: número em Geist Mono 24px pronto (sem `CountUpText`), chip 28px `rounded-ds-buttons`, `tone` (azul por padrão; success/warning/destructive só para status), `info` com `(i)` e tooltip, parado no hover. `MetricGrid` no mesmo arquivo (células com divisória de 1px; linha incompleta fica em branco). `InsightStrip` + `InsightValue` em `src/components/dashboard/insight-strip.tsx` (Callout neutro, rótulo `AI_INSIGHT_LABEL` só para texto da IA); aplicado à frase do funil ("Em resumo") e aos Destaques da equipe (o selo verde/âmbar virou texto). O `ai-conversation-insight-card` ficou como está: é análise interativa com ações, não faixa de leitura. `iconClassName` decorativo saiu de 23 cards (relatórios, qualificação, venda); verde e âmbar viraram `tone`. `KpiComparisonCard`, `DsStatTile` e `DsTrendStatCard` alinhados ao mesmo número e chip; `.ui-metric-card-icon` com radius 8px. `hover:shadow-*` e `hover:-translate-y` fora de 16 arquivos (a landing `src/app/page.tsx` fica para a etapa 10; a welcome-screen ainda tem `hover:scale` e `transition-all`, etapa 9). Vitrine do laboratório com `MetricGrid`, `StatCard` e `InsightStrip`. Ficou de fora: o painel do plantão (`duty-operations-workspace`) mantém o chip próprio aprovado em 14/11.


**O que muda**
- Um card de número canônico, `MetricCard` (base: `src/components/arc/metric-card`), com a anatomia da referência: ícone em quadrado com borda, rótulo `text-sm` Inter, `(i)` opcional à direita que abre tooltip, número grande, linha de contexto cinza, delta colorido opcional (verde ou vermelho, **uma** cor cromática por card). Unidade monetária (`R$`) em cinza de texto secundário, menor que o número.
- Grade de números colada (cards com borda compartilhada, como "Consultas hoje / Sala de espera / Comparecimento / Atrasos") como variante `MetricGrid`: um container com borda 1px e divisórias internas, em vez de quatro cards separados.
- Um bloco de IA canônico, `InsightStrip`, substituindo os três atuais: rótulo fixo pequeno em azul ("Sugestões • Âncora IA", nome a confirmar), texto corrido, números citados destacados. A cor de fundo depende de decisão (§8, item 3).
- Remover `hover:shadow-*`, `hover:-translate-y` e `shadow-xs` de cards informativos (lista de arquivos no §2). Card clicável ganha só troca de borda em `fast` e pressão `.985`.
- Migrar `ds-stat-tile`, `ds-trend-stat-card`, `dashboard-card` e `dashboard/metric-card` para `MetricCard`, e `DsCountUp`/`CountUpText` para valor estático (decisão 5).

**Componentes afetados**: `ui/card.tsx`, `arc/metric-card`, os quatro cards de número, `funnel-insights-panel`, `ai-conversation-insight-card`, `insights-section`, as views do Diretor Lite, e as 10+4 telas com sombra ou elevação no hover.

**Tokens**: borda `#e5e5e5`, radius 12px (card) e 16px (card grande), nada novo. Movimento: só pressão e borda, `instant`/`fast`.

**Movimento reduzido**: sem escala na pressão; borda muda sem transição.

**Validação**: laboratório › Movimento › "Cards" lado a lado com o print da referência; preview 3005 em `/dashboard`, `/financeiro`, `/equipe/desempenho`, `/gestao`. Conferir que nenhum card tem `box-shadow` (busca no DOM).

### Etapa 2 · Entrada de rota e entrada em sequência · PARCIAL 18/11/2026

Entregue a pedido do usuário ("animação mais dinâmica"): `.ct-enter-seq` e `.ct-enter-seq-tight` em `src/styles/interface-motion.css`, CSS puro (vale em componente de servidor). Cada bloco sobe 8px (`--distance-base`), sai de um desfoque de 2px (`--blur-small`) e aparece em `--duration-considered` (480ms) com `--ease-enter`; blocos a cada 80ms (`--duration-micro`, passo `line` dos tokens), até 6; cards dentro de um bloco a cada 35ms com `--enter-offset` para começar depois do bloco pai. Fill `backwards`, então nada fica preso depois. Desligado por movimento reduzido, "Menos animação" e kill switch. Aplicado no Resumo do diretor (`CommandCenter`, modo normal), em `/equipe` e na vitrine do laboratório. Diferença do plano: 480ms e 80ms em vez de 240ms e 35ms, porque o usuário pediu mais movimento; o teto de 480ms continua dentro do "raro" de `motion-frequencia.md`, e por isso não entra nas rotas de alta frequência. Falta: o `template.tsx` (adiado: um invólucro em volta das páginas mexe no flex do layout; vai precisar de um teste por rota) e as demais rotas.


**O que muda**
- `template.tsx` em `(dashboard)`, `(platform-admin)` e `(auth)` envolvendo o conteúdo num `RouteEnter` (CSS puro, `animation` com `both`, sem JS de medição) que aplica a entrada da tabela do §5. O cabeçalho e a navegação lateral **não** remontam nem animam.
- Componente `EnterSequence` (ou o `LiteStagger` existente, generalizado) que dá `--i` aos blocos diretos da página: título e filtros = 0, linha de números = 1, bloco de IA = 2, tabela/conteúdo = 3, painel lateral = 4. Máximo 6.
- Rotas de altíssima frequência marcadas com `data-route-tempo="frequente"` (lista no §5) recebem só opacidade 160 ms.
- Primeira visita do dia (`useFirstTimeToday`, já existe) pode usar a cascata completa; as demais visitas, só opacidade. Isso segue a regra de frequência sem precisar de nova decisão.
- Remover o `RouteViewTransition` inerte e o CSS `::view-transition-*` sem uso.

**Componentes afetados**: novos `template.tsx`, `components/motion/route-view-transition.tsx` (sai), `globals.css:1028-1093` (sai), `layout.tsx:149`, `LitePageEnter`.

**Movimento reduzido**: `RouteEnter` vira opacidade 120 ms; cascata zero.

**Validação**: laboratório › Movimento › "Rota" com uma página falsa de 6 blocos e o seletor de atraso; preview 3005 navegando `/dashboard → /leads → /equipe → /financeiro` e voltando com o botão do navegador: nada pisca, nada pula de lugar, o loading nunca fica preso (o motivo de a View Transition ter sido desligada). Gravar INP no DevTools antes e depois.

### Etapa 3 · Skeletons com a forma do conteúdo

**O que muda**
- Um sistema só, `PageSkeleton`, com formas prontas que espelham os componentes da Etapa 1 e o padrão de densidade: `table` (cabeçalho de seção + 8 linhas), `metrics` (grade de 4), `metrics+table`, `detail` (cabeçalho + abas + blocos), `inbox` (lista + conversa), `chat` (Lite).
- Todas as ~30 rotas sem `loading.tsx` próprio ganham um com a forma certa; o `RouteLoading` com spinner central fica só como último recurso.
- Atraso de 150 ms antes de mostrar o skeleton (evita piscar em carga rápida) e troca skeleton → conteúdo por `SkeletonReveal` (crossfade `fast`, alturas iguais para não pular).
- Shimmer único (o de `interface-motion.css:186-203`), 1,6 s, pausado fora da tela.
- As nove variações atuais viram apelidos de `PageSkeleton` ou somem.

**Componentes afetados**: `ui/skeleton.tsx`, `RouteLoading`, `LitePageLoading`, `LightPageSkeleton`, Arc `Skeleton`, `ShimmerSkeleton`, `foundations/PageSkeleton`, `DirectorLiteDashboardSkeleton`, `DsSkeleton`, e os `loading.tsx` novos.

**Movimento reduzido**: sem shimmer (cor fixa), troca seca.

**Validação**: laboratório › Movimento › "Carregando" com atraso 400/1200/3000 ms para cada forma; preview 3005 com rede "Slow 4G" no DevTools em 10 rotas, conferindo que o skeleton tem a mesma altura do conteúdo (sem CLS; medir no painel Performance).

### Etapa 4 · Estados vazios e de erro

**O que muda**
- Um `EmptyState` canônico (base: `components/empty-state.tsx`), sem `shadow-xs`, com três tamanhos (dentro de tabela, dentro de card, página inteira) e entrada no ritmo do FEEDBACK: visual na hora, texto +80 ms, ação +160 ms.
- Estado vazio de filtro ("nada com esses filtros" + limpar) separado do vazio de verdade ("ainda não há…" + ação de criar). Sem culpa no texto.
- Erro de carga de bloco segue o FEEDBACK: causa, o que continua valendo, "Tentar de novo".

**Componentes afetados**: as três versões de estado vazio + Arc, `DataTable` (slot de vazio), `SearchAddList`.

**Movimento reduzido**: aparece de uma vez.

**Validação**: laboratório › Movimento › "Vazio" e "Erro" (resultado `falha`); preview 3005 em `/equipe` filtrando por nome inexistente, `/notificacoes` vazio, `/indicacoes` sem dados.

### Etapa 5 · Abas e troca de conteúdo

**O que muda**
- Um `Tabs` canônico (base: `ui/tabs.tsx`, que já tem o indicador com `layoutId`), com indicador em `spring.snappy` e **crossfade do painel** em `fast` (só opacidade, mesma altura reservada enquanto troca). `ds-tabs`, `route-section-tabs`, `page-tabs` (sem o `shadow-xs`) e as abas do Lite passam a usá-lo.
- Abas de rota (`RouteSectionTabs`) trocam a URL; o conteúdo entra pelo `RouteEnter` em modo "frequente" (só opacidade), para não somar duas animações.
- Abas sem indicador de fundo seguem a lógica da referência: ativa em cor de texto principal, inativas em texto secundário, hover no meio (tokens de texto do DS, sem cor nova).

**Componentes afetados**: `ui/tabs.tsx`, `ds-tabs.tsx`, `route-section-tabs.tsx`, `foundations/page-tabs.tsx`, `ds-segmented-control.tsx`, `route-tabs` do Lite, `/leads/[id]`.

**Movimento reduzido**: indicador pula, painel troca seco.

**Validação**: laboratório › Movimento › "Abas" com conteúdo de alturas diferentes; preview 3005 em `/leads/[id]`, `/equipe`, `/settings`, `/relatorios`. Clicar rápido em três abas seguidas: nunca mostra dois painéis ao mesmo tempo.

### Etapa 6 · Drawers, dialogs e menus

**O que muda**
- `Sheet`, `Drawer`, `DsSheet` e `Dialog` com os tokens do §5 (hoje 300 ms; passa a `standard` 240 ms, saída `exit` 180 ms). `DsSheet` perde `shadow-lg`/`shadow-ds` e usa a sombra de diálogo do DS.
- Conteúdo do `Sheet` entra em sequência só na abertura: cabeçalho 0, seções +35 ms cada, máximo 4; trocar de registro com o drawer aberto (clicar em outra linha) faz só crossfade `fast` do conteúdo, sem fechar e abrir de novo.
- Menus (`DropdownMenu`, `Popover`, "Configurações ▾", `⋯` da linha) com 4px + fade `fast` e saída `exit`; itens sem cascata (menu é nível 0).
- Overlay do `Sheet` sem `backdrop-blur` em telas de frequência alta (custo de GPU em máquina fraca).

**Componentes afetados**: `ui/sheet.tsx`, `ui/drawer.tsx`, `ui/ds-sheet.tsx`, `ui/dialog.tsx`, `ui/dropdown-menu.tsx`, `ui/popover.tsx`, `interface-motion.css:88-183`, inspetor de lead (`lead-inspector`), side-panel do Lite.

**Movimento reduzido**: drawer e menu aparecem com opacidade 120 ms, sem deslize.

**Validação**: laboratório › Movimento › "Drawer" com troca de registro e atraso de carga; preview 3005 em `/equipe` (clicar linha, trocar de linha, `⋯`), `/leads`, mobile 375px (drawer de baixo).

### Etapa 7 · Tabelas

**O que muda**
- Uma `DataTable` só (`src/components/data-table`); a cópia de `components/ui/data-table` vira reexportação.
- `useRowEnter` só na primeira carga da rota (e só fora das rotas "frequentes"); filtro, ordenação, paginação e busca trocam o corpo com opacidade `fast`, sem cascata.
- Carregando com dados anteriores: corpo a 50% (já existe) com transição `fast`, barra fina no topo em vez de `animate-pulse`.
- Linha nova em tempo real: `NewItemHighlight` (já existe) em vez de entrada.
- Hover da linha só com cor de fundo neutra, `instant`.

**Componentes afetados**: as duas `DataTable`, `useRowEnter`, `leads-data-table.tsx`, `SectionCardHeader`.

**Movimento reduzido**: nada se mexe; linha nova destacada por cor fixa por alguns segundos.

**Validação**: laboratório › Movimento › "Tabela" com botão "chegou linha nova"; preview 3005 em `/equipe`, `/leads`, `/vendas`.

### Etapa 8 · Números e bloco de IA vivos

**O que muda**
- Ao abrir a tela, números aparecem prontos dentro da entrada da rota, sem contar do zero.
- Com a tela aberta, valor que muda por tempo real (leads na fila, vendas do dia) rola por dígito (`LiteNumber`/`AnimatedCounter`), nível 2, respeitando o limite diário do FEEDBACK; delta aparece +160 ms depois do número (ritmo do FEEDBACK).
- `InsightStrip` entra depois dos números (+160 ms), sem efeito de digitação; ao atualizar, crossfade `fast` do texto.

**Componentes afetados**: `MetricCard`, `InsightStrip`, `realtime-sync-provider` (apenas o disparo), views do Diretor Lite.

**Movimento reduzido**: número troca seco.

**Validação**: laboratório › Movimento › "Ao vivo" com botão que altera o valor; preview 3005 em `/dashboard` com dois navegadores (um aceita lead, o outro vê o número mudar).

### Etapa 9 · Limpeza e trava contra regressão

**O que muda**
- Trocar `transition-all` (49 arquivos), `duration-*` soltos (~120) e durações inline (~160) pelos tokens.
- Tirar `animate-bounce` de `assistente-chat-client.tsx:405-407` e revisar os 8 `animate-ping` e 28 `animate-pulse` (laço infinito só em indicador de status ao vivo, e pausado fora da tela).
- Script `scripts/check-motion.mjs` rodando no CI que falha com `transition-all`, `animate-bounce`, `hover:shadow` em card, `hover:-translate-y`, duração fora da lista de tokens e `playSound`/`navigator.vibrate` fora de `useFeedback`.

**Validação**: script verde; varredura visual de 20 rotas no preview 3005.

### Etapa 10 · Superfícies de marca (só depois da decisão do §8)

Landing (`src/app/page.tsx`), login (`LightAuthShell`), primeiro acesso, onboarding e `/welcome`. Candidatos: faixa azul com pontilhado e brilho interno, troca de áreas (Atendimento, Leads, Equipe, Financeiro…) com texto inativo esmaecido e anel de progresso pausável, mockups reais do produto em crossfade 450 ms, retrato com borda esfumada. **Nada disso entra nas telas internas.** Só começa com o §8 respondido.

---

## 7. Ordem de entrega e rotas piloto

1. Etapa 0 inteira (sem ela, cada tela inventa o próprio movimento de novo).
2. Etapas 1 a 8 primeiro em quatro rotas piloto, que cobrem os padrões: `/dashboard` (números + IA), `/equipe` (tabela + drawer + menus), `/leads/[id]` (abas + detalhe), `/conversas` (caixa de entrada, alta frequência). O usuário revisa visualmente no preview 3005 antes de seguir.
3. Lotes por área, um por branch: CRM (leads, distribuição, plantões) → vendas (negociações, vendas, cotação, clientes, documentos) → equipe e gestão → financeiro e relatórios → configurações, integrações e admin → telas públicas.
4. Lite e Diretor Lite recebem as mesmas peças pelo kit `src/components/lite/motion`, já ligado ao `useMotionAllowed` da Etapa 0.
5. Etapa 9 em paralelo a partir do terceiro lote; Etapa 10 por último.

Cada lote fecha com: laboratório › Movimento verde nos três interruptores, preview 3005 nas rotas do lote em desktop e 375px, gravação curta de antes e depois para a revisão do usuário.

## 8. O que o design system não cobre · DECIDIDO em 18/11/2026

O usuário mandou seguir as recomendações em todos os itens. Resumo do que vale:

| # | Tema | Decisão |
|---|---|---|
| 1 | Superfície azul grande | só landing, login e onboarding, com o azul do DS; nunca nas telas internas. Entra como exceção escrita no `design-system.md` na etapa 10 |
| 2 | Texturas | só o pontilhado (branco 12%, passo 12px), nas superfícies do item 1; sem halftone nem grão |
| 3 | Fundo do bloco de IA | Callout neutro do DS: Paper Mist (`bg-ds-paper-mist`) com borda; só o rótulo e os números citados em azul (corrigido em 18/11: `#fafafa` não é token) |
| 4 | Número grande | **corrigido em 18/11:** o DS já cobre (§ Stat / KPI Tile): Geist Mono 24px (`font-ds-mono text-ds-heading-sm`), `tabular-nums`, chip 28px com radius 8px. A recomendação de Inter 30px foi erro do plano |
| 5 | Retrato/vídeo | só landing, radius 16px, esfumado por máscara; precisa de imagem com direito de uso |
| 6 | Nome do bloco de IA | "Sugestões • Âncora IA" |
| 7 | Count-up ao abrir | não usar |
| 8 | Troca automática de abas | só superfícies de marca |
| 9 | Scroll-driven | só landing |

Texto original das opções, para referência:


1. **Superfície azul grande com textura** (faixa da referência). O DS diz que o azul `#2563eb` nunca é fundo de superfície grande. Recomendação: permitir só na landing, login e onboarding, como exceção documentada no DS, com o azul do DS (não o `#0e7aff` da referência), e nunca nas telas internas.
2. **Texturas** (pontilhado SVG, grão, halftone) e **brilho interno por `box-shadow inset`**. Não existem tokens para isso. Recomendação: um único token de textura pontilhada (branco 12%, passo 12px) e nenhum halftone; só nas superfícies do item 1.
3. **Fundo do bloco de IA**. A referência usa azul muito claro. O DS não tem um tom de fundo azul-claro. Opções: (a) fundo neutro `#fafafa` com borda e só o rótulo em azul (cabe no DS hoje); (b) criar um token `--surface-ai` azul bem claro. Recomendação: (a).
4. **Tamanho do número grande**. A referência usa ~32px; o DS manda Satoshi só a partir de 36px e Inter abaixo. Recomendação: número do card em Inter 30–32px semibold (precisa entrar na escala tipográfica se não estiver lá) e Satoshi só no título de página da landing.
5. **Retrato/vídeo de pessoa sobreposto**. Precisa de imagem ou vídeo real (direito de uso, quem aparece) e de uma regra de borda esfumada (radius 30px não está na escala; o DS vai até 16px). Recomendação: só na landing, com radius 16px e o esfumado por máscara.
6. **Nome do bloco de IA**: "Sugestões • Âncora IA", "Sugestões do Capitão" (o mascote novo) ou outro.
7. **Count-up dos números ao abrir**. O plano adota "não conta" (FEEDBACK nível 0). Se o usuário quiser a contagem em telas de visita rara (ex.: relatório mensal), é preciso dizer em quais.
8. **Troca automática de abas com anel de progresso** (como os módulos da referência). Faz sentido só em superfície de marca; nas telas internas, aba nunca troca sozinha.
9. **Scroll-driven** (`animation-timeline: view()`), como o hero que encolhe ao rolar. Não há regra no DS; recomendação: só landing.

## 9. Riscos e rollback

- **Prender o loading de novo**: a Etapa 2 não usa View Transition nem `startTransition` na navegação; só CSS no `template.tsx`. Rollback: remover os `template.tsx`.
- **Remontar estado** com `template.tsx` (ele remonta a cada navegação): conferir que nenhum estado de cliente vive acima da página no grupo; filtros na URL continuam valendo.
- **Desempenho em máquina fraca**: sem `backdrop-blur` nem `filter: blur` em entrada de tela frequente; medir INP antes e depois em `/leads` e `/conversas`.
- **Kill switch** continua sendo a saída de emergência: desligar `feature_interface_motion_enabled` zera tudo sem deploy.
