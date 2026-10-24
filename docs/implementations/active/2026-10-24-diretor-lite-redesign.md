# Plano: modo diretor com o visual Lite (conversão e redesign completo)

> Pedido do Vinicios em 2026-10-24: "converter o estilo e todos os componentes do modo diretor para o estilo do modo lite, mantendo toda a estrutura, sem deixar nada sem padrão".
> Base: `feat/diretor-visual-lite`. Status: **aprovado em 2026-10-24** (o Vinicios aprovou D0 a D17 como recomendadas). Execução começou pela F0a e pelo D12.
> Coordenação: Maestro. Execução: Cinzel e Vigia (revisão cruzada). Inventário feito em 24/10 por 8 agentes; anexos em `2026-10-24-diretor-lite/`.

## 1. O que muda e o que não muda

**Muda:** a camada visual de tudo que o diretor vê no modo normal: a moldura (sidebar, cabeçalho, menus, busca, notificações), as primitivas (`src/components/ui`, `ds-*`, `foundations`, `dashboard`), os componentes de feature e as 92 páginas de `src/app/(dashboard)`, mais auth, rotas públicas, telas de erro e onboarding do diretor.

**Não muda:** rotas, itens e seções do menu, permissões, consultas, ações de servidor, regras de negócio, escopo de dados, URLs, atalhos de teclado e o fluxo de cada tela. O diretor não vira chat (decisão de 2026-10-09). Gestor, supervisor e corretor no Lite continuam como estão.

**Por que agora dá certo e em 09/10 não deu.** Em 2026-10-09 a pele do Lite foi aplicada por tokens globais (`3fdd31a0` a `c78cb73b`) e desfeita no mesmo dia a pedido do Vinicios (`338eb958`). Este plano evita os três erros daquela tentativa:
1. **Nada global.** Os tokens Lite valem só dentro de `.arc-venancor[data-skin="diretor"]`. `:root` e `globals.css` ficam como estão. O que precisar mudar no Lite compartilhado fica isolado na F0b, com prints dos três papéis.
2. **Atrás de uma chave.** `feature_director_lite_style` desligada = o diretor vê exatamente o que vê hoje. Ligar e desligar não precisa de deploy.
3. **Por etapas revisáveis.** Cada fase e cada onda de telas entra com prints antes e depois, aprovados pelo Vinicios. Se uma tela não agradar, ela sai da pele sozinha (opt-out por rota), sem reverter o resto.

## 2. Diagnóstico (números de 24/10, HEAD `5026f66e`)

| Medida | Valor | Fonte |
|---|---|---|
| Arquivos varridos (.tsx/.css fora de arc, light, chat) | 825 | Cinzel |
| Arquivos com algum desvio do Lite | 483 (59%) | Cinzel |
| Total de desvios | 5.357 | Cinzel |
| Cores cruas (hex, paleta Tailwind fora de token) | 1.619 em 175 arquivos | Cinzel |
| Valores arbitrários (`text-[..]`, `w-[..]`...) | 1.193 em 254 arquivos | Cinzel |
| Alvos abaixo de 44px | 1.201 sinais em 282 arquivos; o Button padrão tem 36px, o `sm` 30px | Cinzel, primitivas |
| Sombras | 591 em 244 arquivos | Cinzel |
| Classes `dark:` | 316 em 78 arquivos | Cinzel |
| Uppercase e tracking largo | 303 em 131 arquivos | Cinzel |
| Gradientes | 132 em 31 arquivos; mais 35 ocorrências de `gradient` e `from-` dentro do próprio Lite (`components/arc`, `light`, `chat`) | Cinzel, Vigia |
| Pesos fora de 400 a 700 | 2 | Cinzel |
| Imports de `@/components/ui` contra `@/components/arc` (todo `src/**/*.tsx`, HEAD `5026f66e`) | 1.647 linhas em 443 arquivos contra 203 em 81 | Vigia |
| Bibliotecas de ícone | Lucide 97 arquivos, Phosphor 14, Hugeicons 2 | Cinzel |
| Componentes únicos no caminho do diretor (grupo A) | 171 (24 G, 51 M, 96 P) | Grupo A |
| Primitivas mortas ou sem uso em produção | cerca de 45 arquivos | Primitivas |
| Páginas | 92 `page.tsx`: 11 só redirect, 81 telas (21 sempre Lite, 10 escolhem entre Lite e normal, 3 parciais, 47 sem nada de Lite) | Grupos A, B, C, qualidade |
| Telas sem loading próprio | 64 (56 caem no `RouteLoading` genérico, que não é Lite); 17 ou 18 com `loading.tsx` ao lado, conforme se conta herança | Qualidade, Vigia |
| Telas sem estado vazio | 30 | Qualidade |
| Telas sem `error.tsx` próprio | 75 (só o `RouteError` genérico) | Qualidade |
| Telas que quebram em 390px | 25 (24 com tabela sem versão mobile) | Qualidade |
| Telas com problema de acessibilidade | 38 (o mais comum é `Label` sem `htmlFor` e botão só de ícone sem `aria-label`) | Qualidade |

**Achados técnicos que definem a arquitetura:**
1. O CSS do escopo (`src/components/arc/venancor-scope.css`) só carrega quando alguma tela Lite o importa. O diretor nunca o recebe.
2. O diretor nunca passa pelo `LightChrome` (`layout.tsx:168-172`, `lite-audience.ts:21-27`). A conversão é reestilizar o ramo normal do `AppShell` (`app-shell.tsx:192-235`), sem mudar a regra que decide o modo.
3. O Tailwind 4 usa `@theme inline` (`globals.css:17-63`): `bg-card`, `border-border`, `text-xl` etc. viram `var(--...)` no próprio elemento. Por isso, redefinir tokens dentro do escopo muda as primitivas sem tocar em quem as chama. É a alavanca principal do plano.
4. **Colisões de nome** entre CRM e Arc dentro do escopo:
   - `--accent`: hover cinza no CRM, índigo `#3b2dff` no Arc. Afeta menus, combobox, command, toggle, calendário e mais 47 usos.
   - `--text-xl` a `--text-5xl`: 22, 28, 36, 52 e 72px no Arc contra 20, 24, 30, 36 e 48px no CRM. São 208 usos.
   - De valor: `--duration-fast` (250 para 160ms), `--ease-in-out`, `--success` e `--warning` (mais escuros) e `--border` (translúcida).
