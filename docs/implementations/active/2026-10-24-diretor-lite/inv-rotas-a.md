# Inventário GRUPO A: modo diretor (NORMAL) para o estilo Lite

Repo: `C:/Users/kyper/Desktop/Kyper/Projects/ancorahub-lite-listas` (HEAD 5026f66e). Somente leitura: nada foi editado nem executado no repo.
Gerado em 2026-10-24. Caminhos de componente relativos a `src/`.

## 1. Como foi feito e como ler

- Para cada rota, parti de `page.tsx` (mais `loading.tsx`, `error.tsx`, `layout.tsx` quando existem) e segui TODOS os imports (estáticos e `import()` dinâmico) recursivamente por `src/app`, `src/features` e `src/components`.
- O rastreio para em três fronteiras, que viram listas à parte em cada seção:
  - **Lite já pronto**: `components/light|chat|arc`, `features/broker-workspace|supervisor-workspace|manager-workspace|team-conversations`, arquivos `light-*`/`lite-*`. Aparecem como "já renderizados nesta rota" (ramos Lite do page).
  - **Primitivas**: `components/ui|foundations|base|motion|data-table|illustrations|unlumen-ui`. Convertidas uma vez só (seção 3).
  - **Shell comum**: `layout.tsx` do grupo `(dashboard)` e `components/dashboard-header.tsx` com tudo que eles puxam (seção 4). Saem das tabelas de rota para não repetir 11 linhas em toda rota.
- Componente compartilhado entre rotas aparece com a linha completa só na primeira seção em que surge; nas seguintes, "ver seção X".
- Colunas da tabela:
  - **Componente (arquivo:linha)**: linha da primeira declaração exportada.
  - **Importado em (arquivo:linha)**: onde a rota puxa esse arquivo pela primeira vez (`(entrada)` = arquivo de rota).
  - **Desvios do Lite**: detecção por regex linha a linha, com contagem e as primeiras linhas:
    - `gradiente`: bg-gradient, linear/radial-gradient, from-/via-/to-.
    - `sombra`: shadow-*, box-shadow, drop-shadow (exceto shadow-none). Token único tipo `shadow-(--shadow-resting)` também conta, conferir à mão.
    - `cor crua`: paleta Tailwind (emerald, sky, amber, red, white, black...), hex, rgb(), hsl(), oklch().
    - `peso`: font-thin, light, extrabold, black e font-[100 a 300, 800, 900]. Nenhum arquivo do Grupo A tem esse desvio.
    - `uppercase`: uppercase e textTransform.
    - `dark:`: variantes de tema escuro.
    - `alvo<44px`: size="sm|xs|icon|icon-sm|icon-xs", h-5..h-8 e size-5..size-8. Pela `components/ui/button-variants.ts`, sm é h-7.5, xs h-6, icon size-8 e default h-9: **nenhum tamanho do Button atual chega a 44px**. Ícones decorativos `size-5`..`size-8` também caem no filtro, então é teto, não número exato.
  - **Cx**: P (até cerca de 140 linhas, troca direta), M (até cerca de 450 linhas ou vários overlays), G (mais de 450 linhas, kanban, tabela grande ou gráfico).
  - **Dependências**: primitivas Lite que o componente vai precisar, derivadas dos overlays e controles que ele usa.

## 2. Resumo executivo

- **190 componentes únicos** no Grupo A (fora shell e primitivas): **24 G, 51 M, 115 P**. Destes, **171 estão no caminho do diretor** (24 G, 51 M, 96 P). O resto é de rotas que o diretor nem abre.
- **Rotas que o diretor NÃO abre** (redirect ou só Lite), sem conversão: `dashboard/c/[assistant]`, `conversas/broker`, `cotacao`, `desempenho`, `jornada`, `agenda`, `mensagens`, `mensagens/[leadId]`. `leads/[id]/feedback` já renderiza `LightFeedbackView` para todos. `relatorios` e `leads/distribuicao/plantao` são só redirect.
- **Lite pronto para reusar direto** (mesmas props ou quase):
  - `notificacoes`: `NotificationsClient` vira `LightNotifications`, e `LeadToastToggle` vira `LightLeadToastToggle`.
  - `empresas`: `LightCompaniesList`, que o gestor Lite já usa (`empresas/page.tsx:50`).
  - `relacionamento`: `RelationshipCenter` vira `RelationshipCenterLite` (mesmas props).
  - `clientes`: `LightClientsList` com `management` (falta conferir filtro de filial e paginação).
  - Skeletons de loading: `LightPageSkeleton`.
- **Lite que serve de base visual** (o desenho é reaproveitado, a estrutura do diretor fica):
  - `leads/[id]`: `LightLeadDetail` e `SupervisorLeadDetail` (`LeadHeaderBar`, `NextStepCard`, `DetailsZone`, `PeopleDataSection`, `ActionBar`).
  - `clientes/[clientId]`: `LightClientDetail`.
  - Listas: `components/light/people-list` (`PeopleRow`, `PeopleFilters`, `PeopleStats`).
  - Radar: `SupervisorLeadsRadar`.
  - Plantão: `LightDutyCalendar`, `DutyNowView`, `TeamOnDutyList`.
  - Formulários de gestão do lead: `ManagerLeadTransferForm`, `ManagerLeadStatusSheet`.
  - Assistente: `components/chat` (`AssistantChat`, `ChatScreen`, `Composer`).
- **Sem nenhum Lite equivalente (criar Lite novo):**
  - kanban de leads (`leads-workspace.tsx`)
  - distribuição: `queue-control-center`, `distribution-inbox`, `routing-matrix-panel`, `broker-daily-summary-panel`
  - plantões: `duty-operations-workspace`, `monthly-duty-planner`
  - `propostas-client`, `documents-workspace`, `sales-workspace`
  - `lead-quality-center`, `noc-client`
- **Precedente ed0af666** (`conversas`): o page envolve o workspace em `.arc-venancor` mais `conversas-lite.module.css`. O componente ganha atributos `data-lite="workspace|toolbar|panes|pane|search"`, que o CSS module reestiliza, e `motion/react` com `useReducedMotion`. As classes Tailwind internas ficaram como estavam: `conversations-workspace.tsx` ainda tem 27 linhas de cor crua, 14 `dark:` e 22 alvos pequenos. É o molde para o "re-skin por tokens" sem tocar em dados.
- **Maiores focos de desvio** (cor crua / dark:):
  - `leads-table-columns.tsx` (64/38)
  - `assistente-chat-client.tsx` (43 cores)
  - `leads-workspace.tsx` (32/8)
  - `conversations-workspace.tsx` (27/14)
  - `negotiations-radar-tab.tsx` (14/7, mais gradiente e 6 sombras)
  - `queue-control-center.tsx` (12/4)
  - `noc-heatmap.tsx` (10/7)
  - `propostas-client.tsx` (10 cores, 9 sombras)
  - `official-broker-conversations.tsx` (10 cores, 24 alvos)
- **Gradientes** só em 8 arquivos:
  - `lead-quality-center` (5)
  - `negotiations-radar-tab` (2)
  - `ai-conversation-insight-card` (2)
  - `supervision-panel` (1)
  - `lead-documents-section` (1)
  - `next-best-action-card` (1)
  - `clientes/[clientId]/page` (1)
  - `assistente-chat-client` (1)
- **Uppercase** concentrado em:
  - `leads-filters` (9)
  - `clientes/[clientId]/page` (9)
  - `leads/[id]/page` (7)
  - `person-record-details` (7)
  - `conversations-workspace` (5)
  - Eyebrows `text-[11px] uppercase tracking-[0.14em]`.

### Tabela por rota

| Rota | Acesso do diretor | Componentes próprios (inclui repetidos) | Novos G/M/P |
|---|---|---|---|
| dashboard (page, aba overview: CommandCenter) | Diretor: sim (ramo NORMAL) | 7 | 0/2/5 |
| dashboard aba quality (LeadQualityCenter) | Diretor: sim (ramo NORMAL) | 5 | 1/2/1 |
| dashboard aba funnel (QualificationFunnelView) | Diretor: sim (ramo NORMAL) | 5 | 0/1/3 |
| dashboard/c/[assistant] | Diretor: NÃO (redirect /dashboard) | 1 | 0/0/1 |
| dashboard/drill/[drillId] | Diretor: sim | 2 | 0/1/1 |
| leads (page: kanban/lista) | Diretor: sim | 31 | 5/11/14 |
| leads/[id] | Diretor: sim | 30 | 2/8/15 |
| leads/[id]/feedback | Diretor: sim, já Lite (LightFeedbackView) | 1 | 0/0/1 |
| leads/arquivados | Diretor: sim (exclusivo) | 1 | 0/1/0 |
| leads/dashboard | Diretor: sim | 1 | 0/0/1 |
| leads/distribuicao | Diretor: sim (gestor bloqueado no layout) | 28 | 7/5/11 |
| leads/distribuicao/plantao | Redirect para /distribuicao?view=plantao | 1 | 0/0/1 |
| leads/distribuicao/plantao/[scheduleId] | Diretor: sim | 29 | 1/4/7 |
| conversas | Diretor: sim (já em .arc-venancor parcial) | 16 | 2/4/6 |
| conversas/broker | Diretor: NÃO (redirect /conversas) | 3 | 0/0/2 |
| conversas/dashboard | Diretor: sim | 2 | 0/0/2 |
| clientes | Diretor: sim | 9 | 0/2/2 |
| clientes/[clientId] | Diretor: sim | 7 | 1/0/2 |
| vendas | Diretor: sim | 10 | 1/0/3 |
| vendas/[id] | Diretor: sim | 8 | 0/3/1 |
| vendas/dashboard | Diretor: sim | 2 | 0/0/1 |
| propostas | Diretor: sim | 2 | 1/0/1 |
| cotacao | Diretor: NÃO (access-denied; só corretor) | 1 | 0/0/1 |
| documentos | Diretor: sim | 3 | 1/0/1 |
| empresas | Diretor: sim (se a feature estiver ligada) | 1 | 0/0/1 |
| relatorios | Diretor: redirect para /dashboard | 2 | 0/0/2 |
| relatorios/drill/[drillId] | Diretor: sim | 1 | 0/0/0 |
| desempenho | Diretor: NÃO (redirect /dashboard; só corretor Lite) | 1 | 0/0/1 |
| noc | Diretor: sim | 9 | 1/1/2 |
| integridade | Diretor: sim | 2 | 0/1/1 |
| jornada | Diretor: NÃO (redirect /dashboard; só corretor) | 7 | 0/0/7 |
| agenda | Diretor: NÃO (só corretor Lite) | 1 | 0/0/1 |
| tarefas/dashboard | Diretor: sim | 2 | 0/0/1 |
| notificacoes | Diretor: sim (ramo NORMAL) | 3 | 0/0/3 |
| mensagens | Diretor: NÃO (redirect /conversas) | 2 | 0/0/2 |
| mensagens/[leadId] | Diretor: NÃO (redirect /conversas) | 1 | 0/0/1 |
| minha-fila | Diretor: alcança (sem gate), mas é a fila pessoal do corretor | 6 | 0/2/3 |
| relacionamento | Diretor: sim (RelationshipJourneyTabs) | 9 | 0/3/6 |
| assistente | Diretor: sim | 2 | 1/0/1 |
## 3. Primitivas Lite: o que já existe e o que falta

**Já instaladas em `src/components/arc`** (escopo `.arc-venancor`, tokens em `components/arc/venancor-scope.css`):
action-button, animated-counter, avatar, badge, bottom-sheet, button, calendar, chip-group, date-picker, empty-state, expandable-card, file-dropzone, input, metric-card, password-field, radio-cards, search-field, segmented-control, skeleton, slider, stepper, switch, textarea.

**Já existem no Lite, fora do Arc:**
- `components/light/people-list` (PeoplePage, PeopleStats, PeopleFilters, PeopleSection, PeopleRow, PeopleEmpty)
- `components/light/light-page-skeleton.tsx`
- `components/light/light-motion.tsx`
- `components/chat/*` (chat-screen, composer, chat-blocks, chat-audio, thread-row, assistant-chat)

**Faltam, e o Grupo A depende delas.** Todas estão no catálogo Arc (uiarc.dev) e entram via shadcn CLI. Bloqueiam a conversão das telas G e M:

| Primitiva a instalar/criar | Usada por (exemplos do Grupo A) | Prioridade |
|---|---|---|
| Arc `dialog` | 30+ componentes: qualifying-lead-actions, lead-quick-note, lead-reminder, bulk-lead-import-dialog, distribution-inbox, duty-type-ui, propostas-client, delete-lead-control | 1 |
| Arc `drawer` (lateral desktop) | lead-details-drawer (inspector), manual-lead-sheet, queue-detail-sheet, duty-operations-workspace, broker-day-history-trigger, lead-tags-manager, campaigns-tab | 1 |
| Arc `sortable-data-table` | leads-data-table, leads-table-columns, sales-workspace, documents-workspace, queues-table, commission-schedule-table, broker-daily-summary-panel, relatorios/drill, lead-quality-center | 1 |
| Arc `select` / `combobox` | period-select, branch-select, lead-status-selector, manual-qualification-dialog, routing-matrix-panel, ddd-routing-panel | 1 |
| Arc `tabs` | leads/[id] (abas do perfil), clientes/[clientId], vendas/[id], distribution-tabs-container, director-journey-panel | 1 |
| Arc `dropdown-menu` | leads-header-actions, leads-table-columns (menu de linha), queue-control-center, media-attach-button, related-actions-menu | 2 |
| Arc `popover` | lead-quality-filters, lead-tags-picker, quick-responses-popover, broker-presence-release-button, notification-popover (shell) | 2 |
| Arc `checkbox` | leads-workspace (seleção em massa), lead-tasks, manual-lead-form | 2 |
| Arc `tooltip` | lead-health-badge, next-best-action-inline, noc-client, queue-control-center | 2 |
| Arc `toast` (ou re-skin do `ui/sonner.tsx`) | quase todas as ações (29 rotas alcançam sonner) | 2 |
| Arc charts (`line-chart`, `bar-chart`, `donut-chart`, `sparkline`, `activity-heatmap`) | metric-sparkline, mini-donut, sparkline (2 cópias), ds-bar-chart, chart.tsx, noc-client, noc-heatmap, director-journey-panel | 2 |
| Arc `timeline` | lead-timeline, lead-assignment-history, broker-day-history-trigger, audit-tab | 3 |
| Arc `filter-toolbar` | leads-filters, conversations-workspace (FilterToolbar), sales-workspace, documents-workspace | 3 |
| Arc `alert`, `progress`, `scroll-area`, `number-field` | noc-anomaly-alerts, context-note, progress, currency-input | 3 |
| **Kanban Lite (criar, não existe no Arc)** | leads-workspace (SortableKanbanColumn, KanbanColumn, KanbanLeadCard, SlaBar) | 1 |
| **Superfície/cartão Lite (criar)** | substitui `ui/card.tsx` (30 rotas): bg `--surface-muted` ou `--surface`, raio `--radius-panel`, `--shadow-resting` (sombra única) | 1 |
| **Header de página Lite** | `components/dashboard-header.tsx` em toda rota NORMAL (ver Shell) | 1 |

### Primitivas atuais (`components/ui` e afins) alcançadas pelo Grupo A

Coluna "rotas" = quantas rotas do Grupo A alcançam a primitiva (inclui via shell). Converter ou trocar aqui propaga para todas.

| Primitiva atual | Rotas | Linhas | Desvios | Substituto Lite |
|---|---|---|---|---|
| `components/ui/card.tsx` | 30 | 124 | - | superfície Lite (classe utilitária ou componente LiteCard: bg surface-muted, radius-panel, shadow-resting) |
| `components/ui/input.tsx` | 30 | 138 | sombra 1 (l.129); dark: 1 (l.129); alvo<44px 1 (l.129) | arc/input |
| `components/ui/button.tsx` | 30 | 162 | - | arc/button (min 44px) |
| `components/ui/skeleton.tsx` | 29 | 39 | - | arc/skeleton |
| `components/ui/badge.tsx` | 29 | 95 | cor crua 6 (l.31,32,33,34); dark: 6 (l.31,32,33,34) | arc/badge (tone) |
| `components/ui/scroll-area.tsx` | 29 | 63 | - | Arc scroll-area (instalar) |
| `components/ui/sonner.tsx` | 29 | 99 | sombra 2 (l.20,45) | Arc toast (instalar) ou re-skin do sonner |
| `components/motion/animated-page-title.tsx` | 27 | 31 | - | lite-page-title |
| `components/ui/separator.tsx` | 27 | 26 | - | borda token --border-subtle |
| `components/ui/select.tsx` | 14 | 179 | - | Arc select (instalar) |
| `components/ui/table.tsx` | 12 | 115 | - | Arc sortable-data-table (instalar) |
| `components/motion/count-up.tsx` | 9 | 68 | - | arc/animated-counter |
| `components/ui/chart.tsx` | 8 | 374 | sombra 1 (l.194); cor crua 1 (l.68); dark: 1 (l.10) | Arc charts (instalar) |
| `components/ui/label.tsx` | 8 | 23 | - | label do arc/input |
| `components/motion/animated-badge.tsx` | 8 | 192 | cor crua 2 (l.52,53); dark: 2 (l.52,53); alvo<44px 2 (l.59,60) | arc/badge |
| `components/ui/dialog.tsx` | 7 | 123 | sombra 1 (l.49) | Arc dialog (instalar) |
| `components/ui/tabs.tsx` | 7 | 278 | - | Arc tabs (instalar) |
| `components/ui/tooltip.tsx` | 7 | 80 | sombra 1 (l.66) | Arc tooltip (instalar) |
| `components/ui/textarea.tsx` | 7 | 9 | sombra 1 (l.5) | arc/textarea |
| `components/ui/sheet.tsx` | 6 | 190 | sombra 1 (l.56); alvo<44px 2 (l.69,70) | Arc drawer (instalar) / arc bottom-sheet |
| `components/ui/checkbox.tsx` | 6 | 31 | sombra 1 (l.13); dark: 1 (l.13) | Arc checkbox (instalar) |
| `components/ui/user-avatar.tsx` | 6 | 76 | sombra 1 (l.54) | arc/avatar |
| `components/ui/section-card-header.tsx` | 5 | 48 | - | cabeçalho de seção Lite (criar) |
| `components/ui/ds-status-badge.tsx` | 5 | 86 | - | arc/badge (tone) |
| `components/ui/data-table/data-table-frame.tsx` | 5 | 54 | - | Arc sortable-data-table (instalar) |
| `components/ui/data-table/index.ts` | 5 | 6 | - | Arc sortable-data-table (instalar) |
| `components/ui/ds-empty-state.tsx` | 4 | 52 | - | arc/empty-state |
| `components/foundations/page-tabs.tsx` | 4 | 117 | sombra 4 (l.56,59,90,93) | Arc tabs ou arc/segmented-control |
| `components/ui/popover.tsx` | 4 | 55 | sombra 1 (l.40) | Arc popover (instalar) |
| `components/ui/dropdown-menu.tsx` | 4 | 293 | sombra 2 (l.44,162); uppercase 1 (l.72); dark: 2 (l.99,115) | Arc dropdown-menu (instalar) |
| `components/ui/ds-button-variants.ts` | 3 | 33 | sombra 2 (l.11,17) | arc/button variants |
| `components/motion/interface-motion-provider.tsx` | 3 | 88 | - | light-motion |
| `components/ui/selection-toolbar.tsx` | 3 | 53 | sombra 1 (l.30); alvo<44px 1 (l.39) | barra Lite (criar) |
| `components/ui/button-variants.ts` | 3 | 46 | sombra 2 (l.4,12); cor crua 1 (l.10); dark: 2 (l.4,12); alvo<44px 5 (l.28,29,31,33) | arc/button variants |
| `components/foundations/confirm-dialog.tsx` | 3 | 87 | sombra 1 (l.78); alvo<44px 2 (l.64,75) | Arc dialog (instalar) / confirm-morph |
| `components/ui/responsive-data-view.tsx` | 3 | 69 | - | PeopleRow (mobile) + data-table Arc |
| `components/ui/ds-bar-chart.tsx` | 2 | 132 | sombra 1 (l.109); cor crua 2 (l.16,20) | Arc bar-chart (instalar) |
| `components/ui/ds-segmented-control.tsx` | 2 | 112 | sombra 2 (l.31,96) | arc/segmented-control |
| `components/motion/copy-check-icon.tsx` | 2 | 55 | - | Arc copy-button (instalar) |
| `components/ui/context-note.tsx` | 2 | 53 | - | Arc alert (instalar) |
| `components/ui/drag-scroll-table.tsx` | 2 | 131 | - | Arc sortable-data-table (instalar) |
| `components/foundations/detail-drawer.tsx` | 2 | 87 | - | Arc drawer (instalar) |
| `components/motion/file-upload.tsx` | 2 | 599 | cor crua 2 (l.84,357); dark: 1 (l.84); alvo<44px 5 (l.232,287,320,332) | arc/file-dropzone |
| `components/motion/attachment-upload.tsx` | 2 | 1033 | sombra 3 (l.304,417,432); cor crua 3 (l.196,393,496); dark: 2 (l.196,496); alvo<44px 3 (l.292,532,620) | arc/file-dropzone |
| `components/ui/ds-outlined-action-button.tsx` | 2 | 40 | cor crua 1 (l.15) | arc/action-button |
| `components/ui/switch.tsx` | 2 | 38 | sombra 1 (l.30); alvo<44px 1 (l.22) | arc/switch |
| `components/ui/search-add-list.tsx` | 2 | 109 | alvo<44px 1 (l.88) | arc/search-field + lista Lite |
| `components/ui/progress.tsx` | 2 | 42 | - | Arc progress (instalar) |
| `components/ui/stateful-button.tsx` | 1 | 143 | - | arc/button (loading) |
| `components/foundations/filter-bar.tsx` | 1 | 158 | sombra 1 (l.113); alvo<44px 3 (l.92,124,145) | Arc filter-toolbar (instalar) / PeopleFilters |
| `components/foundations/active-filter-chips.tsx` | 1 | 73 | alvo<44px 2 (l.63,65) | arc/chip-group |
| `components/ui/bulk-status-dialog.tsx` | 1 | 154 | alvo<44px 1 (l.73) | Arc dialog (instalar) |
| `components/ui/bulk-reassign-dialog.tsx` | 1 | 330 | cor crua 4 (l.209,305,306,320); dark: 1 (l.306); alvo<44px 7 (l.159,172,175,186) | Arc dialog (instalar) |
| `components/data-table/data-table.tsx` | 1 | 138 | - | Arc sortable-data-table (instalar) |
| `components/data-table/data-table-column-header.tsx` | 1 | 75 | alvo<44px 2 (l.38,39) | Arc sortable-data-table (instalar) |
| `components/motion/success-overlay.tsx` | 1 | 50 | sombra 1 (l.40) | re-skin |
| `components/ui/currency-input.tsx` | 1 | 130 | sombra 1 (l.118); dark: 1 (l.122); alvo<44px 1 (l.117) | Arc number-field (instalar) ou arc/input |
| `components/ui/info-tooltip.tsx` | 1 | 54 | sombra 1 (l.46) | Arc tooltip (instalar) |
| `components/ui/field.tsx` | 1 | 62 | - | label do arc/input |
| `components/ui/bubble.tsx` | 1 | 129 | cor crua 1 (l.30); dark: 4 (l.30,32,34,36) | components/chat (bolhas Lite) |
| `components/ui/message.tsx` | 1 | 85 | - | components/chat (bolhas Lite) |
| `components/ui/marker.tsx` | 1 | 71 | - | re-skin |
| `components/ui/filter-toolbar.tsx` | 1 | 31 | - | Arc filter-toolbar (instalar) |
| `components/foundations/skeletons.tsx` | 1 | 110 | alvo<44px 6 (l.17,18,36,69) | arc/skeleton |
| `components/ui/avatar.tsx` | 1 | 110 | dark: 1 (l.20); alvo<44px 2 (l.20,94) | arc/avatar |
| `components/illustrations/voxel-illustration.tsx` | 1 | 34 | dark: 1 (l.25) | manter (ilustração) |
| `components/unlumen-ui/shimmer-skeleton.tsx` | 1 | 41 | - | arc/skeleton |
| `components/ui/ds-tabs.tsx` | 1 | 75 | - | Arc tabs (instalar) |
| `components/ui/ds-count-up.tsx` | 1 | 14 | - | arc/animated-counter |
| `components/ui/ds-dashboard-card.tsx` | 1 | 30 | cor crua 1 (l.8) | arc/metric-card |
| `components/ui/ds-donut-chart.tsx` | 1 | 104 | sombra 1 (l.57) | Arc donut-chart (instalar) |
| `components/ui/ds-section-header.tsx` | 1 | 36 | - | cabeçalho de seção Lite (criar) |
| `components/ui/ds-stat-tile.tsx` | 1 | 69 | - | arc/metric-card |
| `components/ui/ds-dialog.tsx` | 1 | 100 | sombra 1 (l.32) | Arc dialog (instalar) |
| `components/ui/ds-filled-dark-cta.tsx` | 1 | 40 | - | arc/button primary |
| `components/ui/ds-input-field.tsx` | 1 | 30 | sombra 1 (l.23); cor crua 2 (l.9,11) | arc/input |
| `components/ui/ds-sheet.tsx` | 1 | 138 | sombra 2 (l.13,41) | Arc drawer (instalar) |
| `components/ui/ds-switch.tsx` | 1 | 29 | sombra 2 (l.10,24) | arc/switch |
## 4. Shell comum (fora das tabelas de rota, mas afeta todas)

