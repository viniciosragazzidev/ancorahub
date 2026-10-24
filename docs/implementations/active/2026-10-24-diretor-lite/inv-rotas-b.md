# Inventário Lite, Grupo B (equipe, gestão, unidades, filiais, distribuição, plantões)

Repo: `ancorahub-lite-listas` (somente leitura). Caminhos relativos a `src/`. `(d)` = `app/(dashboard)`.
Levantado em 2026-10-24 seguindo imports a partir de cada `page.tsx`, `loading.tsx`, `error.tsx` e `layout.tsx` (script de rastreio + leitura dos arquivos).

## 0. Legenda e regras de leitura

**Ações de conversão**
- **RE-SKIN**: manter o componente, trocar classes por tokens Arc (`--surface`, `--surface-muted`, `--text-muted`, `--radius-panel`, `--shadow-resting`, `--chat-action`), tirar `dark:`, cores cruas, uppercase, alvos < 44px.
- **ARC**: trocar a primitiva shadcn por componente Arc (`components/arc/*`).
- **REUSAR**: já existe tela/componente Lite equivalente; plugar para o diretor (normalmente falta escopo multiunidade).
- **NOVO**: criar componente Lite novo (não há Arc nem Lite equivalente).

**Complexidade**: P (até meio dia), M (1 a 2 dias), G (3 dias ou mais / arquivo gigante ou fluxo crítico).

**Desvios detectados automaticamente** (scanner próprio + leitura): `grad` gradiente; `sombra` sombra crua/empilhada (`--shadow-resting` é token e vale); `cor` cor crua (emerald/amber/red, oklch/hsl/hex literais); `upper` uppercase/caixa alta; `dark` classes `dark:`; `<44` alvo de toque menor que 44px; `shadcn` primitiva `components/ui/*`; `ds-` tokens do design system legado (`ds-charcoal`, `ds-fog`, `p-ds-48`...).

**Fato importante sobre botões**: `components/ui/button-variants.ts:26-35` define `default` h-9 (36px), `sm` h-7.5 (30px), `xs` h-6, `icon` 32px, `icon-sm` 30px. **Todo `Button` shadcn está abaixo de 44px**, inclusive dentro das telas Lite atuais. O Arc `components/arc/button/button.module.css:31` usa `--control-height-sm` que no escopo Venancor é 2.75rem (44px). Trocar por Arc resolve o alvo.

**Fato importante sobre tokens**: `components/arc/venancor-scope.css:86-112` remapeia `--card`, `--primary`, `--muted`, `--muted-foreground`, `--border`, `--destructive` dentro de `.arc-venancor`. Componentes shadcn que só usam tokens semânticos ganham boa parte do Lite só por estarem dentro do escopo; os que usam `ds-*`, emerald/amber, `dark:` ou `shadow-sm` não.

## 1. Componentes compartilhados (aparecem em várias rotas; converter uma vez)