5. Todas as camadas flutuantes (Dialog, Sheet, Popover, DropdownMenu, Tooltip, todas Base UI) abrem em `document.body`, fora do escopo. O Select próprio usa `createPortal` (`motion/select.tsx:324-353`). O Toaster está em `app/layout.tsx:115`.
6. O modo normal tem tema escuro real (cookie `corretop-theme`, `.dark` no `<html>`); o Lite é só claro.
7. `html { font-size: 97% }` (`globals.css:404`) faz `2.75rem` dar 42,7px. Alvos de 44px precisam ser declarados em px.
8. O próprio Lite fere as regras dele: `--shadow-resting` e `--shadow-raised` têm 2 camadas (`venancor-scope.css:114`), há 19 gradientes, 3 cores diferentes de pílula de ação principal e componentes Arc com texto em inglês.
9. Das 93 primitivas `.tsx` de `ui/`, 65 expõem `data-slot`. Isso permite uma folha de pele por primitiva (`.arc-venancor[data-skin="diretor"] [data-slot="button"]`) sem editar quem chama.
10. Lacunas do Lite para o diretor: tabela densa, kanban, select, combobox, multi-select com busca, dropdown ancorado, tooltip, popover, dialog de confirmação, checkbox, barra de lote, chips de filtro removíveis, intervalo de datas, paginação, casca de wizard, sidebar desktop, command palette, gráficos com paleta de tokens e drawer de detalhe no desktop.

## 3. Arquitetura da conversão

### 3.1 Camadas (de baixo para cima)
| Camada | O que é | Onde | Efeito |
|---|---|---|---|
| C0 Chave | `feature_director_lite_style` (tenant), lida no layout e avaliada junto com o papel (só diretor, D17) | `shared/feature-flags/catalog.ts`, `(dashboard)/layout.tsx` | Liga ou desliga tudo. Opt-out por rota em `director-lite-routes.ts` |
| C1 Escopo | `className="arc-venancor" data-skin="diretor"` no `SidebarProvider` do ramo normal | `app-shell.tsx` | Tokens Lite valem no chrome e nas páginas |
| C2 Compatibilidade | Bloco `.arc-venancor[data-skin="diretor"]` que repõe `--accent` neutro, a escala `--text-xl..5xl` decidida (D3), as durações e o `--ease-in-out`, e expõe o índigo como `--arc-accent` | `src/components/arc/director-skin.css` (novo) | Evita que o shadcn dentro do escopo vire índigo ou mude de tamanho sem querer |
| C3 Tokens que faltam | `--sidebar-*`, `--chart-*` e `--series-1..6`, `--info`, `--success-subtle`, `--warning-subtle`, `--danger-subtle`, `--info-subtle` e os `-foreground`, sombra de 1 camada | mesmo arquivo | Cobre o que o escopo hoje não define |
| C4 Pele das primitivas | Regras por `data-slot` (button, input, card, badge, tabs, table, dialog-popup, sheet-content, popover-content, dropdown-menu-content, tooltip, checkbox, switch, skeleton, progress, separator, scroll-area, sidebar-*) | `src/components/arc/director-primitives.css` (novo) | Re-skin de 300+ chamadores sem tocar neles |
| C5 Portais | `ArcScopeProvider` (contexto React; atravessa portal). Os wrappers de `ui/` leem o contexto e põem `arc-venancor` + `data-skin` no Popup e no Backdrop: dialog, sheet, drawer, popover, dropdown-menu (e SubContent), tooltip, command (paleta Ctrl+K), combobox (via popover). Select e attachment-upload trocam o alvo do `createPortal`; `motion/success-overlay` recebe a classe. Toaster ganha a classe quando a chave está ligada. O teste do provider cobre todo wrapper de `components/ui` que tenha `Portal` ou `Popup` | `components/arc/arc-scope-context.tsx` (novo) e cerca de 12 wrappers | Menus, modais e toasts no visual Lite |
| C6 Tema | Com a chave ligada, o servidor ignora o cookie `corretop-theme` (não põe `.dark`) e o `ThemeToggle` some | `app/layout.tsx:104-108`, `theme-provider.tsx`, `dashboard-header.tsx` | Fim do `dark:` vazando |
| C7 Componentes de feature | Troca de cores cruas por tokens (tabela 5.3), sentence case, alvos 44px, sombras, gradientes, ícones | por onda (seção 7) | Telas no padrão |
| C8 Componentes Lite novos | As lacunas do item 10 da seção 2 | `src/components/arc/*` e `src/components/lite/*` | Telas G passam a ter peça Lite |

**Regra de ouro:** nenhuma tela usa `data-lite` + `!important` (técnica do `ed0af666`). Isso só serve de remendo até C4 existir; depois, as Conversas migram para a pele padrão (onda 2).

### 3.2 Opt-out por rota
`director-lite-routes.ts` lista as rotas que ainda não foram revisadas. Nelas, o `SidebarInset` recebe `data-skin="off"`: o chrome fica Lite e a página fica como hoje. A lista começa com todas as rotas e cada onda remove as suas. Isso evita tela "meio convertida" em produção.

### 3.3 Arquivos de alto conflito
`app-shell.tsx`, `(dashboard)/layout.tsx`, `corretop-sidebar.tsx`, `dashboard-header.tsx`, `globals.css`, `venancor-scope.css`, `light-routes.ts` e os wrappers de `ui/`. Mudanças aditivas e pequenas por etapa; o Maestro resolve conflitos no merge.