`src/app/(dashboard)/layout.tsx` (AppShell, sidebars, command palette, drawers globais, onboarding, WhatsApp) e `components/dashboard-header.tsx`, que toda página NORMAL renderiza. O header puxa:
- theme-toggle
- global-search
- notification-popover
- experience-mode-toggle
- push-notification-manager
- empty-state

Pontos para o plano:
- `theme-toggle.tsx` e `animated-theme-toggler` não fazem sentido no Lite (sem tema escuro).
- `notification-popover.tsx` (popover, `dark:`, 4 alvos pequenos).
- `push-notification-manager.tsx` (12 alvos pequenos).
- `global-search.tsx` (uppercase 1, sombra 1).

Se o shell não estiver em outro grupo, ele é pré-requisito: sem o header Lite, cada rota convertida fica com o topo no visual antigo.

| Arquivo:linha | Linhas | UI | Desvios |
|---|---|---|---|
| `app/(dashboard)/layout.tsx:37` | 276 | Drawer | - |
| `app/(dashboard)/loading.tsx:3` | 6 | - | - |
| `app/(dashboard)/error.tsx:5` | 8 | - | - |
| `app/(dashboard)/not-found.tsx:3` | 11 | - | - |
| `components/app-shell.tsx:44` | 237 | Dialog | cor crua 1 |
| `features/onboarding/components/tenant-onboarding-dialog-loader.tsx:8` | 17 | Dialog | - |
| `features/onboarding/components/director-wizard-loader.tsx:6` | 38 | - | - |
| `components/providers/realtime-sync-provider.tsx:73` | 425 | - | sombra 1 |
| `components/providers/notification-count-provider.tsx:17` | 72 | - | - |
| `features/leads/components/feedback-toast-handler.tsx:41` | 93 | Toast | - |
| `components/passkey-toast-handler.tsx:12` | 115 | Card, Motion | sombra 1, alvo<44px 4 |
| `features/onboarding/components/route-onboarding-loader.tsx:10` | 32 | Dialog | - |
| `features/broker-availability/components/broker-availability-onboarding-loader.tsx:7` | 13 | - | - |
| `components/command-palette.tsx:13` | 149 | Dialog, Badge, Input | sombra 1, cor crua 1, uppercase 1, alvo<44px 2 |
| `components/system-feedback-drawer.tsx:16` | 130 | Sheet, Drawer, Form, Badge, Input, Motion | uppercase 1, alvo<44px 3 |
| `components/agent-drawer/agent-drawer-provider.tsx:20` | 100 | Drawer | - |
| `components/agent-drawer/agent-drawer.tsx:32` | 273 | Sheet, Drawer, Dropdown, Form, Badge, Input | gradiente 1, sombra 3, cor crua 1, uppercase 2, alvo<44px 13 |
| `components/whatsapp/whatsapp-plantao-notice.tsx:36` | 247 | Dialog, Motion | - |
| `components/whatsapp/whatsapp-link-handler.tsx:15` | 31 | - | - |
| `components/route-loading.tsx:4` | 32 | Card, Skeleton | alvo<44px 2 |
| `components/route-error.tsx:21` | 104 | - | sombra 2 |
| `components/route-not-found.tsx:7` | 60 | - | sombra 1 |
| `components/corretop-sidebar.tsx:261` | 600 | Dropdown, Tooltip, Badge, Motion, Toast | sombra 1, cor crua 27, uppercase 2, dark: 17, alvo<44px 4 |
| `components/corretop-financeiro-sidebar.tsx:48` | 70 | Motion, Toast | alvo<44px 1 |
| `features/super-admin/components/view-as.tsx:26` | 139 | - | - |
| `components/onboarding/onboarding-provider.tsx:12` | 24 | - | - |
| `components/onboarding/onboarding-welcome-dialog.tsx:4` | 7 | Dialog | - |
| `components/whatsapp/whatsapp-missing-banner.tsx:20` | 54 | Dialog | - |
| `features/onboarding/components/tenant-onboarding-dialog.tsx:104` | 111 | Dialog, Toast | alvo<44px 1 |
| `features/onboarding/components/director-wizard.tsx:134` | 391 | Dialog, Input, Motion, Toast | gradiente 1, sombra 1, cor crua 4, uppercase 3, alvo<44px 2 |
| `components/notifications/incoming-lead-card.tsx:14` | 75 | Toast | - |
| `components/huge-icons.tsx:302` | 429 | Motion, Filtros | - |
| `features/onboarding/components/route-onboarding-dialog.tsx:52` | 256 | Dialog, Motion | sombra 2, cor crua 1, uppercase 3, dark: 1, alvo<44px 5 |
| `features/broker-availability/components/broker-availability-onboarding.tsx:14` | 83 | Dialog, Toast | uppercase 1, alvo<44px 1 |
| `components/agent-drawer/agent-shortcut-chips.tsx:13` | 38 | - | - |
| `components/whatsapp/whatsapp-connect-dialog.tsx:80` | 773 | Dialog, Badge, Toast | alvo<44px 3 |
| `components/experience-mode-toggle.tsx:18` | 173 | Badge, Toast | sombra 2, alvo<44px 2 |
| `components/super-admin-role-switcher.tsx:35` | 113 | Dropdown, Toast | sombra 1, alvo<44px 3 |
| `components/sidebar-collapsible-group.tsx:12` | 90 | Motion | alvo<44px 1 |
| `components/onboarding/onboarding-card.tsx:9` | 121 | Card, Motion | sombra 1, uppercase 1, alvo<44px 6 |
| `features/onboarding/components/onboarding-hero.tsx:17` | 77 | Badge | alvo<44px 1 |
| `features/onboarding/components/onboarding-benefits.tsx:10` | 32 | - | uppercase 1 |
| `features/onboarding/components/onboarding-preview.tsx:3` | 70 | - | gradiente 1, alvo<44px 2 |
| `features/onboarding/components/onboarding-step-list.tsx:11` | 41 | - | - |
| `features/broker-availability/components/broker-availability-schedule-editor.tsx:26` | 110 | Input, Toast | sombra 1, alvo<44px 2 |
| `components/whatsapp/whatsapp-pairing-panel.tsx:50` | 537 | Skeleton, Input, Motion | cor crua 2, dark: 1, alvo<44px 7 |
| `components/ancora-logo.tsx:8` | 22 | - | dark: 1 |
| `features/onboarding/components/onboarding-step-item.tsx:12` | 103 | - | alvo<44px 3 |
| `features/onboarding/components/onboarding-progress.tsx:9` | 29 | - | - |
| `components/dashboard-header.tsx:20` | 66 | Popover | alvo<44px 3 |
| `components/theme-toggle.tsx:9` | 47 | - | - |
| `components/global-search.tsx:14` | 122 | Form, Input | sombra 1, uppercase 1, alvo<44px 2 |
| `components/notification-popover.tsx:38` | 285 | Popover, Badge, Motion, EmptyState | sombra 1, cor crua 1, dark: 1, alvo<44px 4 |
| `components/theme-provider.tsx:21` | 45 | - | - |
| `components/empty-state.tsx:78` | 139 | Skeleton, Motion, EmptyState | alvo<44px 1 |
| `features/notifications/components/push-notification-manager.tsx:36` | 337 | Card, Badge, Input, Motion, Toast | alvo<44px 12 |
## 5. Ordem sugerida (dependências primeiro)

1. **Fundação:**
   - Instalar no `components/arc` as primitivas da tabela da seção 3: dialog, drawer, sortable-data-table, select, tabs, dropdown-menu, popover, checkbox, tooltip, toast e charts.
   - Criar a superfície/cartão Lite e o header Lite.
   - Definir o mapa status para tom de `arc/badge` (resolve `status-badges.tsx` e o mapa de `leads-table-columns.tsx`).
2. **Troca direta de Lite existente (P, ganho rápido):** notificacoes, empresas, relacionamento (centro de recados), loadings, `domain-dashboard` (atende 3 rotas), `leads/dashboard`.
3. **Telas de lista com PeopleRow:** clientes, leads/arquivados, minha-fila, dashboard-widgets (leads recentes).
4. **Detalhes com base Lite:** leads/[id] (e seus 30 componentes), clientes/[clientId], vendas/[id].
5. **Telas G sem equivalente:**
   - leads (kanban e filtros)
   - dashboard quality/funnel
   - distribuicao e plantões
   - propostas, documentos, vendas, noc, assistente
6. **Terminar conversas:** cores, `dark:` e alvos que ficaram depois do ed0af666.

## 6. Inventário por rota

## Rota: dashboard (page, aba overview: CommandCenter)

- Entradas: `src/app/(dashboard)/dashboard/page.tsx`, `src/app/(dashboard)/dashboard/loading.tsx`, `src/features/dashboard/components/command-center.tsx` (abas quality e funnel nas duas seções seguintes)
- Acesso: Diretor: sim (ramo NORMAL)
- Componentes próprios: 7 (novos nesta seção: G 0, M 2, P 5)

| Componente (arquivo:linha da definição) | Importado em (arquivo:linha) | Padrão de UI | Desvios do Lite (linhas) | Lite reaproveitável | Ação de conversão | Cx | Dependências (primitivas) |
|---|---|---|---|---|---|---|---|
| `app/(dashboard)/dashboard/page.tsx:34` (103 l.) | (entrada) | Server: roteia por papel e aba (overview, quality, funnel). Ramos Lite (broker, supervisor, manager) já existem | nenhum detectado | ChatHomeContent / SupervisorHomeContent / ManagerHomeContent (só ramos Lite) | Envolver o ramo NORMAL em .arc-venancor (padrão ed0af666); sem mudança de dados | P | arc skeleton |
| `features/dashboard/components/command-center.tsx:247` (300 l.) | (entrada) | Centro de comando: header, busca rápida, cards de atenção, leads recentes, card WhatsApp | nenhum detectado | components/chat/chat-home.tsx (resumo/stats) e arc/metric-card como base visual | Re-skin por tokens + trocar Card por superfície Lite e KPIs por arc metric-card | M | arc input/textarea/button; superfície Lite (surface-muted + shadow-resting) / arc metric-card; arc input/search-field/textarea |
| `features/dashboard/components/whatsapp-activity-card.tsx:9` (49 l.) | features/dashboard/components/command-center.tsx:27 | Card de atividade do WhatsApp | nenhum detectado | ChatHome já recebe whatsappActivity (components/chat/chat-home.tsx) | Reusar visual do ChatHome ou re-skin por tokens | P | superfície Lite (surface-muted + shadow-resting) / arc metric-card |
| `features/dashboard/components/dashboard-widgets.tsx:57` (477 l.) | features/dashboard/components/command-center.tsx:28 | AttentionGrid (grade de alertas) + RecentLeadsCard (tabela/lista de leads) + mini funil | uppercase 3 (l.88,100,124); alvo<44px 4 (l.159,163,213,463) | components/light/people-list (PeopleRow, PeopleStats) | Reusar PeopleRow/PeopleStats para a lista; re-skin do resto | M | Arc sortable-data-table (instalar); Arc charts (instalar: line/bar/donut/sparkline); superfície Lite (surface-muted + shadow-resting) / arc metric-card; arc badge; arc empty-state |
| `components/dashboard/funnel-chart.tsx:48` (117 l.) | features/dashboard/components/dashboard-widgets.tsx:23 | Gráfico de funil animado | nenhum detectado | nenhum | Re-skin por tokens (cores de série Arc) | P | light-motion / arc motion-tokens |
| `app/(dashboard)/dashboard/loading.tsx:23` (50 l.) | (entrada) | Skeleton da grade de KPIs e cards | alvo<44px 2 (l.15,30) | components/light/light-page-skeleton.tsx (variant dashboard) ou arc/skeleton | Reusar Lite existente | P | superfície Lite (surface-muted + shadow-resting) / arc metric-card; arc skeleton |
| `features/dashboard/components/dashboard-section-tabs.tsx:12` (44 l.) | features/dashboard/components/command-center.tsx:29 | Abas de página (PageTabs) Visão/Qualidade/Funil | nenhum detectado | arc/segmented-control ou PeopleFilters (pílula com contagem) | Trocar por componente Arc (tabs ou segmented-control com href) | P | - |

- Componentes Lite já renderizados nesta rota (ramos Lite, sem conversão): `components/light/light-page-skeleton.tsx`, `features/broker-workspace/components/chat-home-content.tsx`, `features/supervisor-workspace/supervisor-home-content.tsx`, `features/manager-workspace/manager-home-content.tsx`
- Primitivas compartilhadas usadas (convertidas uma vez, ver seção Primitivas): `components/ui/skeleton.tsx`, `components/ui/card.tsx`, `components/ui/ds-button-variants.ts`, `components/ui/input.tsx`, `components/ui/section-card-header.tsx`, `components/ui/button.tsx`, `components/motion/animated-page-title.tsx`, `components/ui/ds-bar-chart.tsx`, `components/motion/count-up.tsx`, `components/ui/ds-empty-state.tsx`, `components/ui/ds-status-badge.tsx`, `components/ui/table.tsx`, `components/foundations/page-tabs.tsx`, `components/ui/badge.tsx`, `components/ui/scroll-area.tsx`, `components/ui/separator.tsx`, `components/ui/sonner.tsx`, `components/motion/interface-motion-provider.tsx`, `components/ui/select.tsx`, `components/ui/popover.tsx`, `components/ui/chart.tsx`

## Rota: dashboard aba quality (LeadQualityCenter)

- Entradas: `src/features/reports/components/lead-quality-center.tsx`
- Acesso: Diretor: sim (ramo NORMAL)
- Componentes próprios: 5 (novos nesta seção: G 1, M 2, P 1)

| Componente (arquivo:linha da definição) | Importado em (arquivo:linha) | Padrão de UI | Desvios do Lite (linhas) | Lite reaproveitável | Ação de conversão | Cx | Dependências (primitivas) |
|---|---|---|---|---|---|---|---|
| `features/reports/components/lead-quality-center.tsx:391` (630 l.) | (entrada) | Central de qualidade: KPIs com borda colorida e gradiente, tabelas por dimensão, cards de seção com eyebrow uppercase | gradiente 5 (l.122,123,124,125,573); cor crua 7 (l.123,124,125,146,147,...); uppercase 4 (l.503,517,534,546); dark: 1 (l.467); alvo<44px 8 (l.156,271,296,301,417,...) | arc/metric-card; nenhuma tela Lite equivalente | Criar Lite novo (re-skin pesado): remover gradientes (l.122-125, 573), cores cruas por tom, eyebrows uppercase (l.503-546) | G | Arc sortable-data-table (instalar); superfície Lite (surface-muted + shadow-resting) / arc metric-card; arc badge |
| `components/period-select.tsx:27` (107 l.) | features/reports/components/lead-quality-center.tsx:15 | Select de período Nota: Compartilhado por 5 rotas | nenhum detectado | arc/segmented-control (2 a 5 opções) ou Arc select | Trocar por componente Arc | P | Arc select/combobox (instalar); arc chip-group / Arc filter-toolbar (instalar) |
| `features/dashboard/components/dashboard-section-tabs.tsx:12` | features/reports/components/lead-quality-center.tsx:19 | ver seção "dashboard (page, aba overview: CommandCenter)" | | | | P | |
| `features/reports/components/lead-quality-filters.tsx:19` (197 l.) | features/reports/components/lead-quality-center.tsx:21 | Filtros em popover (período, fila, origem, vista) | alvo<44px 7 (l.16,81,110,111,155,...) | arc/chip-group, arc/date-picker | Trocar por componente Arc (popover + chip-group); alvos 44px | M | Arc popover (instalar) |
| `features/reports/components/lead-quality-simple.tsx:24` (159 l.) | features/reports/components/lead-quality-center.tsx:22 | Relatório simples: tabela explicada + cards | cor crua 4 (l.9,36,111,126); dark: 4 (l.9,36,111,126) | arc/metric-card | Re-skin por tokens; tirar dark: e cores cruas | M | Arc sortable-data-table (instalar); superfície Lite (surface-muted + shadow-resting) / arc metric-card |
- Primitivas compartilhadas usadas (convertidas uma vez, ver seção Primitivas): `components/ui/badge.tsx`, `components/ui/card.tsx`, `components/ui/table.tsx`, `components/ui/button.tsx`, `components/motion/animated-page-title.tsx`, `components/ui/select.tsx`, `components/foundations/page-tabs.tsx`, `components/ui/popover.tsx`, `components/ui/input.tsx`, `components/ui/scroll-area.tsx`, `components/ui/separator.tsx`, `components/ui/sonner.tsx`, `components/ui/skeleton.tsx`

## Rota: dashboard aba funnel (QualificationFunnelView)

- Entradas: `src/features/qualification-turbo/components/qualification-funnel-view.tsx`
- Acesso: Diretor: sim (ramo NORMAL)
- Componentes próprios: 5 (novos nesta seção: G 0, M 1, P 3)

