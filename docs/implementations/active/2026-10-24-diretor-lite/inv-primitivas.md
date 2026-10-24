# Inventário das primitivas: modo diretor (normal) para Lite (.arc-venancor)

Repo: `C:/Users/kyper/Desktop/Kyper/Projects/ancorahub-lite-listas` (somente leitura, nada foi alterado).
Data: 2026-10-24.

Como os números foram medidos:
- "Imp." = arquivos de produção que importam a primitiva (resolvendo `@/` e caminhos relativos; exclui `*.test.*`, `src/app/dev/**`, `dev-preview`). Entre parênteses: quantos desses ficam FORA de `src/components` (telas e features). Script: grafo de imports em Node sobre todo `src/`.
- "Desvios Lite" foi levantado por varredura de classes (gradiente, `shadow-*`, pesos, `uppercase`, `dark:`, alturas `h-5..h-9`/`size-5..9`) mais leitura dos arquivos.
- Regras Lite usadas: só tokens Arc, sem gradiente, sem sombra empilhada, pesos 400 a 700, sentence case, alvo de 44px, sem tema escuro.

Legenda de estratégia:
- **A** re-skin no lugar via tokens/CSS escopado em `.arc-venancor` (mesma API, zero mudança nos chamadores).
- **B** substituir pelo componente Arc com codemod (mapear props). "B-adaptador" = o arquivo CRM passa a renderizar o Arc por dentro, mantendo a API (zero mudança nos chamadores).
- **C** criar componente Lite novo.
- **D** aposentar (morto ou duplicado; migrar os poucos chamadores para o canônico).

---

## 0. Achados críticos (ler antes do plano)