## 4. Decisões do Vinicios (todas aprovadas como recomendadas em 2026-10-24)

Cada uma tem recomendação. Responder com o número e "ok" ou a troca.

| # | Decisão | Recomendação |
|---|---|---|
| D0 | Qual sistema de design governa o modo diretor. Hoje o `CLAUDE.md` do repo (linhas 15 a 18) torna `docs/design-system.md` (padrão Dub) obrigatório para todo trabalho visual: `#1e40af` como única ação principal, borda de 1px `#e5e5e5` em vez de sombra, cartão de 12px, botão de 8px, Inter no corpo. O Lite usa `#3b2dff`, sombra, cartões de 24px, pílulas e Plus Jakarta Sans | **Aprovado: o Lite passa a valer para o diretor.** No mesmo PR da F0a: `docs/design-system.md` ganha a seção "Exceção: modo diretor com a chave ligada segue `LITE_CHAT_DESIGN_SYSTEM.md`", o `CLAUDE.md` e o `AGENTS.md` apontam para essa exceção, e o `decision-log.md` registra. Nenhuma fase começa sem esta resposta |
| D17 | Papéis no modo normal. O ramo normal do `AppShell` também é de gestor sem `MANAGER_LITE` e de supervisor sem Lite (`experience-mode.ts:20-22, 38-44`) | A chave liga só para `role === "director"`, conferido no `(dashboard)/layout.tsx` junto com a chave. Gestor e supervisor no modo normal continuam como hoje (eles já têm o Lite próprio) |
| D1 | Rollout | Chave `feature_director_lite_style` por tenant, nasce desligada para todos; o Vinicios liga no super admin. Só na F5, depois da aprovação final, passa a nascer ligada para tenants novos |
| D2 | Tema escuro do diretor | Sai com a chave ligada (Lite é só claro). Sem toggle |
| D3 | Escala de títulos (`text-xl..5xl`) | Manter a do CRM nas telas do diretor (densidade de painel) e usar a do Lite só nos títulos de página (`.lite-page-title`, 22/500) |
| D4 | Cor da ação principal | Uma só: índigo `#3b2dff` (já é a `--primary` do CRM e do Arc). O preto do Arc fica para ação secundária forte; o azul `--chat-action` fica só no chat do corretor |
| D5 | Sombra | Achatar `--shadow-resting` e `--shadow-raised` para 1 camada (afeta o Lite inteiro, para melhor) |
| D6 | Gradientes que já existem no Lite (faixa do WhatsApp, "Ver como", aviso de plantão, boas-vindas) | Remover na F0b, com prints do Lite aprovados |
| D7 | Navegação no celular (390px) | Manter o drawer esquerdo (é a estrutura atual), com os itens de 44px; "Mais" em BottomSheet com busca, agente, feedback, perfil, instalar app e Sair (hoje busca e feedback somem no celular) |
| D8 | Ctrl+K duplicado (CommandPalette e GlobalSearch abrem juntos) | Uma paleta só, com duas seções: "Ir para" (funções) e "Buscar" (dados) |
| D9 | Ícones do menu coloridos por item | Monocromáticos, como no Lite |
| D10 | Modo recolhido da sidebar (só ícones) | Manter, com tooltip Lite |
| D11 | Marca do tenant (`brandColor`) | Respeitar: a `--primary` do escopo lê a `brandColor` (pensando no CorreTop multi-tenant) |
| D12 | Código morto (cerca de 60 arquivos: `base/*`, metade de `data-table/*`, 13 `ds-*`, sidebars e rails mortos, workflow studio órfão etc.) | Remover em PR próprio antes do re-skin (o histórico fica no git) |
| D13 | Rotas sem item no menu (Clientes, Relatórios, Tarefas, Documentos, NOC, Roadmap, Guia) | Não mexer no menu neste plano; decidir depois |
| D14 | Densidade de tabela | Linha de 44px no desktop (alvo de toque inteiro na linha), 52px com 2 linhas de texto; no celular, tabela vira lista de cartões |
| D15 | Peso 600 | Permitido só em nome de pessoa e título de seção (como o Lite já faz); o resto 400 e 500 |
| D16 | Toast | Mantém o Sonner no diretor, com a pele Lite (o "sem toast" é regra do chat do corretor) |

## 5. Contrato visual do diretor Lite (o padrão que tudo segue)

### 5.1 Base
- **Fonte:** Plus Jakarta Sans, pesos 400 e 500 (600 conforme D15). Títulos com `--tracking-display`, números com `tabular-nums`.
- **Texto:** sentence case sempre, sem overline e sem uppercase. Rótulos de seção em `text-sm font-medium text-(--text-secondary)`.
- **Superfícies:** fundo da página `--background` `#f7f7f9`; cartões brancos `--surface` com sombra de 1 camada e sem borda; blocos dentro de cartão em `--surface-muted`.
- **Raios:** controles e linhas `--radius-control` (pílula); cartões `--radius-panel` (24px); folhas e modais `--radius-surface` (28px); blocos de número 20px.
- **Espaço:** escala de 4px (`--space-*`). Página em coluna de até 1280px no diretor (o 860px do Lite é para leitura; painéis densos precisam de largura). Calha de 16px no celular e de 24px no desktop.
- **Alvos:** mínimo 44px declarado em px. Ícones de 18 a 20px, com área de toque de 44px.
- **Ícones:** só `lucide-react`, traço 1.75 a 2. Sai o Phosphor (14 arquivos) e o Hugeicons (2 arquivos e `components/huge-icons.tsx`, que vira um mapa para lucide).
- **Sem:** gradiente, sombra empilhada, `dark:`, `backdrop-blur` decorativo, emoji como ícone e cor como única informação.

