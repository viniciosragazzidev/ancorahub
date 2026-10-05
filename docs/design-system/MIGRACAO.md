# Migração para o Design System Venancor

Fonte da verdade: `docs/design-system/venancor.md`. Trabalho atual na branch `design/venancor`, criada de `perf/crons-n1`; `design/venancor-ds` é só referência visual. Sem mudar regra de negócio, dados, comportamento ou estrutura das telas. Tema claro por padrão.

**Donos:** Prumo = tokens e primitivos (`src/app/globals.css`, `src/app/layout.tsx`, `src/components/ui`, `src/components/base`, `src/components/motion`). Mosaico = componentes compostos e telas (`src/components/*` fora de ui/base/motion, `src/app/**`).
**Revisão:** Arquiteto revisa só o `git diff` de cada tarefa. Sem push, sem deploy.

## Inventário (resumo)
- Tokens: `globals.css` ainda em Inter (`--font-inter-sans`), `--primary #0d111b`, `--radius-control 0.625rem`, `--radius-panel 2rem`, dark em oklch. `layout.tsx` carrega Inter/Geist Mono/JetBrains.
- Primitivos: `ui/` (~60 arquivos: button, input, select, dialog, sheet, tabs, card, badge, table, popover, dropdown-menu, toggle-group, switch, checkbox, tooltip, sidebar, skeleton, sonner, page-header, filter-toolbar, form-section, empty-state). Paralelos: `base/` (button, input, select, table, chip, segmented-control, dropdown, pagination, tooltip, avatar, checkbox; ~5 usos externos), `motion/` (select, tooltip, animated-badge/toast), `unlumen-ui/shimmer-skeleton`, `ui/animated-icons`. Não existe nenhum arquivo `ds-*`; os "ds" são os próprios `ui/`.
- Compostos: `data-table/` e `ui/data-table`, `status-badges`, `dashboard/*` (metric-card, gráficos), `app-shell`, `workspace-rail`, sidebars (corretop, corretor, financeiro, platform-admin, super-dev), `dashboard-header`, `command-palette`, `global-search`, `notification-popover`, `light-bottom-nav`/`mobile-bottom-nav`, `empty-state`, `degraded-state`, `whatsapp/*`, `onboarding/*`, `agent-drawer/*`, `system-feedback-drawer`, `splash-screen`, logos.
- Telas (arquivos .tsx): leads 39, settings 28, equipe 14, relatórios 11, dashboard 9, qualificação 8, integrations 8, marketing 7, conversas 7, vendas 6, demais ≤4; mais `(auth)`, `(platform-admin)` e `onboarding`.
- Débito medido: 74 arquivos com `shadow-sm/md/lg/xl`; 7 com hex literal; 5 arquivos com Dialog/Sheet + ScrollArea (`conversations-workspace`, `leads-workspace`, `propostas-client`, `ui/sheet`, `ui/sidebar`).

## Tarefas (ordem de execução)

### Fase 1 — Fundação (Prumo)
| # | Tarefa | Pronto visual |
|---|---|---|
| P1 | Tokens de cor light/dark (`--primary #3b2dff`, `--ring`, `--secondary/muted/accent #f4f3f0`, `--border/input #e4e4e7`, success/warning/info/destructive, página `#faf9f7`, seleção a 8%) | Botão primário, foco e seleção em `#3b2dff`; fundo da página cinza-quente; dark só com `.dark` |
| P2 | Fonte: Plus Jakarta Sans em `--font-sans`/`--font-heading`; Amil só em `--font-logo`; remover Inter | Nenhum texto em Inter; logo em Amil; `tabular-nums` utilitário para números |
| P3 | Raio: `--radius: 1rem`, card 16-20, dialog 24, controles `rounded-full`; sombra só em flutuantes | Sem `rounded-[0.625rem]` em controles; cards sem sombra |
| P4 | Escala tipográfica (título 24-28/600, seção 16-18/600, corpo 14, rótulo 13/500 muted, micro caps 11/600) e movimento (150-200ms, `cubic-bezier(0.2,0,0,1)`, reduced-motion) | Tokens/classes existem e o respeito a reduced-motion continua |