| Componente (arquivo:linha da definição) | Importado em (arquivo:linha) | Padrão de UI | Desvios do Lite (linhas) | Lite reaproveitável | Ação de conversão | Cx | Dependências (primitivas) |
|---|---|---|---|---|---|---|---|
| `features/qualification-turbo/components/qualification-funnel-view.tsx:77` (220 l.) | (entrada) | Funil de qualificação: cards de etapa + tabela | alvo<44px 1 (l.59) | arc/metric-card | Re-skin por tokens; tabela para Arc data-table | M | Arc sortable-data-table (instalar); superfície Lite (surface-muted + shadow-resting) / arc metric-card |
| `components/dashboard/metric-card.tsx:59` (172 l.) | features/qualification-turbo/components/qualification-funnel-view.tsx:5 | KPI com sparkline e delta Nota: Compartilhado por 7 rotas | alvo<44px 1 (l.106) | arc/metric-card (label, número, contexto, chip de variação) | Trocar por componente Arc | P | Arc charts (instalar: line/bar/donut/sparkline); superfície Lite (surface-muted + shadow-resting) / arc metric-card; arc badge |
| `features/dashboard/components/dashboard-section-tabs.tsx:12` | features/qualification-turbo/components/qualification-funnel-view.tsx:8 | ver seção "dashboard (page, aba overview: CommandCenter)" | | | | P | |
| `components/dashboard/mini-donut.tsx:12` (100 l.) | components/dashboard/metric-card.tsx:6 | Donut SVG pequeno | nenhum detectado | nenhum (Arc catálogo: donut-chart) | Trocar por Arc donut-chart (instalar) ou re-skin com tokens de cor | P | arc chip-group / Arc filter-toolbar (instalar) |
| `components/dashboard/metric-sparkline.tsx:15` (53 l.) | components/dashboard/metric-card.tsx:7 | Sparkline SVG | nenhum detectado | nenhum (Arc catálogo: sparkline) | Trocar por Arc sparkline (instalar) | P | Arc charts (instalar: line/bar/donut/sparkline) |
- Primitivas compartilhadas usadas (convertidas uma vez, ver seção Primitivas): `components/ui/card.tsx`, `components/ui/section-card-header.tsx`, `components/ui/button.tsx`, `components/motion/animated-page-title.tsx`, `components/ui/badge.tsx`, `components/motion/count-up.tsx`, `components/foundations/page-tabs.tsx`, `components/ui/input.tsx`, `components/ui/scroll-area.tsx`, `components/ui/separator.tsx`, `components/ui/sonner.tsx`, `components/ui/chart.tsx`, `components/ui/skeleton.tsx`

## Rota: dashboard/c/[assistant]

- Entradas: `src/app/(dashboard)/dashboard/c/[assistant]/page.tsx`
- Acesso: Diretor: NÃO (redirect /dashboard)
- Componentes próprios: 1 (novos nesta seção: G 0, M 0, P 1)

| Componente (arquivo:linha da definição) | Importado em (arquivo:linha) | Padrão de UI | Desvios do Lite (linhas) | Lite reaproveitável | Ação de conversão | Cx | Dependências (primitivas) |
|---|---|---|---|---|---|---|---|
| `app/(dashboard)/dashboard/c/[assistant]/page.tsx:23` (73 l.) | (entrada) | Chat de assistente (só supervisor Lite e broker Lite; diretor é redirecionado) | nenhum detectado | já Lite (AssistantChat) | Fora do escopo do diretor | P | - |

- Componentes Lite já renderizados nesta rota (ramos Lite, sem conversão): `components/chat/assistant-chat.tsx`, `components/chat/mark-seen-on-view.tsx`
- Primitivas compartilhadas usadas (convertidas uma vez, ver seção Primitivas): `components/ui/button.tsx`, `components/ui/dialog.tsx`, `components/ui/sonner.tsx`, `components/ui/ds-segmented-control.tsx`, `components/ui/ds-status-badge.tsx`, `components/motion/copy-check-icon.tsx`, `components/motion/interface-motion-provider.tsx`, `components/ui/input.tsx`

## Rota: dashboard/drill/[drillId]

- Entradas: `src/app/(dashboard)/dashboard/drill/[drillId]/page.tsx`
- Acesso: Diretor: sim
- Componentes próprios: 2 (novos nesta seção: G 0, M 1, P 1)

| Componente (arquivo:linha da definição) | Importado em (arquivo:linha) | Padrão de UI | Desvios do Lite (linhas) | Lite reaproveitável | Ação de conversão | Cx | Dependências (primitivas) |
|---|---|---|---|---|---|---|---|
| `app/(dashboard)/dashboard/drill/[drillId]/page.tsx:1` (9 l.) | (entrada) | Re-export de relatorios/drill | nenhum detectado | - | Nenhuma (herda) | P | - |
| `app/(dashboard)/relatorios/drill/[drillId]/page.tsx:14` (126 l.) | app/(dashboard)/dashboard/drill/[drillId]/page.tsx:4 | Drill de relatório: header + tabela de registros Nota: Também atende /dashboard/drill/[drillId] (re-export) | sombra 1 (l.46) | PeopleRow para listas de leads | Re-skin + tabela Arc (sortable-data-table) | M | Arc sortable-data-table (instalar) |
- Primitivas compartilhadas usadas (convertidas uma vez, ver seção Primitivas): `components/ui/data-table/data-table-frame.tsx`, `components/ui/table.tsx`, `components/ui/button.tsx`, `components/motion/animated-page-title.tsx`, `components/ui/input.tsx`, `components/ui/badge.tsx`, `components/ui/scroll-area.tsx`, `components/ui/separator.tsx`, `components/ui/sonner.tsx`, `components/ui/skeleton.tsx`, `components/ui/card.tsx`

## Rota: leads (page: kanban/lista)

- Entradas: `src/app/(dashboard)/leads/page.tsx`, `src/app/(dashboard)/leads/loading.tsx`, `src/app/(dashboard)/leads/error.tsx`
- Acesso: Diretor: sim
- Componentes próprios: 31 (novos nesta seção: G 5, M 11, P 14)

| Componente (arquivo:linha da definição) | Importado em (arquivo:linha) | Padrão de UI | Desvios do Lite (linhas) | Lite reaproveitável | Ação de conversão | Cx | Dependências (primitivas) |
|---|---|---|---|---|---|---|---|
| `app/(dashboard)/leads/page.tsx:60` (908 l.) | (entrada) | Server: ramos Lite (manager, supervisor, broker) + ramo NORMAL com header, abas de fila, filtros, kanban/lista/radar, sheets de criação e import [já .arc-venancor] | alvo<44px 4 (l.762,772,868,886) | SupervisorLeadsRadar / ManagerLiteLeadsPage / LightLeadsList (ramos Lite) | Envolver ramo NORMAL em .arc-venancor; botões size sm para 44px (bloco do header, l.~880) | M | Arc dialog (instalar); Kanban Lite (criar); arc skeleton; arc chip-group / Arc filter-toolbar (instalar) |
| `app/(dashboard)/leads/loading.tsx:3` (6 l.) | (entrada) | Loading da rota (RouteLoading) | nenhum detectado | LightPageSkeleton variant list | Reusar Lite existente | P | - |
| `app/(dashboard)/leads/error.tsx:5` (15 l.) | (entrada) | Erro da rota (RouteError) | nenhum detectado | arc/empty-state | Re-skin via RouteError comum | P | - |
| `app/(dashboard)/leads/_components/manual-lead-sheet.tsx:11` (21 l.) | app/(dashboard)/leads/page.tsx:8 | Sheet lateral de cadastro manual | alvo<44px 1 (l.19) | arc/bottom-sheet (mobile) ou drawer Arc | Trocar por componente Arc (drawer) | P | Arc drawer (instalar) / arc bottom-sheet |
| `app/(dashboard)/leads/_components/bulk-lead-import-dialog.tsx:21` (232 l.) | app/(dashboard)/leads/page.tsx:9 | Dialog de importação em massa (arquivo + mapeamento + select de fila) | nenhum detectado | arc/file-dropzone | Trocar por Arc dialog + file-dropzone + select | M | Arc dialog (instalar); arc input/textarea/button; Arc select/combobox (instalar); arc input/search-field/textarea; Arc toast (instalar) ou sonner re-skin |
| `app/(dashboard)/leads/_components/leads-live-sync.tsx:14` (23 l.) | app/(dashboard)/leads/page.tsx:10 | Sem UI (sync realtime) | nenhum detectado | - | Nenhuma | P | - |
| `app/(dashboard)/leads/_components/leads-filters.tsx:44` (570 l.) | app/(dashboard)/leads/page.tsx:11 | Barra de filtros: busca, chips de status, faceted, datas, limpar | uppercase 9 (l.288,317,347,363,381,...); alvo<44px 18 (l.247,264,299,303,328,...) | PeopleFilters (people-list) + arc/search-field + arc/chip-group | Trocar por componente Arc; tirar uppercase (9 linhas) e botões pequenos (18) | G | Kanban Lite (criar); arc input/textarea/button; arc badge; arc chip-group / Arc filter-toolbar (instalar) |
| `app/(dashboard)/leads/_components/leads-queue-tabs.tsx:16` (47 l.) | app/(dashboard)/leads/page.tsx:12 | Abas de fila com contagem | nenhum detectado | PeopleFilters (pílula com contagem) / arc/segmented-control | Reusar PeopleFilters | P | Arc tabs (instalar) ou segmented-control; Kanban Lite (criar); arc badge |
| `app/(dashboard)/leads/leads-workspace.tsx:189` (1238 l.) | app/(dashboard)/leads/page.tsx:14 | Workspace de leads: kanban dnd-kit (SortableKanbanColumn l.875, KanbanColumn l.918, KanbanLeadCard l.970, SlaBar l.1076), lista/tabela, aba radar, seleção em massa, drawer de detalhe, métricas Nota: Precisa de Kanban Lite (criar), Arc checkbox, drawer, tabs, toast | cor crua 32 (l.145,146,147,150,151,...); dark: 8 (l.147,152,157,162,167,...); alvo<44px 4 (l.618,812,1039,1063) | Kanban: nenhum. Lista: PeopleRow. Radar: SupervisorLeadsRadar. Detalhe: light-lead-detail/details-panel | Criar Lite novo para coluna/card/SLA do kanban; re-skin do resto; 32 linhas com cor crua e 8 com dark: | G | Arc dialog (instalar); Arc drawer (instalar); Arc dropdown-menu (instalar); Arc tabs (instalar) ou segmented-control; Arc sortable-data-table (instalar); Kanban Lite (criar); Arc tooltip (instalar); superfície Lite (surface-muted + shadow-resting) / arc metric-card; arc badge; arc switch + Arc checkbox (instalar); Arc toast (instalar) ou sonner re-skin; arc empty-state; arc chip-group / Arc filter-toolbar (instalar) |
| `app/(dashboard)/leads/_components/leads-header-actions.tsx:36` (166 l.) | app/(dashboard)/leads/page.tsx:15 | Ações do header (dropdown: distribuir, exportar, importar) + dialogs | cor crua 2 (l.132,144); uppercase 1 (l.107); dark: 1 (l.132); alvo<44px 5 (l.92,99,103,114,119) | - | Trocar por Arc dropdown-menu + dialog | M | Arc dialog (instalar); Arc dropdown-menu (instalar) |
| `components/next-urgent-lead-button.tsx:9` (39 l.) | app/(dashboard)/leads/page.tsx:19 | Botão 'próximo lead urgente' com tooltip | cor crua 2 (l.24,26); uppercase 1 (l.24); dark: 1 (l.24); alvo<44px 1 (l.23) | broker-workspace/components/light-dashboard/next-action.tsx | Re-skin por tokens; alvo 44px | P | Arc tooltip (instalar) |
| `app/(dashboard)/leads/_components/manual-lead-form.tsx:21` (250 l.) | app/(dashboard)/leads/_components/manual-lead-sheet.tsx:7 | Formulário de lead manual (inputs, switches, telefone) | cor crua 3 (l.203,204,210) | arc/input, arc/textarea, arc/switch, arc/button | Trocar campos por Arc | M | arc input/textarea/button; arc input/search-field/textarea; arc switch + Arc checkbox (instalar); Arc toast (instalar) ou sonner re-skin |
| `features/conversation-intelligence/components/negotiations-radar-tab.tsx:84` (469 l.) | app/(dashboard)/leads/leads-workspace.tsx:27 | Radar de negociações: filtros, cards de lead com sinais da IA, badges coloridas | gradiente 2 (l.335,336); sombra 6 (l.192,211,230,249,267,...); cor crua 14 (l.210,211,217,218,221,...); uppercase 4 (l.198,217,236,255); dark: 7 (l.217,218,221,255,256,...); alvo<44px 9 (l.203,222,241,260,275,...) | supervisor-workspace/supervisor-leads-radar.tsx (radar Lite) como base | Re-skin pesado usando o visual do radar Lite: tirar gradiente (2), sombras (6), cores cruas (14), dark: (7) | G | Arc select/combobox (instalar); superfície Lite (surface-muted + shadow-resting) / arc metric-card; arc badge; arc input/search-field/textarea; Arc toast (instalar) ou sonner re-skin; arc chip-group / Arc filter-toolbar (instalar) |
| `features/lead-distribution/queue-color-tag.tsx:9` (40 l.) | app/(dashboard)/leads/leads-workspace.tsx:38 | Tag/ponto com a cor da fila | nenhum detectado | arc/badge | Re-skin por tokens (manter matiz da fila) | P | Kanban Lite (criar) |
| `app/(dashboard)/leads/_components/lead-drawer-management-actions.tsx:45` (496 l.) | app/(dashboard)/leads/leads-workspace.tsx:39 | Ações de gestão no drawer: transferir, mudar status, remover da distribuição (dialogs + selects) | cor crua 1 (l.360); alvo<44px 4 (l.355,367,388,389) | manager-workspace/manager-lead-transfer-form.tsx, manager-lead-status-sheet.tsx, supervisor-workspace/transfer-request-form.tsx | Reusar formulários Lite como base visual; trocar dialogs por Arc dialog/bottom-sheet | G | Arc dialog (instalar); Arc drawer (instalar); arc input/textarea/button; Arc select/combobox (instalar); arc input/search-field/textarea; Arc toast (instalar) ou sonner re-skin |
| `app/(dashboard)/leads/_components/lead-distribution-removal.tsx:25` (119 l.) | app/(dashboard)/leads/leads-workspace.tsx:40 | Tag + dialog de remoção da distribuição | nenhum detectado | - | Trocar por Arc dialog + badge | P | Arc dialog (instalar); arc input/textarea/button; Arc select/combobox (instalar); arc badge; arc input/search-field/textarea; Arc toast (instalar) ou sonner re-skin |
| `app/(dashboard)/leads/_components/lead-assignment-history.tsx:62` (230 l.) | app/(dashboard)/leads/leads-workspace.tsx:41 | Histórico de atribuições (lista temporal) | cor crua 1 (l.145); alvo<44px 2 (l.101,145) | Arc timeline (catálogo) | Trocar por componente Arc (timeline) | M | arc badge |
| `app/(dashboard)/leads/_components/qualifying-lead-actions.tsx:31` (230 l.) | app/(dashboard)/leads/leads-workspace.tsx:42 | Botões e dialogs de iniciar qualificação Nota: Usado em 3 rotas | cor crua 3 (l.57,59,88); dark: 1 (l.57); alvo<44px 3 (l.158,170,182) | - | Trocar por Arc dialog + button; tirar dark: | M | Arc dialog (instalar); arc input/textarea/button; Arc select/combobox (instalar); Arc toast (instalar) ou sonner re-skin |
| `app/(dashboard)/leads/leads-data-table.tsx:38` (233 l.) | app/(dashboard)/leads/leads-workspace.tsx:43 | Tabela de leads (DataTable) + tabela de qualificação | cor crua 1 (l.117); alvo<44px 2 (l.131,141) | PeopleRow (lista) ou Arc sortable-data-table | Trocar por componente Arc (data-table Lite) | M | Arc sortable-data-table (instalar); arc badge; arc chip-group / Arc filter-toolbar (instalar) |
| `components/status-badges.tsx:12` (188 l.) | app/(dashboard)/leads/leads-workspace.tsx:46 | Badges de status do lead/qualificação (global) Nota: Compartilhado por 8 rotas; 44 marcas de tamanho pequeno | alvo<44px 44 (l.22,29,36,43,50,...) | arc/badge (tone) | Trocar por componente Arc; mapear status para tons | M | arc badge |
| `components/ownership-context.tsx:18` (32 l.) | app/(dashboard)/leads/leads-workspace.tsx:59 | Linha 'responsável/unidade' | nenhum detectado | - | Re-skin por tokens | P | - |
| `features/leads/components/lead-health-badge.tsx:62` (160 l.) | app/(dashboard)/leads/leads-workspace.tsx:60 | Badge de saúde do lead com tooltip | nenhum detectado | arc/badge | Trocar por Arc badge + tooltip | P | Arc tooltip (instalar); arc badge |
| `features/leads/components/lead-quick-note.tsx:22` (87 l.) | app/(dashboard)/leads/leads-workspace.tsx:74 | Dialog de nota rápida | alvo<44px 3 (l.43,65,75) | light-lead-detail/step-sheet.tsx (padrão bottom-sheet) | Trocar por Arc dialog/bottom-sheet + textarea | P | Arc dialog (instalar); arc input/textarea/button; arc input/search-field/textarea; Arc toast (instalar) ou sonner re-skin |
| `features/leads/components/lead-reminder.tsx:29` (152 l.) | app/(dashboard)/leads/leads-workspace.tsx:75 | Dialog de lembrete (data/hora) | alvo<44px 3 (l.65,129,140) | light-lead-detail/step-sheet.tsx; arc/date-picker | Trocar por Arc dialog + date-picker | M | Arc dialog (instalar); arc input/textarea/button; arc input/search-field/textarea; Arc toast (instalar) ou sonner re-skin |
| `features/leads/components/mark-lead-in-service-button.tsx:24` (78 l.) | app/(dashboard)/leads/leads-workspace.tsx:78 | Botão + confirmação 'marcar em atendimento' | alvo<44px 1 (l.54) | - | Trocar por Arc button + dialog | P | Arc dialog (instalar); Arc toast (instalar) ou sonner re-skin |
| `features/leads/components/lead-details-drawer.tsx:67` (139 l.) | app/(dashboard)/leads/leads-workspace.tsx:81 | Inspector do lead (DetailDrawer com abas: dados, operação, histórico) | cor crua 1 (l.133); alvo<44px 1 (l.133) | light-lead-detail/details-panel.tsx + identity-zone.tsx | Trocar DetailDrawer por Arc drawer; reusar DetailsZone/IdentityHeader como base visual | M | Arc drawer (instalar); Arc tabs (instalar) ou segmented-control; arc badge |
| `components/period-select.tsx:27` | app/(dashboard)/leads/_components/leads-header-actions.tsx:18 | ver seção "dashboard aba quality (LeadQualityCenter)" | | | | P | |
| `app/(dashboard)/leads/_components/manual-qualification-dialog.tsx:29` (231 l.) | app/(dashboard)/leads/_components/lead-drawer-management-actions.tsx:17 | Dialog de qualificação manual (selects, inputs, chips coloridas) | cor crua 8 (l.101,105,114,118,127,...); dark: 4 (l.101,114,127,140); alvo<44px 3 (l.84,221,222) | - | Trocar por Arc dialog + select; tirar 8 cores cruas e 4 dark: | M | Arc dialog (instalar); arc input/textarea/button; Arc select/combobox (instalar); arc input/search-field/textarea; Arc toast (instalar) ou sonner re-skin |
| `app/(dashboard)/leads/_components/lead-attendance-flow-starter.tsx:18` (71 l.) | app/(dashboard)/leads/_components/lead-drawer-management-actions.tsx:18 | Select para iniciar fluxo de atendimento | nenhum detectado | - | Trocar por Arc select | P | Arc select/combobox (instalar); Arc toast (instalar) ou sonner re-skin |
| `app/(dashboard)/leads/leads-table-columns.tsx:213` (556 l.) | app/(dashboard)/leads/leads-data-table.tsx:6 | Definição de colunas: badges de status com mapa de cores, menus de linha | cor crua 64 (l.44,45,49,50,54,...); dark: 38 (l.45,50,55,60,65,...); alvo<44px 5 (l.251,453,454,503,510) | arc/badge com tone | Re-skin: mapa de status (l.44 em diante) com 64 cores cruas e 38 dark: vira tons Arc | G | Arc drawer (instalar); Arc dropdown-menu (instalar); Arc sortable-data-table (instalar); arc badge; arc switch + Arc checkbox (instalar); arc chip-group / Arc filter-toolbar (instalar) |
| `features/lead-tags/components/lead-tag-chip.tsx:9` (32 l.) | app/(dashboard)/leads/leads-table-columns.tsx:29 | Chip de etiqueta | nenhum detectado | arc/badge | Re-skin por tokens | P | - |

- Componentes Lite já renderizados nesta rota (ramos Lite, sem conversão): `features/manager-workspace/manager-lite-leads.tsx`, `features/supervisor-workspace/supervisor-leads-radar.tsx`, `components/arc/skeleton/skeleton.tsx`, `features/broker-workspace/components/light-leads-list.tsx`
- Primitivas compartilhadas usadas (convertidas uma vez, ver seção Primitivas): `components/ui/button.tsx`, `components/ui/context-note.tsx`, `components/ui/sheet.tsx`, `components/ui/sonner.tsx`, `components/ui/dialog.tsx`, `components/ui/input.tsx`, `components/ui/select.tsx`, `components/ui/stateful-button.tsx`, `components/ui/badge.tsx`, `components/ui/scroll-area.tsx`, `components/foundations/filter-bar.tsx`, `components/foundations/active-filter-chips.tsx`, `components/ui/drag-scroll-table.tsx`, `components/ui/tabs.tsx`, `components/ui/checkbox.tsx`, `components/ui/selection-toolbar.tsx`, `components/ui/bulk-status-dialog.tsx`, `components/ui/bulk-reassign-dialog.tsx`, `components/ui/user-avatar.tsx`, `components/ui/card.tsx`, `components/foundations/detail-drawer.tsx`, `components/ui/tooltip.tsx`, `components/ui/dropdown-menu.tsx`, `components/motion/animated-page-title.tsx`, `components/ui/skeleton.tsx`, `components/ui/button-variants.ts`, `components/ui/label.tsx`, `components/foundations/confirm-dialog.tsx`, `components/ui/textarea.tsx`, `components/data-table/data-table.tsx`, `components/motion/animated-badge.tsx`, `components/ui/separator.tsx`, `components/data-table/data-table-column-header.tsx`