### 5.2 Movimento (de `arc/motion-tokens.ts`, nunca constante local)
| Uso | Especificação |
|---|---|
| Entrada da página | fade e y 8px, 240ms, `ease.enter` |
| Lista e cartões | cascata y 6px, 180ms, `min(i,8) × 35ms` |
| Abas e segmentos | pílula deslizante com `layoutId` e mola `spring.morph` |
| Folhas e modais | mola com saída mais curta; véu proporcional |
| Toque | scale .97 (botão), .99 (linha), .985 (cartão) |
| Números | odômetro (`animated-counter`) ou `count-up` |
| Carregando | skeleton do Arc com brilho; nunca tela branca |
| Movimento reduzido | `useReducedMotion` e `@media (prefers-reduced-motion)`: só opacidade |
| Proibido | bounce, animar width, height, top ou left |

### 5.3 Cores cruas para tokens (regra do codemod da F1 e das ondas)
| Hoje (Tailwind cru) | Vira | Uso |
|---|---|---|
| `emerald-*`, `green-*`, `lime-*` | `--success` / `--success-subtle` / `--success-foreground` | ok, ativo, venda, online |
| `amber-*`, `yellow-*`, `orange-*` | `--warning` / `--warning-subtle` | atenção, pendente, morno |
| `red-*`, `rose-*` | `--danger` / `--danger-subtle` | erro, perda, quente urgente, sair |
| `sky-*`, `blue-*`, `indigo-*` | `--primary` / `--accent-subtle` / `--info` | link, seleção, informação |
| `violet-*`, `purple-*`, `fuchsia-*`, `pink-*`, `teal-*`, `cyan-*` | `--series-1..6` (só em dado categórico e gráfico) ou neutro | categorias, etiquetas |
| `slate-*`, `zinc-*`, `gray-*`, `neutral-*`, `stone-*`, `black`, `white` | `--neutral-*`, `--foreground`, `--text-secondary`, `--text-muted`, `--surface`, `--surface-muted`, `--border` | texto, fundo, borda |
| hex e rgb soltos | token equivalente; se não houver, novo token com nome semântico no `director-skin.css` | |
| `dark:*` | apagar | |
| `shadow-sm/md/lg/xl/2xl` e `shadow-[...]` | `--shadow-resting` (cartão), `--shadow-floating` (camada flutuante), nada (linha) | |
| `uppercase`, `tracking-wide*` | apagar, ajustar o texto para sentence case | |
| `bg-gradient-*`, `from-/via-/to-`, `linear/radial-gradient` | cor sólida do token | |

Etiquetas de lead (tags com cor escolhida pelo usuário) e a temperatura (frio, morno, quente) são dado e não estilo: ficam com a cor, mas passam pela paleta `--series-*` e `--warning`/`--danger`, sempre com texto ou ícone junto.

### 5.4 Componentes canônicos (um por papel)
| Papel | Canônico | Sai |
|---|---|---|
| Botão | `ui/button` com pele (C4): 44px, pílula, `primary` índigo, `secondary` cinza, `ghost`, `danger`; tamanhos `sm` e `icon` também com 44px de área | `ds-*-button`, `magnetic-button`, `base/buttons`; `stateful-button` vira `arc/action-button` |
| Cartão | `ui/card` com pele | `dashboard-card`, `ds-dashboard-card`, `ds-elevated-feature-card`, `foundations/section` |
| Número (KPI) | `StatCard` com pele = bloco cinza do Lite (número 500 tabular, rótulo muted) | `ds-stat-tile`, `ds-trend-stat-card` |
| Estado vazio | `arc/empty-state`, com adaptador em `components/empty-state.tsx`; ilustração voxel opcional | `ui/empty-state`, `foundations/empty-state`, `ds-empty-state` |
| Carregando | `ui/skeleton` com pele (forma livre) e `arc/skeleton` (texto); `LightPageSkeleton` nas páginas | `ds-skeleton`, `shimmer-skeleton`, `data-table-skeleton` |
| Escolha de 2 a 5 opções | `arc/segmented-control` | `ds-segmented-control`, `base/segmented-control`, `toggle-group` |
| Abas de seção | `ui/tabs` com pele (pílula deslizante) | `ds-tabs` |
| Abas por URL | `route-section-tabs` com pele (chips) | fundir `foundations/page-tabs` |
| Confirmação curta | `ui/dialog` com pele | `ds-dialog` |
| Painel lateral (desktop) | `ui/sheet` com pele; no celular, `arc/bottom-sheet` | `ds-sheet`, `ui/drawer` |
| Status | `ui/badge` com pele (mapa de cores das linhas 31-36 refeito com tokens) e `status-badges` como camada de domínio | `ds-pill-badge`, `ds-status-badge`, `foundations/status-badge`, `base/badges` |
| Campo | `ui/input` com pele (mantém as máscaras) | `ds-input-field`, `base/input` |
| Interruptor | `arc/switch` | `ds-switch` |
| Avatar | `arc/avatar`, via adaptador em `user-avatar` | `base/avatar` |
| Tooltip | `ui/tooltip` com pele | `motion/tooltip`, `base/tooltip` |
| Aviso no meio da tela | `context-note` com pele; banner = modal de 2 colunas com ilustração 3D (padrão aprovado) | `ds-callout` |
| Filtros | `foundations/filter-bar` com pele, chips removíveis novos | `ui/filter-toolbar` |
| Tabela | `ui/table` e `ui/data-table` com pele + `LiteDataList` no celular | dice-ui parcial, `base/table` |
| Gráfico | `ui/chart` com `--series-*` | `ds-bar-chart`, `ds-donut-chart` |
| Contagem animada | `motion/count-up` | `ds-count-up` |

## 6. Fases

Cada fase é uma branch a partir de `origin/feat/diretor-visual-lite`, em worktree próprio, com `node_modules` por junction. Nunca copiar `.env.local`. Validação: testes focados, `type-check`, `eslint` dos arquivos e prints. O Maestro junta e dá push; o deploy é do Vinicios.