### Fase 2 — Primitivos (Prumo)
| # | Tarefa | Pronto visual |
|---|---|---|
| P5 | `button`/`button-variants`, `base/buttons`: pílula; alturas 40/44-48/52; primário, secundário branco com borda, ghost, destrutivo | Foco visível (anel 2px primário), contraste AA do texto sobre `#3b2dff` |
| P6 | `input`, `textarea`, `select`, `combobox`, `currency-input`, `field`, `label`, `base/input|select`, `motion/select`: pílula, borda fina, rótulo acima, ajuda/erro 13px | Campos 44px pílula; textarea com raio 16 (não pílula) |
| P7 | `tabs`, `toggle-group`, `toggle`, `base/segmented-control`: pílulas, selecionado primária a 8% + borda e texto primários | Estado selecionado distinguível sem depender só de cor (borda) |
| P8 | `card`, `page-header`, `form-section`, `separator`, `table`/`base/table`: card branco, borda 1px, sem sombra, `p-5/p-6`; tabela com cabeçalho micro caps e hover `#f4f3f0` | Nenhum card com sombra |
| P9 | `badge`, `base/badges`, `status-badges.tsx`: pílula e `bg-*-50 text-*-700 border-*-200` por status | Cinco status fiéis ao spec |
| P10 | `dialog`, `sheet`, `drawer`, `popover`, `dropdown-menu`, `tooltip`, `sonner`: dialog até `max-w-3xl/4xl`, 90vh, header/rodapé fixos, corpo com rolagem nativa sem ScrollArea, tela cheia no celular; sombra suave só aqui | Zero `ScrollArea` em Dialog/Sheet (inclui `ui/sheet.tsx`) |
| P11 | `skeleton`, `unlumen-ui/shimmer-skeleton`, `progress`, `slider`, `switch`, `checkbox`, `avatar`, `calendar`, `chart` (paleta: `#3b2dff`, `#3b82f6`, `#f59e0b`, `#10b981`, `#94a3b8`), ícones traço fino (stroke 1.5) | Gráficos na paleta; sem ícones preenchidos |
| P12 | Decidir `base/` vs `ui/`: manter um só caminho visual (re-exportar ou alinhar `base/` aos mesmos tokens). Não remover sem acordo | `base/` e `ui/` renderizam igual |

### Fase 3 — Compostos (Mosaico), depois de P1-P3 mergeados na branch
| # | Tarefa | Pronto visual |
|---|---|---|
| M0 (pronta para build) | Limpeza de dialogs nas telas: remover `ScrollArea` de `conversations-workspace`, `leads-workspace`, `propostas-client`; largura e rodapé fixos | Dialog largo, rolagem nativa, sem corte em 375px |
| M1 (pronta para build) | Shell: `app-shell`, `workspace-rail`, sidebars (5), `dashboard-header`, `platform-admin-*`, `super-dev-*`, bottom navs, `skip-to-content` | Fundo `#faf9f7`, item ativo com seleção a 8%, foco visível |
| M2 (pronta para build) | `data-table/*` e `ui/data-table` (toolbar, filtros, paginação, colunas) | Cabeçalho micro caps, hover quente, filtros em pílula |
| M3 | `dashboard/*` (metric-card, gráficos, sparkline), `empty-state`, `degraded-state`, `route-*`, `loading/*` | KPIs `tabular-nums`, cards sem sombra, gráficos na paleta |
| M4 | Overlays compostos: `command-palette`, `global-search`, `notification-popover`, `quick-actions-menu`, `agent-drawer`, `system-feedback-drawer`, `whatsapp-connect-dialog`, `onboarding/*`, `pwa-install-prompt` | Largura/90vh/rodapé fixo conforme spec; tela de sucesso no padrão (check verde, 2 botões) |
| M5 | Logos e splash: `ancora-logo`, `corretop-logo`, `branding/*`, `splash-screen`, `login-transition` | Logo em Amil; splash em tema claro |

### Fase 4 — Telas em volume (Mosaico), uma por PR/commit
Ordem por tráfego e volume: M6 `dashboard` · M7 `leads` (39 arq., maior) · M8 `conversas` + `minha-fila` · M9 `propostas`, `vendas`, `clientes` · M10 `equipe`, `filiais`, `unidades`, `distribuicao` · M11 `relatorios`, `marketing`, `qualificacao` · M12 `settings` (28), `integrations`, `assinatura`, `fluxos-whatsapp` · M13 `(auth)`, `onboarding`, `primeiro-acesso`, `welcome`, `termos` · M14 `(platform-admin)` super-admin e super-dev, `noc`, `integridade`, `roadmap`, `guia`, `notificacoes`, `assistente`, `empresas`.
Pronto visual por tela: sem cor/hex fora de tokens, sem `shadow-*` em cards, pílulas em controles, respiro (card p-5/p-6, gap 16-20), mobile 375px sem scroll horizontal.

### Fase 5 — Varredura final (Mosaico, Prumo apoia)
- F1 grep: hex literal (7 arquivos), `shadow-(sm|md|lg|xl)` (74), `font-inter`, `rounded-md|lg` em controles, `ScrollArea` em overlays.
- F2 contraste AA e foco visível nas telas-chave; `prefers-reduced-motion`.
- F3 rodar `tsc`, lint e testes dos componentes tocados (`foundation-primitives`, `pattern-primitives`, `status-badges`, `select`, `accessibility-foundation`).

## Regras para todos
- Mudar só classes/tokens/estilo; nenhum handler, query, action ou schema.
- Commits pequenos por tarefa (id no título, ex.: `style(ds): P5 button pill`). Pedir revisão ao Arquiteto com o id da tarefa.
- Dependência: nenhuma tarefa M1+ começa antes de P1-P3 estarem na branch; M0 pode seguir já.