## Rota: leads/[id]

- Entradas: `src/app/(dashboard)/leads/[id]/page.tsx`, `src/app/(dashboard)/leads/[id]/loading.tsx`, `src/app/(dashboard)/leads/[id]/error.tsx`
- Acesso: Diretor: sim
- Componentes próprios: 30 (novos nesta seção: G 2, M 8, P 15)

| Componente (arquivo:linha da definição) | Importado em (arquivo:linha) | Padrão de UI | Desvios do Lite (linhas) | Lite reaproveitável | Ação de conversão | Cx | Dependências (primitivas) |
|---|---|---|---|---|---|---|---|
| `app/(dashboard)/leads/[id]/page.tsx:70` (955 l.) | (entrada) | Perfil do lead (NORMAL, l.468 em diante): card de identidade, ações (qualificar, excluir, iniciar), seletor de status, abas Atendimento/Documentos/Histórico/Tarefas (l.621) com cards | cor crua 2 (l.694,906); uppercase 7 (l.803,843,857,872,883,...); dark: 8 (l.472,711,732,748,801,...); alvo<44px 8 (l.536,705,772,839,853,...) | SupervisorLeadDetail / LightLeadDetail (LeadHeaderBar, NextStepCard, LeadSocialLayout, DetailsZone, PeopleDataSection) | Re-skin por tokens + Arc tabs; tirar uppercase (7), dark: (8), cards amber/primary (l.694, 769); botões size xs/sm (l.536, 705) para 44px | G | Arc tabs (instalar) ou segmented-control; superfície Lite (surface-muted + shadow-resting) / arc metric-card; arc skeleton; arc badge |
| `app/(dashboard)/leads/[id]/loading.tsx:4` (19 l.) | (entrada) | Skeleton (já tem .arc-venancor) [já .arc-venancor] | sombra 1 (l.9) | LightPageSkeleton | Já Lite; revisar sombra (1) | P | arc skeleton |
| `app/(dashboard)/leads/[id]/error.tsx:5` (15 l.) | (entrada) | Erro da rota | nenhum detectado | arc/empty-state | Re-skin via RouteError comum | P | - |
| `features/leads/components/lead-status-selector.tsx:58` (288 l.) | app/(dashboard)/leads/[id]/page.tsx:15 | Seletor de status com dialog de motivo | cor crua 4 (l.220,221,226,240); dark: 2 (l.221,226); alvo<44px 1 (l.247) | manager-workspace/manager-lead-status-sheet.tsx | Reusar visual do status sheet Lite; Arc select/dialog | M | Arc dialog (instalar); arc input/textarea/button; Arc select/combobox (instalar); arc badge; Arc toast (instalar) ou sonner re-skin |
| `features/leads/components/lead-timeline.tsx:19` (32 l.) | app/(dashboard)/leads/[id]/page.tsx:16 | Timeline de interações + form de nova interação | uppercase 1 (l.30); alvo<44px 1 (l.30) | Arc timeline | Trocar por componente Arc | P | arc input/textarea/button; superfície Lite (surface-muted + shadow-resting) / arc metric-card; arc input/search-field/textarea; Arc toast (instalar) ou sonner re-skin |
| `features/leads/components/lead-tasks.tsx:20` (181 l.) | app/(dashboard)/leads/[id]/page.tsx:17 | Lista de tarefas do lead + dialog de nova tarefa | cor crua 1 (l.167); alvo<44px 4 (l.56,62,167,172) | broker-workspace/components/light-dashboard/agenda.tsx (lista de retornos) | Re-skin usando o visual da Agenda Lite; Arc dialog + checkbox | M | Arc dialog (instalar); arc input/textarea/button; superfície Lite (surface-muted + shadow-resting) / arc metric-card; arc input/search-field/textarea; arc switch + Arc checkbox (instalar); Arc toast (instalar) ou sonner re-skin |
| `features/leads/components/lead-chat.tsx:6` (22 l.) | app/(dashboard)/leads/[id]/page.tsx:18 | Atalho/abertura do chat do lead | sombra 1 (l.13); alvo<44px 1 (l.15) | broker-workspace/chat/lead-conversation.tsx | Re-skin por tokens | P | - |
| `app/(dashboard)/leads/[id]/start-service-button.tsx:11` (44 l.) | app/(dashboard)/leads/[id]/page.tsx:25 | Botão iniciar atendimento | alvo<44px 1 (l.42) | light-lead-detail/action-bar.tsx | Trocar por Arc button | P | arc input/textarea/button; Arc toast (instalar) ou sonner re-skin |
| `features/leads/components/mark-lead-in-service-button.tsx:24` | app/(dashboard)/leads/[id]/page.tsx:26 | ver seção "leads (page: kanban/lista)" | | | | P | |
| `app/(dashboard)/leads/[id]/supervision-panel.tsx:23` (398 l.) | app/(dashboard)/leads/[id]/page.tsx:28 | Painel de supervisão: reatribuir, nota, select de corretor, eyebrow uppercase | gradiente 1 (l.208); cor crua 1 (l.243); uppercase 3 (l.239,263,277); dark: 1 (l.243); alvo<44px 2 (l.351,352) | manager-workspace/manager-lead-transfer-form.tsx | Re-skin + reusar transfer form Lite; tirar gradiente (1) e uppercase (3) | M | Arc dialog (instalar); arc input/textarea/button; Arc select/combobox (instalar); superfície Lite (surface-muted + shadow-resting) / arc metric-card; arc badge; arc input/search-field/textarea; Arc toast (instalar) ou sonner re-skin |
| `app/(dashboard)/leads/[id]/delete-lead-control.tsx:12` (38 l.) | app/(dashboard)/leads/[id]/page.tsx:29 | Excluir lead com confirmação | alvo<44px 1 (l.31) | - | Trocar por Arc dialog (ou confirm-morph) | P | Arc dialog (instalar); arc input/textarea/button; Arc toast (instalar) ou sonner re-skin |
| `app/(dashboard)/leads/_components/qualifying-lead-actions.tsx:31` | app/(dashboard)/leads/[id]/page.tsx:33 | ver seção "leads (page: kanban/lista)" | | | | M | |
| `features/documents/components/lead-documents-section.tsx:65` (500 l.) | app/(dashboard)/leads/[id]/page.tsx:48 | Checklist e upload de documentos do lead Nota: Usado também em clientes/[clientId] | gradiente 1 (l.212); sombra 4 (l.212,258,301,388); uppercase 2 (l.244,308); alvo<44px 5 (l.261,315,400,420,485) | light-lead-detail/sale-doc-sheet.tsx + arc/file-dropzone | Re-skin pesado; tirar gradiente (1) e sombras (4) | G | arc badge; Arc toast (instalar) ou sonner re-skin |
| `features/leads/components/lead-action-hub.tsx:83` (311 l.) | app/(dashboard)/leads/[id]/page.tsx:49 | Hub de ações rápidas (ligar, WhatsApp, nota, lembrete, próximo passo) | sombra 1 (l.117); uppercase 1 (l.126); alvo<44px 13 (l.144,180,182,190,199,...) | light-lead-detail/action-bar.tsx + chat/lead-screen-parts NextStepCard | Reusar ActionBar Lite como base; 13 alvos pequenos | M | arc badge; light-motion / arc motion-tokens |
| `app/(dashboard)/leads/[id]/beneficiaries-section.tsx:40` (236 l.) | app/(dashboard)/leads/[id]/page.tsx:53 | Lista de beneficiários + dialog de edição | alvo<44px 1 (l.144) | light-lead-detail/people-data-section.tsx | Reusar PeopleDataSection como base visual; Arc dialog | M | Arc dialog (instalar); Arc select/combobox (instalar); superfície Lite (surface-muted + shadow-resting) / arc metric-card; arc badge; arc input/search-field/textarea; Arc toast (instalar) ou sonner re-skin |
| `features/customer-record/components/person-record-details.tsx:15` (100 l.) | app/(dashboard)/leads/[id]/page.tsx:58 | Ficha de dados cadastrais (pares rótulo/valor, eyebrows uppercase) | sombra 1 (l.36); uppercase 7 (l.43,44,56,62,73,...) | light-lead-detail/identity-zone.tsx (ClientInfoCard) | Reusar ClientInfoCard ou re-skin; tirar uppercase (7) | P | superfície Lite (surface-muted + shadow-resting) / arc metric-card; arc badge |
| `features/leads/components/lead-feedback-dialog.tsx:28` (76 l.) | features/leads/components/lead-status-selector.tsx:36 | Dialog de feedback do atendimento | uppercase 1 (l.61) | broker-workspace/components/light-feedback-view.tsx | Reusar visual do LightFeedbackView em Arc dialog | P | Arc dialog (instalar); arc input/textarea/button; arc input/search-field/textarea; Arc toast (instalar) ou sonner re-skin |
| `app/(dashboard)/leads/[id]/register-sale-panel.tsx:29` (301 l.) | features/leads/components/lead-status-selector.tsx:37 | Painel de registrar venda (dialog com campos) | cor crua 1 (l.167); uppercase 2 (l.107,176); dark: 1 (l.167) | Já é importado pelo LightLeadDetail (light-lead-detail/index.tsx:9); light-lead-detail/sale-section.tsx | Re-skin por tokens (beneficia Lite e Normal) | M | Arc dialog (instalar); arc input/search-field/textarea; Arc toast (instalar) ou sonner re-skin |
| `features/leads/components/next-status-suggestion.tsx:24` (53 l.) | features/leads/components/lead-status-selector.tsx:38 | Sugestão de próximo status | sombra 1 (l.44); alvo<44px 2 (l.40,44) | chat/lead-screen-parts NextStepCard | Re-skin por tokens | P | - |
| `components/plugins/lead-assigned-notification-button.tsx:16` (47 l.) | app/(dashboard)/leads/[id]/supervision-panel.tsx:16 | Botão de notificação de lead atribuído | nenhum detectado | - | Re-skin por tokens | P | Arc toast (instalar) ou sonner re-skin |
| `features/conversation-intelligence/components/ai-conversation-insight-card.tsx:75` (285 l.) | features/conversation-intelligence/index.ts:7 | Card de insight da IA sobre a conversa | gradiente 2 (l.88,166); sombra 1 (l.166); cor crua 4 (l.202,203,215,216); dark: 2 (l.203,216); alvo<44px 6 (l.92,103,170,249,270,...) | components/chat/chat-blocks.tsx (blocos de insight do chat Lite) | Re-skin; tirar gradiente (2) e cores cruas (4) | M | superfície Lite (surface-muted + shadow-resting) / arc metric-card; arc badge; Arc toast (instalar) ou sonner re-skin |
| `components/status-badges.tsx:12` | features/documents/components/lead-documents-section.tsx:15 | ver seção "leads (page: kanban/lista)" | | | | M | |
| `features/leads/components/lead-progress-stepper.tsx:35` (125 l.) | features/leads/components/lead-action-hub.tsx:22 | Stepper de etapas do lead | sombra 2 (l.61,113); alvo<44px 1 (l.57) | arc/stepper | Trocar por componente Arc | P | - |
| `features/leads/components/lead-reminder.tsx:29` | features/leads/components/lead-action-hub.tsx:23 | ver seção "leads (page: kanban/lista)" | | | | M | |
| `features/leads/components/lead-quick-note.tsx:22` | features/leads/components/lead-action-hub.tsx:24 | ver seção "leads (page: kanban/lista)" | | | | P | |
| `app/(dashboard)/leads/[id]/inline-feedback-form.tsx:25` (348 l.) | features/leads/components/lead-action-hub.tsx:25 | Formulário inline de feedback | alvo<44px 10 (l.88,104,116,125,132,...) | light-feedback-view.tsx | Reusar visual Lite; 10 alvos pequenos | M | arc input/textarea/button; Arc select/combobox (instalar); arc input/search-field/textarea; Arc toast (instalar) ou sonner re-skin |
| `features/next-best-action/components/next-best-action-card.tsx:34` (130 l.) | features/next-best-action/index.ts:6 | Card de próxima melhor ação | gradiente 1 (l.51); sombra 3 (l.51,110,119); uppercase 2 (l.58,68); alvo<44px 2 (l.108,117) | chat/lead-screen-parts NextStepCard | Reusar NextStepCard; tirar gradiente (1) e sombras (3) | P | Arc tooltip (instalar); arc badge |
| `features/next-best-action/components/next-best-action-inline.tsx:21` (60 l.) | features/next-best-action/index.ts:7 | NBA inline com tooltip | alvo<44px 2 (l.30,33) | NextStepCard | Re-skin por tokens | P | Arc tooltip (instalar) |
| `features/next-best-action/components/next-best-action-banner.tsx:15` (46 l.) | features/next-best-action/index.ts:8 | Banner de NBA | alvo<44px 2 (l.34,38) | NextStepCard | Re-skin por tokens | P | - |
| `features/next-best-action/components/related-actions-menu.tsx:22` (55 l.) | features/next-best-action/index.ts:9 | Menu de ações relacionadas | uppercase 1 (l.34); alvo<44px 1 (l.28) | - | Trocar por Arc dropdown-menu | P | Arc dropdown-menu (instalar) |

- Componentes Lite já renderizados nesta rota (ramos Lite, sem conversão): `components/light/light-page-skeleton.tsx`, `features/broker-workspace/components/light-lead-detail/index.tsx`, `features/broker-workspace/chat/lead-conversation.tsx`, `features/supervisor-workspace/supervisor-lead-detail.tsx`, `features/manager-workspace/manager-lite-leads.tsx`, `components/arc/skeleton/skeleton.tsx`
- Primitivas compartilhadas usadas (convertidas uma vez, ver seção Primitivas): `components/ui/badge.tsx`, `components/ui/button.tsx`, `components/ui/user-avatar.tsx`, `components/ui/card.tsx`, `components/ui/tabs.tsx`, `components/motion/animated-page-title.tsx`, `components/ui/dialog.tsx`, `components/ui/select.tsx`, `components/ui/sonner.tsx`, `components/ui/scroll-area.tsx`, `components/ui/textarea.tsx`, `components/ui/checkbox.tsx`, `components/ui/input.tsx`, `components/ui/label.tsx`, `components/motion/success-overlay.tsx`, `components/foundations/confirm-dialog.tsx`, `components/motion/file-upload.tsx`, `components/motion/attachment-upload.tsx`, `components/ui/button-variants.ts`, `components/ui/separator.tsx`, `components/ui/currency-input.tsx`, `components/motion/animated-badge.tsx`, `components/ui/tooltip.tsx`, `components/ui/dropdown-menu.tsx`, `components/ui/skeleton.tsx`

## Rota: leads/[id]/feedback

- Entradas: `src/app/(dashboard)/leads/[id]/feedback/page.tsx`
- Acesso: Diretor: sim, já Lite (LightFeedbackView)
- Componentes próprios: 1 (novos nesta seção: G 0, M 0, P 1)

| Componente (arquivo:linha da definição) | Importado em (arquivo:linha) | Padrão de UI | Desvios do Lite (linhas) | Lite reaproveitável | Ação de conversão | Cx | Dependências (primitivas) |
|---|---|---|---|---|---|---|---|
| `app/(dashboard)/leads/[id]/feedback/page.tsx:11` (40 l.) | (entrada) | Renderiza LightFeedbackView para todos os papéis | nenhum detectado | já Lite | Nenhuma | P | - |

- Componentes Lite já renderizados nesta rota (ramos Lite, sem conversão): `features/broker-workspace/components/light-feedback-view.tsx`

## Rota: leads/arquivados

- Entradas: `src/app/(dashboard)/leads/arquivados/page.tsx`
- Acesso: Diretor: sim (exclusivo)
- Componentes próprios: 1 (novos nesta seção: G 0, M 1, P 0)

| Componente (arquivo:linha da definição) | Importado em (arquivo:linha) | Padrão de UI | Desvios do Lite (linhas) | Lite reaproveitável | Ação de conversão | Cx | Dependências (primitivas) |
|---|---|---|---|---|---|---|---|
| `app/(dashboard)/leads/arquivados/page.tsx:25` (166 l.) | (entrada) | Lista de arquivados (só diretor): busca, tabela, restaurar | cor crua 1 (l.96); dark: 1 (l.96); alvo<44px 3 (l.116,155,156) | PeoplePage/PeopleRow | Re-skin; tabela para PeopleRow ou data-table Arc | M | Arc sortable-data-table (instalar); arc input/textarea/button; superfície Lite (surface-muted + shadow-resting) / arc metric-card; arc badge; arc input/search-field/textarea; arc chip-group / Arc filter-toolbar (instalar) |
- Primitivas compartilhadas usadas (convertidas uma vez, ver seção Primitivas): `components/ui/badge.tsx`, `components/ui/button.tsx`, `components/ui/card.tsx`, `components/ui/input.tsx`, `components/ui/table.tsx`, `components/motion/animated-page-title.tsx`, `components/ui/scroll-area.tsx`, `components/ui/separator.tsx`, `components/ui/sonner.tsx`, `components/ui/skeleton.tsx`

## Rota: leads/dashboard

- Entradas: `src/app/(dashboard)/leads/dashboard/page.tsx`
- Acesso: Diretor: sim
- Componentes próprios: 1 (novos nesta seção: G 0, M 0, P 1)

| Componente (arquivo:linha da definição) | Importado em (arquivo:linha) | Padrão de UI | Desvios do Lite (linhas) | Lite reaproveitável | Ação de conversão | Cx | Dependências (primitivas) |
|---|---|---|---|---|---|---|---|
| `app/(dashboard)/leads/dashboard/page.tsx:10` (36 l.) | (entrada) | Visão geral de leads: 4 KPIs + gargalos + funil | nenhum detectado | arc/metric-card | Trocar KPIs por Arc metric-card; re-skin | P | superfície Lite (surface-muted + shadow-resting) / arc metric-card |
- Primitivas compartilhadas usadas (convertidas uma vez, ver seção Primitivas): `components/ui/card.tsx`, `components/ui/button.tsx`, `components/motion/animated-page-title.tsx`, `components/ui/input.tsx`, `components/ui/badge.tsx`, `components/ui/scroll-area.tsx`, `components/ui/separator.tsx`, `components/ui/sonner.tsx`, `components/ui/skeleton.tsx`

## Rota: leads/distribuicao

- Entradas: `src/app/(dashboard)/leads/distribuicao/layout.tsx`, `src/app/(dashboard)/leads/distribuicao/page.tsx`
- Acesso: Diretor: sim (gestor bloqueado no layout)
- Componentes próprios: 28 (novos nesta seção: G 7, M 5, P 11)