### F0a. Fundação isolada (bloqueia tudo; chave desligada = zero pixel em qualquer papel, inclusive no Lite)
Pré-requisito: D0 e D17 respondidas.
1. Registrar a decisão nova no `docs/decision-log.md` (revoga a parte "modo normal fora do escopo" do `LITE_CHAT_DESIGN_SYSTEM.md:253-259`), a exceção em `docs/design-system.md`, o `CLAUDE.md` e o `AGENTS.md` (D0) e atualizar o §10 do doc do Lite.
2. Chave `feature_director_lite_style` no catálogo, no super admin e no layout, só para diretor (C0, D17). `director-lite-routes.ts` com o opt-out de todas as rotas.
3. Carregar `venancor-scope.css` + `director-skin.css` no `app/layout.tsx` (C1, C2, C3). Tudo do diretor fica sob `[data-skin="diretor"]`; nada muda no bloco `.arc-venancor` base.
4. `ArcScopeProvider` e classe nas camadas flutuantes listadas em C5. O provider só atua com `data-skin="diretor"`; o `BottomSheet` do Lite não muda nesta fase.
5. Tema claro forçado com a chave ligada (C6).
6. Alvos em px (`--control-height-sm: 44px`) só dentro de `[data-skin="diretor"]`.
7. Correção do `/distribuicao` sem o bloqueio de gestor (seção 7).
8. Linha de base de desempenho: LCP e maior tarefa de `/dashboard`, `/leads` e `/conversas` no HEAD atual, com o Performance do Chrome, gravados em `2026-10-24-diretor-lite/baseline-desempenho.md`.
9. Guarda-corpo automático (seção 9) rodando em modo de relatório.

**Pronto quando:** com a chave desligada, nenhum pixel muda em nenhum papel, inclusive no Lite (prints de comparação: 5 telas do diretor, Início, rail, lead e fila do corretor, Início do gestor e do supervisor); com a chave ligada, o chrome continua o de hoje, mas um menu, um modal e um toast abertos de qualquer tela do diretor saem com fundo, borda e fonte do Lite; testes do provider, do opt-out e do papel passam.

### F0b. Ajustes no Lite compartilhado (só com prints do Lite aprovados pelo Vinicios)
Muda o Lite de corretor, gestor e supervisor; por isso é uma etapa própria, com prints antes e depois do Início, rail, lead e fila do corretor e das telas principais do gestor e do supervisor.
1. Sombras de 1 camada no bloco `.arc-venancor` base (D5).
2. Remoção dos gradientes do Lite (D6): 35 ocorrências de `gradient` e `from-` em `components/arc`, `light` e `chat` (busca de 24/10), mais os módulos de `features/*` apontados em `inv-rotas-b.md`.
3. `--control-height-sm` em px no bloco base.
4. Componentes Arc em pt-BR (ActionButton, DatePicker, SearchField, PasswordField, FileDropzone, AnimatedCounter com `pt-BR`); DatePicker com portal; `BottomSheet` passa a pôr a classe de escopo sozinho.
5. Troca do import de `light-motion.tsx` para o kit da F1b nos três papéis.

### D12. Remoção do código morto (etapa própria, em paralelo com a F0a)
PR separado, com `type-check` limpo e lista de arquivos removidos no PR. Inclui o código atrás do redirect incondicional de `/roadmap`.

### F1. Pele das primitivas
1. `director-primitives.css` por `data-slot` (C4), na ordem do alcance: Button (309 importadores), Badge (172), Sonner (171), Card (167), Input (130), Select (85), Dialog (60), Label (57), Table (44), Sheet (31), Dropdown (28), StatCard (20), Tabs (17), Popover, Tooltip, Skeleton, Checkbox, Switch, Progress, Separator, ScrollArea.
2. Editar o que o CSS não alcança: o mapa de cores de `ui/badge.tsx:31-36` e de `animated-badge.tsx:53-54`; `focus:bg-accent` para `bg-muted` em `dropdown-menu.tsx`, `toggle.tsx`, `combobox.tsx`, `command.tsx` e `calendar.tsx`; os tamanhos de `button-variants.ts` (área de 44px).
3. Codemods B: `ds-segmented-control` para `arc/segmented-control` (7), `ds-empty-state` (6), `stateful-button` para `arc/action-button` (2), `ui/switch` para `arc/switch` (19), adaptadores em `components/empty-state.tsx` (11) e `user-avatar` (13), upload para `arc/file-dropzone` (1).
4. Gráficos: `--chart-*` lendo `--series-*`; tirar os 2 gradientes SVG.
5. Página `/internal/design-system` vira o **catálogo Lite do diretor**: cada primitiva em todos os estados (normal, foco, desabilitado, carregando, erro, vazio) para o QA visual.

**Pronto quando:** o catálogo mostra todas as primitivas no padrão; o guarda-corpo dá zero desvio em `src/components/ui`; Button, Input, Select, Checkbox, Switch e Tabs têm 44px medidos no navegador; teclado e foco visível funcionam em todos; **e o Vinicios aprovou os prints do catálogo com a chave desligada e ligada antes do merge** (a F1 muda primitivas usadas por mais de 300 arquivos; é o ponto em que 09/10 deu errado).