| Componente | Arquivo:linha | Padrão de UI | Desvios Lite | Lite equivalente | Ação | Cx |
|---|---|---|---|---|---|---|
| DashboardHeader | components/dashboard-header.tsx:1-66 | barra superior com breadcrumb, busca global, notificações, toggle de tema, sidebar trigger | shadcn Button <44 (l35, l57); `theme-toggle` (tema escuro, proibido); sidebar do modo normal | `components/light/light-app-header.tsx` + `light-chrome.tsx` (título vem de `light-routes.ts` RULES) | REUSAR chrome Lite; títulos das rotas do diretor entram em RULES | G (fora deste grupo, dependência de todas as rotas) |
| StatCard | components/dashboard/metric-card.tsx:1-172 (+ mini-donut.tsx, metric-sparkline.tsx, motion/count-up.tsx) | card de KPI com sparkline/donut | ícone `size-8` l106; sparkline usa `--chart-*`; Card shadcn | `components/arc/metric-card/metric-card.tsx:43` (sem sparkline) e blocos cinza de `manager-lite-team` (`styles.overview`) | ARC (MetricCard) ou NOVO `LiteStatTile` com sparkline opcional | M |
| RouteLoading | components/route-loading.tsx:1-32 | skeleton genérico em Cards | Card shadcn, `h-8` l12-13 | `components/light/light-page-skeleton.tsx`, `components/arc/skeleton` | REUSAR light-page-skeleton | P |
| RouteError | components/route-error.tsx:1-104 | tela de erro com retry | `shadow-sm hover:shadow` l74, l82; Button shadcn | nenhum Lite de erro; `components/arc/empty-state` serve de base | NOVO `LiteRouteError` (EmptyState + Arc Button) | P |
| status-badges (RoleBadge, MemberStatusBadge) | components/status-badges.tsx:1-188 | badges animados por status | alturas h-5 em 44 variantes (l22..), cores próprias | `components/arc/badge/badge.tsx` (tones neutral/success/warning/danger/info) | ARC (mapear status para tone) | P |
| UserAvatar | components/ui/user-avatar.tsx:54 | avatar com seed | sombra l54 | `components/arc/avatar/avatar.tsx` | ARC | P |
| EmptyState (normal) | components/empty-state.tsx | vazio com ícone | ícone Phosphor, Card | `components/arc/empty-state` + `AssistantAvatar` (mascote) | ARC | P |
| DataTable / DataTableColumnHeader | components/ui/data-table/* | tabela ordenável, paginação, toggle de colunas | shadcn, densidade alta, botões <44 | **não existe tabela Arc**; padrão Lite é lista `components/light/people-list/people-list.tsx` (PeopleSection/PeopleRow/PeopleFilters) | NOVO `LiteDataList` (lista em cards + busca + paginação "carregar mais") ou REUSAR people-list | G |
| Dialog / DialogPopup | components/ui/dialog.tsx | modal central | shadcn | `components/arc/bottom-sheet/bottom-sheet.tsx` (sheet com detents, vira modal no desktop) | ARC (BottomSheet) | por tela |
| Sheet lateral | components/ui/sheet.tsx | painel lateral | shadcn | BottomSheet Arc | ARC | por tela |
| Select / AppSelect | components/ui/select.tsx | combobox | shadcn, h-9 | **não existe Select Arc**; usar `chip-group` (poucas opções), `radio-cards`, `segmented-control` ou lista dentro de BottomSheet | NOVO `LiteSelectSheet` (lista de opções em BottomSheet com busca) | M |
| DropdownMenu | components/ui/dropdown-menu.tsx | menu "⋯" | shadcn, itens 32px | padrão Lite: botão `•••` 44px + BottomSheet com `sheetRow` (`features/supervisor-workspace/my-team-page.module.css:36,47`) | REUSAR padrão sheetRow | P por uso |
| Tabs / RouteSectionTabs | components/ui/tabs.tsx, components/ui/route-section-tabs.tsx:1-36 | abas sublinhadas | gatilhos `min-h-10` (40px), `text-xs` | `components/arc/segmented-control` | ARC | P |
| Checkbox | components/ui/checkbox.tsx | seleção múltipla | shadcn ~16px | **não existe Checkbox Arc**; `components/arc/switch`, `chip-group multiple`, ou checkbox nativo em linha de 44px (`team-invite-lite-sheet.tsx:88`) | NOVO `LiteCheckRow` | P |
| Switch | components/ui/switch.tsx | liga/desliga | shadcn | `components/arc/switch/switch.tsx:23` | ARC | P |
| Popover / Tooltip / InfoTooltip | components/ui/popover.tsx, tooltip.tsx, info-tooltip.tsx:46 | detalhe flutuante | sombra l46; alvo pequeno | sem Arc; usar BottomSheet ou `expandable-card` | NOVO/ARC por uso | P |
| Card / SectionCardHeader | components/ui/card.tsx, section-card-header.tsx | card com header e ícone | borda + `variant="overview"` | card Lite = `--surface` + `--radius-panel` + `--shadow-resting` (`team-page-view.module.css:16-22`) | RE-SKIN ou NOVO `LiteCard` | P |
| SelectionToolbar | components/ui/selection-toolbar.tsx:30,39 | barra de ação em lote | sombra l30, botão <44 l39 | nenhum | NOVO barra fixa inferior Lite (como a de disponibilidade em settings) | M |
| ContextNote | components/ui/context-note.tsx | nota informativa | tokens ok | bloco `--surface-muted` | RE-SKIN | P |
| PeriodSelect | components/period-select.tsx:1-107 | Select de período | shadcn Select | `segmented-control` (7/30/90) | ARC | P |
| AvailabilityToggle | components/availability-toggle.tsx:39,51,63 | pílulas disponível/pausado/offline | cor crua + `dark:` l39, l51, l63 | `light-availability-context.tsx` / Badge Arc | RE-SKIN | P |
| SearchAddList | components/ui/search-add-list.tsx:88 | busca + adicionar | botão <44 l88 | `components/arc/search-field` + people-list | RE-SKIN | P |
| ds-* (DsStatusBadge, DsEmptyState, DsOutlinedActionButton) | components/ui/ds-status-badge.tsx, ds-empty-state.tsx, ds-outlined-action-button.tsx:15 | design system legado | tokens `ds-*`, cor crua l15 | Badge, EmptyState, Button Arc | ARC | P |
| TeamManagementTabs | (d)/equipe/team-management-tabs.tsx:4-12 | abas Equipe/Unidades via RouteSectionTabs | ver Tabs | segmented-control | ARC | P |

**Lacunas do Arc a decidir antes de executar** (bloqueiam várias rotas): Tabela/lista densa, Select, Checkbox, Popover/Tooltip, Toolbar de seleção em lote. Proposta: criar 4 primitivas Lite (`LiteDataList`, `LiteSelectSheet`, `LiteCheckRow`, `LiteBulkBar`) antes das telas G.

**Desvios dentro das telas Lite já existentes (correções transversais)**:
- `Button` shadcn (`components/ui/button`) em telas Lite: `my-team-page.tsx:7,81,125`, `team-page-view.tsx:6,43`, `goals-section.tsx:5,37,42,59,93`, `team-on-duty-list.tsx:6,36`, `team-settings.tsx:7,121,122`, `transfer-request-form.tsx:5`, `handoff-form.tsx:7`, `supervisor-broker-profile.tsx:8,322`, `manager-lite-unit-profile.tsx:10,39`, `team-invite-lite-sheet.tsx:8,52,64,104,107`, `manager-lite-team.tsx:11,71,102,103,120,121,154,155`, `weekly-summary-card.tsx:8`, `manager-lite-profile-actions.tsx:4`. Ação: ARC Button. P cada.
- `Input` shadcn em Lite: `team-invite-lite-sheet.tsx:9,71-77`, `manager-lite-profile-actions.tsx:5,41-43`. Ação: `components/arc/input`.
- `weekly-summary-card.tsx:7,9,31,65`: Card + Select shadcn dentro da tela Lite. Ação: card Lite + LiteSelectSheet.
- `manager-lite-profile-actions.tsx:17,27`: usa `window.confirm` (fora do padrão Lite de sheet). Ação: BottomSheet de confirmação.
- CSS module com gradiente/cor crua: `team-settings.module.css:8,46` (gradiente hsl no preview e na barra sticky), `my-team-page.module.css:36` (hsl por equipe), `recognize-sheet.module.css:8,15,21` (gradiente dourado + sombra crua `0 6px 16px`), `team-standings.module.css:30,31` (gradiente na barra), `journey.module.css:23,24,51,70,71,83` (pódio com gradientes, uppercase l118), `duty-now-view.module.css:9` (hero com gradiente), `:16,22,45,46` (oklch cru), `components/chat/chat.module.css` (gradientes l200,230,279,332,347-349,368,390; sombras empilhadas l238-240; uppercase l444; `.dark` l22,362), `people-list.module.css:26` (segmento ~36px de altura, <44), `podium.tsx:12` (cores de medalha oklch).

---

## 2. Rotas

### 2.1 `/equipe` (lista de membros e visão Unidades)

- Página: `(d)/equipe/page.tsx:24-290`. Estados: `(d)/equipe/loading.tsx:1-5` (RouteLoading), `(d)/equipe/error.tsx:1-14` (RouteError). Vazio: dentro da tabela.
- Ramificações: supervisor Lite redireciona para `/equipe/minha` (l26); broker negado (l27); **gestor Lite já renderiza `ManagerLiteTeam`** (l28-35); `?visao=unidades` renderiza `UnitsView` (l37-40, ver 2.1b); diretor/gestor normal/supervisor normal: tela normal (l241-289).

| Componente | Arquivo:linha | Padrão de UI | Desvios Lite | Lite reusável | Ação | Cx | Depende de |
|---|---|---|---|---|---|---|---|
| Header + botões "Cargos e permissões" e "Novo funcionário" | page.tsx:253-257 | DashboardHeader com rightSlot | Button outline h-9 (<44); Title Case "Novo Funcionário" | `manager-lite-team.tsx:65-73` (header Lite com ações) | REUSAR layout do header Lite | P | chrome Lite |
| TeamManagementTabs | page.tsx:259; team-management-tabs.tsx:10 | abas Equipe/Unidades | ver §1 | segmented-control | ARC | P | |
| 4 StatCards com sparkline | page.tsx:272-275 | grade de KPIs | ver StatCard; `--chart-1..4` | blocos `styles.overview` em `manager-lite-team.tsx:76-83` | ARC/NOVO LiteStatTile | P | StatCard |
| TransferRequestsPanel | features/supervisor-workspace/transfer-requests-panel.tsx:10-58 (usado em page.tsx:277) | lista de pedidos com Aprovar/Recusar | Button sm 30px (l47-48); borda `bg-card` l32 | **mesma função já existe em Lite**: `manager-lite-team.tsx:89-108` (PeopleSection + PeopleRow) | REUSAR bloco do ManagerLiteTeam | P | people-list |
| TeamMembersTable | (d)/equipe/team-members-table.tsx:60-452 | Card + SectionCardHeader + filtro de unidade (Select l274) + SelectionToolbar com ações em lote (Ativar/Desativar/Pausar/Retomar l293-361) + lista mobile com busca e paginação (l365-433) + DataTable desktop (l438-447) | Button sm (l304,316,333,349,424,430); cor crua emerald l306; UserAvatar size-8; textos `font-mono text-xs`; Checkbox | `ManagerLiteTeam` (lista por PeopleRow, busca, convites) cobre consulta; **não cobre** filtro multiunidade, seleção em lote, colunas e-mail/WhatsApp/papel | REUSAR ManagerLiteTeam estendido: filtro de unidade (segmented/LiteSelectSheet), papel no chip, LiteBulkBar | G | LiteDataList, LiteBulkBar, LiteCheckRow |
| TeamMemberActions (menu "⋯") | (d)/equipe/member-actions.tsx:403-623; DropdownMenu l524-588 | dropdown com Editar, Ativar/Desativar, Gerar senha, Transferir leads, Excluir | itens 32px; Button icon | menu Lite `•••` + BottomSheet (`manager-lite-team.tsx:149-158`) | REUSAR padrão sheetRow | M | |
| EditMemberDialog | member-actions.tsx:80-315 (Dialog l140) | formulário grande: nome, e-mail, telefone, papel, cargo personalizado, unidade, supervisor, lista de corretores supervisionados com checkbox (l281) | Field/Select/Input shadcn (Select x5), alvos 32-36px, `hover:bg-muted/60` | parcial: `manager-lite-profile-actions.tsx:38-46` (só contato); seleção de corretores em `team-invite-lite-sheet.tsx:85-98` | NOVO `MemberEditSheet` Lite (BottomSheet detents 0.9) reaproveitando os dois | G | LiteSelectSheet, LiteCheckRow |
| DeleteMemberDialog | member-actions.tsx:317-401 (Dialog l346) | confirmação destrutiva com resumo | `bg-muted/30` l354; botões shadcn | `my-team-page.module.css:54` (`.sheetDanger`) | ARC BottomSheet + sheetDanger | P | |
| ResetPasswordDialog | member-actions.tsx:625-779 (Dialog l705) | gera link, textarea mono com mensagem, copiar | `text-emerald-400` l763; textarea `rounded-md` l756; `font-mono text-xs` | `manager-lite-profile-actions.tsx:26-30,47` (gera link, sem textarea) | REUSAR ação Lite + Arc Textarea | M | |
| TransferLeadsDialog | member-actions.tsx:781-862 (Dialog l816) | transferir carteira em lote para outro membro | Title Case "Transferir Leads em Lote" l818; Select | nenhum Lite (gestor Lite não transfere carteira) | NOVO sheet Lite | M | LiteSelectSheet |
| TeamInviteSection | (d)/equipe/team-invite-section.tsx:30-273 | Dialog com abas Manual/CSV (botões custom l158-172), formulário, tela de sucesso com link e mensagem WhatsApp | `shadow-sm` l157,165; emerald/amber crus l98, l118; Title Case l90,94,118,152,162,170; Select x4 | `features/team/team-invite-lite-sheet.tsx:49-110` (convite Lite, papel corretor/supervisor, corretores livres) | REUSAR TeamInviteLiteSheet com audience "director" (papéis diretor/gestor/supervisor/corretor, escolha de unidade, cargo personalizado) + aba CSV em segmented-control | G | LiteSelectSheet |
| TeamInviteForm | (d)/equipe/team-invite-form.tsx:9-108 | formulário antigo | shadcn | n/a | **código morto** (nenhum import); não converter, só arquivar | P | |
| Bloco legado comentado | page.tsx:260-270 | comentário com "GESTAO DE EQUIPE" uppercase | n/a | n/a | remover junto | P | |

**2.1b `/equipe?visao=unidades` (UnitsView)**

| Componente | Arquivo:linha | Padrão de UI | Desvios Lite | Lite reusável | Ação | Cx | Depende de |
|---|---|---|---|---|---|---|---|
| UnitsView | (d)/equipe/units-view.tsx:10-58 | header + abas + BranchesManager | DashboardHeader | nenhum | RE-SKIN wrapper | P | |
| BranchesManager | features/branches/components/branches-manager.tsx:156-253 | 4 StatCards (l191) + Card/SectionCardHeader (l220) + DataTable de unidades (l243) + legenda (l248) + EmptyState (l236) | Button `size="sm"`/`icon-sm` (l94,123,144,183,227) | `manager-lite-unit-profile.tsx` (só uma unidade, leitura) | NOVO `LiteUnitsList` (cards por unidade com 3 toggles e atalho "Ver unidade") | M | LiteDataList, StatCard |
| CreateBranchSheet / CreateBranchForm | branches-manager.tsx:60-116 (Sheet l93-98) | sheet lateral com 2 inputs | Label/Input shadcn | `components/arc/input` + BottomSheet | ARC | P | |
| EditBranchSheet | branches-manager.tsx:~118-150 (gatilho l123, l144) | sheet de edição | icon-sm 30px | idem | ARC | P | |
| BranchAcceptingToggle / AutoDistribute / Hub / Legend | features/branches/components/branch-distribution-controls.tsx:56,71-93 | Switch shadcn | shadcn Switch | `components/arc/switch` | ARC | P | |

### 2.2 `/equipe/[id]` (perfil do membro)

- Página: `(d)/equipe/[id]/page.tsx:68-286`. Loading/erro herdados de `/equipe` (RouteLoading/RouteError).
- **Gestor Lite (l87-122) e supervisor Lite (l124-207) já renderizam `SupervisorBrokerProfile`** com quase todos os dados do perfil normal (`managerProfile` com temperatura, cotações, vendas, interações, tarefas e dias de plantão). O diretor e o gestor/supervisor normais caem na versão normal (l209-285).
- Lacunas da versão Lite para o diretor: perfil de **não corretor** (gestor/supervisor/diretor; Lite redireciona para /not-found l86, l127); lista completa de leads com abas por período (`MemberLeadsTabs`, limite `MEMBER_PROFILE_LEADS_LIMIT`); **Redistribuições** (l278-279); `withoutStep` do ranking; papel/cargo personalizado e "Cadastro" (lifecycle).

| Componente | Arquivo:linha | Padrão de UI | Desvios Lite | Lite reusável | Ação | Cx | Depende de |
|---|---|---|---|---|---|---|---|
| Header do perfil (Card transparente, avatar, badges, dados) | page.tsx:220-234 | header com voltar (Button sm l220) | Button sm; `capitalize` em enum cru | `supervisor-broker-profile.tsx:232-255` (header Lite com WhatsApp) | REUSAR | P | |
| Metric (6 KPIs em faixa) | page.tsx:59-66, 236-243 | strip de métricas | `font-mono`; tons text-success/warning | `supervisor-broker-profile.tsx` métricas (props `metrics`) | REUSAR | P | |
| MemberTemperaturePanel | (d)/equipe/[id]/_components/member-temperature.tsx:13-37 | barra empilhada + dl | borda `--radius-card-lg`; cores via TEMPERATURE_UI | seção "Temperatura" em `supervisor-broker-profile.tsx:396` | REUSAR | P | |
| MemberOffersPanel | member-temperature.tsx:39-62 | ofertas enviadas x aceitas | idem | seção `leadOffers` `supervisor-broker-profile.tsx:256-265` | REUSAR | P | |
| MemberLeadsTabs | (d)/equipe/[id]/_components/member-leads-tabs.tsx:43-142 | abas por período + Table shadcn | Table densa, sem alvo de 44 | `supervisor-broker-profile.tsx:367-395` (só 5 a 8 leads ativos) | NOVO seção "Todos os leads" Lite (segmented + lista de linhas `leadInitials`) | M | LiteDataList |
| SupervisorNoteHistory (Feedbacks em Card) | page.tsx:255-265; features/supervisor-workspace/broker-profile/supervisor-broker-profile.tsx (export) | histórico de notas | Card shadcn em volta | seção Feedbacks `supervisor-broker-profile.tsx:317-347` | REUSAR | P | |
| MemberRankingPanel | (d)/equipe/[id]/_components/member-ranking.tsx:4-34 | posições no ranking | sem desvio relevante | prop `ranking` do perfil Lite | REUSAR (acrescentar `withoutStep`) | P | |
| MemberDutyCalendar | (d)/equipe/[id]/_components/member-duty-calendar.tsx:47-165 | calendário mensal com Popover por dia (l101-130) e navegação de mês | Button `icon-sm` 30px (l79-80); Popover | seção "Dias de plantão" `supervisor-broker-profile.tsx:398` (lista) ou `components/arc/calendar` | ARC Calendar + BottomSheet do dia | M | |
| Resultado comercial (Card) | page.tsx:268-276 | 4 números | `font-mono` | seção `supervisor-broker-profile.tsx:397` | REUSAR | P | |
| Redistribuições (Card) | page.tsx:277-280 | lista de eventos + resumo | `rounded-lg border`, `text-[11px]` | nenhum | NOVO seção Lite no perfil | P | |
| Nota de escopo do gestor | page.tsx:283 | texto | n/a | n/a | manter | P | |
| SupervisorBrokerProfile (já Lite) | features/supervisor-workspace/broker-profile/supervisor-broker-profile.tsx:1-554 + .module.css | perfil Lite completo, sheets de nota, meta, reconhecimento | Button shadcn l8, l322 (`pillButton` 32px, module l152); `windowButton` 32px (module l95); `color-mix` ok | é o alvo | REUSAR para o diretor; corrigir alvos | M | |
| RecognizeSheet | features/journey/components/recognize-sheet.tsx:1-83 + recognize-sheet.module.css | BottomSheet com valores e sugestões | gradiente l8,15,21; sombra crua l8; oklch cru l14,18; sugestão 32px l12 | é Lite | RE-SKIN (tirar gradiente dourado) | P | |
| GoalsSection / GoalSheet (meta do mês) | features/team-management-extras/goals-section.tsx:78-99; goal-sheet.tsx:1-85 | card de meta + sheet | Button sm (goals-section l93) | é Lite | ARC Button | P | |
| LiteBrokerProfileActions | features/manager-workspace/manager-lite-profile-actions.tsx:8-49 | desativar, link de senha, editar contato em `<details>` | Button/Input shadcn; `window.confirm` l17,27; `rounded-2xl border bg-card` l32 | é Lite | ARC + sheets de confirmação; base para ações do diretor (soma papel/unidade/excluir) | M | MemberEditSheet |

### 2.3 `/equipe/cargos` (cargos e permissões, só diretor)

- Página: `(d)/equipe/cargos/page.tsx:8-16` (diretor; fora do Lite no plano 2026-10-14, mas entra na conversão do diretor). Loading/erro herdados de `/equipe`.

| Componente | Arquivo:linha | Padrão de UI | Desvios Lite | Lite reusável | Ação | Cx | Depende de |
|---|---|---|---|---|---|---|---|
| CustomRolesWorkspace | (d)/equipe/cargos/workspace.tsx:582-758 | cabeçalho com eyebrow, aviso (Card warning l642), filtro Select (l666), grade de cards de cargo com hover | `GESTÃO DE EQUIPE` uppercase l624; `hover:shadow-md` l707; overlay `shadow-sm` l738; Select | nenhum | NOVO tela Lite (lista de cargos em cards + filtro segmented) | M | LiteSelectSheet |
| PermissionToggle | workspace.tsx:60-95 | switch caseiro | `h-5 w-9` l77 (<44); `ring-offset` l79; `shadow-sm` l86 | `components/arc/switch` | ARC | P | |
| StatusBadge | workspace.tsx:97-105 | badge | n/a | Arc Badge | ARC | P | |
| PermissionRow / PermissionsTab | workspace.tsx:107-208 | lista por categoria com cabeçalho | `text-[10px] font-bold uppercase tracking-wider` l185, l225 | nenhum | RE-SKIN (sentence case, linhas 44px) | M | |
| RouteVisibilityTab | workspace.tsx:210-246 | checklist de rotas | alvos pequenos | LiteCheckRow | NOVO | P | LiteCheckRow |
| IdentidadeTab | workspace.tsx:248-333 | form nome, escopo, status (Select l283) | Select | Arc Input + segmented | ARC | P | |
| MembersTab | workspace.tsx:335-368 | lista de membros do cargo | n/a | people-list | REUSAR | P | |
| RoleEditorDialog | workspace.tsx:370-580 (Dialog l465, Tabs l480-535) | modal com 4 abas | Title Case "Novo Cargo Personalizado" l469; DialogClose `icon-sm` l476; Button sm l556 | BottomSheet + segmented-control | ARC | G | |

### 2.4 `/equipe/convidar`

- Página: `(d)/equipe/convidar/page.tsx:10-52`. Card shadcn (l32) com `TeamInviteSection` (l42). Comentário legado com "GESTAO DE EQUIPE" (l25). Título "Novo Funcionário" (l34, Title Case). Main `bg-background` (l22).

| Componente | Arquivo:linha | Padrão de UI | Desvios Lite | Lite reusável | Ação | Cx | Depende de |
|---|---|---|---|---|---|---|---|
| Card wrapper | convidar/page.tsx:32-48 | Card com título e descrição | Card shadcn; Title Case | página Lite `lite-page` + título `lite-page-title` | RE-SKIN | P | |
| TeamInviteSection | ver 2.1 | | | TeamInviteLiteSheet | REUSAR (aqui como página, sem sheet) | M | 2.1 |

### 2.5 `/equipe/dashboard` (visão geral da equipe)

- Página: `(d)/equipe/dashboard/page.tsx:6` (uma linha). Componente: `features/dashboard/components/domain-dashboard.tsx:5` (título, grade de Cards com número `font-mono`, link "Abrir operação").

| Componente | Arquivo:linha | Padrão de UI | Desvios Lite | Lite reusável | Ação | Cx |
|---|---|---|---|---|---|---|
| DomainDashboard | features/dashboard/components/domain-dashboard.tsx:5 | KPIs genéricos + link | Card shadcn `shadow-none`; link `text-xs` sem alvo | Arc MetricCard; padrão de 4 blocos do Início do gestor | ARC (compartilhado com 2.17) | P |

### 2.6 `/equipe/desempenho` (placar da equipe)

- Página: `(d)/equipe/desempenho/page.tsx:12-23`. **Só supervisor Lite** (l14), atrás de TEAM_RANKING. Já Lite.

| Componente | Arquivo:linha | Padrão de UI | Desvios Lite | Lite reusável | Ação | Cx |
|---|---|---|---|---|---|---|
| TeamStandings | features/journey/components/team-standings.tsx:1-129 + team-standings.module.css | segmented (l42), pódio, lista com barra | gradiente l30-31 do module; oklch cru l34 | é Lite | RE-SKIN module | P |
| Podium | features/journey/components/podium.tsx:1-47 + journey.module.css | pódio com medalhas | cores cruas l12; gradientes e sombras no module (l23-25, 51, 70-71, 77, 83, 107); uppercase l118 | é Lite | RE-SKIN | P |
| Estado vazio | team-standings.tsx:59, 95 | Arc EmptyState | ok | | manter | P |

Para o diretor: hoje não existe; se entrar, precisa de placar entre equipes da unidade escolhida (dependência de escopo, não de visual).

### 2.7 `/equipe/minha` (minha equipe, supervisor)

- Página: `(d)/equipe/minha/page.tsx:9-19` (só supervisor Lite, l11). Loading Lite: `(d)/equipe/minha/loading.tsx:3-16` (arc-venancor + Skeleton shadcn `h-8` l7). Erro inline Lite (l13-15).

| Componente | Arquivo:linha | Padrão de UI | Desvios Lite | Lite reusável | Ação | Cx |
|---|---|---|---|---|---|---|
| MyTeamPage | features/supervisor-workspace/my-team-page.tsx:1-160 + my-team-page.module.css | hero da equipe, segmented Membros/Unidade/Convites (l89), PeopleRows, sheets de ação | Button shadcn sm (l81, l125); module: hsl por equipe l36; `color-mix` ok | é Lite | ARC Button; RE-SKIN hsl | P |
| TeamInviteLiteSheet | features/team/team-invite-lite-sheet.tsx:49-110 | BottomSheet de convite | Button/Input shadcn (l52-107) | é Lite | ARC | P |
| TeamOnDutyList | features/supervisor-workspace/team-on-duty-list.tsx:1-42 | PeopleRows de plantão | Button sm l36 | é Lite | ARC | P |
| PeopleList | components/light/people-list/people-list.tsx + .module.css | lista Lite | segmento 36px (module l26) | é a base | RE-SKIN alvo | P |
| Skeleton (loading) | equipe/minha/loading.tsx:7 | Skeleton shadcn | `h-8` (ok visual) | `components/arc/skeleton` | ARC | P |

### 2.8 `/equipe/minha/configurar`

- Página: `(d)/equipe/minha/configurar/page.tsx:9-15` (supervisor Lite). Erro inline Lite l13 (`font-semibold` ok).

| Componente | Arquivo:linha | Padrão de UI | Desvios Lite | Lite reusável | Ação | Cx |
|---|---|---|---|---|---|---|
| SupervisorTeamSettings | features/supervisor-workspace/team-settings.tsx:1-153 + team-settings.module.css | preview da equipe, foto, nome/descrição (Arc Input/Textarea), ActionButton | gradiente hsl no preview (module l8) e na barra sticky (l46); hsl cru l14; badge 26px l26; Button sm shadcn l121-122 | é Lite | RE-SKIN + ARC Button | P |

### 2.9 `/equipe/plantao` (plantão da equipe)

- Página: `(d)/equipe/plantao/page.tsx:11-25` (supervisor Lite). Erro inline l22 (`rounded-3xl bg-(--surface-muted)`, ok).

| Componente | Arquivo:linha | Padrão de UI | Desvios Lite | Ação | Cx |
|---|---|---|---|---|---|
| TeamOnDutyList | ver 2.7 | | Button sm | ARC | P |

### 2.10 `/equipe/recuperacoes` (pedidos de recuperação de senha, só diretor)

- Página: `(d)/equipe/recuperacoes/page.tsx:12-110`. Loading/erro herdados de `/equipe`.

| Componente | Arquivo:linha | Padrão de UI | Desvios Lite | Lite reusável | Ação | Cx | Depende de |
|---|---|---|---|---|---|---|---|
| Cabeçalho de seção | page.tsx:53-60 | eyebrow + h1 | `SEGURANÇA` caixa alta l54; título "Recuperação de Senha" Title Case l50 | `lite-page-title` | RE-SKIN | P | |
| 3 StatCards | page.tsx:63-91 | KPIs com sparkline | `text-amber-500` l67, `text-emerald-500` l76, `text-red-500` l86 | MetricCard | ARC | P | StatCard |
| Card "Solicitações recebidas" | page.tsx:94-106 | Card | Card shadcn | card Lite | RE-SKIN | P | |
| RecoveryRequestsTable | (d)/equipe/recuperacoes/recovery-requests-table.tsx:48-293 | tabela com Aprovar/Rejeitar/Detalhes | Button sm + `h-8` (l157,160,172,174); `text-red-600` l174 | nenhum (o pedido de senha no Lite é por `manager-lite-profile-actions`) | NOVO lista Lite (PeopleRow com ações) | M | LiteDataList |
| Dialog Rejeitar | recovery-requests-table.tsx:208-262 | modal com Textarea | shadcn | BottomSheet + Arc Textarea | ARC | P | |
| Dialog Detalhes da rejeição | recovery-requests-table.tsx:265-290 | modal informativo | shadcn | BottomSheet | ARC | P | |
| Estado vazio | page.tsx:98-100 (texto na descrição) | sem EmptyState | n/a | Arc EmptyState com mascote | NOVO | P | |

### 2.11 `/equipe/repassar` (repassar lead dentro da equipe)

- Página: `(d)/equipe/repassar/page.tsx:16-42`. Supervisor com escopo de equipe, **qualquer audiência** (não checa Lite): o supervisor no modo normal vê o formulário Lite dentro do chrome normal. Vazio/erro: `notFound()`.

| Componente | Arquivo:linha | Padrão de UI | Desvios Lite | Ação | Cx |
|---|---|---|---|---|---|
| HandoffForm | features/supervisor-workspace/handoff-form.tsx:1-69 + handoff-form.module.css | ChipGroup de corretores (l49), Textarea motivo (l57), enviar (l62) | Button shadcn l7, l62; `oklch` fallback l15 do module | ARC Button | P |

### 2.12 `/equipe/transferencia` (pedir corretor de outra equipe)

- Página: `(d)/equipe/transferencia/page.tsx:8-22` (supervisor Lite, `lite-page`). Já Lite.

| Componente | Arquivo:linha | Padrão de UI | Desvios Lite | Ação | Cx |
|---|---|---|---|---|---|
| TransferRequestForm | features/supervisor-workspace/transfer-request-form.tsx:1-50 | form em card Lite com ChipGroup (l41) e Textarea (l44) | Button shadcn l5, l45; `min-h-5` status l46 (não é alvo) | ARC Button | P |

### 2.13 `/gestao` (gestão da unidade)

- Página: `(d)/gestao/page.tsx:18-58`. Acesso: `features/team-management-ui/access.ts:7-12`; **só gestor Lite (render) e supervisor Lite**; diretor recebe `/access-denied`. Atrás de `feature_team_management_enabled`. Não há versão normal: a tela já é Lite. Sem loading/erro próprios (herda `(d)/loading.tsx` = RouteLoading normal e `(d)/error.tsx` = RouteError normal: desvio).

| Componente | Arquivo:linha | Padrão de UI | Desvios Lite | Lite reusável | Ação | Cx | Depende de |
|---|---|---|---|---|---|---|---|
| UnitOverviewView | features/team-management-ui/unit-overview.tsx:1-155 + unit-overview.module.css | KPIs, "Saúde das equipes" (l135), "Comparar supervisores" (l144), link "Abrir equipe" (l65) | `--shadow-resting` ok; nenhum desvio relevante | é Lite | para o diretor: acrescentar seletor de unidade (segmented/LiteSelectSheet) e liberar `resolveGestaoAccess` | M | LiteSelectSheet, escopo |
| TeamPageViewComponent (supervisor) | features/team-management-ui/team-page-view.tsx:1-144 + .module.css | header, KPIs, "precisa de você", carga | Button shadcn sm l43; Badge sm ok | é Lite | ARC Button | P | |
| WeeklySummaryCard | features/team-management-ui/weekly-summary-card.tsx:1-82 | destaques da semana + Select de corretor + reconhecer | Card shadcn l31; Select shadcn l65; Button shadcn | é Lite com primitivas erradas | ARC + LiteSelectSheet | P | LiteSelectSheet |
| TeamExtrasSection / InsightsSection / GoalsSection / GoalSheet | features/team-management-extras/team-extras-section.tsx:1-25; insights-section.tsx:1-24; goals-section.tsx:22-76; goal-sheet.tsx:1-85 | insights, metas da equipe e por corretor, sheet | Button shadcn sm (goals l37,42,59) | é Lite | ARC Button | P | |
| RecognizeSheet | ver 2.2 | | gradientes | | RE-SKIN | P | |
| Loading/erro | herdados de (d)/loading.tsx e (d)/error.tsx | normal | Card shadcn, sombras | `light-page-skeleton.tsx` | NOVO `gestao/loading.tsx` e `error.tsx` Lite | P | LiteRouteError |

### 2.14 `/gestao/equipes/[supervisorId]` (perfil da equipe)

- Página: `(d)/gestao/equipes/[supervisorId]/page.tsx:12-26`. Mesmo loader (`team-page-loader.ts:52-100`): gestor e supervisor; diretor negado. Sem loading/erro próprios.

| Componente | Arquivo:linha | Desvios | Ação | Cx |
|---|---|---|---|---|
| TeamPageViewComponent | ver 2.13 | Button sm | ARC | P |
| TeamExtrasSection (+Insights, Goals, GoalSheet) | ver 2.13 | Button sm | ARC | P |
| WeeklySummaryCard + RecognizeSheet | ver 2.13 | Card/Select shadcn, gradientes | ARC + RE-SKIN | P |
| Loading/erro | herdados | normal | NOVO Lite (o mesmo de 2.13) | P |

Para o diretor: liberar acesso em `team-page-loader.ts:64` (hoje só manager/supervisor) com escopo de tenant. Sem trabalho visual além do acima.

### 2.15 `/unidades/[branchId]` (perfil da unidade)

- Página: `(d)/unidades/[branchId]/page.tsx:23-147`. **Gestor Lite já usa `ManagerLiteUnitProfile`** (l32-45, somente leitura). Diretor, gestor normal e corretor caem na versão normal (l47-146). Loading: `(d)/unidades/[branchId]/loading.tsx:3-22` já é Lite (arc-venancor, Skeleton shadcn) e aparece também para o diretor no modo normal. Sem error.tsx (herda RouteError normal).
- Lacunas da versão Lite para o diretor: período (PeriodSelect), exportar relatórios, ações na tabela de membros (pausar/retomar corretor), ranking de conversão, botões de gestão da unidade no header.

| Componente | Arquivo:linha | Padrão de UI | Desvios Lite | Lite reusável | Ação | Cx | Depende de |
|---|---|---|---|---|---|---|---|
| Header + PeriodSelect | page.tsx:79; components/period-select.tsx | DashboardHeader com Select | shadcn Select | segmented-control | ARC | P | |
| UnitProfileHeader | features/branches/components/unit-profile-header.tsx:1-93 | voltar + ícone + "UNIDADE" + badges + exportar | caixa alta "UNIDADE" l49; Button sm l34, l84; Badge `h-3 w-3` | header de `manager-lite-unit-profile.tsx:36-60` | REUSAR + ações do diretor | P | |
| UnitReportsExporter | features/branches/components/unit-reports-exporter.tsx:1-209 | Dialog com opções de exportação | Button sm l107; Dialog/Select | nenhum | NOVO BottomSheet Lite | M | LiteSelectSheet |
| UnitMetricsCards | features/branches/components/unit-metrics-cards.tsx:1-81 | StatCards | `text-emerald-500` l41, `text-amber-500` l43, l70 | KPIs de `manager-lite-unit-profile.tsx` | REUSAR | P | StatCard |
| Card "Membros da unidade" + UnitMembersTable | page.tsx:101-113; features/branches/components/unit-members-table.tsx:1-148 | Table com botão pausar/retomar | Button sm + `h-7` (l58, l66); ícone `h-8 w-8` vazio l80 | lista de membros de `manager-lite-unit-profile.tsx` (sem ação) | REUSAR lista + ação pausar em sheet | M | LiteDataList |
| Card "Ranking de conversão" + UnitTopBrokers | page.tsx:118-130; features/branches/components/unit-top-brokers.tsx:1-86 | ranking com posição | círculo `h-5 w-5 text-[10px] font-bold` l63; `text-emerald-500` l74; Button sm l50 | "destaques" de `manager-lite-unit-profile.tsx` | REUSAR | P | |
| Card de leitura do corretor | page.tsx:135-142 | texto | Card shadcn | n/a (corretor nem chega aqui no Lite) | RE-SKIN | P | |
| ManagerLiteUnitProfile (já Lite) | features/branches/components/manager-lite-unit-profile.tsx:1-120 (usa my-team-page.module.css) | resumo da unidade | Button shadcn ghost sm l39 | é o alvo | ARC Button; estender para diretor | M | |
| loading.tsx | unidades/[branchId]/loading.tsx:7-17 | skeleton Lite | Skeleton shadcn | Arc skeleton | manter/ARC | P | |
| error.tsx | não existe | | | | NOVO Lite | P | LiteRouteError |

### 2.16 `/filiais`

- Página: `(d)/filiais/page.tsx:6-12`. **Só redireciona** para `/equipe?visao=unidades` (diretor ou gestor com unidade) ou `/access-denied`. Nenhum componente. Ação: nenhuma visual; a conversão acontece em 2.1b. Cx: P (zero).

### 2.17 `/distribuicao` (central de distribuição)

- Página: `(d)/distribuicao/page.tsx:1-5` **reexporta** `(d)/leads/distribuicao/page.tsx:84-928`. O `layout.tsx` de `/leads/distribuicao` (l4-8, bloqueia gestor) **não vale** para `/distribuicao`: nesta URL o gestor normal entra (página aceita director e manager, l99). Sem loading/erro próprios (herda RouteLoading/RouteError normais).
- Estados: gestor sem unidade (l108-122, DsEmptyState em `bg-ds-canvas-white p-ds-48`); sem unidades (l148-162).
- Abas (`distribution-view-access.ts:1-28`): Resumo, Entradas e regras, Operação, Filas (só diretor), Plantões, Saúde. **Nenhum Lite equivalente existe** (gestor e supervisor Lite não têm distribuição; `/leads/distribuicao` está fora das allowlists em `light-routes.ts`). É a maior rota do grupo.

| Componente | Arquivo:linha | Padrão de UI | Desvios Lite | Lite reusável | Ação | Cx | Depende de |
|---|---|---|---|---|---|---|---|
| Header com contadores | leads/distribuicao/page.tsx:611-628 | DashboardHeader + "disponíveis/aguardando" | `bg-ds-vivid-green` l617 (ds-) | chrome Lite | RE-SKIN | P | chrome |
| DistributionStages | page.tsx:59-82 | lista numerada (guia) | `text-[10px] font-semibold` l73 | expandable-card | RE-SKIN | P | |
| DistributionTabsContainer | leads/distribuicao/_components/distribution-tabs-container.tsx:14-117 | Tabs sublinhadas sticky com 6 abas | gatilho `min-h-10` (40px) l84; `text-xs`; `backdrop-blur` l72 | segmented-control (rolável) | ARC | M | |
| **Aba Resumo:** BrokerDailySummaryPanel | leads/distribuicao/_components/broker-daily-summary-panel.tsx:45-493 | 6 StatCards (l369), Select de unidade (l349), Table de corretores (l388) com AvailabilityToggle (l430) | Button/alvos sm (l256-295, 328, 476); `text-[1xpx]` | nenhum | NOVO lista Lite por corretor + KPIs | G | LiteDataList, LiteSelectSheet, StatCard |
| AvailabilityToggle | components/availability-toggle.tsx:39,51,63 | pílulas | cores cruas + `dark:` | Badge Arc | RE-SKIN | P | |
| **Aba Entradas e regras:** DisqualifiedLeadsRoutingPanel | leads/distribuicao/_components/disqualified-leads-routing-panel.tsx:1-91 | Card + Switch (l66) | Card/Switch shadcn | Arc Switch + card Lite | ARC | P | |
| DddRoutingPanel | leads/distribuicao/_components/ddd-routing-panel.tsx:1-160 | Card + Switch (l91) + Select (l122) | Button sm l149; `text-[10px]` | | ARC | M | LiteSelectSheet |
| RoutingMatrixPanel | leads/distribuicao/_components/routing-matrix-panel.tsx:61-763 | lista de regras + Dialog de regra (l482) com ~22 Selects (l524..) + Switch (l609) | 13 alvos sm (l301-414...); `text-emerald-500` l420; 14 usos `text-[10/11px]` | nenhum | NOVO editor de regra em BottomSheet (passos com stepper) | G | LiteSelectSheet |
| **Aba Operação:** DistributionMetrics | leads/distribuicao/_components/distribution-dashboard.tsx:1-54 | 5 StatCards (l25) | StatCard | MetricCard | ARC | P | StatCard |
| DistributionInbox | leads/distribuicao/_components/distribution-inbox.tsx:344-1189 | Card (l586) + filtros AppSelect (x9, l633) + Table com Checkbox (l746-750) + ações por linha (ActionButton l114, ActionForm l159) + atribuição em lote | `emerald`/`amber` + `dark:` (l139, l612, l718); 9 alvos sm (l249, 601, 610, 638, 662, 839, 884, 927...) | `manager-lead-transfer-form.tsx` (atribuição Lite de um lead) | NOVO inbox Lite (lista + LiteBulkBar + sheet de atribuição) | G | LiteDataList, LiteBulkBar, LiteCheckRow, LiteSelectSheet |
| ManualAssignmentChoiceDialog / ChoiceSubmitForm | distribution-inbox.tsx:231-342 (Dialog l248-290) | modal "Como deseja enviar este lead?" | shadcn | radio-cards em BottomSheet | ARC | P | |
| Dialog "Escolha quais leads arquivar" | distribution-inbox.tsx:~1015-1100 (título l1025) | modal com lista | shadcn | BottomSheet + LiteCheckRow | ARC | M | LiteCheckRow |
| CampaignConflictDialog | distribution-inbox.tsx:1103-1189 (título l1144) | modal de conflito | shadcn | BottomSheet | ARC | P | |
| **Aba Filas (diretor):** ColdLeadRequalificationPanel | leads/distribuicao/_components/cold-lead-requalification-panel.tsx:17-129 | Card + Dialog de confirmação (l116) | Button sm (l87, 98-102) | | ARC | P | |
| QueueControlCenter | leads/distribuicao/_components/queue-control-center.tsx:108-1379 | Card + SectionCardHeader (l481-482), DropdownMenu (l494), QueuesTable (l525), PanelSheet de configurações (l564), QueueDetailSheet (l545), Dialog criar/editar fila (l586-~1120, AppSelect x9, Checkbox x7), Dialog excluir (l1136), Dialog simular (l1256), InfoTooltip (l1053) | 12 cores cruas emerald/amber + 4 `dark:` (l647-779, 1158-1186); 24 usos `text-[10/11px]`; 6 alvos sm (l489, 495, 614, 860, 1010, 1029) | nenhum | NOVO "Filas" Lite: lista de filas + sheet de detalhe + editor em passos | G | todas as primitivas Lite |
| QueuesTable | leads/distribuicao/_components/queues/queues-table.tsx:33-151 | Table + DropdownMenu por linha | Button sm l119 | | NOVO (parte do item acima) | M | LiteDataList |
| QueueDetailSheet / PanelSheet | leads/distribuicao/_components/queues/queue-detail-sheet.tsx:46-181 | Sheet lateral com seções | Button sm l116, l138 | BottomSheet | ARC | M | |
| ColdAgeReleaseSection | leads/distribuicao/_components/queues/cold-age-release-section.tsx:1-55 | Switch + inputs | Button sm l46 | Arc Switch/Input | ARC | P | |
| MetaEntries | leads/distribuicao/_components/queues/meta-entries.tsx:1-71 | lista de entradas Meta | `text-[10/11px]` | | RE-SKIN | P | |
| QueueColorTag | features/lead-distribution/queue-color-tag.tsx:1-40 | etiqueta de cor da fila | cor dinâmica por fila (dado) | Arc Badge com cor de dado | RE-SKIN | P | |
| BrokerAcceptanceSlaPanel (dentro de PanelSheet) | leads/distribuicao/_components/broker-acceptance-sla-panel.tsx:1-156 | presets de minutos + Switch (l79) | Button sm l142; `font-semibold` ok | chip-group (presets) | ARC | P | |
| DistributionPolicyPanel (dentro de PanelSheet) | (d)/settings/_components/distribution-policy-panel.tsx:1-124 | Card + Checkbox (l66) + campos | shadcn | | ARC | M | LiteCheckRow |
| **Aba Plantões:** DutyOperationsWorkspace | leads/distribuicao/plantao/_components/duty-operations-workspace.tsx:1273-1603 | 2 StatCards (l1453), Card (l1462), grade semanal por turno, DutyMonthCalendar (l1501), MonthlyDutyPlanner (l1556), DutyTypesSheet (l1574), DutyInspector (l1575), DutyFormSheet (l1585) | 7 alvos sm (l349, 882, 1017, 1073, 1470, 1473, 1542); `bg-muted/%` x9; `text-[10/11px]` x6 | `features/broker-workspace/components/light-duty-calendar.tsx` (calendário Lite do corretor, só leitura, Arc Calendar l211 + BottomSheet l265) | NOVO workspace de escala Lite (base visual do light-duty-calendar) | G | Arc Calendar, LiteSelectSheet, LiteCheckRow |
| DutyFormSheet | duty-operations-workspace.tsx:185-~720 (Sheet l323-326, AppSelect l338, Checkbox l397) | formulário de plantão (dias, horário, fila, corretores) | Sheet lateral, checkbox, selects | BottomSheet | ARC | G | |
| DutyInspector | duty-operations-workspace.tsx:722-~1270 (SheetTitle l869; Dialogs l1198-1260: escalar fora, arquivar, excluir) | sheet de detalhe + 3 confirmações | toggle de turno `bg-background` l974 | BottomSheet + sheetDanger | ARC | G | |
| StatusBadge (plantão) | duty-operations-workspace.tsx:179-183 | badge | | Arc Badge | ARC | P | |
| DutyMonthCalendar | leads/distribuicao/plantao/_components/duty-month-calendar.tsx:23-161 | grade mensal | `shadow-[inset...]` + `dark:` l98; `text-[1xpx]` x5 | Arc Calendar (`components/arc/calendar/calendar.tsx:105`) | ARC | M | |
| MonthlyDutyPlanner | leads/distribuicao/plantao/_components/monthly-duty-planner.tsx:127-~925 (Sheet l414-417, Stepper l116/l567, SearchAddList l518, Checkbox l488, AppSelect l542, Dialogs: corretor l839, forçar l894, publicar l909) | wizard mensal de escala | 8 alvos sm (l120, 122, 434, 479, 544, 569, 573, 659) | `components/arc/stepper`, `components/arc/slider` | NOVO wizard Lite em BottomSheet de tela cheia | G | LiteCheckRow, LiteSelectSheet |
| EscalaPdfDialog | monthly-duty-planner.tsx:926-977 (DialogTitle l951) | modal gerar PDF | shadcn | BottomSheet + radio-cards | ARC | P | |
| DutyTypeDialog / DutyTypesSheet | leads/distribuicao/plantao/_components/duty-type-ui.tsx:40-191 (Dialog l99), 193-249 (Sheet l214) | CRUD de tipos de plantão | alvos sm l135, l231-232 | BottomSheet | ARC | M | |
| DutyTypeTag | leads/distribuicao/plantao/_components/duty-type-tag.tsx:1-33 | etiqueta | ok | Arc Badge | ARC | P | |
| SearchAddList | components/ui/search-add-list.tsx:88 | busca e adiciona | alvo l88 | search-field | RE-SKIN | P | |
| Link para `/leads/distribuicao/plantao/[scheduleId]` | (rota fora do Grupo B) | | broker-occurrence-card, broker-live-status etc. vivem lá | | registrar dependência com o grupo dono de `/leads/*` | n/a | |
| **Aba Saúde:** Histórico auditável | page.tsx:768-816 | Card + SectionCardHeader + lista + DsEmptyState | 17 usos de tokens `ds-*` (font-ds-inter, text-ds-charcoal, text-ds-fog, gap-ds-*) | thread-row/people-list | RE-SKIN para tokens Arc | M | |
| Automação da fila | page.tsx:819-865 | Card + DsStatusBadge + 3 StatCards | ds-*, `text-destructive` ok | Arc Badge + MetricCard | ARC | P | StatCard |
| Efeitos pendentes + Reprocessar | page.tsx:866-918 | Card + 4 StatCards + lista de falhas + DsOutlinedActionButton | `rounded-ds-cards border-ds-ash bg-ds-paper-mist` l893; botão `!py-ds-4` (<44) l906 | | RE-SKIN + Arc Button | P | |
| Estado "Unidade não definida" | page.tsx:108-122 | DsEmptyState | ds-* | Arc EmptyState + mascote | ARC | P | |
| Loading/erro | herdados | normal | | | NOVO Lite | P | |

### 2.18 `/distribuicao/dashboard`

- Página: `(d)/distribuicao/dashboard/page.tsx:6`. Usa `DomainDashboard` (ver 2.5). Ação: ARC, P. Mesmo componente da 2.5 (converter uma vez).

### 2.19 `/plantoes` (calendário de plantões do corretor)

- Página: `(d)/plantoes/page.tsx:11-24`. **Só corretor no Lite** (l13 notFound para não corretor; l19 redirect se não LIGHT). Diretor nunca vê. Já Lite. Sem loading/erro próprios.

| Componente | Arquivo:linha | Padrão de UI | Desvios Lite | Ação | Cx |
|---|---|---|---|---|---|
| LightDutyCalendar | features/broker-workspace/components/light-duty-calendar.tsx:1-346 (+ light-duty-calendar-motion.module.css) | destaque do próximo plantão, Arc Calendar (l211), lista do dia, BottomSheet de ocorrência (l265), EmptyState (l194) | sombra por token l24 (ok); Arc Button sm = 44px (falsos positivos do scanner) | nenhuma; é referência visual para 2.17 Plantões | P |

### 2.20 `/plantoes/agora` (meu plantão agora)

- Página: `(d)/plantoes/agora/page.tsx:15-65`. **Só corretor** (l17). Já Lite. Estado vazio inline com `style={{}}` e tokens (l37-47).

| Componente | Arquivo:linha | Padrão de UI | Desvios Lite | Ação | Cx |
|---|---|---|---|---|---|
| PresenceCalloutList | components/chat/presence-callout.tsx (+ camera-capture.tsx, assistant-avatar.tsx, light-motion.tsx, chat.module.css) | pedido de presença com foto | chat.module.css: gradientes l200, 230, 279, 332, 347-349, 368, 390; sombras empilhadas l238-240; `.dark` l22, l362; uppercase l444; vários alvos < 44 (l42, 99, 105, 206-212, 263, 269, 286, 292, 324, 332, 430) | RE-SKIN (arquivo compartilhado com o chat inteiro; coordenar com o grupo do chat) | M |
| DutyNowView | features/broker-workspace/components/duty-now-view.tsx:1-193 + duty-now-view.module.css | hero do plantão, progresso, leads do plantão | gradiente no hero (module l9); oklch cru l16, 22, 45, 46; `.choice` 40px l6; `.count` 22px l33 | RE-SKIN | P |
| Estado "não está de plantão" | agora/page.tsx:37-47 | texto + link | link sem alvo de 44px (l44) | RE-SKIN | P |

### 2.21 `/plantoes/corretor/[brokerId]` (plantão de um corretor, visão da gestão)

- Página: `(d)/plantoes/corretor/[brokerId]/page.tsx:14-47`. Diretor, gestor e supervisor, **qualquer audiência**: o diretor no modo normal já vê a tela Lite (`DutyNowView`) dentro do chrome normal. Estado "não está de plantão" inline (l24-33), link sem alvo de 44px (l29). Negado: `notFound()`.

| Componente | Arquivo:linha | Desvios | Lite reusável | Ação | Cx |
|---|---|---|---|---|---|
| DutyNowView | ver 2.20 | gradiente/oklch cru | é Lite | RE-SKIN (o mesmo de 2.20) | P |
| AssistantAvatar | components/chat/assistant-avatar.tsx | ok | é Lite | manter | P |
| Estado idle | page.tsx:24-33 | link pequeno | | RE-SKIN | P |

---

## 3. Resumo por esforço e ordem sugerida

| Rota | Situação hoje | Esforço | Observação |
|---|---|---|---|
| /filiais | redirect | zero | |
| /equipe/minha, /minha/configurar, /plantao, /desempenho, /transferencia, /repassar | já Lite (supervisor) | P (correções transversais) | trocar Button shadcn por Arc, tirar gradientes de team-settings/journey/recognize |
| /plantoes, /plantoes/agora, /plantoes/corretor/[id] | já Lite | P a M | DutyNowView e chat.module.css com gradientes; chat.module.css é compartilhado |
| /gestao, /gestao/equipes/[id] | já Lite (gestor/supervisor); diretor negado | P visual + M escopo | liberar diretor com seletor de unidade; criar loading/erro Lite |
| /equipe/dashboard, /distribuicao/dashboard | normal, 1 componente | P | DomainDashboard compartilhado |
| /equipe/convidar | normal | M | depende do convite Lite do diretor |
| /equipe/recuperacoes | normal | M | lista + 2 sheets |
| /unidades/[id] | Lite do gestor existe | M | estender ManagerLiteUnitProfile (período, exportar, ações) |
| /equipe/[id] | Lite de gestor/supervisor existe | M | estender SupervisorBrokerProfile (não corretores, todos os leads, redistribuições) |
| /equipe (+ visão Unidades) | Lite do gestor existe | G | lote, filtros multiunidade, EditMemberDialog, convite completo, BranchesManager |
| /equipe/cargos | normal | G | editor com 4 abas e matriz de permissões |
| /distribuicao | normal, sem nenhum Lite | G+ (maior do grupo) | 6 abas, ~8.000 linhas somando os componentes; escala mensal e filas são os mais pesados |

**Ordem sugerida**: (1) primitivas Lite que faltam (LiteDataList, LiteSelectSheet, LiteCheckRow, LiteBulkBar, LiteRouteError, LiteStatTile) e chrome do diretor; (2) correções transversais nas telas já Lite; (3) rotas M que reusam Lite existente (/equipe/[id], /unidades/[id], /gestao para diretor); (4) /equipe e convites; (5) /equipe/cargos e /equipe/recuperacoes; (6) /distribuicao por aba (Saúde, Resumo, Operação, Entradas e regras, Filas, Plantões).

**Dependências externas ao Grupo B**: chrome Lite para o diretor (`light-chrome.tsx`, `light-routes.ts` RULES e allowlist de diretor); `/leads/distribuicao/plantao/[scheduleId]` (linkado pela aba Plantões); `components/chat/chat.module.css` (compartilhado com o chat); `manager-lead-transfer-form.tsx` (atribuição Lite de lead, útil para o inbox).

**Riscos notados**: `/distribuicao` não herda o bloqueio de gestor do `leads/distribuicao/layout.tsx`; `/equipe/repassar` e `/plantoes/corretor/[id]` já mostram visual Lite dentro do chrome normal; `/unidades/[id]/loading.tsx` é Lite para todos; `team-invite-form.tsx` é código morto; Arc não tem Table, Select, Checkbox nem Popover.