| Componente (arquivo:linha da definição) | Importado em (arquivo:linha) | Padrão de UI | Desvios do Lite (linhas) | Lite reaproveitável | Ação de conversão | Cx | Dependências (primitivas) |
|---|---|---|---|---|---|---|---|
| `app/(dashboard)/leads/distribuicao/layout.tsx:4` (9 l.) | (entrada) | Gate de papel (gestor redirecionado) | nenhum detectado | - | Nenhuma | P | - |
| `app/(dashboard)/leads/distribuicao/page.tsx:88` (928 l.) | (entrada) | Central de distribuição: estágios (DistributionStages l.60), abas (fila, inbox, matriz, DDD, SLA, plantão, resumo diário) | alvo<44px 1 (l.73) | - | Re-skin por tokens; abas via Arc tabs | G | arc input/textarea/button; superfície Lite (surface-muted + shadow-resting) / arc metric-card; arc badge; arc empty-state; arc chip-group / Arc filter-toolbar (instalar) |
| `app/(dashboard)/leads/distribuicao/_components/distribution-dashboard.tsx:13` (54 l.) | app/(dashboard)/leads/distribuicao/page.tsx:6 | Resumo da distribuição | nenhum detectado | arc/metric-card | Re-skin | P | - |
| `app/(dashboard)/leads/distribuicao/_components/distribution-inbox.tsx:344` (1189 l.) | app/(dashboard)/leads/distribuicao/page.tsx:7 | Inbox de distribuição: tabela de leads, atribuição manual (ManualAssignmentChoiceDialog l.231), conflito de campanha (CampaignConflictDialog l.1103) | cor crua 3 (l.139,612,718); dark: 3 (l.139,612,718); alvo<44px 11 (l.249,601,610,638,662,...) | PeopleRow para a lista | Criar Lite novo (lista + dialogs Arc); 11 alvos pequenos | G | Arc dialog (instalar); Arc sortable-data-table (instalar); arc input/textarea/button; superfície Lite (surface-muted + shadow-resting) / arc metric-card; arc badge; arc switch + Arc checkbox (instalar); Arc toast (instalar) ou sonner re-skin; arc chip-group / Arc filter-toolbar (instalar) |
| `components/dashboard/metric-card.tsx:59` | app/(dashboard)/leads/distribuicao/page.tsx:14 | ver seção "dashboard aba funnel (QualificationFunnelView)" | | | | P | |
| `app/(dashboard)/leads/distribuicao/_components/queue-control-center.tsx:108` (1379 l.) | app/(dashboard)/leads/distribuicao/page.tsx:25 | Controle de filas: cards de fila, ordenação, toggles, dialogs, dropdowns, tooltips | cor crua 12 (l.647,669,670,671,678,...); dark: 4 (l.647,670,701,779); alvo<44px 5 (l.489,495,614,860,1029) | - | Criar Lite novo; tirar 12 cores cruas e 4 dark: | G | Arc dialog (instalar); Arc dropdown-menu (instalar); Kanban Lite (criar); Arc tooltip (instalar); superfície Lite (surface-muted + shadow-resting) / arc metric-card; arc badge; arc input/search-field/textarea; arc switch + Arc checkbox (instalar); Arc toast (instalar) ou sonner re-skin |
| `app/(dashboard)/leads/distribuicao/_components/distribution-tabs-container.tsx:14` (118 l.) | app/(dashboard)/leads/distribuicao/page.tsx:26 | Container das abas da distribuição | nenhum detectado | arc/segmented-control ou Arc tabs | Trocar por componente Arc | P | Arc tabs (instalar) ou segmented-control |
| `app/(dashboard)/settings/_components/distribution-policy-panel.tsx:23` (124 l.) | app/(dashboard)/leads/distribuicao/page.tsx:27 | Painel de política (switch + input) Nota: Mora em settings, compartilhado | nenhum detectado | manager-workspace/manager-lite-settings-parts.tsx (linhas de ajuste) | Re-skin com linhas de ajuste Lite + arc/switch | P | superfície Lite (surface-muted + shadow-resting) / arc metric-card; arc input/search-field/textarea; arc switch + Arc checkbox (instalar); Arc toast (instalar) ou sonner re-skin |
| `app/(dashboard)/leads/distribuicao/_components/routing-matrix-panel.tsx:61` (763 l.) | app/(dashboard)/leads/distribuicao/page.tsx:29 | Matriz de roteamento: grade editável, selects, switches, dialogs | cor crua 1 (l.420); alvo<44px 13 (l.301,312,321,352,388,...) | - | Criar Lite novo; 13 alvos pequenos | G | Arc dialog (instalar); Arc select/combobox (instalar); superfície Lite (surface-muted + shadow-resting) / arc metric-card; arc badge; arc input/search-field/textarea; arc switch + Arc checkbox (instalar); Arc toast (instalar) ou sonner re-skin; arc chip-group / Arc filter-toolbar (instalar) |
| `app/(dashboard)/leads/distribuicao/_components/ddd-routing-panel.tsx:32` (160 l.) | app/(dashboard)/leads/distribuicao/page.tsx:30 | Roteamento por DDD (lista + select + switch) | alvo<44px 1 (l.149) | manager-lite-settings-parts | Re-skin + Arc select/switch | M | Arc select/combobox (instalar); superfície Lite (surface-muted + shadow-resting) / arc metric-card; arc badge; arc input/search-field/textarea; arc switch + Arc checkbox (instalar); Arc toast (instalar) ou sonner re-skin |
| `app/(dashboard)/leads/distribuicao/_components/broker-daily-summary-panel.tsx:45` (493 l.) | app/(dashboard)/leads/distribuicao/page.tsx:32 | Resumo diário por corretor: tabela, date picker, filtros | alvo<44px 8 (l.256,264,272,280,290,...) | arc/date-picker | Re-skin + data-table Arc | G | Arc sortable-data-table (instalar); Arc select/combobox (instalar); arc date-picker/calendar; superfície Lite (surface-muted + shadow-resting) / arc metric-card; arc badge; arc input/search-field/textarea; Arc toast (instalar) ou sonner re-skin; arc chip-group / Arc filter-toolbar (instalar) |
| `app/(dashboard)/leads/distribuicao/plantao/_components/duty-operations-workspace.tsx:1273` (1603 l.) | app/(dashboard)/leads/distribuicao/page.tsx:34 | Operação de plantões: lista de escalas, DutyFormSheet (l.185, form grande em sheet), DutyInspector (l.722), navegação de mês | alvo<44px 7 (l.349,882,1017,1073,1470,...) | broker-workspace/components/light-duty-calendar.tsx, duty-now-view.tsx, supervisor-workspace/team-on-duty-list.tsx | Criar Lite novo (sheets para Arc drawer), reusando calendário/lista Lite | G | Arc dialog (instalar); Arc drawer (instalar) / arc bottom-sheet; arc input/textarea/button; superfície Lite (surface-muted + shadow-resting) / arc metric-card; arc badge; arc input/search-field/textarea; arc switch + Arc checkbox (instalar); Arc toast (instalar) ou sonner re-skin; arc chip-group / Arc filter-toolbar (instalar) |
| `app/(dashboard)/leads/distribuicao/_components/broker-acceptance-sla-panel.tsx:25` (156 l.) | app/(dashboard)/leads/distribuicao/page.tsx:36 | Ajuste de SLA de aceite (switch + input) | alvo<44px 1 (l.142) | manager-lite-settings-parts | Re-skin por tokens | P | superfície Lite (surface-muted + shadow-resting) / arc metric-card; arc badge; arc input/search-field/textarea; arc switch + Arc checkbox (instalar); Arc toast (instalar) ou sonner re-skin |
| `app/(dashboard)/leads/distribuicao/_components/disqualified-leads-routing-panel.tsx:13` (91 l.) | app/(dashboard)/leads/distribuicao/page.tsx:40 | Toggle de roteamento de desqualificados | nenhum detectado | manager-lite-settings-parts | Re-skin por tokens | P | superfície Lite (surface-muted + shadow-resting) / arc metric-card; arc badge; arc switch + Arc checkbox (instalar); Arc toast (instalar) ou sonner re-skin |
| `app/(dashboard)/leads/distribuicao/_components/cold-lead-requalification-panel.tsx:17` (129 l.) | app/(dashboard)/leads/distribuicao/page.tsx:41 | Requalificação de leads frios (switch + dialog) | alvo<44px 4 (l.98,99,101,102) | - | Re-skin + Arc dialog | P | Arc dialog (instalar); superfície Lite (surface-muted + shadow-resting) / arc metric-card; arc switch + Arc checkbox (instalar); Arc toast (instalar) ou sonner re-skin |
| `components/status-badges.tsx:12` | app/(dashboard)/leads/distribuicao/_components/distribution-inbox.tsx:59 | ver seção "leads (page: kanban/lista)" | | | | M | |
| `components/dashboard/mini-donut.tsx:12` | components/dashboard/metric-card.tsx:6 | ver seção "dashboard aba funnel (QualificationFunnelView)" | | | | P | |
| `components/dashboard/metric-sparkline.tsx:15` | components/dashboard/metric-card.tsx:7 | ver seção "dashboard aba funnel (QualificationFunnelView)" | | | | P | |
| `features/lead-distribution/queue-color-tag.tsx:9` | app/(dashboard)/leads/distribuicao/_components/queue-control-center.tsx:55 | ver seção "leads (page: kanban/lista)" | | | | P | |
| `app/(dashboard)/leads/distribuicao/_components/queues/meta-entries.tsx:18` (71 l.) | app/(dashboard)/leads/distribuicao/_components/queue-control-center.tsx:56 | Entradas Meta da fila (badges) | nenhum detectado | arc/badge | Re-skin | P | arc badge |
| `app/(dashboard)/leads/distribuicao/_components/queues/queue-detail-sheet.tsx:46` (181 l.) | app/(dashboard)/leads/distribuicao/_components/queue-control-center.tsx:57 | Sheet de detalhe da fila | alvo<44px 2 (l.116,138) | - | Trocar por Arc drawer | M | Arc drawer (instalar) / arc bottom-sheet; arc badge |
| `app/(dashboard)/leads/distribuicao/_components/queues/queues-table.tsx:33` (151 l.) | app/(dashboard)/leads/distribuicao/_components/queue-control-center.tsx:58 | Tabela de filas com menu de linha | alvo<44px 1 (l.119) | - | Trocar por data-table Arc + dropdown-menu | M | Arc dropdown-menu (instalar); Arc sortable-data-table (instalar); arc badge |
| `components/availability-toggle.tsx:8` (72 l.) | app/(dashboard)/leads/distribuicao/_components/broker-daily-summary-panel.tsx:27 | Toggle de disponibilidade do corretor (badge colorida) | cor crua 3 (l.39,51,63); dark: 3 (l.39,51,63) | broker-availability/components/light-availability-section.tsx, broker-workspace/components/light-availability-banner.tsx | Reusar Lite existente ou re-skin (3 cores cruas, 3 dark:) | P | arc badge; Arc toast (instalar) ou sonner re-skin |
| `app/(dashboard)/leads/distribuicao/plantao/_components/duty-month-calendar.tsx:23` (161 l.) | app/(dashboard)/leads/distribuicao/plantao/_components/duty-operations-workspace.tsx:64 | Calendário mensal de plantões | sombra 1 (l.98); dark: 1 (l.98); alvo<44px 1 (l.113) | broker-workspace/components/light-duty-calendar.tsx | Reusar calendário Lite como base | M | - |
| `app/(dashboard)/leads/distribuicao/plantao/_components/monthly-duty-planner.tsx:62` (977 l.) | app/(dashboard)/leads/distribuicao/plantao/_components/duty-operations-workspace.tsx:65 | Planejador mensal: tabela de dias, Stepper local (l.116), sheets, EscalaPdfDialog (l.926) | alvo<44px 8 (l.120,122,434,479,544,...) | arc/stepper; light-duty-calendar | Criar Lite novo; Stepper local para arc/stepper | G | Arc dialog (instalar); Arc drawer (instalar) / arc bottom-sheet; Arc sortable-data-table (instalar); arc skeleton; arc badge; arc input/search-field/textarea; arc switch + Arc checkbox (instalar); Arc toast (instalar) ou sonner re-skin; arc chip-group / Arc filter-toolbar (instalar) |
| `app/(dashboard)/leads/distribuicao/plantao/_components/duty-type-ui.tsx:40` (249 l.) | app/(dashboard)/leads/distribuicao/plantao/_components/duty-operations-workspace.tsx:66 | CRUD de tipos de plantão (sheet + dialog + form) | alvo<44px 3 (l.135,231,232) | - | Trocar por Arc drawer/dialog + campos Arc | M | Arc dialog (instalar); Arc drawer (instalar) / arc bottom-sheet; arc input/textarea/button; arc badge; arc input/search-field/textarea; arc switch + Arc checkbox (instalar); Arc toast (instalar) ou sonner re-skin |
| `app/(dashboard)/leads/distribuicao/_components/queues/cold-age-release-section.tsx:12` (55 l.) | app/(dashboard)/leads/distribuicao/_components/queues/queue-detail-sheet.tsx:21 | Switch de liberação por idade | alvo<44px 1 (l.46) | - | Re-skin + arc/switch | P | arc switch + Arc checkbox (instalar); Arc toast (instalar) ou sonner re-skin |
| `app/(dashboard)/leads/distribuicao/plantao/_components/duty-type-tag.tsx:8` (33 l.) | app/(dashboard)/leads/distribuicao/plantao/_components/duty-month-calendar.tsx:7 | Tag do tipo de plantão | nenhum detectado | arc/badge | Re-skin | P | - |
- Primitivas compartilhadas usadas (convertidas uma vez, ver seção Primitivas): `components/ui/ds-status-badge.tsx`, `components/ui/card.tsx`, `components/ui/section-card-header.tsx`, `components/ui/ds-empty-state.tsx`, `components/ui/ds-outlined-action-button.tsx`, `components/ui/ds-button-variants.ts`, `components/ui/sonner.tsx`, `components/ui/badge.tsx`, `components/ui/button.tsx`, `components/ui/checkbox.tsx`, `components/ui/table.tsx`, `components/ui/select.tsx`, `components/ui/dialog.tsx`, `components/ui/data-table/data-table-frame.tsx`, `components/motion/animated-page-title.tsx`, `components/motion/count-up.tsx`, `components/ui/dropdown-menu.tsx`, `components/ui/info-tooltip.tsx`, `components/ui/input.tsx`, `components/ui/tabs.tsx`, `components/ui/field.tsx`, `components/ui/label.tsx`, `components/ui/switch.tsx`, `components/ui/sheet.tsx`, `components/motion/animated-badge.tsx`, `components/ui/scroll-area.tsx`, `components/ui/separator.tsx`, `components/ui/chart.tsx`, `components/ui/data-table/index.ts`, `components/ui/search-add-list.tsx`, `components/ui/skeleton.tsx`

## Rota: leads/distribuicao/plantao

- Entradas: `src/app/(dashboard)/leads/distribuicao/plantao/page.tsx`
- Acesso: Redirect para /distribuicao?view=plantao
- Componentes próprios: 1 (novos nesta seção: G 0, M 0, P 1)

| Componente (arquivo:linha da definição) | Importado em (arquivo:linha) | Padrão de UI | Desvios do Lite (linhas) | Lite reaproveitável | Ação de conversão | Cx | Dependências (primitivas) |
|---|---|---|---|---|---|---|---|
| `app/(dashboard)/leads/distribuicao/plantao/page.tsx:3` (7 l.) | (entrada) | Redirect para /distribuicao?view=plantao | nenhum detectado | - | Nenhuma | P | - |

## Rota: leads/distribuicao/plantao/[scheduleId]

- Entradas: `src/app/(dashboard)/leads/distribuicao/plantao/[scheduleId]/page.tsx`
- Acesso: Diretor: sim
- Componentes próprios: 29 (novos nesta seção: G 1, M 4, P 7)

| Componente (arquivo:linha da definição) | Importado em (arquivo:linha) | Padrão de UI | Desvios do Lite (linhas) | Lite reaproveitável | Ação de conversão | Cx | Dependências (primitivas) |
|---|---|---|---|---|---|---|---|
| `app/(dashboard)/leads/distribuicao/plantao/[scheduleId]/page.tsx:89` (629 l.) | (entrada) | Detalhe do plantão: contexto (l.69), seções de corretores com cards de ocorrência (l.585), tabela, ações | uppercase 1 (l.465); alvo<44px 11 (l.128,135,152,155,323,...) | supervisor-workspace/team-on-duty-list.tsx, broker-workspace/components/duty-now-view.tsx | Re-skin; 11 alvos pequenos; uppercase (1) | G | Arc sortable-data-table (instalar); arc input/textarea/button; superfície Lite (surface-muted + shadow-resting) / arc metric-card; arc badge; arc input/search-field/textarea |
| `components/status-badges.tsx:12` | app/(dashboard)/leads/distribuicao/plantao/[scheduleId]/page.tsx:9 | ver seção "leads (page: kanban/lista)" | | | | M | |
| `app/(dashboard)/leads/distribuicao/plantao/_components/broker-live-status.tsx:30` (74 l.) | app/(dashboard)/leads/distribuicao/plantao/[scheduleId]/page.tsx:25 | Status ao vivo do corretor (badge animada) | alvo<44px 1 (l.48) | broker-workspace/components/connection-badge.tsx | Re-skin | P | arc badge; light-motion / arc motion-tokens |
| `app/(dashboard)/leads/distribuicao/plantao/_components/broker-presence-invite-button.tsx:11` (37 l.) | app/(dashboard)/leads/distribuicao/plantao/[scheduleId]/page.tsx:26 | Botão convidar presença | alvo<44px 1 (l.19) | - | Trocar por Arc button | P | Arc toast (instalar) ou sonner re-skin |
| `app/(dashboard)/leads/distribuicao/plantao/_components/broker-pause-button.tsx:11` (37 l.) | app/(dashboard)/leads/distribuicao/plantao/[scheduleId]/page.tsx:27 | Botão pausar corretor | alvo<44px 1 (l.19) | - | Trocar por Arc button | P | Arc toast (instalar) ou sonner re-skin |
| `components/dashboard/metric-card.tsx:59` | app/(dashboard)/leads/distribuicao/plantao/[scheduleId]/page.tsx:32 | ver seção "dashboard aba funnel (QualificationFunnelView)" | | | | P | |
| `app/(dashboard)/leads/distribuicao/plantao/_components/broker-presence-release-button.tsx:19` (77 l.) | app/(dashboard)/leads/distribuicao/plantao/[scheduleId]/page.tsx:36 | Liberar presença (popover com nota) | alvo<44px 4 (l.46,61,70,71) | - | Trocar por Arc popover + textarea | P | Arc popover (instalar); arc input/search-field/textarea; Arc toast (instalar) ou sonner re-skin |
| `app/(dashboard)/leads/distribuicao/plantao/_components/duty-lead-details-trigger.tsx:11` (87 l.) | app/(dashboard)/leads/distribuicao/plantao/[scheduleId]/page.tsx:37 | Gatilho de drawer com leads do plantão | nenhum detectado | PeopleRow | Trocar por Arc drawer | P | Arc drawer (instalar) |
| `app/(dashboard)/leads/distribuicao/plantao/_components/broker-day-history-trigger.tsx:28` (143 l.) | app/(dashboard)/leads/distribuicao/plantao/[scheduleId]/page.tsx:38 | Drawer de histórico do dia do corretor | nenhum detectado | Arc timeline | Trocar por Arc drawer + timeline | M | Arc drawer (instalar); arc badge |
| `app/(dashboard)/leads/distribuicao/plantao/_components/broker-occurrence-card.tsx:24` (261 l.) | app/(dashboard)/leads/distribuicao/plantao/[scheduleId]/page.tsx:39 | Card de ocorrência do corretor no plantão (ações, drawers) | alvo<44px 5 (l.183,184,185,228,238) | supervisor-workspace/team-on-duty-list.tsx (linha de corretor) | Re-skin; 5 alvos pequenos | M | Arc drawer (instalar); arc badge; Arc toast (instalar) ou sonner re-skin |
| `app/(dashboard)/leads/distribuicao/plantao/_components/pending-roster.tsx:21` (73 l.) | app/(dashboard)/leads/distribuicao/plantao/[scheduleId]/page.tsx:40 | Lista de pendentes da escala | alvo<44px 2 (l.51,67) | PeopleRow | Re-skin | P | arc badge; Arc toast (instalar) ou sonner re-skin |
| `app/(dashboard)/leads/distribuicao/plantao/_components/schedule-escalar-button.tsx:25` (77 l.) | app/(dashboard)/leads/distribuicao/plantao/[scheduleId]/page.tsx:43 | Botão escalar com input | alvo<44px 1 (l.59) | - | Trocar por Arc button/input | P | arc input/search-field/textarea; Arc toast (instalar) ou sonner re-skin |
| `components/dashboard/mini-donut.tsx:12` | components/dashboard/metric-card.tsx:6 | ver seção "dashboard aba funnel (QualificationFunnelView)" | | | | P | |
| `components/dashboard/metric-sparkline.tsx:15` | components/dashboard/metric-card.tsx:7 | ver seção "dashboard aba funnel (QualificationFunnelView)" | | | | P | |
| `features/leads/components/lead-details-drawer.tsx:67` | app/(dashboard)/leads/distribuicao/plantao/_components/duty-lead-details-trigger.tsx:5 | ver seção "leads (page: kanban/lista)" | | | | M | |
| `app/(dashboard)/leads/distribuicao/plantao/_components/duty-swap-picker.tsx:21` (141 l.) | app/(dashboard)/leads/distribuicao/plantao/_components/broker-occurrence-card.tsx:15 | Seletor de troca de plantão | alvo<44px 3 (l.70,87,88) | arc/radio-cards | Trocar por componente Arc | M | arc badge; arc input/search-field/textarea |
| `app/(dashboard)/leads/distribuicao/plantao/_components/plantao-occurrence-sheet.tsx:26` (150 l.) | app/(dashboard)/leads/distribuicao/plantao/_components/schedule-escalar-button.tsx:12 | Sheet de ocorrência do plantão | alvo<44px 5 (l.110,111,114,130,131) | arc/bottom-sheet | Trocar por Arc drawer/bottom-sheet | M | Arc drawer (instalar) / arc bottom-sheet; Arc toast (instalar) ou sonner re-skin |
| `components/ownership-context.tsx:18` | features/leads/components/lead-details-drawer.tsx:7 | ver seção "leads (page: kanban/lista)" | | | | P | |
| `app/(dashboard)/leads/_components/lead-drawer-management-actions.tsx:45` | features/leads/components/lead-details-drawer.tsx:11 | ver seção "leads (page: kanban/lista)" | | | | G | |
| `app/(dashboard)/leads/_components/lead-distribution-removal.tsx:25` | features/leads/components/lead-details-drawer.tsx:12 | ver seção "leads (page: kanban/lista)" | | | | P | |
| `app/(dashboard)/leads/_components/lead-assignment-history.tsx:62` | features/leads/components/lead-details-drawer.tsx:13 | ver seção "leads (page: kanban/lista)" | | | | M | |
| `app/(dashboard)/leads/_components/qualifying-lead-actions.tsx:31` | features/leads/components/lead-details-drawer.tsx:14 | ver seção "leads (page: kanban/lista)" | | | | M | |
| `features/leads/components/lead-health-badge.tsx:62` | features/leads/components/lead-details-drawer.tsx:16 | ver seção "leads (page: kanban/lista)" | | | | P | |
| `features/leads/components/mark-lead-in-service-button.tsx:24` | features/leads/components/lead-details-drawer.tsx:17 | ver seção "leads (page: kanban/lista)" | | | | P | |
| `features/leads/components/lead-quick-note.tsx:22` | features/leads/components/lead-details-drawer.tsx:18 | ver seção "leads (page: kanban/lista)" | | | | P | |
| `features/leads/components/lead-reminder.tsx:29` | features/leads/components/lead-details-drawer.tsx:19 | ver seção "leads (page: kanban/lista)" | | | | M | |
| `features/lead-distribution/queue-color-tag.tsx:9` | features/leads/components/lead-details-drawer.tsx:24 | ver seção "leads (page: kanban/lista)" | | | | P | |
| `app/(dashboard)/leads/_components/manual-qualification-dialog.tsx:29` | app/(dashboard)/leads/_components/lead-drawer-management-actions.tsx:17 | ver seção "leads (page: kanban/lista)" | | | | M | |
| `app/(dashboard)/leads/_components/lead-attendance-flow-starter.tsx:18` | app/(dashboard)/leads/_components/lead-drawer-management-actions.tsx:18 | ver seção "leads (page: kanban/lista)" | | | | P | |
- Primitivas compartilhadas usadas (convertidas uma vez, ver seção Primitivas): `components/ui/badge.tsx`, `components/ui/button.tsx`, `components/ui/input.tsx`, `components/ui/card.tsx`, `components/ui/table.tsx`, `components/ui/drag-scroll-table.tsx`, `components/ui/data-table/data-table-frame.tsx`, `components/ui/section-card-header.tsx`, `components/motion/animated-page-title.tsx`, `components/motion/animated-badge.tsx`, `components/ui/sonner.tsx`, `components/motion/count-up.tsx`, `components/ui/popover.tsx`, `components/ui/textarea.tsx`, `components/foundations/detail-drawer.tsx`, `components/ui/select.tsx`, `components/ui/scroll-area.tsx`, `components/ui/separator.tsx`, `components/ui/chart.tsx`, `components/ui/sheet.tsx`, `components/ui/tabs.tsx`, `components/ui/search-add-list.tsx`, `components/ui/skeleton.tsx`, `components/ui/label.tsx`, `components/foundations/confirm-dialog.tsx`, `components/ui/dialog.tsx`, `components/ui/tooltip.tsx`