### F1b. Sistema de movimento e acabamento
Especificação completa em `2026-10-24-diretor-lite/motion-e-acabamento.md` (exigência do Vinicios, 24/10: animações profissionais e cuidado detalhista de ponta a ponta).
1. Tokens novos em `motion-tokens.ts` e no CSS (`distance`, `scale`, `stagger.max`), com o par CSS de cada um.
2. Kit em `src/components/lite/motion/` (15 componentes). Antes da Onda 1, nesta ordem: `LitePageEnter`, `LiteStagger`, `LiteSwap`, `LiteNumber`, `LiteSuccess`, `LiteHighlight`, `LiteAttention`, `LiteReveal`. Os demais (`LitePress`, `LiteSkeletonToContent`, `LiteDelta`, `LiteCollapse`, `LiteListPresence`, `LiteProgress`, `LiteDrawLine`) podem vir com a onda que os usa. O kit **convive** com `light-motion.tsx`; trocar o import do Lite dos três papéis é a F0b item 5, com prints.
3. A pele das primitivas (F1) recebe a coreografia da seção 4 do anexo: toque, foco, popover com origem no gatilho, tooltip "aquecido", check que se desenha, toast que empilha.
4. Revisar para o movimento reduzido os 14 arquivos com `requestAnimationFrame` e os 18 com `animate()` (lista gerada com `grep -rl` e anexada em `2026-10-24-diretor-lite/animacao-imperativa.md` no início da F1b).
5. Página "Movimento" no catálogo (`/internal/design-system/motion`), com cada peça do kit, a versão com movimento reduzido e o arquétipo de tela.

**Pronto quando:** o kit tem testes (inclusive com movimento reduzido), aparece no catálogo, não há constante de duração ou curva fora dos tokens nas pastas convertidas, e o perfil de desempenho do `/dashboard` não mostra tarefa longa causada por animação.

### F2. Chrome do diretor
Detalhe peça por peça em `2026-10-24-diretor-lite/inv-shell.md`.
1. `app-shell.tsx` (ramo normal): escopo e canvas `--background`; sai o ramo financeiro morto.
2. `corretop-sidebar.tsx`: mesmas seções, itens e permissões; fundo `--surface-muted`; ícones monocromáticos (D9); item ativo em pílula; itens de 44px; seção em sentence case; "Beta" vira `arc/badge`; plantão e Agente IA viram linhas neutras com ponto `--success`; avatar Arc; menu do perfil com a pele; modo recolhido (D10). O drawer do celular (`SheetContent`) também recebe o escopo.
3. `dashboard-header.tsx` reescrito sobre o `LightAppHeader`, **com a mesma API** (as 65 telas que o usam não mudam): [menu ou voltar 44px] [título 16 a 22px, 500] [ações da página] [buscar] [notificações] [ajuda] [avatar]. Sai o `ThemeToggle`. No celular: uma linha, ações da página numa segunda linha que rola. Antes, corrigir a faixa de 768 a 1023px do header Lite (o "Mais" some).
4. `director-routes.ts` (título, pai e voltar por rota, como o `light-routes.ts`) para telas de detalhe usarem o `LightBackButton`.
5. Camadas globais: paleta única Ctrl+K (D8), `notification-popover` (linhas no layout do `NoticeCard`, sem blur), atalhos (`keyboard-shortcuts-provider`), Central de Feedback (`system-feedback-drawer`), Agente IA (`agent-drawer`, sem fundo de pontos, bolhas no estilo do chat Lite), `super-admin-role-switcher` (sem emoji, sem botão flutuante), `pwa-install-prompt` (vai para o menu do perfil).
6. `route-loading`, `route-error`, `route-not-found`, o `error.tsx` da raiz de `(dashboard)` e os 6 `error.tsx` próprios das rotas, com `arc/empty-state` e `LightPageSkeleton`.
7. `route-section-tabs` em chips (Equipe, Atendimento, WhatsApp).
8. Onboarding do diretor: `director-wizard` e `route-onboarding-dialog` no modal de 2 colunas com ilustração 3D.
9. "Mais" do celular (D7).

**Pronto quando:** com a chave ligada e todas as rotas em opt-out, a moldura inteira está Lite em 1440, 1024, 768 e 390px; todos os itens do menu da seção 5 do `inv-shell.md` continuam lá e funcionando; Ctrl+K, Ctrl+J, Ctrl+B e os atalhos `g` continuam funcionando.

### F3. Componentes Lite novos (lacunas)
Cada um com variantes, estados, teclado, `aria`, movimento reduzido, pt-BR e página no catálogo.
| Componente | Base | Usado por |
|---|---|---|
| `LiteDataTable` (ordenação, seleção, cabeçalho fixo, linha 44px, menu por linha) + `LiteDataList` (versão em cartões abaixo de 768px) | `ui/table` e `ui/data-table` com pele | leads, vendas, propostas, equipe, documentos, distribuição, campanhas |
| `LiteKanban` (colunas `--surface-muted`, cartões brancos, arrastar com mouse e teclado, contagem do total por coluna) | dnd-kit (já no repo) | `/leads` |
| `LiteSelect`, `LiteCombobox`, `LiteMultiSelect` com busca (popover no desktop, BottomSheet no celular) | `ui/select` e `ui/combobox` com pele | filtros de unidade, corretor, fila, período |
| `LiteDateRange` | `arc/calendar` | painéis e relatórios |
| `LiteConfirmDialog` (destrutivo em `--danger`, texto do que acontece) | `ui/dialog` | exclusões, desligar, encerrar |
| `LiteMenu` (dropdown ancorado no desktop, BottomSheet no celular) | `ui/dropdown-menu` | ações por linha, "•••" |
| `LiteCheckbox` e `LiteCheckRow` | tokens `--control-*` | seleção em massa, permissões |
| `LiteBulkBar` (barra de ação em lote) | `selection-toolbar` com pele | leads, equipe |
| `LiteFilterChips` (filtros ativos removíveis) | `arc/chip-group` | todas as listas |
| `LitePagination` (e carregar mais no celular) | novo | listas longas |
| `LiteWizard` (passo x de y, rodapé com voltar e seguir) | `arc/stepper` | convite, escala mensal, template, conexão Meta |
| `LiteSidePanel` (drawer de detalhe no desktop) | `ui/sheet` com pele | inspector do lead, drill do painel |
| Gráficos Lite (barra, linha, área, funil, sparkline) com `--series-*` e animação de entrada | `ui/chart` (recharts) | painel, NOC, desempenho, campanhas |

**Pronto quando:** cada componente tem teste de render e teclado, aparece no catálogo e foi aprovado em print.