1. **O CSS do escopo não está carregado no modo diretor.** `venancor-scope.css` só é importado por `light-chrome.tsx:10`, `light-auth-shell.tsx`, `conversas/page.tsx:5`, `a11y-prefs.tsx`, `light-duty-calendar.tsx` e páginas dev. Em Next, CSS importado por componente só entra quando aquele componente é usado. Para o diretor, importar `@/components/arc/venancor-scope.css` no `src/app/layout.tsx` (ou `@import` no `globals.css`). É seguro porque tudo está sob `.arc-venancor`, exceto 3 regras globais: `.light-canvas`, `.lite-rail/.lite-split/.lite-main` e `html[data-text-scale]`/`html[data-contrast]` (venancor-scope.css:140-178), que já são inofensivas fora do Lite.
2. **`html { font-size: 97% }`** (globals.css:404). Todo `rem` encolhe 3%: `--control-height-sm: 2.75rem` (venancor-scope.css:121) vira 42,7px, abaixo dos 44px. Alvo de toque precisa ser declarado em `px` (`min-height: 44px`) ou o 97% precisa sair dentro do Lite.
3. **Colisão `--accent`**: no CRM (shadcn) `--accent` é o fundo neutro de hover (#f4f3f0, globals.css:102); no Arc é a cor de marca (#3b2dff, venancor-scope.css:104) e `--accent-foreground` vira branco. Dentro do escopo, todo `focus:bg-accent` de menu vira azul sólido. Pontos: `dropdown-menu.tsx:99,140,186,228,268`, `toggle.tsx:9`, mais 26 usos em `app/` e `features/` (32 arquivos no total). Corrigir trocando para `bg-muted`/`text-foreground` nas primitivas, não remapeando o token.
4. **Colisão da escala tipográfica do Tailwind**: o Arc redefine `--text-xl` (1.375rem), `--text-2xl` (1.75rem), `--text-3xl` (2.25rem), `--text-4xl` (3.25rem), `--text-5xl` (4.5rem) (venancor-scope.css:64-66). Os utilitários `text-xl..text-5xl` do Tailwind 4 leem essas variáveis, então dentro do escopo todo título CRM cresce (1.25 para 1.375, 1.5 para 1.75, 1.875 para 2.25...). `text-xs/sm/base/lg` batem. Já acontece hoje nas telas Lite.
5. **Portais não herdam o escopo.** Base UI (`@base-ui/react`) e o `createPortal` do select montam no `<body>`, fora de qualquer `.arc-venancor`. Ver seção 5.
6. **Tema escuro vaza para dentro do escopo.** O `dark:` é `&:is(.dark *)` (globals.css:15) e a classe `.dark` vem do cookie `corretop-theme` no `<html>` (layout.tsx:104-107). O escopo só declara `color-scheme: light` e remapeia parte dos tokens; `--sidebar-*`, `--chart-*`, `--info`, `--surface-*`, `--muted-text` e todo utilitário `dark:` continuam escuros. Lite precisa forçar tema claro (ignorar o cookie e esconder `theme-toggle`/`animated-theme-toggler`).
7. **O próprio escopo tem sombra empilhada.** `--shadow-resting` no mapeamento Venancor tem 2 camadas (venancor-scope.css:114), `--shadow-raised` 2 camadas (55), `--control-thumb-shadow` 3 camadas (44). Decisão: aceitar como token oficial ou achatar `--shadow-resting` para 1 camada antes de espalhar pelos cards do diretor.
8. **Cores fora de token nas duas primitivas mais usadas depois do Button**: `ui/badge.tsx:31-36` usa paleta crua (`slate/blue/emerald/amber/red-*` + `dark:`) e `animated-badge.tsx:53-54` usa `emerald/amber`. Re-skin por token não pega isso: precisa editar o mapa de classes (continua sendo A, 1 arquivo, 172 chamadores intactos).
9. **Família `ds-*` não responde ao escopo.** Usa `@theme` com hex literais (`src/styles/design-system/tokens.css:13-117`, ex. `--color-ds-electric-blue: #3b2dff`, `--ds-gradient-conic-spectrum`). Ou remapeia `--color-ds-*` dentro de `.arc-venancor`, ou aposenta (recomendado: quase tudo tem 0 a 2 chamadores).
10. **Muito código morto.** `base/*` inteiro (só usado por `components/application/data-table/data-table.tsx`, que tem 0 importadores), metade de `components/data-table/*`, `ui/empty-state`, `ui/page-header`, `ui/form-section`, `ui/form`, `magnetic-button`, `dock`, `inline-group`, `faceted`, `sortable`, `breadcrumb`, `toggle-group`, 13 dos 26 `ds-*`. Lista na seção 6. Aposentar antes do re-skin reduz a superfície em ~45 arquivos.

---

## 1. Como o Lite chega no diretor (pré-requisitos, antes de mexer em primitiva)

| # | Ação | Onde | Por quê |
|---|---|---|---|
| P1 | Carregar `venancor-scope.css` globalmente | `src/app/layout.tsx` ou `globals.css` | Hoje só carrega nas rotas Lite (achado 1) |
| P2 | Pôr `arc-venancor` no shell do diretor (AppShell/`[data-slot=app-content]`) e no container de portal | `app-shell.tsx`, layout | Tokens Arc passam a valer para todas as primitivas CRM que já leem `--primary/--card/--muted...` |
| P3 | Forçar tema claro no modo Lite | `layout.tsx:104-107`, `theme-provider.tsx` | Achado 6 |
| P4 | Neutralizar `font-size: 97%` dentro do Lite, ou declarar alvos em px | `globals.css:404` | Achado 2 |
| P5 | Completar o mapeamento de tokens que o escopo ainda não cobre (`--sidebar-*`, `--chart-*`, `--info`, `--warning-foreground`, `--surface-*` CRM, `--background`) | `venancor-scope.css` | Seção 2 |
| P6 | Camada "primitivas Lite" escopada: um bloco `.arc-venancor [data-slot=...]` por primitiva (button, input, card, badge, tabs...) | novo arquivo, ex. `src/components/arc/venancor-primitives.css` | Permite estratégia A sem tocar nos 300+ chamadores |

Observação: as primitivas CRM usam `@theme inline` (globals.css:17-63), então `bg-primary`, `bg-card`, `border-border` etc. resolvem `var(--primary)` no elemento e respeitam o escopo. É isso que torna a estratégia A viável.

---

## 2. Mapa de tokens: CRM (globals.css) contra Arc (venancor-scope.css)

Legenda "Situação no escopo": **remapeado** = venancor-scope.css já sobrescreve; **colisão** = mesmo nome, semântica ou valor diferente; **sem par** = Arc não tem equivalente; **herda** = não remapeado, vale o valor CRM.

### 2.1 Cores semânticas

| Token CRM | Valor claro (linha) | Valor dark (linha) | Token Arc equivalente | Situação no escopo |
|---|---|---|---|---|
| `--background` | #ffffff (86) | #09090b (321) | `--background` (#f7f7f9, 78) | **colisão de valor**: dentro do escopo `bg-background` vira cinza. Lite usa `--surface` (#fff) como canvas (`.light-canvas`, 140). Sugestão: no diretor, `--background: var(--surface)` |
| `--foreground` | #09090b (87) | #fafafa | `--foreground` (#0b0b12, 82) | colisão de nome, mesmo papel; ok |
| `--card` / `--card-foreground` | #fff / #09090b (89-90) | #18181b | `--surface` / `--foreground` | remapeado (86-87) |
| `--popover` / `-foreground` | oklch(1 0 0) (92-93) | #27272a | `--surface-raised` | remapeado (88-89) |
| `--primary` / `-foreground` | #3b2dff / #fff (96-97) | #1f6fe5 | `--accent` (#3b2dff) | remapeado (90-91), mesmo valor |
| `--secondary` / `-foreground` | #f4f3f0 (99-100) | #27272a | `--surface-muted` (#f1f1f5) | remapeado (92-93) |
| `--accent` / `-foreground` | #f4f3f0 / #09090b (102-103) | #27272a | **sem par semântico**: Arc `--accent` = marca #3b2dff | **COLISÃO CRÍTICA** (achado 3). Par correto do papel CRM: `--surface-muted` / `--foreground` |
| `--muted` / `-foreground` | #f4f3f0 / #71717a (105-106) | #27272a / #a1a1aa | `--surface-muted` / `--text-muted` (#666674) | remapeado (94-95) |
| `--muted-text` | #8d8d8d (107) | #6b6b6b | `--text-muted` | herda; nome confunde com `--text-muted` |
| `--warning` / `-foreground` | #f59e0b / #fff (110-112) | igual | `--warning` (#a15c00, 111) | **colisão de valor** (Arc é âmbar escuro legível); `-foreground` herda #fff |
| `--success` / `-foreground` | #10b981 / #fff (113-115) | igual | `--success` (#0f7a4d, 110) | colisão de valor; `-foreground` remapeado (100) |
| `--destructive` / `-foreground` | #ef4444 / #fafafa (116-117) | igual | `--danger` (#d4263a) | remapeado (98-99) |
| `--info` / `-foreground` | #3b82f6 / #fff (118-119) | igual | Arc Badge "info" usa `--accent` (badge.module.css:46); texto azul Lite = `--chat-action-text` | **herda** (não remapeado). Sugestão: `--info: var(--accent)` |
| `--border` | #e4e4e7 (122) | #27272a | `--border` (rgb(16 16 40/.08), 101) | colisão de nome, mesmo papel; ok |
| `--border-strong` | #afb0b1 (124) | #353535 | `--border-strong` (rgb(16 16 40/.18)) | colisão de nome, mesmo papel; ok |
| `--input` | #e4e4e7 (125) | #27272a | `--border-strong` | remapeado (96): bordas de campo ficam mais escuras |
| `--ring` | #3b2dff (126) | #1f6fe5 | `--accent-strong` (#2a1fd1) | remapeado (97) |
| `--surface-base/-card/-secondary/-elevated/-overlay` | 76-84 | 315-319 | `--background` / `--surface` / `--surface-muted` / `--surface-raised` | **herda**: `card.tsx:12` (variant subtle) usa `--surface-secondary`. Sugestão: mapear no escopo |
| `--ct-blue` / `--ct-blue-strong` | #3b82f6 / #1f6fe5 (139-140) | igual | `--chat-action` / `--chat-action-strong` | herda |
| `--color-deep-sapphire` | #1e40af literal em `@theme inline` (26) | sem dark | `--accent-strong` | **não escopável** (valor fixo no utilitário). 4 usos de `variant="deep-sapphire"` |
| `--sync-local/-confirmed/-error/-surface` | 301-304 | via base | `--warning` / `--accent` / `--danger` / `--surface-muted` | herda, mas aponta para tokens remapeados; ok |
| `--tabs-text-muted/-active/-pill-bg` | oklch literais (297-300) | sem dark | `--text-muted` / `--foreground` / `--surface` | herda; trocar por var() |
| `--dashboard-canvas` | #fff (305) | sem dark | `--surface` | herda |

### 2.2 Sidebar (`--sidebar-*`, globals.css:128-137 e dark 359-368)

| Token CRM | Claro | Par Arc sugerido | Situação |
|---|---|---|---|
| `--sidebar` | var(--card) | `--surface-muted` (igual `.lite-rail`, 154) | herda (resolve para `--card` remapeado = branco) |
| `--sidebar-foreground` | var(--card-foreground) | `--foreground` | herda, ok |
| `--sidebar-primary` / `-foreground` | var(--primary) | `--accent` / `--accent-foreground` | herda, ok |
| `--sidebar-accent` / `-foreground` | #f4f3f0 / #09090b | `--accent-subtle` / `--accent-strong` (item ativo Lite) ou `--surface-muted` / `--foreground` (hover) | herda literal; decidir |
| `--sidebar-warning` / `-foreground` | oklch(.965 .003 260) / oklch(.22 .012 260) | sem par (falta `--warning-subtle` no Arc) | herda; **C**: criar `--warning-subtle` |
| `--sidebar-border` | #e4e4e7 | `--border` | herda literal |
| `--sidebar-ring` | #3b2dff | `--accent-strong` | herda literal |

Dark de todos: sem par (Lite sem tema escuro).

### 2.3 Gráficos (`--chart-1..5`, globals.css:143-151; dark 374-378)

Arc não tem tokens de gráfico (**sem par**). 128 ocorrências de `chart-N` em `.tsx`.

| Token | CRM | Proposta Lite |
|---|---|---|
| `--chart-1` | #3b2dff | `var(--accent)` |
| `--chart-2` | #3b82f6 | `var(--chat-action)` |
| `--chart-3` | #f59e0b | `var(--warning)` (#a15c00) |
| `--chart-4` | #10b981 | `var(--success)` (#0f7a4d) |
| `--chart-5` | #94a3b8 | `var(--neutral-6)` |

Comentários das linhas 144-152 estão trocados (dizem "Emerald" no azul etc.), corrigir junto.

### 2.4 Raio

| Token CRM | Valor | Par Arc | Situação |
|---|---|---|---|
| `--radius` | 1rem (58, 306, 379) | sem par | herda |
| `--radius-sm` | calc(1rem - .5rem) = .5rem (59) | sem par | herda |
| `--radius-md` | var(--radius-card) (60) | `--radius-panel` (1.5rem) para card Lite | herda (1rem) |
| `--radius-lg` | 1.25rem (61) | sem par | herda |
| `--radius-xl` | var(--radius-panel) (62) | `--radius-panel` | ok, mesmo valor (1.5rem) |
| `--radius-control` | 999px (189) | `--radius-control` 9999px (116) | **colisão de nome**, mesmo efeito (pílula) |
| `--radius-card` | 1rem (190) | `--radius-panel` (1.5rem) | herda; card do diretor fica com 16px enquanto Lite usa 24px |
| `--radius-panel` | 1.5rem (191) | `--radius-panel` 1.5rem (117) | colisão de nome, mesmo valor |
| `--border-radius-pill` / `-rounded` / `-circle` | 999px / var(--radius-control) / 50% (192-194) | `--radius-pill` | herda |
| `--radius-2lg`, `--radius-notification-card` | 10px (theme.css:66-67) | `--radius-control` / `--radius-panel` | herda; usados por `base/*` (morto) |
| `--radius-ds-*` | 6/8/12/16/9999px (tokens.css:99-103) | `--radius-control` / `--radius-panel` | herda (ds) |
| (Arc) `--radius-surface` | 1.75rem | sem par CRM | só Arc |

### 2.5 Sombras

| Token CRM | Valor (linha) | Camadas | Par Arc | Situação |
|---|---|---|---|---|
| `--shadow-xs` | 196 | 2 (empilhada) | `--shadow-resting` | herda; usada por `switch.tsx` thumb, `user-avatar`, `selection-toolbar`, `foundations/*` |
| `--shadow-sm` | 197 (e theme.css:74, duplicado) | 2 | `--shadow-resting` | herda; **conflito interno CRM** (dois valores) |
| `--shadow-md` | 198 (theme.css:75) | 2 | `--shadow-raised` | herda; duplicado |
| `--shadow-lg` | 199 (theme.css:76) | 2 | `--shadow-floating` | herda; duplicado |
| `--shadow-xl` | 200 (theme.css:77) | 2 | `--shadow-floating` | herda; duplicado |
| `--shadow-action` | none (201) | 0 | (nenhuma) | ok |
| `--shadow-card` | none (202) vs `0 1px 1px` (theme.css:105) | 1 | `--shadow-resting` | **conflito interno CRM** |
| `--shadow-dialog` | 0 16px 48px (203) | 1 | `--shadow-floating` (1 camada no mapeamento, 115) | herda; mesmo papel. Usada por dialog, sheet, popover, dropdown, tooltip, sonner |
| `.ct-notification-popover` | globals.css:964-979 | 3 | `--shadow-floating` | viola "sem sombra empilhada" |
| `--shadow-sidebar/-nav-selected/-checkbox-selected/-dropdown/-waitlist` | theme.css:84-117 | várias | sem par | herda; usados por `base/*` (morto) |
| `--shadow-ds-*` | tokens.css | | | herda (ds) |
| (Arc) `--shadow-resting` | venancor 114 | **2** | | decisão (achado 7) |
| (Arc) `--shadow-raised` | venancor 55 | **2** | | idem |
| (Arc) `--shadow-floating` | venancor 115 | 1 | | ok |

### 2.6 Fontes, tipografia, movimento

| Token CRM | Valor | Par Arc | Situação |
|---|---|---|---|
| `--font-sans` | Jakarta (globals 54/154); theme.css:52 diz Inter | `--font-body` (Jakarta, 119) | ok; **conflito interno CRM** (Inter em theme.css) |
| `--font-heading` | Jakarta (56/155) | `--font-display` (Jakarta, 120) | ok |
| `--font-logo` | Amil (57/156) | sem par | manter (marca) |
| `--font-mono` | JetBrains/Geist Mono (55/158) | sem par | manter; `dropdown-menu.tsx:72` usa mono em rótulo, trocar |
| `--font-inter-sans` | Jakarta (157) | `--font-body` | herda |
| `--text-{xxl..xs}-font-size/-line-height/-letter-spacing` | 242-261 | `--text-*`, `--leading-*`, `--tracking-*` | sem colisão de nome; mapear se usados |
| `--text-weight-extra-bold` | 800 (265) | sem par | **fora da regra** (400 a 700) |
| Tailwind `--text-xl..5xl` | padrão TW | Arc redefine | **colisão** (achado 4) |
| `--duration-fast` | 250ms (162) | 160ms | **colisão de valor** (primitivas CRM ficam mais rápidas no escopo) |
| `--ease-in-out` | `ease-in-out` (179) | cubic-bezier(.65,0,.35,1) | **colisão de valor** (afeta utilitário `ease-in-out`) |
| `--duration-quick/-medium/-slow`, `--motion-*`, `--dialog-*` | 159-206 | `--duration-*`, `--ease-*` | sem colisão; herda |
| `--mobile-touch-target` | 2.75rem (235) | `--control-height-sm` (2.75rem) | mesmo valor; ambos sofrem o 97% |
| `--size-spacing-01..12` | 218-229 | `--space-1..24` | sem colisão; herda (Card usa) |
| (Arc) `--focus-ring` transparente + outline 2px | venancor 50, 132-136 | CRM `:where(...):focus-visible` 2px `--ring` (globals 459-462) | convivem; resultado igual |

### 2.7 Resumo das colisões de nome (mesmo nome, semântica ou valor diferente)

Críticas: `--accent`, `--accent-foreground`, `--text-xl..--text-5xl` (Tailwind), `--background`.
De valor (aceitáveis, decidir): `--success`, `--warning`, `--duration-fast`, `--ease-in-out`, `--input`, `--ring`.
Inofensivas (mesmo papel): `--foreground`, `--border`, `--border-strong`, `--radius-control`, `--radius-panel`.
Internas do CRM (duas definições): `--shadow-sm/md/lg/xl`, `--shadow-card`, `--font-sans`.

---

## 3. Inventário por primitiva

### 3.1 Botões e ações

| Arquivo | Imp. | Variantes / tamanhos | Estilo atual e desvios Lite | Equivalente Lite | Estratégia |
|---|---|---|---|---|---|
| `ui/button.tsx` + `ui/button-variants.ts` | 303 (248); `buttonVariants` direto em 6 | variant: default, primary, deep-sapphire, success, outline, secondary, ghost, accent, destructive, link. size: default h-9, xs h-6, sm h-7.5, lg h-10, icon 32, icon-xs 24, icon-sm 30, icon-lg 40. Props: loading, asChild (5 usos), render (100 usos) | Alturas 24 a 40px, nenhuma chega a 44 (button-variants.ts:27-35). Texto base `text-xs` 12px (4). `deep-sapphire` cor literal (10, globals.css:26). `success` com `color-mix(...black)` e `dark:` (12). `accent` sem uso. Pílula ok, sem sombra ok | `arc/button` (primary, secondary, ghost, danger; sm/md/lg; sem asChild/render/ícone/link) | **A**. Codemod em 303 arquivos com asChild/render/ícone é inviável. CSS escopado: `.arc-venancor [data-slot=button]{min-height:44px;font-size:14px;font-weight:500}`, ícones com hit area `::after` (padrão de venancor-scope.css:146-147); mapear variantes por token (outline/secondary para fundo `--surface-muted` sem borda, destructive para `--danger`). Trocar `deep-sapphire` por `primary` (4 usos) |
| `ui/ds-button-variants.ts` | 7 (3) | dsVariant: filled-dark, outlined-action, ghost-nav, outlined-nav | Hex `ds-*`, raio 8px, `shadow-ds-subtle` | `ui/button` | **D**: filled-dark para default, outlined-* para outline, ghost-nav para ghost |
| `ui/ds-filled-dark-cta.tsx` | 2 (2) | (usa dsVariant) | idem | `ui/button` | **D** |
| `ui/ds-outlined-action-button.tsx` | 4 (4) | idem | idem | `ui/button` variant outline | **D** |
| `ui/ds-ghost-nav-button.tsx` | 0 | | | | **D** |
| `ui/ds-outlined-nav-button.tsx` | 0 | | | | **D** |
| `ui/magnetic-button.tsx` | 0 | | Efeito magnético (movimento decorativo) | | **D** |
| `ui/stateful-button.tsx` | 2 (2): leads-filters, confirm-duty-presence | state idle/loading/success/error | | `arc/action-button` (label, successLabel, pendingLabel, onAction) | **B** (2 chamadores) |
| `base/buttons/button.tsx`, `icon-button.tsx` | 0 reais (cadeia morta) | h-6/8/9, `shadow-xs`, `rounded-2lg` | | | **D** |
| `related-actions.tsx` | 4 (4) | | Card subtle + título `uppercase tracking-wider font-bold` (36), `rounded-xl` | | **A** + sentence case na linha 36 |
| `foundations/page-actions.tsx` | 0 reais (só barrel) | | `shadow-xs`, size-8 | | **D** |
| `foundations/row-actions.tsx` | 0 reais | | rótulo `uppercase text-[10px]` (77), size-8 | | **D** |

### 3.2 Badges, status, tags

| Arquivo | Imp. | Variantes / tamanhos | Desvios Lite | Equivalente Lite | Estratégia |
|---|---|---|---|---|---|
| `ui/badge.tsx` | 172 (151) | variant (14): default, secondary, success, warning, destructive, info, indigo, purple, pink, cyan, orange, outline, ghost, link; status: neutral, info, success, warning, danger, loading; size sm h-6 / md h-8 | Paleta crua + `dark:` (31-36), não token | `arc/badge` (tone neutral/success/info/warning/danger; size sm/md; icon) | **A**: trocar `VENANCOR_STATUS` por tokens (`--accent-subtle`/`--accent-strong`, `color-mix` de `--success/--warning/--danger`), igual a `badge.module.css:46`. 172 chamadores intactos. Mapa variant para tone documentado nas linhas 13-28 |
| `motion/animated-badge.tsx` | 4 (1) | status 6; size sm h-6, md h-8 | `emerald/amber` + `dark:` (53-54) | motor do badge | **A** (mesma troca) |
| `status-badges.tsx` | 17 (17) | LeadTemperature, LeadQualificationBadge, LeadStatusBadge, SaleStatusBadge, ScheduleStatusBadge, DocumentStatusBadge, RecoveryStatusBadge, MemberStatusBadge, RoleBadge | Herda do AnimatedBadge | | **A** (domínio; herda o re-skin) |
| `ui/ds-status-badge.tsx` | 6 (5) | status (pending/completed/warning/success...) | `ds-*` hex | `ui/badge` com `status` | **D** (codemod 6 arquivos) |
| `ui/ds-pill-badge.tsx` | 0 | | | | **D** |
| `ui/ds-pill-feature-tag.tsx` | 0 | | | | **D** |
| `foundations/status-badge.tsx` | 1 (branches-manager via barrel) | | | `ui/badge` | **D** |
| `base/badges/chip.tsx`, `status-dot.tsx` | 0 reais | | | | **D** |
| `ui/marker.tsx` | 2 (conversas) | cva variant | | chat Lite (`components/chat`) | **A** |

### 3.3 Cards, containers, cabeçalhos

| Arquivo | Imp. | Variantes / tamanhos | Desvios Lite | Equivalente Lite | Estratégia |
|---|---|---|---|---|---|
| `ui/card.tsx` | 167 (156) | variant: default, subtle, overview, compact, kanban; size default/sm | Borda 1px + raio 1rem + sem sombra (11-15). Lite: sem borda, raio `--radius-panel`, `--shadow-resting` ou fundo `--surface-muted` (venancor-scope.css:113, 139). `subtle` usa `--surface-secondary` não remapeado (12). Título `text-base semibold` (63) ok; descrição `text-xs` | não existe Card genérico no Arc (só `expandable-card`, `metric-card`) | **A**: `.arc-venancor [data-slot=card]{border:0;border-radius:var(--radius-panel);box-shadow:var(--shadow-resting)}`; subtle para `--surface-muted` |
| `dashboard-card.tsx` | 3 (3, relatorios) | força `variant="overview"` | `rounded-none` | `ui/card` overview | **D** (duplicado de Card overview) |
| `ui/ds-dashboard-card.tsx` | 1 (director-journey-panel) | | `ds-*` | `ui/card` | **D** |
| `ui/ds-elevated-feature-card.tsx` | 0 | | `shadow-ds-subtle-2` | | **D** |
| `dashboard.tsx` (DashboardGrid) | 5 (5) | | só grid | | **A** |
| `dashboard/metric-card.tsx` (StatCard) | 20 (20) | variant default/overview; badge de variação; CountUp | `size-8` ícone; overview sem borda à direita | `arc/metric-card` (label, value number, suffix, context, change; 1 uso) | **A** (API Arc é estreita demais para 20 telas) |
| `ui/ds-stat-tile.tsx` | 1 | tone default/success/warning/destructive | `ds-*` | StatCard | **D** |
| `ui/ds-trend-stat-card.tsx` | 0 | | | | **D** |
| `ui/section-card-header.tsx` | 22 (22) | | herda Card | | **A** |
| `ui/ds-section-header.tsx` | 4 (4, journey director) | title/description/actions/as | `ds-*` | `section-card-header` ou `.lite-page-title` | **D** |
| `ui/ds-page-header.tsx` | 1 (`components/app-page-header.tsx`) | | `ds-*` | `.lite-page-title/-subtitle` (venancor-scope.css:188-189) | **A** via remap `--color-ds-*` ou reescrever o app-page-header |
| `ui/page-header.tsx` | 0 | | | | **D** |
| `foundations/page-header.tsx` | 0 reais | | | | **D** |
| `ui/form-section.tsx` | 0 | | | | **D** |
| `foundations/section.tsx`, `settings-section.tsx` | 0 reais | | `rounded-xl/2xl`, `shadow-xs` | | **D** |
| `ui/context-note.tsx` | 4 (4) | variant info (cva) | `rounded-md` | | **A** |
| `ui/ds-callout.tsx` | 0 | tone 5 | | | **D** |
| `operational-placeholder.tsx` | 0 | | | | **D** |
| `ui/selection-toolbar.tsx` | 4 (4) | | `shadow-xs` 2 camadas, `rounded-xl` | | **A** |
| `ui/ds-selection-bar.tsx` | 0 | | | | **D** |
| `illustrations/voxel-illustration.tsx` | 3 (3) | | 1 `dark:` | ilustrações 3D (memória: modal 2 colunas com ilustração) | **A** (tirar `dark:`) |

### 3.4 Formulário

| Arquivo | Imp. | Variantes / tamanhos | Desvios Lite | Equivalente Lite | Estratégia |
|---|---|---|---|---|---|
| `ui/input.tsx` | 130 (119) | máscaras `format` (cpf, cnpj, phone, cep, currency, date...), autodetecção por id/name | h-8 (32px), `text-xs`, `bg-card`, pílula (129) | `arc/input` (exige `label`, traz descrição/erro próprios, sem máscara) | **A**: altura 44px e 16px no celular (o escopo já faz 16px em 193-197). Codemod quebraria máscaras |
| `ui/textarea.tsx` | 30 (28) | | `rounded-2xl`, `text-xs` (5) | `arc/textarea` (exige label) | **A** (escopo já ajusta raio, 182) |
| `ui/label.tsx` | 57 (53) | | | | **A** |
| `ui/field.tsx` | 12 (12) | Field, FieldLabel, FieldDescription, FieldError, FieldSuccess | | label embutido do Arc | **A** |
| `ui/currency-input.tsx` | 3 (3) | | h-8, 1 `dark:` | | **A** |
| `ui/ds-input-field.tsx` | 3 (3) | | `ds-*` | `ui/input` | **D** |
| `ui/checkbox.tsx` | 23 (23) | | 16px com hit area `after:-inset-x-3 -inset-y-2` (~40x32px), `rounded-md`, 1 `dark:` | não existe (Arc tem radio-cards, chip-group; tokens `--control-on/-glyph` existem) | **A**: marcado em `--control-on`, hit area 44px |
| `ui/ds-checkbox.tsx` | 0 | | | | **D** |
| `ui/switch.tsx` (Base UI) | 19 (18) | | h-5 w-9 (20x36px), thumb `shadow-xs` 2 camadas (22-30) | `arc/switch` (Radix; checked/onCheckedChange/disabled + label; 42px de trilho) | **B** (props compatíveis; 19 arquivos) ou **A** se quiser zero risco |
| `ui/ds-switch.tsx` | 1 (rules-tab) | | `shadow-ds-subtle` | | **D** |
| `ui/select.tsx` | 85 (78) | Select (motion), MorphSelect; size default; Trigger `!rounded-full` (31,35) | lista via `motion/select.tsx` `createPortal(document.body)` (324-353), `shadow-lg`, `rounded-[10px]`, h-7/h-8 | não existe select no Arc (Lite usa BottomSheet + radio-cards/chip-group) | **A** + correção de portal (seção 5) |
| `motion/select.tsx` | 1 (ui/select) | | idem | | **A** |
| `motion/select-morph.tsx` | 1 (ui/select) | | `shadow-lg` | | **A** |
| `period-select.tsx` | 10 (10) | | usa `ui/select` | | **A** (herda) |
| `branch-select.tsx` | 2 (2) | | usa `ui/select` | | **A** (herda) |
| `ui/combobox.tsx` | 1 (internal/design-system) | | `shadow-xl`, h-8, 1 `dark:` | | **A** (herda popover) ou **D** |
| `ui/command.tsx` (cmdk) | 2, ambos mortos (faceted, data-table-faceted-filter) | | `shadow-lg`, `tracking-widest` (140) | | **D** (se `command-palette.tsx` não usar; ele não importa este arquivo) |
| `ui/slider.tsx` | 1 (cadeia morta) | | | `arc/slider` | **D** |
| `ui/calendar.tsx` | 1 (cadeia morta) | | `shadow-xs` | `arc/calendar`, `arc/date-picker` | **D** |
| `ui/search-add-list.tsx` | 3 (3) | | `rounded-lg` | `arc/search-field` (busca) | **A** |
| `ui/toggle.tsx` | 1 (toggle-group) | variant default/outline; size default h-8, sm h-7, lg h-9 | `bg-accent` (9), alvos < 44 | `arc/chip-group` | **D** |
| `ui/toggle-group.tsx` | 0 | | | | **D** |
| `ui/form.tsx` | 0 | | | | **D** |
| `base/input/*`, `base/checkbox/*`, `base/select/*`, `base/dropdown/*` | 0 reais | | gradiente em `base/checkbox/checkbox.tsx`, `shadow-dropdown` | | **D** |

### 3.5 Abas, segmentado, navegação

| Arquivo | Imp. | Variantes / tamanhos | Desvios Lite | Equivalente Lite | Estratégia |
|---|---|---|---|---|---|
| `ui/tabs.tsx` | 17 (17) | variant pill, underline (padrão), segment, line (25) | indicador com mola; `--tabs-*` literais (globals 297-300) | `arc/segmented-control` para pill/segment | **A** (underline/line); usos `segment`/`pill` com até 4 opções podem ir para **B** |
| `ui/ds-tabs.tsx` | 2 (2) | | `ds-*` | `ui/tabs` | **D** |
| `ui/ds-segmented-control.tsx` | 7 (6) | options {value,label,count,disabled}, value, onValueChange, aria-label | `ds-*`, `shadow-ds-subtle` | `arc/segmented-control` (options {value,label,accessory}, value, onValueChange, label) | **B**: `count` para `accessory`, `aria-label` para `label`; 7 arquivos |
| `base/segmented-control/*` | 0 reais | | | | **D** |
| `ui/route-section-tabs.tsx` | 3 (3) | | `min-h-10` (40px), `text-xs` | | **A** (44px) |
| `foundations/page-tabs.tsx` | 3 (2) | tabs com badge, href ou onTabChange | Button outline/secondary + Badge, `shadow-xs` | `arc/segmented-control` | **A** (herda Button/Badge) |
| `ui/sidebar.tsx` | 12 (0, só shells) | variant sidebar/floating/inset; side; collapsible | `--sidebar-*`; h-7/h-8, size-9 | `light/light-side-rail.tsx` | **A** via mapeamento `--sidebar-*` (seção 2.2); troca de shell é de outro inventário |
| `ui/ds-sidebar-nav-item.tsx` | 0 | | | | **D** |
| `ui/breadcrumb.tsx` | 0 | | | | **D** |
| `ui/dock.tsx` | 0 | | | | **D** |
| `ui/scroll-area.tsx` | 16 (12) | ScrollArea, ScrollBar | | | **A** |
| `ui/separator.tsx` | 11 (6) | | | | **A** |

### 3.6 Overlays (ver seção 5 para portais)

| Arquivo | Imp. | Variantes / tamanhos | Desvios Lite | Equivalente Lite | Estratégia |
|---|---|---|---|---|---|
| `ui/dialog.tsx` (Base UI) | 60 (52) | Dialog, DialogPopup (overlayClassName), Header, Footer, Title, Description, Portal | Overlay `bg-foreground/28 backdrop-blur-sm` (29); popup `rounded-[--radius-panel]` + borda + `--shadow-dialog` (48); título `text-lg font-bold` (94), descrição `text-xs` (104) | `arc/bottom-sheet` no celular | **A** + escopo no Popup. Precedente: `first-message-dialog.tsx:143` já usa `DialogPopup className="arc-venancor"` |
| `ui/sheet.tsx` (Base UI) | 31 (27) | side top/right/bottom/left; showCloseButton; Body, Section | Fechar `size-8` com `aria-label="Fechar painel"` (72): fora da regra de 44px do escopo, que só cobre `"Fechar"` (146-147) | `arc/bottom-sheet` | **A** + incluir `"Fechar painel"` na regra de hit area |
| `ui/drawer.tsx` (Base UI drawer) | 2 (2) | | 1 `dark:` | `ui/sheet` ou `arc/bottom-sheet` | **D** |
| `ui/ds-dialog.tsx` | 1 (audit-tab) | | `shadow-ds-lg` | `ui/dialog` | **D** |
| `ui/ds-sheet.tsx` | 1 (campaigns-tab) | | `shadow-ds-lg`+`shadow-lg` | `ui/sheet` | **D** |
| `foundations/detail-drawer.tsx` | 5 (4) | | envolve `ui/sheet` | | **A** (herda) |
| `foundations/confirm-dialog.tsx` | 4 (3) | | envolve `ui/dialog`, `shadow-xs` | | **A** (herda) |
| `ui/bulk-reassign-dialog.tsx`, `ui/bulk-status-dialog.tsx` | 1 cada (leads-workspace) | | h-8, 1 `dark:` | | **A** (são features; mover para `features/leads`) |
| `ui/popover.tsx` (Base UI) | 12 (5) | | `rounded-[--radius-card]` borda + `--shadow-dialog` (39) | | **A** + escopo |
| `ui/dropdown-menu.tsx` (Base UI Menu) | 28 (14) | Content, Item (variant destructive), CheckboxItem, RadioItem, Sub, Label, Shortcut | Label `font-mono text-[11px] uppercase tracking-wider` (72); `focus:bg-accent` (99,140,186,228,268); `dark:` x2 | | **A** + trocar accent por muted + sentence case |
| `ui/tooltip.tsx` (Base UI) | 16 (10) | | `rounded-xl` + borda + `--shadow-dialog` (65) | | **A** + escopo |
| `ui/info-tooltip.tsx` | 1 | | `shadow-md` | | **A** |
| `motion/tooltip.tsx` | 1 (attachment-upload) | | `shadow-md` | `ui/tooltip` | **D** |
| `ui/sonner.tsx` | 171 (156) | toast.success/error/warning/info/loading/message; Toaster bottom-right | AnimatedToast com `!shadow-[--shadow-dialog]` (43) | | **A** + escopo no Toaster |
| `motion/animated-toast.tsx` | 1 (sonner) | | `shadow-2xl`, `shadow-xs`, 6 `dark:` | | **A** |
| `arc/bottom-sheet` | 23 (20) | detents, trigger, title/description | | canônico mobile | (já Lite) |

### 3.7 Feedback, carregamento, vazio, movimento

| Arquivo | Imp. | Variantes / tamanhos | Desvios Lite | Equivalente Lite | Estratégia |
|---|---|---|---|---|---|
| `ui/skeleton.tsx` | 10 (5) | Skeleton, SkeletonReveal | `ct-skeleton bg-muted rounded-[--radius-card]` (9) | `arc/skeleton` (API por linhas: label, lines, avatar) | **A** (canônico por forma livre); cor e pulso iguais ao Arc (`color-mix(--border-strong 38%, --surface)`) |
| `ui/ds-skeleton.tsx` | 0 | | | | **D** |
| `unlumen-ui/shimmer-skeleton.tsx` | 1 (minha-fila/loading) | | shimmer em gradiente | `ui/skeleton` | **D** |
| `foundations/skeletons.tsx` | 2 (vendas/loading + barrel) | | h-6..h-9 | `ui/skeleton` / `light-page-skeleton` | **A** ou **D** |
| `data-table/data-table-skeleton.tsx` | 0 | | | | **D** |
| `empty-state.tsx` (raiz) | 11 (9) | variant default, card, ghost, inline; icon ComponentType; action; loading; animated | Borda tracejada `rounded-[--radius-card]` (37-41) | `arc/empty-state` (title, description obrigatório, action, icon ReactNode) | **B-adaptador**: renderizar Arc EmptyState por dentro (default/card/ghost); manter `inline` local |
| `ui/empty-state.tsx` | 0 | actionLabel/actionHref/secondaryAction | | | **D** |
| `foundations/empty-state.tsx` | 1 (branches-manager) | | `shadow-xs` | `arc/empty-state` | **D** |
| `ui/ds-empty-state.tsx` | 6 (6) | icon, title, description, action, bordered | `ds-*` | `arc/empty-state` | **B** (API quase igual) |
| `ui/progress.tsx` | 3 (3) | | `bg-primary` | | **A** |
| `motion/count-up.tsx` | 2 (1) | | | `arc/animated-counter` | **A** |
| `ui/ds-count-up.tsx` | 2 (1) | | | `motion/count-up` | **D** |
| `motion/success-overlay.tsx` + `success-moment.tsx` | 3 (3) / 1 | | `--shadow-dialog`, size-5/8 | | **A** |
| `motion/copy-check-icon.tsx` | 4 (3) | | | | **A** |
| `motion/file-upload.tsx`, `motion/attachment-upload.tsx` | 1 cada (lead-documents-section) | | `shadow-2xl/xl`, `dark:`, `createPortal` próprio, size-7..9 | `arc/file-dropzone` | **B** (1 chamador) |
| `motion/interface-motion-provider.tsx`, `use-interface-animation.ts`, `stagger.tsx`, `route-view-transition.tsx`, `animated-page-title.tsx` | 28 / 35 / 1 / 1 / 2 | | infraestrutura de movimento, sem visual | `arc/motion-tokens.ts` | **A** (garantir que respeitem `html[data-reduce-motion]`, venancor-scope.css:169-171) |
| `ui/animated-theme-toggler.tsx` | 1 (theme-toggle) | | troca de tema | Lite sem dark | **D** no Lite (esconder) |
| `ui/animated-icons/hugeicons/*` (35 ícones + index) | via `huge-icons.tsx` (244 importadores) | | só SVG animado | | **A** (nada a re-skin) |

### 3.8 Dados, tabelas, gráficos, avatar, chat

| Arquivo | Imp. | Variantes / tamanhos | Desvios Lite | Equivalente Lite | Estratégia |
|---|---|---|---|---|---|
| `ui/table.tsx` | 44 (41) | Table, Header, Body, Footer, Row, Head, Cell, Caption | `bg-card`, `text-sm`; regras globais por slot (globals.css:508-522) | `light/people-list` (lista, não tabela) | **A** |
| `ui/data-table/*` (index, data-table, frame, column-header, pagination, view-options) | index 15 (14), frame 17 (14) | `dataTableFrameVariants` | raios `--radius-control/--radius-card`, size-8, h-7/h-9 | | **A** |
| `ui/drag-scroll-table.tsx` | 4 (2) | | | | **A** |
| `ui/responsive-data-view.tsx` | 7 (7) | MobileDataList, MobileDataListItem, MobileDataRow | `rounded-[--radius-card]` | `light/people-list` | **A** |
| `data-table/data-table.tsx` (dice-ui) + `column-header`, `pagination` | 1 cada (leads-data-table) | | h-8 | `ui/data-table` | **A** ou **D** (fundir no `ui/data-table`) |
| `data-table/` toolbar, advanced-toolbar, filter-list, filter-menu, sort-list, view-options, faceted-filter, date-filter, slider-filter, skeleton | 0 reais (advanced-toolbar tem 0 e puxa o resto) | | h-6..h-8 | | **D** |
| `base/table`, `base/pagination` | 0 reais | | | | **D** |
| `ui/ds-data-row.tsx` | 0 | | | | **D** |
| `ui/chart.tsx` (Recharts) | 7 (3) | THEMES light/dark (10); tooltip `shadow-xl` (194) | | | **A** + `--chart-*` (seção 2.3) |
| `ui/ds-bar-chart.tsx` | 1 (dashboard-widgets) | | `shadow-ds-md`, hex | `ui/chart` | **D** |
| `ui/ds-donut-chart.tsx` | 1 (director-journey-panel) | | `shadow-ds-md`, hex | `ui/chart` | **D** |
| `dashboard/funnel-chart.tsx` | 1 | | **gradiente SVG** (70-79) | | **A** (trocar por cor chapada) |
| `dashboard/sparkline.tsx` | 1 (integridade) | | **gradiente SVG** de área (37-50) | | **A** (preenchimento chapado com opacidade) |
| `dashboard/metric-sparkline.tsx`, `mini-donut.tsx` | 1 cada (metric-card) | | | | **A** |
| `dashboard/lead-trend-chart.tsx`, `backlog-overlay.tsx` | 0 | | | | **D** |
| `ui/avatar.tsx` (Base UI) | 4 (3) | size default/sm/lg; Image, Fallback, Badge, Group, GroupCount | 1 `dark:` | `arc/avatar` (name, src, size sm/md/lg/xl, status) | **A**; regra Lite já existe: `.light-avatar` fundo `--accent-subtle` (venancor-scope.css:143) |
| `ui/user-avatar.tsx` | 13 (10) | size sm/default/lg; DiceBear styles | `shadow-xs` 2 camadas | `arc/avatar` | **B-adaptador** (iniciais chapadas, sem DiceBear no Lite) |
| `base/avatar` | 0 reais | | | | **D** |
| `ui/bubble.tsx`, `ui/message.tsx` | 2 cada (conversas) | bubble variant (cva) | 4 `dark:` em bubble | `components/chat` (Lite) | **A** (ou trocar pelo chat Lite no inventário de telas) |
| `foundations/filter-bar.tsx` | 2 (leads-filters) | | `shadow-lg` 2 camadas | | **A** |
| `foundations/active-filter-chips.tsx` | 2 (leads-filters) | | chips h-6 (24px) | `arc/chip-group` | **A** (44px) |
| `ui/filter-toolbar.tsx` | 1 (conversas) | | | `foundations/filter-bar` | **D** |
| `ui/faceted.tsx`, `ui/sortable.tsx`, `ui/inline-group.tsx` | 0 | | | | **D** |
| `foundations/icons/chevrons.tsx` | 2, ambos mortos | | | | **D** |
| `foundations/index.ts` (barrel) | 1 real (branches-manager) + dev | | | | **D** após migrar branches-manager |

---

## 4. Duplicatas: um canônico por papel

| Papel | Candidatos hoje | Canônico proposto | O que acontece com os outros |
|---|---|---|---|
| Botão | `ui/button` (303), `ds-*-button` x4 + `ds-button-variants` (13 usos), `magnetic-button` (0), `stateful-button` (2), `base/buttons` (0), `arc/button` (29) | **`ui/button` re-skinado (A)** para o diretor; `arc/button` continua nas telas Lite já feitas | ds-* para ui/button (D); stateful para `arc/action-button` (B); magnetic e base (D) |
| Botão com estado | `stateful-button`, `arc/action-button` | **`arc/action-button`** | stateful (B) |
| Card | `ui/card` (167), `dashboard-card` (3), `ds-dashboard-card` (1), `ds-elevated-feature-card` (0), `foundations/section` (0) | **`ui/card` re-skinado** | demais (D) |
| Métrica | `dashboard/metric-card` StatCard (20), `ds-stat-tile` (1), `ds-trend-stat-card` (0), `arc/metric-card` (1) | **StatCard re-skinado** | ds (D); `arc/metric-card` fica para Lite |
| Estado vazio | `components/empty-state` (11), `ui/empty-state` (0), `foundations/empty-state` (1), `ds-empty-state` (6), `arc/empty-state` (25) | **`arc/empty-state`** (com adaptador no `components/empty-state` para não tocar 11 chamadores; variante `inline` fica local) | ui/foundations (D); ds (B) |
| Skeleton | `ui/skeleton` (10), `ds-skeleton` (0), `unlumen shimmer` (1), `foundations/skeletons` (2), `data-table-skeleton` (0), `arc/skeleton` (5), `light-page-skeleton` | **`ui/skeleton`** para forma livre (re-skin com a cor/pulso do Arc) + **`arc/skeleton`** para blocos de texto | ds, shimmer, data-table-skeleton (D) |
| Segmentado / abas | `ui/tabs` (17, 4 variantes), `ds-tabs` (2), `ds-segmented-control` (7), `base/segmented-control` (0), `route-section-tabs` (3), `foundations/page-tabs` (3), `toggle-group` (0), `arc/segmented-control` (13) | **`arc/segmented-control`** para escolha de 2 a 5 filtros; **`ui/tabs` underline** para abas de seção; **`route-section-tabs`** para abas por URL | ds-segmented (B), ds-tabs, base, toggle-group (D); page-tabs avaliar fundir em route-section-tabs |
| Modal / painel | `ui/dialog` (60), `ds-dialog` (1), `ui/sheet` (31), `ds-sheet` (1), `ui/drawer` (2), `foundations/detail-drawer` (5), `arc/bottom-sheet` (23) | **`ui/dialog`** (confirmação curta), **`ui/sheet`** lado direito no desktop, **`arc/bottom-sheet`** no celular. `detail-drawer` e `confirm-dialog` ficam como composições | ds-dialog, ds-sheet, drawer (D) |
| Badge / status | `ui/badge` (172), `animated-badge` (4), `ds-pill-badge` (0), `ds-status-badge` (6), `foundations/status-badge` (1), `status-badges` (17, domínio), `base/badges` (0), `arc/badge` (23) | **`ui/badge` re-skinado** (motor `animated-badge`); `status-badges` segue como camada de domínio | ds-pill, ds-status, foundations, base (D) |
| Campo de texto | `ui/input` (130), `ds-input-field` (3), `base/input` (0), `arc/input` (11) | **`ui/input` re-skinado** (máscaras) | ds, base (D) |
| Switch | `ui/switch` (19), `ds-switch` (1), `arc/switch` (5) | **`arc/switch`** (B) ou `ui/switch` re-skinado | ds (D) |
| Contagem animada | `motion/count-up` (2), `ds-count-up` (2), `arc/animated-counter` (3) | **`motion/count-up`** no diretor | ds (D) |
| Tooltip | `ui/tooltip` (16), `info-tooltip` (1), `motion/tooltip` (1), `base/tooltip` (0) | **`ui/tooltip`** | motion/base (D) |
| Callout | `context-note` (4), `ds-callout` (0) | **`context-note`** | ds (D) |
| Barra de filtro | `foundations/filter-bar` (2), `ui/filter-toolbar` (1) | **`foundations/filter-bar`** | filter-toolbar (D) |
| Tabela | `ui/table` + `ui/data-table/*`, `components/data-table/*` (dice-ui), `base/table` | **`ui/table` + `ui/data-table`** | dice-ui parcial e base (D) |
| Gráfico | `ui/chart`, `ds-bar-chart`, `ds-donut-chart`, `dashboard/*` | **`ui/chart`** | ds (D) |
| Avatar | `ui/avatar` (4), `user-avatar` (13), `base/avatar` (0), `arc/avatar` (16) | **`arc/avatar`** via adaptador no `user-avatar` | base (D) |

---

## 5. Portais: como o conteúdo herda `.arc-venancor`

Contexto: todas as overlays CRM são **Base UI** (`@base-ui/react`), não Radix; `Portal` do Base UI aceita `container`. Por padrão monta em `document.body`, fora do escopo. Custom properties se aplicam ao próprio elemento que tem a classe, então pôr `arc-venancor` no Popup basta. Já há precedente no repo: `first-message-dialog.tsx:143` (`<DialogPopup className="arc-venancor ...">`) e ~15 `<BottomSheet className="arc-venancor">`.

Recomendação: **uma solução central, não por chamador**. Duas opções equivalentes:

- **Opção 1 (recomendada): contexto de escopo + classe no Popup.** Criar `ArcScopeProvider` (true no shell Lite/diretor) e, nas wrappers de `src/components/ui`, fazer `className={cn(base, inArcScope && "arc-venancor", className)}` no Popup/Content. Zero mudança nos chamadores. Não depende do DOM.
- **Opção 2: container de portal escopado.** Um `<div id="arc-portal-root" class="arc-venancor">` no layout e passar `container` no Portal das wrappers. Mais limpo para empilhamento, mas exige ref/estado e não cobre `createPortal` manual nem Sonner.

| Primitiva | Lib | Onde monta o portal | Como herdar o escopo |
|---|---|---|---|
| `ui/dialog.tsx` | Base UI Dialog | `DialogPortal` (16-17), usado em `DialogPopup` (44) | classe no `DialogPrimitive.Popup` (47) **e** no Backdrop (27) para o véu usar `--foreground` Lite; ou `container` no `DialogPortal` |
| `ui/sheet.tsx` | Base UI Dialog | `SheetPortal` (22-23), em `SheetContent` (50) | classe no Popup (53) e no Backdrop (29) |
| `ui/drawer.tsx` | Base UI Drawer | `DrawerPortal` (59-60, 110) | classe no Popup (120); mas aposentar (D) |
| `ui/popover.tsx` | Base UI Popover | `PopoverPrimitive.Portal` (29) direto, sem prop de container | classe no `PopoverPrimitive.Popup` (38) |
| `ui/dropdown-menu.tsx` | Base UI Menu | `MenuPrimitive.Portal` (34) e SubContent (161) | classe no Popup (43) e no SubContent (161) |
| `ui/select.tsx` | motion custom | `motion/select.tsx:324-353` `createPortal(..., document.body)`; idem `select-morph` | trocar o alvo do `createPortal` pelo container escopado, ou classe no `div` do listbox (344) |
| `ui/tooltip.tsx` | Base UI Tooltip | `TooltipPrimitive.Portal` (55), Positioner `isolate z-50` | classe no Popup (64); o Arrow usa `bg-popover` e herda |
| `ui/command.tsx` | cmdk dentro de `DialogPopup` | herda do `ui/dialog` | resolve junto com dialog (e é D) |
| `ui/combobox.tsx` | usa `ui/popover` | herda do popover | resolve junto com popover |
| `ui/sonner.tsx` | Sonner | **não é portal**: o `<section>` renderiza onde o `<Toaster/>` está (`layout.tsx:115`, fora do shell) | adicionar `arc-venancor` ao `className` do Toaster (hoje `"ct-toaster"`, linha 15) quando o modo for Lite, ou ao `className` do `AnimatedToast` (43) |
| `motion/attachment-upload.tsx` | `createPortal` próprio | body | classe no nó do portal (ou B para `arc/file-dropzone`) |
| `ui/sortable.tsx` | `createPortal` (DragOverlay) | body | morto (D) |
| `foundations/confirm-dialog`, `detail-drawer`, `bulk-*-dialog` | usam dialog/sheet | herdam | nada a fazer |
| `arc/bottom-sheet` | Radix Dialog Portal (bottom-sheet.tsx:100) | body | já padronizado: chamador passa `className="arc-venancor"`. Sugestão: embutir a classe no próprio componente para parar de repetir |

Cuidado: com a classe no Popup, as regras `.arc-venancor textarea` (182), `input` 16px no celular (193-197) e o `:focus-visible` Arc (132-136) passam a valer dentro de todos os menus e modais. É o desejado, mas confirmar que nenhum menu do diretor dependia do ring CRM.

---

## 6. Aposentar primeiro (estratégia D, 0 ou só chamadores mortos)

Sem nenhum importador de produção:
`ui/empty-state.tsx`, `ui/page-header.tsx`, `ui/form-section.tsx`, `ui/form.tsx`, `ui/magnetic-button.tsx`, `ui/dock.tsx`, `ui/inline-group.tsx`, `ui/faceted.tsx`, `ui/sortable.tsx`, `ui/breadcrumb.tsx`, `ui/toggle-group.tsx` (e `ui/toggle.tsx`, só usado por ele), `ui/ds-ghost-nav-button.tsx`, `ui/ds-outlined-nav-button.tsx`, `ui/ds-pill-badge.tsx`, `ui/ds-pill-feature-tag.tsx`, `ui/ds-elevated-feature-card.tsx`, `ui/ds-trend-stat-card.tsx`, `ui/ds-sidebar-nav-item.tsx`, `ui/ds-callout.tsx`, `ui/ds-checkbox.tsx`, `ui/ds-data-row.tsx`, `ui/ds-selection-bar.tsx`, `ui/ds-skeleton.tsx` (estes ds só aparecem em `app/dev/*`), `dashboard/lead-trend-chart.tsx`, `dashboard/backlog-overlay.tsx`, `operational-placeholder.tsx`, `foundations/page-header.tsx`, `page-actions.tsx`, `row-actions.tsx`, `section.tsx`, `settings-section.tsx`.

Cadeias mortas (o topo tem 0 importadores):
- `components/application/data-table/data-table.tsx` (0) puxa **todo `src/components/base/*`** (17 arquivos) e `foundations/icons/chevrons.tsx`.
- `components/data-table/data-table-advanced-toolbar.tsx` (0) puxa `data-table-toolbar`, `filter-list`, `filter-menu`, `sort-list`, `view-options`; e `faceted-filter`, `date-filter`, `slider-filter`, `data-table-skeleton` (0) puxam `ui/command`, `ui/calendar`, `ui/slider`.

Com 1 a 6 chamadores, migrar e apagar: `ds-button-variants` + `ds-filled-dark-cta` + `ds-outlined-action-button`, `ds-status-badge`, `ds-empty-state`, `ds-segmented-control`, `ds-tabs`, `ds-dialog`, `ds-sheet`, `ds-switch`, `ds-input-field`, `ds-section-header`, `ds-dashboard-card`, `ds-stat-tile`, `ds-count-up`, `ds-bar-chart`, `ds-donut-chart`, `dashboard-card.tsx`, `ui/drawer.tsx`, `unlumen-ui/shimmer-skeleton.tsx`, `motion/tooltip.tsx`, `ui/filter-toolbar.tsx`, `foundations/empty-state` e `status-badge` (via barrel). Os chamadores ds concentram-se em `features/journey/components/director/*`, `features/dashboard/components/{dashboard-widgets,command-center}.tsx` e `leads/distribuicao/page.tsx`.

Total: cerca de 45 arquivos saem antes do re-skin. Lembrete da regra do vault: no repo isso é remoção de código via git (histórico preservado), não arquivamento.

---

## 7. Ordem sugerida (só primitivas)

1. P1 a P6 (escopo global, classe no shell, tema claro, 44px em px, tokens faltantes, arquivo de CSS de primitivas).
2. Corrigir `--accent` nas primitivas (dropdown-menu, toggle) e decidir `--text-xl..5xl` e `--background`.
3. Portais (seção 5, opção 1) e Toaster.
4. Aposentar a lista da seção 6.
5. Re-skin A das 6 primitivas de maior alcance: Button (303), Badge (172), Sonner (171), Card (167), Input (130), Select (85). Isso cobre a maior parte das telas do diretor.
6. Dialog/Sheet/Popover/Dropdown/Tooltip, Table/DataTable, Tabs, Checkbox/Switch, Skeleton.
7. B pontuais: ds-segmented-control para Arc SegmentedControl (7), ds-empty-state e adaptador do empty-state, stateful-button para ActionButton (2), user-avatar adaptador, file/attachment-upload para FileDropzone (1).
8. Gráficos: `--chart-*` e remoção dos 2 gradientes SVG.

Riscos a validar em tela: tamanho de títulos (achado 4), fundo cinza vindo de `bg-background` (2.1), densidade das tabelas com alvos de 44px, e menus que hoje usam `bg-accent`.