## Rota: conversas

- Entradas: `src/app/(dashboard)/conversas/page.tsx`, `src/app/(dashboard)/conversas/loading.tsx`, `src/app/(dashboard)/conversas/error.tsx`
- Acesso: Diretor: sim (já em .arc-venancor parcial)
- Componentes próprios: 16 (novos nesta seção: G 2, M 4, P 6)

| Componente (arquivo:linha da definição) | Importado em (arquivo:linha) | Padrão de UI | Desvios do Lite (linhas) | Lite reaproveitável | Ação de conversão | Cx | Dependências (primitivas) |
|---|---|---|---|---|---|---|---|
| `app/(dashboard)/conversas/page.tsx:50` (1161 l.) | (entrada) | Server: já envolve o workspace em .arc-venancor + conversas-lite.module.css (l.1071, commit ed0af666) [já .arc-venancor] | nenhum detectado | já Lite parcial | Nenhuma no page; terminar componentes filhos | P | Arc dialog (instalar); arc chip-group / Arc filter-toolbar (instalar) |
| `app/(dashboard)/conversas/loading.tsx:3` (25 l.) | (entrada) | Skeleton de 3 painéis Nota: Também usado por conversas/broker | alvo<44px 3 (l.7,8,12) | LightPageSkeleton | Re-skin para arc/skeleton | P | arc skeleton |
| `app/(dashboard)/conversas/error.tsx:5` (15 l.) | (entrada) | Erro da rota | nenhum detectado | arc/empty-state | Re-skin via RouteError comum | P | - |
| `app/(dashboard)/conversas/conversations-workspace.tsx:186` (2046 l.) | app/(dashboard)/conversas/page.tsx:9 | 3 painéis: lista (ConversationRow l.1605), chat (ConversationHeader l.535, MessageRow l.1268, ChatInput l.1017, MediaLightbox l.1365), perfil (ClientProfile l.1708); FilterToolbar, sheets, dropdown de transferência | sombra 1 (l.903); cor crua 27 (l.720,736,738,740,750,...); uppercase 5 (l.728,1197,1862,1867,1951); dark: 14 (l.736,738,740,750,752,...); alvo<44px 22 (l.338,359,678,716,813,...) | Parcialmente convertido via data-lite + CSS module (ed0af666). Base: light-conversations-view.tsx, team-conversation-view.tsx, components/chat/composer.tsx, chat-screen.tsx | Terminar re-skin: 27 cores cruas (ex.: l.736-752), 14 dark:, 5 uppercase, 22 alvos pequenos | G | Arc dialog (instalar); Arc drawer (instalar) / arc bottom-sheet; Arc popover (instalar); Arc dropdown-menu (instalar); arc input/textarea/button; Arc select/combobox (instalar); Arc tooltip (instalar); arc badge; arc input/search-field/textarea; light-motion / arc motion-tokens; Arc toast (instalar) ou sonner re-skin; arc empty-state; arc chip-group / Arc filter-toolbar (instalar) |
| `app/(dashboard)/conversas/official-broker-conversations.tsx:114` (975 l.) | app/(dashboard)/conversas/page.tsx:14 | Aba conversas oficiais dos corretores (lista + chat + dialogs) | cor crua 10 (l.333,354,359,555,663,...); uppercase 2 (l.576,590); dark: 3 (l.333,359,496); alvo<44px 24 (l.334,353,393,395,401,...) | team-conversations/team-conversation-view.tsx, team-conversations-list.tsx | Re-skin seguindo ed0af666; 10 cores cruas (ex.: l.333-359), 24 alvos pequenos | G | Arc dialog (instalar); arc input/textarea/button; Arc select/combobox (instalar); arc badge; arc input/search-field/textarea; arc switch + Arc checkbox (instalar); Arc toast (instalar) ou sonner re-skin; arc empty-state; arc chip-group / Arc filter-toolbar (instalar) |
| `app/(dashboard)/conversas/_components/conversas-header-nav.tsx:15` (76 l.) | app/(dashboard)/conversas/page.tsx:19 | Navegação do header (abas com contagem) | nenhum detectado | PeopleFilters / segmented-control | Trocar por componente Arc | P | arc badge |
| `features/ai-qualification/components/bulk-qualification-dialog.tsx:28` (201 l.) | app/(dashboard)/conversas/page.tsx:37 | Dialog de qualificação em massa | cor crua 4 (l.91,103,163,182); dark: 1 (l.163); alvo<44px 5 (l.91,103,115,175,179) | - | Trocar por Arc dialog + select | M | Arc dialog (instalar); Arc select/combobox (instalar); arc badge; arc chip-group / Arc filter-toolbar (instalar) |
| `features/lead-tags/components/lead-tag-chip.tsx:9` | app/(dashboard)/conversas/conversations-workspace.tsx:24 | ver seção "leads (page: kanban/lista)" | | | | P | |
| `features/lead-tags/components/lead-tags-picker.tsx:20` (118 l.) | app/(dashboard)/conversas/conversations-workspace.tsx:25 | Popover de etiquetas | alvo<44px 3 (l.60,72,97) | arc/chip-group | Trocar por Arc popover + chip-group | P | Arc popover (instalar); arc input/search-field/textarea; Arc toast (instalar) ou sonner re-skin |
| `features/lead-distribution/queue-color-tag.tsx:9` | app/(dashboard)/conversas/conversations-workspace.tsx:26 | ver seção "leads (page: kanban/lista)" | | | | P | |
| `components/ownership-context.tsx:18` | app/(dashboard)/conversas/conversations-workspace.tsx:55 | ver seção "leads (page: kanban/lista)" | | | | P | |
| `app/(dashboard)/leads/_components/manual-qualification-dialog.tsx:29` | app/(dashboard)/conversas/conversations-workspace.tsx:100 | ver seção "leads (page: kanban/lista)" | | | | M | |
| `features/conversations/components/quick-responses-popover.tsx:54` (92 l.) | app/(dashboard)/conversas/conversations-workspace.tsx:101 | Popover de respostas rápidas | cor crua 1 (l.62); alvo<44px 1 (l.61) | - | Trocar por Arc popover | P | Arc popover (instalar); Arc dropdown-menu (instalar) |
| `features/conversations/components/media-bubble.tsx:31` (288 l.) | app/(dashboard)/conversas/conversations-workspace.tsx:103 | Bolha de mídia (imagem, áudio, doc) | cor crua 1 (l.208); alvo<44px 2 (l.166,174) | components/chat/chat-audio.tsx, chat-blocks.tsx | Reusar blocos do chat Lite onde couber; re-skin | M | - |
| `features/conversations/components/media-attach-button.tsx:40` (205 l.) | app/(dashboard)/conversas/conversations-workspace.tsx:110 | Anexar mídia (dropdown + dialog) | alvo<44px 3 (l.127,186,191) | components/chat/camera-capture.tsx, composer.tsx | Trocar por Arc dropdown/dialog | M | Arc dialog (instalar); Arc dropdown-menu (instalar); arc input/search-field/textarea; Arc toast (instalar) ou sonner re-skin |
| `features/lead-tags/components/lead-tags-manager.tsx:18` (152 l.) | features/lead-tags/components/lead-tags-picker.tsx:14 | Sheet/drawer de gestão de etiquetas | alvo<44px 4 (l.62,125,127,141) | - | Trocar por Arc drawer | M | Arc drawer (instalar) / arc bottom-sheet; Arc drawer (instalar); arc input/textarea/button; arc input/search-field/textarea; Arc toast (instalar) ou sonner re-skin |
- Primitivas compartilhadas usadas (convertidas uma vez, ver seção Primitivas): `components/ui/skeleton.tsx`, `components/ui/button.tsx`, `components/motion/animated-page-title.tsx`, `components/ui/sonner.tsx`, `components/ui/bubble.tsx`, `components/ui/message.tsx`, `components/ui/marker.tsx`, `components/ui/user-avatar.tsx`, `components/ui/badge.tsx`, `components/ui/context-note.tsx`, `components/ui/input.tsx`, `components/ui/label.tsx`, `components/ui/filter-toolbar.tsx`, `components/ui/scroll-area.tsx`, `components/ui/select.tsx`, `components/ui/sheet.tsx`, `components/ui/dialog.tsx`, `components/ui/tooltip.tsx`, `components/ui/dropdown-menu.tsx`, `components/ui/textarea.tsx`, `components/ui/checkbox.tsx`, `components/ui/button-variants.ts`, `components/ui/separator.tsx`, `components/ui/popover.tsx`, `components/ui/card.tsx`

## Rota: conversas/broker

- Entradas: `src/app/(dashboard)/conversas/broker/page.tsx`, `src/app/(dashboard)/conversas/broker/loading.tsx`
- Acesso: Diretor: NÃO (redirect /conversas)
- Componentes próprios: 3 (novos nesta seção: G 0, M 0, P 2)

| Componente (arquivo:linha da definição) | Importado em (arquivo:linha) | Padrão de UI | Desvios do Lite (linhas) | Lite reaproveitável | Ação de conversão | Cx | Dependências (primitivas) |
|---|---|---|---|---|---|---|---|
| `app/(dashboard)/conversas/broker/page.tsx:41` (224 l.) | (entrada) | Só corretor Lite (diretor redirecionado para /conversas) [já .arc-venancor] | nenhum detectado | já Lite | Fora do escopo do diretor | P | - |
| `app/(dashboard)/conversas/broker/loading.tsx:3` (4 l.) | (entrada) | Reusa loading de conversas | nenhum detectado | - | Nenhuma | P | - |
| `app/(dashboard)/conversas/loading.tsx:3` | app/(dashboard)/conversas/broker/loading.tsx:1 | ver seção "conversas" | | | | P | |

- Componentes Lite já renderizados nesta rota (ramos Lite, sem conversão): `components/chat/refresh-soon.tsx`, `features/broker-workspace/components/light-conversations-view.tsx`, `components/chat/assistant-chat.tsx`, `components/chat/thread-list-screen.tsx`
- Primitivas compartilhadas usadas (convertidas uma vez, ver seção Primitivas): `components/ui/skeleton.tsx`

## Rota: conversas/dashboard

- Entradas: `src/app/(dashboard)/conversas/dashboard/page.tsx`
- Acesso: Diretor: sim
- Componentes próprios: 2 (novos nesta seção: G 0, M 0, P 2)

| Componente (arquivo:linha da definição) | Importado em (arquivo:linha) | Padrão de UI | Desvios do Lite (linhas) | Lite reaproveitável | Ação de conversão | Cx | Dependências (primitivas) |
|---|---|---|---|---|---|---|---|
| `app/(dashboard)/conversas/dashboard/page.tsx:6` (7 l.) | (entrada) | Header + DomainDashboard (conversas) | nenhum detectado | arc/metric-card | Herda de DomainDashboard | P | - |
| `features/dashboard/components/domain-dashboard.tsx:5` (6 l.) | app/(dashboard)/conversas/dashboard/page.tsx:4 | Título + 4 KPIs + link (genérico) Nota: Atende conversas/dashboard, vendas/dashboard, tarefas/dashboard | nenhum detectado | arc/metric-card | Trocar por componente Arc | P | superfície Lite (surface-muted + shadow-resting) / arc metric-card |
- Primitivas compartilhadas usadas (convertidas uma vez, ver seção Primitivas): `components/ui/button.tsx`, `components/motion/animated-page-title.tsx`, `components/ui/card.tsx`, `components/ui/input.tsx`, `components/ui/badge.tsx`, `components/ui/scroll-area.tsx`, `components/ui/separator.tsx`, `components/ui/sonner.tsx`, `components/ui/skeleton.tsx`

## Rota: clientes

- Entradas: `src/app/(dashboard)/clientes/page.tsx`, `src/app/(dashboard)/clientes/loading.tsx`
- Acesso: Diretor: sim
- Componentes próprios: 9 (novos nesta seção: G 0, M 2, P 2)

| Componente (arquivo:linha da definição) | Importado em (arquivo:linha) | Padrão de UI | Desvios do Lite (linhas) | Lite reaproveitável | Ação de conversão | Cx | Dependências (primitivas) |
|---|---|---|---|---|---|---|---|
| `app/(dashboard)/clientes/page.tsx:18` (187 l.) | (entrada) | Server: ramo Lite (LightClientsList, inclusive management l.62) e ramo NORMAL com header, busca, filial e ClientesList | nenhum detectado | broker-workspace/components/light-clients-list.tsx (prop management, usado pelo gestor Lite) | Reusar LightClientsList management como base; conferir paridade (filial, paginação) | M | arc chip-group / Arc filter-toolbar (instalar) |
| `app/(dashboard)/clientes/loading.tsx:4` (7 l.) | (entrada) | Skeleton | nenhum detectado | LightPageSkeleton variant list | Reusar Lite existente | P | arc skeleton |
| `components/period-select.tsx:27` | app/(dashboard)/clientes/page.tsx:3 | ver seção "dashboard aba quality (LeadQualityCenter)" | | | | P | |
| `components/branch-select.tsx:14` (56 l.) | app/(dashboard)/clientes/page.tsx:4 | Select de filial | nenhum detectado | Arc select ou PeopleFilters | Trocar por componente Arc | P | Arc select/combobox (instalar) |
| `app/(dashboard)/clientes/clientes-list.tsx:132` (268 l.) | app/(dashboard)/clientes/page.tsx:8 | Lista/tabela de clientes com busca e badges | alvo<44px 5 (l.52,118,120,216,233) | PeopleRow/PeopleSection (people-list) | Reusar PeopleRow | M | Arc sortable-data-table (instalar); superfície Lite (surface-muted + shadow-resting) / arc metric-card; arc badge; arc input/search-field/textarea |
| `components/ownership-context.tsx:18` | app/(dashboard)/clientes/clientes-list.tsx:12 | ver seção "leads (page: kanban/lista)" | | | | P | |
| `components/dashboard/metric-card.tsx:59` | app/(dashboard)/clientes/clientes-list.tsx:16 | ver seção "dashboard aba funnel (QualificationFunnelView)" | | | | P | |
| `components/dashboard/mini-donut.tsx:12` | components/dashboard/metric-card.tsx:6 | ver seção "dashboard aba funnel (QualificationFunnelView)" | | | | P | |
| `components/dashboard/metric-sparkline.tsx:15` | components/dashboard/metric-card.tsx:7 | ver seção "dashboard aba funnel (QualificationFunnelView)" | | | | P | |

- Componentes Lite já renderizados nesta rota (ramos Lite, sem conversão): `features/broker-workspace/components/light-clients-list.tsx`, `components/light/light-page-skeleton.tsx`
- Primitivas compartilhadas usadas (convertidas uma vez, ver seção Primitivas): `components/ui/button.tsx`, `components/motion/animated-page-title.tsx`, `components/ui/select.tsx`, `components/ui/badge.tsx`, `components/ui/user-avatar.tsx`, `components/ui/card.tsx`, `components/ui/data-table/index.ts`, `components/ui/input.tsx`, `components/ui/responsive-data-view.tsx`, `components/ui/scroll-area.tsx`, `components/ui/separator.tsx`, `components/ui/sonner.tsx`, `components/motion/count-up.tsx`, `components/ui/skeleton.tsx`, `components/ui/chart.tsx`

## Rota: clientes/[clientId]

- Entradas: `src/app/(dashboard)/clientes/[clientId]/page.tsx`, `src/app/(dashboard)/clientes/[clientId]/loading.tsx`
- Acesso: Diretor: sim
- Componentes próprios: 7 (novos nesta seção: G 1, M 0, P 2)

| Componente (arquivo:linha da definição) | Importado em (arquivo:linha) | Padrão de UI | Desvios do Lite (linhas) | Lite reaproveitável | Ação de conversão | Cx | Dependências (primitivas) |
|---|---|---|---|---|---|---|---|
| `app/(dashboard)/clientes/[clientId]/page.tsx:29` (571 l.) | (entrada) | Ficha do cliente: header, KPIs, abas (dados, documentos, conversas, renovação), cards | gradiente 1 (l.219); sombra 8 (l.218,221,256,290,347,...); uppercase 9 (l.292,302,313,328,337,...); alvo<44px 8 (l.246,277,298,309,324,...) | broker-workspace/components/light-client-detail.tsx | Reusar LightClientDetail como base; tirar gradiente (1), sombras (8), uppercase (9) | G | Arc tabs (instalar) ou segmented-control; superfície Lite (surface-muted + shadow-resting) / arc metric-card; arc badge |
| `app/(dashboard)/clientes/[clientId]/loading.tsx:4` (7 l.) | (entrada) | Skeleton | nenhum detectado | LightPageSkeleton | Reusar Lite existente | P | arc skeleton |
| `features/leads/components/lead-timeline.tsx:19` | app/(dashboard)/clientes/[clientId]/page.tsx:11 | ver seção "leads/[id]" | | | | P | |
| `features/documents/components/lead-documents-section.tsx:65` | app/(dashboard)/clientes/[clientId]/page.tsx:17 | ver seção "leads/[id]" | | | | G | |
| `features/post-sale/components/customer-renewal-status.tsx:22` (80 l.) | app/(dashboard)/clientes/[clientId]/page.tsx:20 | Status de renovação com ação | sombra 1 (l.66); alvo<44px 1 (l.74) | - | Re-skin | P | arc input/search-field/textarea; Arc toast (instalar) ou sonner re-skin |
| `features/customer-record/components/person-record-details.tsx:15` | app/(dashboard)/clientes/[clientId]/page.tsx:21 | ver seção "leads/[id]" | | | | P | |
| `components/status-badges.tsx:12` | features/documents/components/lead-documents-section.tsx:15 | ver seção "leads (page: kanban/lista)" | | | | M | |

- Componentes Lite já renderizados nesta rota (ramos Lite, sem conversão): `features/broker-workspace/components/light-client-detail.tsx`, `components/light/light-page-skeleton.tsx`
- Primitivas compartilhadas usadas (convertidas uma vez, ver seção Primitivas): `components/ui/badge.tsx`, `components/ui/button.tsx`, `components/ui/user-avatar.tsx`, `components/ui/card.tsx`, `components/ui/tabs.tsx`, `components/motion/animated-page-title.tsx`, `components/ui/sonner.tsx`, `components/ui/scroll-area.tsx`, `components/ui/textarea.tsx`, `components/ui/select.tsx`, `components/motion/file-upload.tsx`, `components/motion/attachment-upload.tsx`, `components/ui/input.tsx`, `components/ui/label.tsx`, `components/ui/separator.tsx`, `components/motion/animated-badge.tsx`, `components/ui/skeleton.tsx`

## Rota: vendas

- Entradas: `src/app/(dashboard)/vendas/page.tsx`, `src/app/(dashboard)/vendas/loading.tsx`
- Acesso: Diretor: sim
- Componentes próprios: 10 (novos nesta seção: G 1, M 0, P 3)