### F4. Telas em 8 ondas
Catálogo completo, rota por rota e componente por componente, em `2026-10-24-diretor-lite/plano-telas.md` (consolidado pelo Vigia a partir dos inventários). Resumo das ondas:
| Onda | Rotas | Observação |
|---|---|---|
| 1 | Rotas com Lite reaproveitável direto: notificações, empresas, relacionamento, clientes (`LightClientsList`, com filtro de unidade e paginação a conferir), feedback do lead | Troca direta ou ajuste |
| 2 (P1) | `/dashboard` e todas as abas, drills, `/leads` (kanban, lista, filtros), `/leads/[id]`, `/conversas` (migrar do `data-lite` para a pele padrão) | Uso diário do diretor; vem primeiro pelo foco. A prévia `/dev/diretor-dashboard-preview` (24/10) é o ponto de partida do `/dashboard` |
| 3 | vendas e detalhe, propostas, documentos, tarefas, NOC, integridade, relatórios e drill, assistente, `/minha-fila` (decidir acesso) | |
| 4 | `/equipe` e abas, `/equipe/[id]`, cargos, convidar, recuperações, `/gestao`, `/unidades/[id]` | Estender `ManagerLiteTeam`, `SupervisorBrokerProfile`, `ManagerLiteUnitProfile` |
| 5 | `/distribuicao` (reexporta `/leads/distribuicao`: página de 927 linhas mais os componentes filhos `queue-control-center`, `duty-operations-workspace`, `distribution-inbox`, `monthly-duty-planner`, `routing-matrix-panel`; abas a confirmar na abertura da onda), plantões, `/plantoes/corretor/[id]` e escala | Uma aba por entrega |
| 6 | `/settings` (todas as abas, via `LightSettings` com as 8 seções do diretor), integrações e WhatsApp, atendimento, qualificação e turbo, fluxos, comissões | `qualification-hub-client.tsx` (1.096 linhas) quebrado por aba |
| 7 | marketing: campanhas, detalhe, importações, Meta | |
| 8 | ferramentas e materiais, validador, assinatura, guia, roadmap, welcome, auth (2FA, admin/login, convite), públicas, telas de erro | `(auth)/verify` tem texto claro sobre fundo claro (bug) |

Em cada onda: tirar as rotas do opt-out, aplicar a tabela 5.3, trocar peças pelas canônicas (5.4) e pelas da F3, conferir os estados (vazio, carregando, erro) e o 390px.

### F5. Varredura final e limpeza
1. Guarda-corpo em modo bloqueante (orçamento zero de desvio) nas pastas convertidas.
2. Opt-out vazio; depois da aprovação final do Vinicios, a chave passa a nascer ligada para tenants novos (D1).
3. Depois de 2 semanas sem regressão: decidir se o modo normal antigo é removido (os wrappers condicionais saem) ou se a chave fica.
4. Atualizar `LITE_CHAT_DESIGN_SYSTEM.md` (diretor dentro do escopo), `CANONICAL_COMPONENTS.md` e `MIGRATION_MAP.md`.

## 7. Correções de segurança e escopo achadas no inventário (entram antes da onda da tela)
- `/distribuicao` reexporta a página de `/leads/distribuicao`, mas não herda o `layout.tsx` que bloqueia o gestor: pela URL curta, o gestor no modo normal entra. Corrigir na F0a.
- `/minha-fila` não tem bloqueio de papel; o diretor alcança a fila pessoal de corretor. Decidir na onda 3.
- `/gestao` e `/gestao/equipes/[id]` barram o diretor (`access.ts`, `team-page-loader.ts:64`); liberar só com seletor de unidade (onda 4).
- `/internal/design-system` está aberta para qualquer usuário logado: exigir diretor (ou super admin) na F1, quando ela vira o catálogo.
- `/assinatura`, `/propostas` e `/settings/waha-diagnostic` não checam papel na página: conferir na onda de cada uma.
- `/settings/feedback-templates` dá erro (`throw`) quando o corretor abre: trocar por redirect ou acesso negado (onda 6).
- `/equipe/repassar` não confere o papel Lite, e o bloqueio do `/noc` só barra o corretor: conferir nas ondas 4 e 3.
- `/roadmap` sempre redireciona e deixa código morto atrás: entra no D12.
- `/unidades/[branchId]/loading.tsx` já é Lite para todo mundo; `/equipe/repassar` e `/plantoes/corretor/[id]` mostram Lite dentro do chrome normal: ficam certos depois da F2.

## 8. Portão de qualidade (bloqueante em toda etapa)
Toda etapa só entra com:
1. **Prints antes e depois** em 1440 e 390px (e 1024 para chrome e tabelas) de cada tela tocada, com a chave ligada e desligada. Se a prévia do app não subir, rota `/dev/<etapa>-preview` com dados de exemplo (`npx next dev --webpack` em worktree com junction).
2. **Checklist por tela:**
   - zero desvio no guarda-corpo;
   - estados vazio, carregando e erro existem e estão no padrão;
   - nenhum scroll horizontal em 390px; tabela vira lista;
   - todo controle com 44px;
   - teclado: tab na ordem certa, foco visível, Esc fecha camadas, Enter e espaço ativam;
   - leitor de tela: botão só de ícone com `aria-label`, campo com `label`;
   - contraste AA (texto 4,5:1, ícone e borda de controle 3:1);
   - movimento reduzido respeitado;
   - textos em pt-BR, sentence case, sem travessão;
   - nenhuma função perdida (comparar a lista de ações da tela antes e depois);
   - coreografia do arquétipo da tela (seção 5 do `motion-e-acabamento.md`) aplicada, com vídeo curto normal e com movimento reduzido;
   - acabamento da seção 6 do mesmo anexo conferido: números e datas em pt-BR, plural, truncamento com tooltip, todos os estados de cada controle e dados de borda (zero, 1, 200+, texto longo, sem permissão, erro).