| Componente (arquivo:linha da definição) | Importado em (arquivo:linha) | Padrão de UI | Desvios do Lite (linhas) | Lite reaproveitável | Ação de conversão | Cx | Dependências (primitivas) |
|---|---|---|---|---|---|---|---|
| `app/(dashboard)/vendas/page.tsx:14` (110 l.) | (entrada) | Server: header + filtros + SalesWorkspace | nenhum detectado | - | Envolver em .arc-venancor; re-skin | P | arc chip-group / Arc filter-toolbar (instalar) |
| `app/(dashboard)/vendas/loading.tsx:3` (6 l.) | (entrada) | Skeleton | nenhum detectado | LightPageSkeleton | Reusar Lite existente | P | arc skeleton |
| `components/period-select.tsx:27` | app/(dashboard)/vendas/page.tsx:4 | ver seção "dashboard aba quality (LeadQualityCenter)" | | | | P | |
| `components/branch-select.tsx:14` | app/(dashboard)/vendas/page.tsx:5 | ver seção "clientes" | | | | P | |
| `app/(dashboard)/vendas/sales-workspace.tsx:41` (442 l.) | app/(dashboard)/vendas/page.tsx:9 | Tabela de vendas com filtros, seleção e toggles | sombra 1 (l.358); alvo<44px 6 (l.218,222,284,348,368,...) | PeopleRow para mobile | Trocar tabela por data-table Arc; re-skin | G | Arc sortable-data-table (instalar); arc input/textarea/button; arc badge; arc input/search-field/textarea; arc switch + Arc checkbox (instalar); Arc toast (instalar) ou sonner re-skin; arc chip-group / Arc filter-toolbar (instalar) |
| `components/related-actions.tsx:25` (77 l.) | app/(dashboard)/vendas/page.tsx:10 | Card de ações relacionadas | uppercase 1 (l.36); alvo<44px 1 (l.51) | - | Re-skin | P | superfície Lite (surface-muted + shadow-resting) / arc metric-card |
| `components/status-badges.tsx:12` | app/(dashboard)/vendas/sales-workspace.tsx:10 | ver seção "leads (page: kanban/lista)" | | | | M | |
| `components/dashboard/metric-card.tsx:59` | app/(dashboard)/vendas/sales-workspace.tsx:18 | ver seção "dashboard aba funnel (QualificationFunnelView)" | | | | P | |
| `components/dashboard/mini-donut.tsx:12` | components/dashboard/metric-card.tsx:6 | ver seção "dashboard aba funnel (QualificationFunnelView)" | | | | P | |
| `components/dashboard/metric-sparkline.tsx:15` | components/dashboard/metric-card.tsx:7 | ver seção "dashboard aba funnel (QualificationFunnelView)" | | | | P | |
- Primitivas compartilhadas usadas (convertidas uma vez, ver seção Primitivas): `components/foundations/skeletons.tsx`, `components/ui/button.tsx`, `components/motion/animated-page-title.tsx`, `components/ui/select.tsx`, `components/ui/sonner.tsx`, `components/ui/checkbox.tsx`, `components/ui/data-table/index.ts`, `components/ui/input.tsx`, `components/ui/responsive-data-view.tsx`, `components/ui/selection-toolbar.tsx`, `components/ui/card.tsx`, `components/ui/badge.tsx`, `components/ui/scroll-area.tsx`, `components/ui/separator.tsx`, `components/motion/animated-badge.tsx`, `components/motion/count-up.tsx`, `components/ui/skeleton.tsx`, `components/ui/chart.tsx`

## Rota: vendas/[id]

- Entradas: `src/app/(dashboard)/vendas/[id]/page.tsx`
- Acesso: Diretor: sim
- Componentes próprios: 8 (novos nesta seção: G 0, M 3, P 1)

| Componente (arquivo:linha da definição) | Importado em (arquivo:linha) | Padrão de UI | Desvios do Lite (linhas) | Lite reaproveitável | Ação de conversão | Cx | Dependências (primitivas) |
|---|---|---|---|---|---|---|---|
| `app/(dashboard)/vendas/[id]/page.tsx:16` (141 l.) | (entrada) | Detalhe da venda: header, cards de stats, abas | sombra 1 (l.64); uppercase 1 (l.69); alvo<44px 3 (l.93,97,101) | - | Re-skin + Arc tabs | M | Arc tabs (instalar) ou segmented-control; arc badge |
| `app/(dashboard)/vendas/[id]/sale-details-tabs.tsx:56` (218 l.) | app/(dashboard)/vendas/[id]/page.tsx:13 | Abas de detalhe da venda | cor crua 2 (l.85,90); alvo<44px 3 (l.125,150,185) | Arc tabs | Trocar por componente Arc | M | Arc tabs (instalar) ou segmented-control; superfície Lite (surface-muted + shadow-resting) / arc metric-card; arc badge |
| `app/(dashboard)/vendas/[id]/sale-stats-cards.tsx:9` (102 l.) | app/(dashboard)/vendas/[id]/page.tsx:14 | Cards de KPI da venda (cores por tom, dark:) | sombra 1 (l.82); cor crua 5 (l.50,60,61,71,72); dark: 5 (l.50,60,61,71,72); alvo<44px 1 (l.82) | arc/metric-card | Trocar por Arc metric-card | P | superfície Lite (surface-muted + shadow-resting) / arc metric-card |
| `app/(dashboard)/vendas/[id]/commission-schedule-table.tsx:91` (233 l.) | app/(dashboard)/vendas/[id]/sale-details-tabs.tsx:19 | Tabela de parcelas de comissão com ações | cor crua 2 (l.67,81); alvo<44px 6 (l.64,67,78,81,106,...) | - | Trocar por data-table Arc | M | Arc sortable-data-table (instalar); arc input/textarea/button; Arc tooltip (instalar); arc badge; Arc toast (instalar) ou sonner re-skin |
| `components/dashboard/metric-card.tsx:59` | app/(dashboard)/vendas/[id]/sale-stats-cards.tsx:4 | ver seção "dashboard aba funnel (QualificationFunnelView)" | | | | P | |
| `components/status-badges.tsx:12` | app/(dashboard)/vendas/[id]/commission-schedule-table.tsx:9 | ver seção "leads (page: kanban/lista)" | | | | M | |
| `components/dashboard/mini-donut.tsx:12` | components/dashboard/metric-card.tsx:6 | ver seção "dashboard aba funnel (QualificationFunnelView)" | | | | P | |
| `components/dashboard/metric-sparkline.tsx:15` | components/dashboard/metric-card.tsx:7 | ver seção "dashboard aba funnel (QualificationFunnelView)" | | | | P | |
- Primitivas compartilhadas usadas (convertidas uma vez, ver seção Primitivas): `components/ui/badge.tsx`, `components/ui/button.tsx`, `components/ui/avatar.tsx`, `components/ui/user-avatar.tsx`, `components/motion/animated-page-title.tsx`, `components/ui/card.tsx`, `components/ui/tabs.tsx`, `components/ui/progress.tsx`, `components/ui/input.tsx`, `components/ui/scroll-area.tsx`, `components/ui/separator.tsx`, `components/ui/sonner.tsx`, `components/ui/tooltip.tsx`, `components/ui/data-table/index.ts`, `components/ui/responsive-data-view.tsx`, `components/motion/count-up.tsx`, `components/ui/skeleton.tsx`, `components/motion/animated-badge.tsx`, `components/ui/chart.tsx`

## Rota: vendas/dashboard

- Entradas: `src/app/(dashboard)/vendas/dashboard/page.tsx`
- Acesso: Diretor: sim
- Componentes próprios: 2 (novos nesta seção: G 0, M 0, P 1)

| Componente (arquivo:linha da definição) | Importado em (arquivo:linha) | Padrão de UI | Desvios do Lite (linhas) | Lite reaproveitável | Ação de conversão | Cx | Dependências (primitivas) |
|---|---|---|---|---|---|---|---|
| `app/(dashboard)/vendas/dashboard/page.tsx:6` (7 l.) | (entrada) | Header + DomainDashboard (vendas) | nenhum detectado | arc/metric-card | Herda de DomainDashboard | P | - |
| `features/dashboard/components/domain-dashboard.tsx:5` | app/(dashboard)/vendas/dashboard/page.tsx:4 | ver seção "conversas/dashboard" | | | | P | |
- Primitivas compartilhadas usadas (convertidas uma vez, ver seção Primitivas): `components/ui/button.tsx`, `components/motion/animated-page-title.tsx`, `components/ui/card.tsx`, `components/ui/input.tsx`, `components/ui/badge.tsx`, `components/ui/scroll-area.tsx`, `components/ui/separator.tsx`, `components/ui/sonner.tsx`, `components/ui/skeleton.tsx`

## Rota: propostas

- Entradas: `src/app/(dashboard)/propostas/page.tsx`
- Acesso: Diretor: sim
- Componentes próprios: 2 (novos nesta seção: G 1, M 0, P 1)

| Componente (arquivo:linha da definição) | Importado em (arquivo:linha) | Padrão de UI | Desvios do Lite (linhas) | Lite reaproveitável | Ação de conversão | Cx | Dependências (primitivas) |
|---|---|---|---|---|---|---|---|
| `app/(dashboard)/propostas/page.tsx:10` (35 l.) | (entrada) | Header próprio (h1 text-3xl font-bold) + PropostasClient | nenhum detectado | - | Trocar por DashboardHeader/lite-page-title | P | - |
| `app/(dashboard)/propostas/_components/propostas-client.tsx:82` (671 l.) | app/(dashboard)/propostas/page.tsx:3 | Propostas: abas, tabela, cards, dialog e sheet de criação, calendário de validade | sombra 9 (l.220,232,249,307,337,...); cor crua 10 (l.67,68,69,70,71,...); uppercase 3 (l.222,234,251); alvo<44px 10 (l.281,478,479,490,491,...) | - | Criar Lite novo; 9 sombras, 10 cores cruas, 3 uppercase | G | Arc dialog (instalar); Arc drawer (instalar) / arc bottom-sheet; Arc tabs (instalar) ou segmented-control; Arc sortable-data-table (instalar); arc input/textarea/button; arc date-picker/calendar; superfície Lite (surface-muted + shadow-resting) / arc metric-card; arc badge; arc input/search-field/textarea; Arc toast (instalar) ou sonner re-skin |
- Primitivas compartilhadas usadas (convertidas uma vez, ver seção Primitivas): `components/ui/sonner.tsx`, `components/ui/button.tsx`, `components/ui/card.tsx`, `components/ui/badge.tsx`, `components/ui/tabs.tsx`, `components/ui/sheet.tsx`, `components/ui/dialog.tsx`, `components/ui/input.tsx`, `components/ui/label.tsx`, `components/ui/textarea.tsx`, `components/ui/scroll-area.tsx`, `components/ui/select.tsx`, `components/ui/data-table/data-table-frame.tsx`, `components/ui/table.tsx`

## Rota: cotacao

- Entradas: `src/app/(dashboard)/cotacao/page.tsx`
- Acesso: Diretor: NÃO (access-denied; só corretor)
- Componentes próprios: 1 (novos nesta seção: G 0, M 0, P 1)

| Componente (arquivo:linha da definição) | Importado em (arquivo:linha) | Padrão de UI | Desvios do Lite (linhas) | Lite reaproveitável | Ação de conversão | Cx | Dependências (primitivas) |
|---|---|---|---|---|---|---|---|
| `app/(dashboard)/cotacao/page.tsx:11` (20 l.) | (entrada) | Só corretor (diretor vai para access-denied). Normal usa LightQuoteSimulator | nenhum detectado | já Lite | Fora do escopo do diretor | P | - |

- Componentes Lite já renderizados nesta rota (ramos Lite, sem conversão): `features/broker-workspace/components/light-quote-simulator/index.tsx`, `features/broker-workspace/chat/quote-chat.tsx`, `features/broker-workspace/chat/quote-paused.tsx`

## Rota: documentos

- Entradas: `src/app/(dashboard)/documentos/page.tsx`
- Acesso: Diretor: sim
- Componentes próprios: 3 (novos nesta seção: G 1, M 0, P 1)

| Componente (arquivo:linha da definição) | Importado em (arquivo:linha) | Padrão de UI | Desvios do Lite (linhas) | Lite reaproveitável | Ação de conversão | Cx | Dependências (primitivas) |
|---|---|---|---|---|---|---|---|
| `app/(dashboard)/documentos/page.tsx:12` (71 l.) | (entrada) | Header + DocumentsWorkspace | nenhum detectado | - | Re-skin | P | - |
| `features/documents/components/documents-workspace.tsx:79` (603 l.) | app/(dashboard)/documentos/page.tsx:6 | Gestão de documentos: tabela, filtros, upload, switches | cor crua 3 (l.249,305,422); dark: 1 (l.249); alvo<44px 14 (l.303,312,323,376,378,...) | arc/file-dropzone | Re-skin + data-table Arc; 14 alvos pequenos | G | Arc sortable-data-table (instalar); arc input/textarea/button; superfície Lite (surface-muted + shadow-resting) / arc metric-card; arc badge; arc input/search-field/textarea; arc switch + Arc checkbox (instalar); Arc toast (instalar) ou sonner re-skin; arc chip-group / Arc filter-toolbar (instalar) |
| `components/ownership-context.tsx:18` | features/documents/components/documents-workspace.tsx:24 | ver seção "leads (page: kanban/lista)" | | | | P | |
- Primitivas compartilhadas usadas (convertidas uma vez, ver seção Primitivas): `components/ui/button.tsx`, `components/motion/animated-page-title.tsx`, `components/ui/sonner.tsx`, `components/ui/selection-toolbar.tsx`, `components/ui/badge.tsx`, `components/ui/card.tsx`, `components/ui/label.tsx`, `components/ui/input.tsx`, `components/ui/checkbox.tsx`, `components/ui/select.tsx`, `components/ui/data-table/index.ts`, `components/illustrations/voxel-illustration.tsx`, `components/ui/table.tsx`, `components/ui/scroll-area.tsx`, `components/ui/separator.tsx`, `components/ui/skeleton.tsx`

## Rota: empresas

- Entradas: `src/app/(dashboard)/empresas/page.tsx`
- Acesso: Diretor: sim (se a feature estiver ligada)
- Componentes próprios: 1 (novos nesta seção: G 0, M 0, P 1)

| Componente (arquivo:linha da definição) | Importado em (arquivo:linha) | Padrão de UI | Desvios do Lite (linhas) | Lite reaproveitável | Ação de conversão | Cx | Dependências (primitivas) |
|---|---|---|---|---|---|---|---|
| `app/(dashboard)/empresas/page.tsx:19` (80 l.) | (entrada) | Lista de empresas em cards; gestor Lite já usa LightCompaniesList (l.50) | sombra 2 (l.61,69); alvo<44px 3 (l.58,63,74) | broker-workspace/components/light-companies-list.tsx | Reusar Lite existente (passar dados do diretor) | P | superfície Lite (surface-muted + shadow-resting) / arc metric-card; arc badge |

- Componentes Lite já renderizados nesta rota (ramos Lite, sem conversão): `features/broker-workspace/components/light-companies-list.tsx`
- Primitivas compartilhadas usadas (convertidas uma vez, ver seção Primitivas): `components/ui/badge.tsx`, `components/ui/button.tsx`, `components/ui/card.tsx`, `components/motion/animated-page-title.tsx`, `components/ui/input.tsx`, `components/ui/scroll-area.tsx`, `components/ui/separator.tsx`, `components/ui/sonner.tsx`, `components/ui/skeleton.tsx`

## Rota: relatorios

- Entradas: `src/app/(dashboard)/relatorios/page.tsx`, `src/app/(dashboard)/relatorios/loading.tsx`
- Acesso: Diretor: redirect para /dashboard
- Componentes próprios: 2 (novos nesta seção: G 0, M 0, P 2)

| Componente (arquivo:linha da definição) | Importado em (arquivo:linha) | Padrão de UI | Desvios do Lite (linhas) | Lite reaproveitável | Ação de conversão | Cx | Dependências (primitivas) |
|---|---|---|---|---|---|---|---|
| `app/(dashboard)/relatorios/page.tsx:12` (36 l.) | (entrada) | Redirect para /dashboard?tab=... | nenhum detectado | - | Nenhuma | P | - |
| `app/(dashboard)/relatorios/loading.tsx:3` (6 l.) | (entrada) | RouteLoading | nenhum detectado | LightPageSkeleton | Herda do comum | P | - |
- Primitivas compartilhadas usadas (convertidas uma vez, ver seção Primitivas): `components/ui/card.tsx`, `components/ui/skeleton.tsx`

## Rota: relatorios/drill/[drillId]

- Entradas: `src/app/(dashboard)/relatorios/drill/[drillId]/page.tsx`
- Acesso: Diretor: sim
- Componentes próprios: 1 (novos nesta seção: G 0, M 0, P 0)

| Componente (arquivo:linha da definição) | Importado em (arquivo:linha) | Padrão de UI | Desvios do Lite (linhas) | Lite reaproveitável | Ação de conversão | Cx | Dependências (primitivas) |
|---|---|---|---|---|---|---|---|
| `app/(dashboard)/relatorios/drill/[drillId]/page.tsx:14` | (entrada) | ver seção "dashboard/drill/[drillId]" | | | | M | |
- Primitivas compartilhadas usadas (convertidas uma vez, ver seção Primitivas): `components/ui/data-table/data-table-frame.tsx`, `components/ui/table.tsx`, `components/ui/button.tsx`, `components/motion/animated-page-title.tsx`, `components/ui/input.tsx`, `components/ui/badge.tsx`, `components/ui/scroll-area.tsx`, `components/ui/separator.tsx`, `components/ui/sonner.tsx`, `components/ui/skeleton.tsx`, `components/ui/card.tsx`

## Rota: desempenho

- Entradas: `src/app/(dashboard)/desempenho/page.tsx`
- Acesso: Diretor: NÃO (redirect /dashboard; só corretor Lite)
- Componentes próprios: 1 (novos nesta seção: G 0, M 0, P 1)

| Componente (arquivo:linha da definição) | Importado em (arquivo:linha) | Padrão de UI | Desvios do Lite (linhas) | Lite reaproveitável | Ação de conversão | Cx | Dependências (primitivas) |
|---|---|---|---|---|---|---|---|
| `app/(dashboard)/desempenho/page.tsx:11` (68 l.) | (entrada) | Só corretor Lite (diretor redirecionado). Já usa .arc-venancor [já .arc-venancor] | sombra 2 (l.42,53) | já Lite | Fora do escopo do diretor | P | - |

## Rota: noc

- Entradas: `src/app/(dashboard)/noc/page.tsx`
- Acesso: Diretor: sim
- Componentes próprios: 9 (novos nesta seção: G 1, M 1, P 2)

| Componente (arquivo:linha da definição) | Importado em (arquivo:linha) | Padrão de UI | Desvios do Lite (linhas) | Lite reaproveitável | Ação de conversão | Cx | Dependências (primitivas) |
|---|---|---|---|---|---|---|---|
| `app/(dashboard)/noc/page.tsx:12` (46 l.) | (entrada) | Server: gate (corretor bloqueado) + NocClient | nenhum detectado | - | Envolver em .arc-venancor | P | - |
| `components/next-urgent-lead-button.tsx:9` | app/(dashboard)/noc/page.tsx:4 | ver seção "leads (page: kanban/lista)" | | | | P | |
| `components/period-select.tsx:27` | app/(dashboard)/noc/page.tsx:5 | ver seção "dashboard aba quality (LeadQualityCenter)" | | | | P | |
| `app/(dashboard)/noc/noc-client.tsx:217` (705 l.) | app/(dashboard)/noc/page.tsx:9 | NOC: KPIs ao vivo, gráficos, tabela, tooltips, animações | sombra 2 (l.109,644); cor crua 4 (l.691,695,697,698); uppercase 1 (l.650); dark: 1 (l.695); alvo<44px 5 (l.195,291,542,591,647) | arc/metric-card, arc/animated-counter | Re-skin + gráficos Arc | G | Arc sortable-data-table (instalar); Arc charts (instalar: line/bar/donut/sparkline); Arc tooltip (instalar); superfície Lite (surface-muted + shadow-resting) / arc metric-card; arc badge; arc input/search-field/textarea; light-motion / arc motion-tokens |
| `components/dashboard/metric-card.tsx:59` | app/(dashboard)/noc/noc-client.tsx:45 | ver seção "dashboard aba funnel (QualificationFunnelView)" | | | | P | |
| `features/noc/components/noc-heatmap.tsx:13` (152 l.) | app/(dashboard)/noc/noc-client.tsx:49 | Heatmap com pílulas de estado coloridas | sombra 2 (l.23,76); cor crua 10 (l.37,38,41,42,46,...); uppercase 4 (l.101,105,109,115); dark: 7 (l.37,41,46,63,65,...); alvo<44px 2 (l.28,140) | Arc activity-heatmap (catálogo) | Re-skin: 10 cores cruas (l.37-46), 7 dark:, 4 uppercase | M | Arc tooltip (instalar); superfície Lite (surface-muted + shadow-resting) / arc metric-card; arc badge |
| `features/noc/components/noc-anomaly-alerts.tsx:9` (74 l.) | app/(dashboard)/noc/noc-client.tsx:50 | Lista de alertas de anomalia | sombra 1 (l.27); cor crua 3 (l.29,30,36); dark: 3 (l.29,30,36); alvo<44px 5 (l.39,52,55,60,63) | Arc alert (catálogo) | Re-skin; 3 cores cruas e 3 dark: | P | - |
| `components/dashboard/mini-donut.tsx:12` | components/dashboard/metric-card.tsx:6 | ver seção "dashboard aba funnel (QualificationFunnelView)" | | | | P | |
| `components/dashboard/metric-sparkline.tsx:15` | components/dashboard/metric-card.tsx:7 | ver seção "dashboard aba funnel (QualificationFunnelView)" | | | | P | |
- Primitivas compartilhadas usadas (convertidas uma vez, ver seção Primitivas): `components/ui/button.tsx`, `components/motion/animated-page-title.tsx`, `components/ui/tooltip.tsx`, `components/ui/select.tsx`, `components/ui/badge.tsx`, `components/ui/card.tsx`, `components/ui/input.tsx`, `components/ui/table.tsx`, `components/ui/chart.tsx`, `components/ui/scroll-area.tsx`, `components/ui/separator.tsx`, `components/ui/sonner.tsx`, `components/motion/count-up.tsx`, `components/ui/progress.tsx`, `components/ui/skeleton.tsx`

## Rota: integridade

- Entradas: `src/app/(dashboard)/integridade/page.tsx`
- Acesso: Diretor: sim
- Componentes próprios: 2 (novos nesta seção: G 0, M 1, P 1)

| Componente (arquivo:linha da definição) | Importado em (arquivo:linha) | Padrão de UI | Desvios do Lite (linhas) | Lite reaproveitável | Ação de conversão | Cx | Dependências (primitivas) |
|---|---|---|---|---|---|---|---|
| `app/(dashboard)/integridade/page.tsx:40` (385 l.) | (entrada) | Saúde dos dados: cards de checagem com sparkline e badges | uppercase 1 (l.365); alvo<44px 3 (l.239,277,370) | arc/metric-card | Re-skin; KPIs para metric-card | M | Arc charts (instalar: line/bar/donut/sparkline); superfície Lite (surface-muted + shadow-resting) / arc metric-card; arc badge |
| `components/dashboard/sparkline.tsx:18` (58 l.) | app/(dashboard)/integridade/page.tsx:20 | Sparkline SVG | nenhum detectado | nenhum (Arc: sparkline) | Trocar por Arc sparkline (instalar) | P | Arc charts (instalar: line/bar/donut/sparkline) |
- Primitivas compartilhadas usadas (convertidas uma vez, ver seção Primitivas): `components/ui/badge.tsx`, `components/ui/button.tsx`, `components/ui/card.tsx`, `components/ui/scroll-area.tsx`, `components/motion/animated-page-title.tsx`, `components/ui/input.tsx`, `components/ui/separator.tsx`, `components/ui/sonner.tsx`, `components/ui/skeleton.tsx`

## Rota: jornada

- Entradas: `src/app/(dashboard)/jornada/page.tsx`, `src/app/(dashboard)/jornada/loading.tsx`
- Acesso: Diretor: NÃO (redirect /dashboard; só corretor)
- Componentes próprios: 7 (novos nesta seção: G 0, M 0, P 7)

| Componente (arquivo:linha da definição) | Importado em (arquivo:linha) | Padrão de UI | Desvios do Lite (linhas) | Lite reaproveitável | Ação de conversão | Cx | Dependências (primitivas) |
|---|---|---|---|---|---|---|---|
| `app/(dashboard)/jornada/page.tsx:13` (33 l.) | (entrada) | Só corretor (diretor redirecionado). Já Lite [já .arc-venancor] | nenhum detectado | já Lite | Fora do escopo do diretor (a jornada do diretor está em /relacionamento) | P | arc empty-state |
| `app/(dashboard)/jornada/loading.tsx:4` (22 l.) | (entrada) | Skeleton Lite [já .arc-venancor] | alvo<44px 2 (l.9,14) | já Lite | Nenhuma | P | arc skeleton |
| `features/journey/components/journey-screen.tsx:43` (278 l.) | app/(dashboard)/jornada/page.tsx:6 | Tela da jornada do corretor [já .arc-venancor] | nenhum detectado | já Lite | Nenhuma | P | light-motion / arc motion-tokens; arc empty-state |
| `features/assist/components/term.tsx:15` (32 l.) | features/journey/components/journey-screen.tsx:13 | Termo com ajuda (já .arc-venancor) [já .arc-venancor] | nenhum detectado | já Lite | Nenhuma | P | - |
| `features/journey/components/badge-art.tsx:21` (48 l.) | features/journey/components/journey-screen.tsx:15 | Arte de selo (cores de ilustração) | cor crua 6 (l.30,31,36,37,41,...) | já Lite | Nenhuma (cores são ilustração) | P | - |
| `features/journey/components/level-ring.tsx:11` (38 l.) | features/journey/components/journey-screen.tsx:16 | Anel de nível | nenhum detectado | já Lite | Nenhuma | P | light-motion / arc motion-tokens |
| `features/journey/components/podium.tsx:21` (47 l.) | features/journey/components/journey-screen.tsx:17 | Pódio | cor crua 1 (l.12) | já Lite | Nenhuma | P | light-motion / arc motion-tokens |

- Componentes Lite já renderizados nesta rota (ramos Lite, sem conversão): `components/arc/empty-state/empty-state.tsx`, `components/arc/skeleton/skeleton.tsx`, `components/arc/animated-counter/animated-counter.tsx`, `components/arc/bottom-sheet/bottom-sheet.tsx`, `components/arc/avatar/avatar.tsx`

## Rota: agenda

- Entradas: `src/app/(dashboard)/agenda/page.tsx`
- Acesso: Diretor: NÃO (só corretor Lite)
- Componentes próprios: 1 (novos nesta seção: G 0, M 0, P 1)

| Componente (arquivo:linha da definição) | Importado em (arquivo:linha) | Padrão de UI | Desvios do Lite (linhas) | Lite reaproveitável | Ação de conversão | Cx | Dependências (primitivas) |
|---|---|---|---|---|---|---|---|
| `app/(dashboard)/agenda/page.tsx:11` (26 l.) | (entrada) | Só corretor Lite. Já .arc-venancor [já .arc-venancor] | nenhum detectado | já Lite | Fora do escopo do diretor | P | - |

- Componentes Lite já renderizados nesta rota (ramos Lite, sem conversão): `features/broker-workspace/components/light-dashboard/agenda.tsx`

## Rota: tarefas/dashboard

- Entradas: `src/app/(dashboard)/tarefas/dashboard/page.tsx`
- Acesso: Diretor: sim
- Componentes próprios: 2 (novos nesta seção: G 0, M 0, P 1)

| Componente (arquivo:linha da definição) | Importado em (arquivo:linha) | Padrão de UI | Desvios do Lite (linhas) | Lite reaproveitável | Ação de conversão | Cx | Dependências (primitivas) |
|---|---|---|---|---|---|---|---|
| `app/(dashboard)/tarefas/dashboard/page.tsx:6` (7 l.) | (entrada) | Header + DomainDashboard (tarefas) | nenhum detectado | arc/metric-card | Herda de DomainDashboard | P | - |
| `features/dashboard/components/domain-dashboard.tsx:5` | app/(dashboard)/tarefas/dashboard/page.tsx:4 | ver seção "conversas/dashboard" | | | | P | |
- Primitivas compartilhadas usadas (convertidas uma vez, ver seção Primitivas): `components/ui/button.tsx`, `components/motion/animated-page-title.tsx`, `components/ui/card.tsx`, `components/ui/input.tsx`, `components/ui/badge.tsx`, `components/ui/scroll-area.tsx`, `components/ui/separator.tsx`, `components/ui/sonner.tsx`, `components/ui/skeleton.tsx`

## Rota: notificacoes

- Entradas: `src/app/(dashboard)/notificacoes/page.tsx`
- Acesso: Diretor: sim (ramo NORMAL)
- Componentes próprios: 3 (novos nesta seção: G 0, M 0, P 3)

| Componente (arquivo:linha da definição) | Importado em (arquivo:linha) | Padrão de UI | Desvios do Lite (linhas) | Lite reaproveitável | Ação de conversão | Cx | Dependências (primitivas) |
|---|---|---|---|---|---|---|---|
| `app/(dashboard)/notificacoes/page.tsx:16` (132 l.) | (entrada) | Server: ramo Lite (LightNotifications) e NORMAL (NotificationsClient, l.~118) | nenhum detectado | broker-workspace/components/light-notifications.tsx | Reusar LightNotifications no ramo NORMAL (mesmas props, aiConsentGranted=null) | P | - |
| `app/(dashboard)/notificacoes/notifications-client.tsx:112` (154 l.) | app/(dashboard)/notificacoes/page.tsx:8 | Lista paginada de notificações com filtros | sombra 1 (l.152); uppercase 1 (l.152); alvo<44px 3 (l.77,86,152) | light-notifications.tsx (mesmas props iniciais) | Reusar Lite existente | P | arc badge; light-motion / arc motion-tokens; arc empty-state; arc chip-group / Arc filter-toolbar (instalar) |
| `app/(dashboard)/notificacoes/lead-toast-toggle.tsx:14` (46 l.) | app/(dashboard)/notificacoes/notifications-client.tsx:12 | Switch de toast de lead | nenhum detectado | broker-workspace/components/light-lead-toast-toggle.tsx | Reusar Lite existente | P | arc switch + Arc checkbox (instalar); Arc toast (instalar) ou sonner re-skin |

- Componentes Lite já renderizados nesta rota (ramos Lite, sem conversão): `features/broker-workspace/components/light-notifications.tsx`, `features/broker-workspace/components/supervisor-team-invites.tsx`, `components/chat/dynamic-notice.tsx`
- Primitivas compartilhadas usadas (convertidas uma vez, ver seção Primitivas): `components/ui/button.tsx`, `components/motion/animated-page-title.tsx`, `components/ui/badge.tsx`, `components/ui/input.tsx`, `components/ui/scroll-area.tsx`, `components/ui/separator.tsx`, `components/ui/sonner.tsx`, `components/ui/skeleton.tsx`, `components/ui/card.tsx`, `components/ui/switch.tsx`

## Rota: mensagens

- Entradas: `src/app/(dashboard)/mensagens/page.tsx`, `src/app/(dashboard)/mensagens/loading.tsx`
- Acesso: Diretor: NÃO (redirect /conversas)
- Componentes próprios: 2 (novos nesta seção: G 0, M 0, P 2)

| Componente (arquivo:linha da definição) | Importado em (arquivo:linha) | Padrão de UI | Desvios do Lite (linhas) | Lite reaproveitável | Ação de conversão | Cx | Dependências (primitivas) |
|---|---|---|---|---|---|---|---|
| `app/(dashboard)/mensagens/page.tsx:11` (18 l.) | (entrada) | Só gestor/supervisor Lite (outros vão para /conversas) | nenhum detectado | já Lite (TeamConversationsList) | Fora do escopo do diretor | P | - |
| `app/(dashboard)/mensagens/loading.tsx:3` (6 l.) | (entrada) | LightPageSkeleton | nenhum detectado | já Lite | Nenhuma | P | arc skeleton |

- Componentes Lite já renderizados nesta rota (ramos Lite, sem conversão): `features/team-conversations/team-conversations-list.tsx`, `components/light/light-page-skeleton.tsx`

## Rota: mensagens/[leadId]

- Entradas: `src/app/(dashboard)/mensagens/[leadId]/page.tsx`
- Acesso: Diretor: NÃO (redirect /conversas)
- Componentes próprios: 1 (novos nesta seção: G 0, M 0, P 1)

| Componente (arquivo:linha da definição) | Importado em (arquivo:linha) | Padrão de UI | Desvios do Lite (linhas) | Lite reaproveitável | Ação de conversão | Cx | Dependências (primitivas) |
|---|---|---|---|---|---|---|---|
| `app/(dashboard)/mensagens/[leadId]/page.tsx:11` (20 l.) | (entrada) | Só gestor/supervisor Lite | nenhum detectado | já Lite (TeamConversationView) | Fora do escopo do diretor | P | - |

- Componentes Lite já renderizados nesta rota (ramos Lite, sem conversão): `features/team-conversations/team-conversation-view.tsx`

## Rota: minha-fila

- Entradas: `src/app/(dashboard)/minha-fila/page.tsx`, `src/app/(dashboard)/minha-fila/loading.tsx`
- Acesso: Diretor: alcança (sem gate), mas é a fila pessoal do corretor
- Componentes próprios: 6 (novos nesta seção: G 0, M 2, P 3)

| Componente (arquivo:linha da definição) | Importado em (arquivo:linha) | Padrão de UI | Desvios do Lite (linhas) | Lite reaproveitável | Ação de conversão | Cx | Dependências (primitivas) |
|---|---|---|---|---|---|---|---|
| `app/(dashboard)/minha-fila/page.tsx:38` (722 l.) | (entrada) | Fila pessoal (pensada para o corretor; sem gate de papel). NORMAL: KPIs, sparkline, escala, QueueClient | sombra 1 (l.584); uppercase 1 (l.592); alvo<44px 7 (l.589,610,631,641,659,...) | broker-workspace/components/light-leads-list.tsx (ramo LIGHT, l.446) | Re-skin ou reusar LightLeadsList; confirmar se o diretor usa essa rota | M | Arc charts (instalar: line/bar/donut/sparkline); superfície Lite (surface-muted + shadow-resting) / arc metric-card; arc skeleton; arc badge |
| `app/(dashboard)/minha-fila/loading.tsx:3` (24 l.) | (entrada) | Skeleton | alvo<44px 4 (l.8,11,12,13) | LightPageSkeleton variant list | Reusar Lite existente | P | arc skeleton |
| `app/(dashboard)/minha-fila/_components/queue-client.tsx:38` (219 l.) | app/(dashboard)/minha-fila/page.tsx:12 | Tabela/lista da fila com filtros | alvo<44px 2 (l.94,193) | light-leads-list.tsx / PeopleRow | Reusar PeopleRow | M | Arc sortable-data-table (instalar); arc badge; arc input/search-field/textarea; light-motion / arc motion-tokens; arc chip-group / Arc filter-toolbar (instalar) |
| `app/(dashboard)/minha-fila/_components/broker-availability.tsx:20` (69 l.) | app/(dashboard)/minha-fila/page.tsx:13 | Toggle de disponibilidade | cor crua 3 (l.15,16,17); alvo<44px 1 (l.59) | light-availability-section.tsx | Reusar Lite existente | P | Arc toast (instalar) ou sonner re-skin |
| `app/(dashboard)/minha-fila/_components/sparkline.tsx:13` (64 l.) | app/(dashboard)/minha-fila/page.tsx:14 | Sparkline SVG | nenhum detectado | Arc sparkline | Trocar por componente Arc | P | Arc charts (instalar: line/bar/donut/sparkline) |
| `components/status-badges.tsx:12` | app/(dashboard)/minha-fila/_components/queue-client.tsx:11 | ver seção "leads (page: kanban/lista)" | | | | M | |

- Componentes Lite já renderizados nesta rota (ramos Lite, sem conversão): `components/light/light-page-skeleton.tsx`, `features/broker-workspace/components/light-leads-list.tsx`
- Primitivas compartilhadas usadas (convertidas uma vez, ver seção Primitivas): `components/ui/badge.tsx`, `components/ui/card.tsx`, `components/ui/button.tsx`, `components/unlumen-ui/shimmer-skeleton.tsx`, `components/motion/animated-page-title.tsx`, `components/ui/input.tsx`, `components/ui/table.tsx`, `components/ui/sonner.tsx`, `components/ui/scroll-area.tsx`, `components/ui/separator.tsx`, `components/motion/animated-badge.tsx`, `components/ui/skeleton.tsx`

## Rota: relacionamento

- Entradas: `src/app/(dashboard)/relacionamento/page.tsx`
- Acesso: Diretor: sim (RelationshipJourneyTabs)
- Componentes próprios: 9 (novos nesta seção: G 0, M 3, P 6)

| Componente (arquivo:linha da definição) | Importado em (arquivo:linha) | Padrão de UI | Desvios do Lite (linhas) | Lite reaproveitável | Ação de conversão | Cx | Dependências (primitivas) |
|---|---|---|---|---|---|---|---|
| `app/(dashboard)/relacionamento/page.tsx:26` (119 l.) | (entrada) | Server: diretor/gestor vão para RelationshipJourneyTabs (l.32-55); supervisor Lite para RelationshipCenterLite [já .arc-venancor] | nenhum detectado | relationship/components/relationship-center-lite.tsx | Envolver ramo diretor em .arc-venancor | P | arc empty-state |
| `features/relationship/components/broker-mural.tsx:18` (88 l.) | app/(dashboard)/relacionamento/page.tsx:4 | Mural do corretor (não aparece para diretor) | alvo<44px 1 (l.76) | - | Fora do escopo do diretor | P | - |
| `features/relationship/components/relationship-center.tsx:76` (339 l.) | app/(dashboard)/relacionamento/page.tsx:5 | Central de recados: form de envio, histórico, sheet | alvo<44px 1 (l.318) | relationship-center-lite.tsx (mesmas props: options, history, initial*) | Reusar Lite existente (RelationshipCenterLite) | P | Arc drawer (instalar) / arc bottom-sheet; arc badge; arc input/search-field/textarea |
| `features/relationship/components/relationship-center-lite.tsx:55` (311 l.) | app/(dashboard)/relacionamento/page.tsx:6 | Versão Lite (supervisor) [já .arc-venancor] | alvo<44px 4 (l.144,159,243,292) | já Lite | Reusar | P | arc badge; arc input/search-field/textarea; light-motion / arc motion-tokens; arc empty-state; arc chip-group / Arc filter-toolbar (instalar) |
| `features/relationship/components/relationship-journey-tabs.tsx:13` (37 l.) | app/(dashboard)/relacionamento/page.tsx:15 | Abas Recados / Jornada | nenhum detectado | arc/segmented-control | Trocar por componente Arc | P | Arc tabs (instalar) ou segmented-control |
| `features/journey/components/director/director-journey-panel.tsx:46` (151 l.) | features/relationship/components/relationship-journey-tabs.tsx:6 | Painel da jornada do diretor: abas, gráfico, cards | nenhum detectado | arc/metric-card | Re-skin + Arc tabs/gráfico | M | Arc tabs (instalar) ou segmented-control; Arc charts (instalar: line/bar/donut/sparkline); superfície Lite (surface-muted + shadow-resting) / arc metric-card; arc empty-state |
| `features/journey/components/director/audit-tab.tsx:22` (111 l.) | features/journey/components/director/director-journey-panel.tsx:18 | Auditoria de eventos com dialog de estorno | nenhum detectado | Arc timeline | Re-skin + Arc dialog | M | Arc dialog (instalar); arc badge; arc empty-state |
| `features/journey/components/director/campaigns-tab.tsx:37` (187 l.) | features/journey/components/director/director-journey-panel.tsx:19 | Campanhas com sheet de criação | nenhum detectado | - | Re-skin + Arc drawer | M | Arc drawer (instalar) / arc bottom-sheet; arc badge; arc empty-state |
| `features/journey/components/director/rules-tab.tsx:15` (71 l.) | features/journey/components/director/director-journey-panel.tsx:20 | Regras com switches | nenhum detectado | manager-lite-settings-parts | Re-skin + arc/switch | P | arc switch + Arc checkbox (instalar); arc empty-state |

- Componentes Lite já renderizados nesta rota (ramos Lite, sem conversão): `components/arc/empty-state/empty-state.tsx`, `components/arc/avatar/avatar.tsx`, `components/arc/badge/badge.tsx`, `components/arc/bottom-sheet/bottom-sheet.tsx`, `components/arc/input/input.tsx`, `components/arc/radio-cards/radio-cards.tsx`, `components/arc/search-field/search-field.tsx`, `components/arc/segmented-control/segmented-control.tsx`, `components/arc/textarea/textarea.tsx`
- Primitivas compartilhadas usadas (convertidas uma vez, ver seção Primitivas): `components/ui/button.tsx`, `components/motion/animated-page-title.tsx`, `components/ui/badge.tsx`, `components/ui/input.tsx`, `components/ui/sheet.tsx`, `components/ui/textarea.tsx`, `components/ui/ds-tabs.tsx`, `components/ui/scroll-area.tsx`, `components/ui/separator.tsx`, `components/ui/sonner.tsx`, `components/ui/ds-count-up.tsx`, `components/ui/ds-dashboard-card.tsx`, `components/ui/ds-donut-chart.tsx`, `components/ui/ds-empty-state.tsx`, `components/ui/ds-section-header.tsx`, `components/ui/ds-stat-tile.tsx`, `components/ui/skeleton.tsx`, `components/ui/card.tsx`, `components/ui/ds-dialog.tsx`, `components/ui/ds-filled-dark-cta.tsx`, `components/ui/ds-input-field.tsx`, `components/ui/ds-outlined-action-button.tsx`, `components/ui/ds-status-badge.tsx`, `components/ui/ds-segmented-control.tsx`, `components/ui/ds-sheet.tsx`, `components/ui/ds-switch.tsx`

## Rota: assistente

- Entradas: `src/app/(dashboard)/assistente/page.tsx`
- Acesso: Diretor: sim
- Componentes próprios: 2 (novos nesta seção: G 1, M 0, P 1)

| Componente (arquivo:linha da definição) | Importado em (arquivo:linha) | Padrão de UI | Desvios do Lite (linhas) | Lite reaproveitável | Ação de conversão | Cx | Dependências (primitivas) |
|---|---|---|---|---|---|---|---|
| `app/(dashboard)/assistente/page.tsx:11` (31 l.) | (entrada) | Wrapper de altura fixa + chat | nenhum detectado | - | Envolver em .arc-venancor | P | - |
| `app/(dashboard)/assistente/_components/assistente-chat-client.tsx:147` (826 l.) | app/(dashboard)/assistente/page.tsx:4 | Chat do copiloto IA: header com status, sugestões, mensagens, input, tooltips | gradiente 1 (l.466); sombra 5 (l.525,578,579,631,686); cor crua 43 (l.279,280,403,409,410,...); uppercase 4 (l.633,659,732,773); dark: 1 (l.409); alvo<44px 15 (l.426,427,433,440,441,...) | components/chat/assistant-chat.tsx, chat-screen.tsx, composer.tsx, assistant-avatar.tsx | Reusar o chat Lite (AssistantChat) mantendo o backend MCP; ou re-skin: 43 cores cruas (ex.: l.403-517), 5 sombras, 4 uppercase | G | Arc tooltip (instalar); arc badge; arc input/search-field/textarea; light-motion / arc motion-tokens |
- Primitivas compartilhadas usadas (convertidas uma vez, ver seção Primitivas): `components/ui/button.tsx`, `components/ui/badge.tsx`, `components/ui/card.tsx`, `components/ui/input.tsx`, `components/ui/tooltip.tsx`, `components/ui/scroll-area.tsx`, `components/ui/select.tsx`, `components/motion/copy-check-icon.tsx`