3. **Revisão cruzada:** quem não executou revisa escopo, design e regressão. Bloqueio volta para quem executou.
4. **Aprovação do Vinicios nos prints** antes de tirar a rota do opt-out.

## 9. Guarda-corpo automático
`scripts/check-lite-skin.mjs` (novo), roda no `lint` e na revisão:
- varre os arquivos fora do opt-out e acusa gradiente, `shadow-*` fora dos tokens, `dark:`, `uppercase` e `tracking-wide*`, cores Tailwind cruas, hex e rgb em `.tsx` e `.module.css`, `font-thin`, `font-light`, `font-extrabold`, `font-black`, imports de Phosphor e Hugeicons, `h-7`, `h-8`, `h-9` e `size="sm"`/`"icon"` em botão sem área de 44px, e o caractere travessão em texto de interface;
- na F0a só gera relatório (base de 5.357); a partir da F5, falha o lint nas pastas convertidas;
- teste de unidade do próprio script.

## 10. Execução entre os agentes
| Ordem | Etapa | Executor | Revisor |
|---|---|---|---|
| 1 | F0a Fundação isolada (inclui a correção do `/distribuicao` e a linha de base de desempenho) | Cinzel | Vigia |
| 1 (paralelo) | Remoção do código morto (D12) | Vigia | Cinzel |
| 1b | F0b Lite compartilhado (depois dos prints do Lite aprovados) | Vigia | Cinzel |
| 2 | F1 Pele das primitivas e catálogo, e F1b kit de movimento | Cinzel | Vigia |
| 2 (paralelo) | F3 parte 1: só testes de teclado e de estado de `LiteDataTable`, `LiteDataList`, `LiteSelect`, `LiteCombobox`, `LiteConfirmDialog`, `LiteMenu`; o visual começa depois do merge de Select, Dropdown e Popover com pele (F1 item 1) | Vigia | Cinzel |
| 3 | F2 Chrome | Cinzel | Vigia |
| 3 (paralelo) | F3 parte 2: `LiteKanban`, `LiteBulkBar`, `LiteFilterChips`, `LiteDateRange`, `LiteWizard`, `LiteSidePanel`, gráficos | Vigia | Cinzel |
| 4 | Onda 1 | Vigia | Cinzel |
| 5 | Onda 2 (P1) | Cinzel | Vigia |
| 6 | Ondas 3 e 4 | Cinzel e Vigia (uma cada) | cruzado |
| 7 | Ondas 5 e 6 | Cinzel e Vigia | cruzado |
| 8 | Ondas 7 e 8, F5 | Cinzel e Vigia | cruzado |

O Lince (OpenCode) entra no QA de prints e acessibilidade quando o limite de uso dele voltar. O Maestro confere prints e guarda-corpo antes de cada merge.

## 11. Riscos
| Risco | Mitigação |
|---|---|
| Repetir o 09/10 (o Vinicios não gostar do conjunto) | Chave por tenant, opt-out por rota, aprovação de print por onda |
| Colisão de tokens mudando telas não revisadas | C2 (compatibilidade) e opt-out |
| Camada flutuante sem escopo (fundo transparente) | C5 central e teste do provider; o guarda-corpo acusa `BottomSheet` sem escopo |
| Tabela perder densidade com 44px | D14; ações por linha no menu "•••" |
| Tela grande quebrar (`/distribuicao`, qualificação) | Uma aba por entrega; sem mudar lógica |
| Regressão no Lite do corretor, gestor ou supervisor por mexer em token compartilhado (D5, D6, kit de movimento) | Tudo que toca o Lite compartilhado fica na F0b, com prints dos três papéis aprovados antes |
| Contradição com o `docs/design-system.md` obrigatório do `CLAUDE.md` | D0 e a exceção registrada na F0a |
| Gestor e supervisor no modo normal recebendo a pele sem revisão | D17: chave só para diretor |
| Conflito com outras branches em `app-shell`, `layout` e `ui/*` | Mudanças aditivas; Maestro junta com frequência |
| Desempenho (CSS a mais e motion em listas longas) | Cascata limitada a 8 itens; `content-visibility` em listas; medir o LCP do `/dashboard` antes e depois |

## 12. Pronto quando (plano inteiro)
- Com a chave ligada, as 92 rotas (fora redirects) e todas as camadas flutuantes estão no visual Lite, sem opt-out.
- O guarda-corpo dá zero desvio em `src/app/(dashboard)`, `src/features/*/components` e `src/components`.
- Nenhuma rota, item de menu, atalho ou função se perdeu (conferido contra a seção 5 do `inv-shell.md` e o catálogo de telas).
- Todas as telas passam no portão da seção 8, em 1440 e 390px.
- Com a chave desligada, o modo normal segue igual ao de hoje até a decisão da F5.

## 13. Anexos (`docs/implementations/active/2026-10-24-diretor-lite/`)
| Arquivo | Conteúdo |
|---|---|
| `motion-e-acabamento.md` | Sistema de movimento (tokens, kit, coreografia por componente e por tipo de tela) e padrão de acabamento |
| `plano-telas.md` | Catálogo de telas em ondas: cada rota, cada componente, ação, dependência, complexidade e critério de pronto (Vigia) |
| `inv-alvo-lite.md` | O sistema Lite como existe no código: tokens, componentes, regras, precedente `ed0af666`, divergências |
| `inv-primitivas.md` | Cada primitiva de `ui/`, mapa de tokens CRM contra Arc, canônicos, portais, o que remover |
| `inv-shell.md` | Chrome peça por peça, navegação completa do diretor, celular, decisões |
| `inv-rotas-a.md`, `inv-rotas-b.md`, `inv-rotas-c.md` | Inventário tela a tela com arquivo:linha |
| `inv-desvios.md` | Contagem de desvios por arquivo, rota e feature (Cinzel) |
| `inv-qualidade.md` | Matriz de estados, responsivo e acessibilidade por rota |
