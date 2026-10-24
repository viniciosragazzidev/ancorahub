# Inventário Lite, Grupo C (configuração, marketing, ferramentas, rotas públicas)

Repo: `ancorahub-lite-listas` (somente leitura). Caminhos relativos a `src/`. Linhas citadas como `arquivo:linha`.
Levantamento feito por leitura estática: grafo de imports a partir de cada `page/layout/error/loading` (script em `scratchpad/tools/deps.js`, saída em `tools/deps.txt`) e varredura de desvios (`tools/scan.js`, `tools/scan.txt`, `tools/lines.txt`).

## 0. Legenda e premissas

**Desvios** (código curto usado nas tabelas):
- `GRAD` gradiente (`bg-gradient`, `from-/to-`, `linear-gradient`)
- `SOMBRA` qualquer `shadow-*` fora de `shadow-none` e `shadow-(--shadow-resting)`, inclusive `shadow-sm` empilhado em card
- `COR` cor crua de paleta Tailwind (`emerald-500`, `zinc-700`, `slate-*`...), hex ou rgb
- `PESO` peso fora de 400 a 700 (`font-extrabold`, `font-black`, `font-light`)
- `CAIXA` `uppercase` / `tracking-wider` (quebra sentence case)
- `DARK` variantes `dark:`
- `PEQ` alvo abaixo de 44px: `size="sm"` (h-7.5 = 30px), `size="xs"`, `size="icon"` (32px), `icon-sm`, e o próprio **default do shadcn é h-9 (36px)** em `components/ui/button-variants.ts:27`. Ou seja, todo `Button` do shadcn é `PEQ`, mesmo sem `size`.
- `SHADCN` usa primitivos de `components/ui/*` (estética desktop, não tokens Arc)

**Ações**: `RESKIN` (trocar classes por tokens Arc mantendo o componente), `ARC` (trocar pelo componente Arc existente), `LITE-NOVO` (criar componente Lite novo), `LITE-REUSO` (já existe versão Lite, só ligar), `MANTER` (já está Lite ou é redirect).
**Complexidade**: P (até ~2h, poucas classes), M (meio dia a 1 dia, vários subcomponentes), G (mais de 1 dia, editor, wizard ou tela com estado grande).

### 0.1 Primitivos que o Arc NÃO tem e que este grupo exige (dependência bloqueante)
Quase todo componente do grupo usa estes primitivos do shadcn. Sem uma versão Lite deles, a conversão vira re-skin arquivo por arquivo. Recomendo criar estes antes das telas:

| Primitivo shadcn | Uso no grupo | Existe no Arc? | Proposta |
|---|---|---|---|
| `ui/card.tsx` (Card, CardHeader, CardTitle...) | ~70 arquivos | Não (há `expandable-card`, `metric-card`) | LITE-NOVO `arc/panel` (superfície `--surface`, `--radius-panel`, `shadow-(--shadow-resting)` única, título sentence case) |
| `ui/button.tsx` + `button-variants.ts:4,12` (shadow, dark), `:27-35` (h-9, sm 30px, icon 32px) | todos | Sim `arc/button` (sm 44px no escopo Lite, `venancor-scope.css:121`) | ARC. Mapear `outline`→`secondary`, `destructive`→`danger`, `size=sm/icon`→`sm` (44px) |
| `ui/input.tsx:129` (shadow, dark, h pequeno) | ~30 | Sim `arc/input` (exige `label`) | ARC; onde hoje há `Label`+`Input` separados, fundir no `label` do Arc |
| `ui/textarea.tsx:5` (shadow) | ~15 | Sim `arc/textarea` | ARC |
| `ui/switch.tsx:22,30` (shadow, 20px) | ~12 | Sim `arc/switch` | ARC |
| `ui/checkbox.tsx:13` (shadow, dark) | 6 | Não | LITE-NOVO `arc/checkbox` (tokens `--control-*` já existem no escopo) |
| `ui/select.tsx` / `AppSelect` | ~20 | Não (há `radio-cards`, `chip-group`, `segmented-control`) | LITE-NOVO `arc/select` (popover nativo estilizado ou listbox em `bottom-sheet` no mobile) |
| `ui/tabs.tsx:175,220` (shadow) | 7 | Parcial: `arc/segmented-control` | ARC segmented para 2 a 4 abas; LITE-NOVO `arc/tabs` (underline) para 5+ abas |
| `ui/dialog.tsx:49` (shadow) | ~14 | Não (há `bottom-sheet`) | LITE-NOVO `arc/dialog` (desktop) que vira `bottom-sheet` abaixo de 640px |
| `ui/sheet.tsx:56,69` / `ui/drawer.tsx:75` (dark) | ~12 | Parcial: `arc/bottom-sheet` | LITE-NOVO `arc/side-sheet` (lateral desktop) reaproveitando motion do bottom-sheet |
| `ui/table.tsx`, `ui/data-table/*` (paginação `PEQ` em `data-table-pagination.tsx:41-87`) | ~10 | Não | LITE-NOVO `arc/data-list` (tabela no desktop, `PeopleRow`-like no mobile; ver `components/light/people-list/people-list.tsx:118`) |
| `ui/dropdown-menu.tsx:44,162` (shadow), `:72,268` (CAIXA), `:99,115` (DARK) | 4 | Não | LITE-NOVO `arc/menu` |
| `ui/badge.tsx:31-36` (COR + DARK) | ~45 | Sim `arc/badge` (tone neutral/success/info/warning/danger) | ARC, mapear variantes |
| `ui/ds-status-badge.tsx` | 3 | Sim `arc/badge` | ARC |
| `ui/ds-segmented-control.tsx:31,96` (shadow) | 5 | Sim `arc/segmented-control` | ARC |
| `ui/section-card-header.tsx` | 8 | Não | LITE-NOVO (cabeçalho do `arc/panel`) |
| `ui/field.tsx`, `ui/label.tsx` | ~15 | Embutido no `label` dos campos Arc | ARC (remover) |
| `ui/sonner.tsx:45` (shadow) | ~45 (toast) | Não | RESKIN do `Toaster` no escopo Lite (1 lugar) |
| `ui/route-section-tabs.tsx` | 2 cabeçalhos | `arc/segmented-control` | ARC |
| `ui/search-add-list.tsx:88` (PEQ) | 1 | `arc/search-field` + `chip-group` | ARC |
| `ui/stateful-button.tsx` | 1 | `arc/action-button` | ARC |
| `ui/scroll-area.tsx` | 2 | n/a | MANTER (sem estilo visual) |
| `ui/avatar.tsx` | 2 | Sim `arc/avatar` | ARC |
| `ui/separator.tsx` | 3 | n/a | RESKIN (`--border`) |
| `ui/chart.tsx:10,68,194` (DARK, COR, shadow no tooltip) | 1 (sparkline) | Não | RESKIN (ver §0.3) |
| `ui/skeleton.tsx` | via `route-loading`, `empty-state` | Sim `arc/skeleton`, `light/light-page-skeleton.tsx:12` | LITE-REUSO |

### 0.2 Cromo compartilhado (aparece em quase toda rota do grupo)
| Componente | Desvios | Ação | Cx | Observação |
|---|---|---|---|---|
| `components/dashboard-header.tsx` (66 l.) e filhos: `theme-toggle.tsx` (tema escuro!), `global-search.tsx:104,114`, `notification-popover.tsx:129,145,161-267`, `experience-mode-toggle.tsx:76,168`, `motion/animated-page-title.tsx` | SOMBRA, CAIXA, DARK, PEQ | Trocar por `components/light/light-app-header.tsx` no modo Lite do diretor; remover `ThemeToggle` (regra sem tema escuro) | M | Provavelmente coberto pelo inventário do shell; aqui só como dependência de todas as páginas com `DashboardHeader` |
| `components/related-actions.tsx:36` (CAIXA), `:51` (PEQ) | CAIXA, PEQ | RESKIN para lista de links estilo `light-settings.tsx:53-65` | P | usado em `settings/page.tsx:181`, `marketing/campanhas/page.tsx`, `guia/page.tsx` |
| `components/route-error.tsx:74,82` (SOMBRA) | SOMBRA, SHADCN | RESKIN + `arc/empty-state` | P | 4 boundaries do grupo |
| `components/route-not-found.tsx:50` | SOMBRA | RESKIN + `arc/empty-state` | P | |
| `components/route-loading.tsx:12,13` | PEQ, SHADCN | LITE-REUSO `light/light-page-skeleton.tsx` | P | `settings/loading.tsx`, `integrations/loading.tsx`, `qualificacao/loading.tsx` |
| `components/foundations/confirm-dialog.tsx:64,75,78` | PEQ, SOMBRA | Depende do `arc/dialog` | P | |
| `components/dashboard/metric-card.tsx` (`StatCard`) `:106` + `mini-donut.tsx` (svg) + `metric-sparkline.tsx` (recharts) + `motion/count-up.tsx` | PEQ, COR via `iconClassName` dos chamadores | ARC `arc/metric-card` + `arc/animated-counter` | M | sparkline e donut precisam de tema (§0.3) |
| `components/empty-state.tsx` | SHADCN | ARC `arc/empty-state` | P | |

### 0.3 Terceiros com estilo próprio e como tematizar
| Lib | Onde no grupo | Como tematizar no Lite |
|---|---|---|
| **@xyflow / react-flow** | **Não existe no repo.** O "editor visual de fluxo" é canvas próprio em `features/workflow-automation/components/workflow-automation-studio.tsx` (1134 l., zoom/pan/drag em `:218-373`), e está **órfão** (nenhuma rota importa). A rota `/fluxos-whatsapp` renderiza só `whatsapp-flows-client.tsx` (lista + diálogo) | Se o studio for religado: nós como `arc/panel`, arestas SVG com `stroke: var(--border-strong)`, seleção `var(--accent)`, fundo pontilhado com `--neutral-3`, sem sombras (`:591,625,753,822,875,887,934`) e sem gradiente (`:679`) |
| **recharts 3.8** | `components/dashboard/metric-sparkline.tsx:4` via `ui/chart.tsx` | Passar `config` com `color: var(--accent)`; trocar `ChartTooltip` (`ui/chart.tsx:194` shadow) por tooltip Lite; remover o bloco de tema escuro de `ui/chart.tsx:10` dentro do escopo |
| **motion/react 12** | `welcome-screen.tsx`, `commission-rules-manager.tsx:5`, `compartilhado/[token]/page.tsx:14`, `whatsapp-pairing-panel.tsx:4`, `notification-popover.tsx:7`, `push-notification-manager.tsx:4`, `internal/design-system/motion` | Usar `components/arc/motion-tokens.ts` e `components/light/light-motion.tsx`; respeitar `useReducedMotion` |
| **sonner** | ~45 arquivos (`toast`) | 1 RESKIN no `Toaster` Lite (`ui/sonner.tsx:45` shadow) |
| **react-day-picker 10** | Não usado nas rotas do grupo | `arc/calendar` e `arc/date-picker` já existem se precisar |
| **@dnd-kit** | Não usado nas rotas do grupo (o reordenar do `flow-editor` é por botões) | n/a |
| **QR code (img)** | `whatsapp-pairing-panel.tsx:239` (`bg-white` atrás do QR), `tenant-channel-card.tsx`, `waha-connections-card.tsx:195,203` | Manter fundo branco do QR (necessário para leitura), mas via `var(--surface)` e sem `shadow-md` |
| **Embedded Signup da Meta (SDK FB)** | `meta-embedded-signup-card.tsx` | O popup é da Meta, não tematizável; só o card de disparo |

---

## 1. `/settings` (Parâmetros do Sistema, diretor)

Página: `app/(dashboard)/settings/page.tsx` (196 l.). O diretor cai no ramo desktop (`:163-194`): `DashboardHeader` + `SettingsTabs` + `RelatedActions`. As abas do diretor (`:67`): conta, empresa, unidade, atendimento, whatsapp, integracoes, seguranca, extensao.
Já existe a **casca Lite** `app/(dashboard)/settings/_components/light-settings.tsx` (lista de seções em `arc-venancor`, `:49-68`) usada por corretor (`:144`) e gestor (`:108`). Caminho natural: o diretor também usar `LightSettings` com as 8 seções acima (a estrutura `?tab=` já é a mesma).

| Componente (arquivo:linha) | Padrão de UI | Desvios | Lite reaproveitável | Ação | Cx | Dependências |
|---|---|---|---|---|---|---|
| `settings/page.tsx:165-192` ramo diretor | Header + grid de abas + ações relacionadas | SHADCN (Card/Button no `whatsapp` inline `:86`), SOMBRA `:120` (`shadow-(--shadow-resting)` ok) | `light-settings.tsx` | LITE-REUSO: montar `sections` do diretor e renderizar `LightSettings` | M | `LightSettings`, todas as abas abaixo |
| `_components/settings-tabs.tsx:68-112` | Nav lateral (desktop) + scroll horizontal (mobile) com `Button ghost` | SHADCN, PEQ no desktop `:92` (sem min-h), `font-semibold` ok | `light-settings.tsx` (lista) | Substituído pelo `LightSettings` (manter só se quiser abas no desktop largo: virar `arc/tabs`) | P | |
| `_components/light-settings.tsx` + `.module.css` | Lista de seções em card único, entrada CSS | Já Lite | Ele mesmo | MANTER | - | |
| `_components/minha-conta-tab.tsx:30` → `features/user-profile/components/perfil-tabs.tsx` (111 l., `:75` SOMBRA) | Abas internas do perfil | SOMBRA, SHADCN | parcial: `features/manager-workspace/manager-lite-profile-actions.tsx` | RESKIN + `arc/segmented-control` | M | filhos abaixo |
| ↳ `user-profile/components/profile-header.tsx:28,49` | Card com avatar, nome, badges de papel e disponibilidade | SOMBRA ×2, SHADCN Avatar | `arc/avatar`, `manager-lite-settings-parts.tsx` (header) | ARC avatar + RESKIN | P | `components/status-badges.tsx` (44 badges `PEQ` em `:22-71`), `components/motion/animated-badge.tsx:52,53` (COR, DARK), `components/availability-toggle.tsx:39,51,63` (COR, DARK) |
| ↳ `user-profile/components/personal-data-section.tsx:108` | Formulário (nome, telefone, avatar upload) | SOMBRA, SHADCN Field/Input | `arc/input`, `arc/avatar` | ARC | M | upload de avatar (`AvatarUpload` local) |
| ↳ `user-profile/components/security-summary-section.tsx:94` | Form troca de senha + status 2FA | COR `emerald-500` | `arc/password-field` | ARC | P | |
| ↳ `user-profile/components/sessions-section.tsx:89,112,125` | Lista de sessões com "encerrar" | COR, PEQ | `PeopleRow` | RESKIN | P | |
| ↳ `user-profile/components/activity-log-section.tsx` | Lista de atividades | SHADCN | `PeopleRow` / lista simples | RESKIN | P | |
| ↳ `_components/account-tab.tsx` (18 l.) | Card info simples | SHADCN | `arc/panel` | RESKIN | P | |
| `_components/empresa-tab.tsx` (85 l.) | Form: nome, razão social, CNPJ, logo, cor | SHADCN Field/Input/Button | `arc/input` | ARC | P | `color-picker.tsx`, `logo-upload.tsx` |
| ↳ `_components/color-picker.tsx:6-11,21` (hex de presets), `:36` SOMBRA | Paleta de swatches | COR (hex é dado do usuário, legítimo), SOMBRA | `arc/chip-group` como base | RESKIN (manter hex como valor, tirar sombra, swatch 44px) | P | |
| ↳ `_components/logo-upload.tsx` (90 l.) | Upload com preview `img` | inputs crus | `arc/file-dropzone` | ARC | P | |
| `_components/unit-tab.tsx:110` | Card da unidade com badges de status | PEQ, SHADCN | `manager-lite-settings-parts.tsx` (`ManagerLiteUnitSection`) | LITE-REUSO (já mostra a mesma unidade no gestor) | P | |
| `_components/feedback-tab.tsx` (202 l.) | Form de parâmetros de feedback (intervalo, tentativas, toggles) | SHADCN Field/Input | `arc/input`, `arc/switch`, `arc/slider` | ARC | M | |
| `features/conversation-intelligence/components/ai-stage-mode-card.tsx` (91 l.) | Card com opções de modo da IA | SHADCN Card/SectionCardHeader | `arc/radio-cards` | ARC | P | |
| whatsapp inline `settings/page.tsx:86` | Card + link para `/integrations/whatsapp` | SHADCN, PEQ | `_components/light-whatsapp-section.tsx` (Lite, usa `ConnectionBadge`) | LITE-REUSO | P | |
| `_components/light-whatsapp-section.tsx:12` | Card Lite com status do WhatsApp pessoal | Já Lite | Ele mesmo | MANTER | - | `features/broker-workspace/components/connection-badge.tsx:126,175` (PEQ) → `components/whatsapp/whatsapp-connect-dialog.tsx` (773 l., PEQ `:728-738`, SHADCN Dialog) → `whatsapp-pairing-panel.tsx` (537 l., COR `:239`, DARK `:466`, PEQ `:268-413`) |
| `_components/integrations-tab.tsx` (383 l.) | Lista de integrações webhook por unidade + Tabs + `CreateIntegrationDialog` + `HelpIntegrationDialog` | COR `:206,207,230,231,349-354`, DARK `:207,231`, PEQ ×12 (`:180-272`), SHADCN Tabs/Dialog/Select | nenhuma | LITE-NOVO (lista Lite + `arc/dialog`) | M | `arc/dialog`, `arc/select`, `arc/tabs` |
| `_components/security-tab.tsx` (128 l.) | 2FA: QR, segredo, código; seção passkey | COR `:86,101`, CAIXA `:104`, PEQ `:104,105` | `arc/input`, `arc/stepper` | RESKIN + ARC | M | `passkey-section.tsx` |
| ↳ `_components/passkey-section.tsx` (348 l.) | Hero + lista de chaves + renomear/excluir | **GRAD `:132`**, SOMBRA `:132,162,217,252`, CAIXA `:231`, COR/DARK `:298`, PEQ ×11 | nenhuma | LITE-NOVO (lista + ações 44px) | M | `arc/dialog` (confirm usa `window.confirm`) |
| `extension/extension-tab.tsx` (54 l.) | Card com passos + ajuda + conectar | SHADCN | `arc/panel` | RESKIN | P | `extension-help-dialog.tsx:19` (PEQ, Dialog), `extension-connect-card.tsx` (Button) |
| `features/assist/components/accessibility-preferences.tsx` | Switches Arc | Já Lite (usado só no Lite hoje) | Ele mesmo | LITE-REUSO (adicionar seção para o diretor) | P | |
| `features/notifications/components/push-notification-manager.tsx` (337 l.) | Card de push com estados, `variant="compact"` | PEQ ×12 (`:194-284`), SHADCN | modo `compact` usado no Lite gestor (`settings/page.tsx:120`) | RESKIN do modo compact | M | |
| **Ramos não-diretor já Lite** (`settings/page.tsx:41-161`): `SupervisorLiteSettings` (`features/supervisor-workspace/supervisor-lite-settings.tsx:15,19,26` sombras arbitrárias `shadow-[...]`), `ManagerLiteSettings*` (`features/manager-workspace/manager-lite-settings-parts.tsx:64` hex `#e7f6ec #166534`), `LightAvailabilitySection` (`:150` `shadow-(--shadow-floating)`), `RankingPreferences` | Lite | pequenos resíduos de COR/SOMBRA | Eles mesmos | RESKIN pontual (hex → `--success`, sombras arbitrárias → `--shadow-resting`) | P | `components/chat/tour/lite-tour.tsx:389,581` |
| `features/broker-availability/components/broker-availability-settings.tsx` + `broker-availability-schedule-editor.tsx:77-103` | Editor de janelas (só corretor desktop) | PEQ, SOMBRA | `light-availability-section.tsx` | LITE-REUSO (fora do diretor) | P | |

**Órfãos em `_components`** (não renderizados por nenhuma rota): `ai-settings-tab.tsx` (297 l., COR/DARK `:289`) e `waha-connections-card.tsx` (395 l., SOMBRA `:172,195`, COR/DARK `:324,333`, PEQ ×9). `distribution-policy-panel.tsx` é usado em `leads/distribuicao/page.tsx` (outro grupo). Sugestão: não converter órfãos; arquivar.

### 1.1 `/settings/extension`
`settings/extension/page.tsx:14`: `DashboardHeader` + `Card` + `ExtensionConnectCard`. Mesmos componentes da aba extensão. Ação: RESKIN, P. Pode virar redirect para `/settings?tab=extensao`.

### 1.2 `/settings/feedback-templates`
| Componente | Padrão | Desvios | Lite | Ação | Cx | Deps |
|---|---|---|---|---|---|---|
| `settings/feedback-templates/page.tsx:14,23` | Header + client | via filhos | | | | |
| `settings/feedback-templates/client.tsx` (275 l.) | CRUD de checklists: lista de cards, form inline com itens dinâmicos | PEQ ×5 (`:133,152,172,232,246`), SHADCN Card/Input/Label/Badge | `arc/input`, `arc/expandable-card` | ARC + LITE-NOVO lista | M | `arc/panel` |

### 1.3 Redirects
`settings/integrations/page.tsx:6` → `/integrations`; `settings/meta/page.tsx:6` → `/integrations/meta`; `settings/whatsapp/page.tsx:4` → `/integrations/whatsapp`. MANTER.

### 1.4 `/settings/waha-diagnostic`
`settings/waha-diagnostic/page.tsx` (120 l.): página de diagnóstico técnico (lista de checagens, `bg-emerald-500` em `:53`, Button). RESKIN P (`--success`).

---

## 2. `/configuracoes/comissoes`
Página `app/(dashboard)/configuracoes/comissoes/page.tsx:22-38`.

| Componente | Padrão | Desvios | Lite | Ação | Cx | Deps |
|---|---|---|---|---|---|---|
| `features/commissions/components/commission-rules-manager.tsx` (585 l.) | Form longo de regra (operadora, percentuais, vigência) + lista de `CommissionRuleCard` animados (motion) + feedback inline | CAIXA `:223`, SOMBRA `:349,471`, PEQ ×11 (`:160-380`), SHADCN Input/Label/Card | `arc/input`, `arc/expandable-card`, `arc/badge` | LITE-NOVO (form em `arc/side-sheet`, lista com expandable-card) | G | `arc/select` (operadora), `arc/side-sheet` |
| `features/post-sale/components/post-sale-settings.tsx` (69 l.) | Card com checkbox + input numérico | SHADCN Checkbox/Input | `arc/switch`, `arc/input` | ARC | P | `arc/checkbox` ou trocar por switch |

---

## 3. `/integrations` (catálogo, Meta, WhatsApp)
`integrations/layout.tsx:6` bloqueia gestor. `integrations/loading.tsx:4` → `RouteLoading` (LITE-REUSO skeleton).

### 3.1 `/integrations` (catálogo)
| Componente | Padrão | Desvios | Lite | Ação | Cx | Deps |
|---|---|---|---|---|---|---|
| `integrations/page.tsx:14,16` | Header + catálogo | | | | | |
| `features/communication-channels/components/integrations-catalog.tsx` (111 l.) | Grid de tiles com ilustração voxel, status, link | SOMBRA `:57,85`, SHADCN Card/Badge | `arc/expandable-card` ou lista Lite | RESKIN | P | `components/illustrations/voxel-illustration.tsx:25` (DARK; ilustrações 3D são o padrão aprovado de aviso, manter imagem) |

### 3.2 `/integrations/meta`
| Componente | Padrão | Desvios | Lite | Ação | Cx | Deps |
|---|---|---|---|---|---|---|
| `integrations/meta/page.tsx:28-30` | Header + hub | | | | | |
| `communication-channels/components/meta-integration-hub.tsx` (28 l.) | Card container | SHADCN | `arc/panel` | RESKIN | P | |
| `meta-ads/components/meta-integration-view.tsx` (384 l.) | Status da conexão, hierarquia de ativos (BM > contas > páginas > formulários) em `details`, métricas, diálogo de desconectar | CAIXA `:245,279,305`, SHADCN Dialog/Card | `arc/expandable-card`, `arc/metric-card` | LITE-NOVO | G | `meta-asset-paging.tsx:49,53` (PEQ), `meta-sync-badge.tsx` (Badge+`details`), `meta-marketing-wizard.tsx` |
| `meta-ads/components/meta-marketing-wizard.tsx` (634 l.) | Wizard multi-etapa em Dialog: intro, permissões (checkbox), seleção de ativos, próximo passo, loader | PEQ `:403,417`, SHADCN Dialog/Checkbox | `arc/stepper`, `arc/radio-cards` | LITE-NOVO (wizard em tela cheia/bottom-sheet com `arc/stepper`) | G | `meta-assets-modal.tsx:35` (COR, PEQ, Dialog), `arc/dialog` |
| `meta-ads/components/meta-conversions-card.tsx` (144 l.) | Form CAPI: switch, select de evento, input token, contadores | SHADCN ×8 | `arc/switch`, `arc/input` | ARC | M | `arc/select` |

### 3.3 `/integrations/whatsapp` (3 visões por `?visao=`)
`integrations/whatsapp/page.tsx`: `visao=diretoria` (`:20-25`), `visao=materiais` (`:28-33`), padrão oficial Meta (`:82-88`).

| Componente | Padrão | Desvios | Lite | Ação | Cx | Deps |
|---|---|---|---|---|---|---|
| `integrations/whatsapp/whatsapp-integration-heading.tsx:12` | `RouteSectionTabs` (oficial, diretoria, materiais) | SHADCN | `arc/segmented-control` | ARC | P | |
| **Visão oficial** `settings/whatsapp-page.tsx` (187 l.) | Tabs internas, cards de status e setup | SHADCN Tabs/Card/Badge | | RESKIN | M | filhos abaixo |
| ↳ `communication-channels/components/meta-cloud-setup-card.tsx` (111 l.) | Detalhes do número (qualidade, limite, token), dialog de ação | COR `amber-800` `:38-46`, CAIXA `:98`, PEQ `:102` | `arc/badge tone=warning` | RESKIN | P | `arc/dialog` |
| ↳ `meta-embedded-signup-card.tsx` (181 l.) | Card que dispara o SDK da Meta | SHADCN | `arc/panel` + `arc/button` | RESKIN | P | SDK FB (não tematizável) |
| ↳ `coexistence-numbers-card.tsx` (177 l.) | Lista de números + `LeadIntakeSheet` (Sheet com select de fila, switch) | PEQ `:148,149`, SHADCN ×7 | `arc/switch` | LITE-NOVO sheet | M | `arc/side-sheet`, `arc/select` |
| ↳ `whatsapp-test-message-card.tsx` (151 l.) | Form envio de teste (select, input, textarea) + resultado | COR `:121,129`, PEQ `:110` | `arc/input`, `arc/textarea` | ARC | P | `arc/select` (também usado em `/qualificacao`) |
| **Visão diretoria** `integrations/whatsapp/director-whatsapp-view.tsx:55-58` | Canal da empresa + avisos da equipe | | | | | |
| ↳ `integrations/whats_alt/_components/tenant-channel-card.tsx` (269 l.) | Conexão WAHA: QR/código de pareamento, status | SOMBRA `:198`, PEQ ×6 (`:224-260`) | `whatsapp-pairing-panel` (compartilhado com Lite corretor) | RESKIN | M | `components/whatsapp/whatsapp-pairing-panel.tsx` |
| ↳ `whats_alt/_components/team-notices-card.tsx` (294 l.) | Lista de avisos com switch, `NoticeTextsSheet` (editor de textos/variantes), `SearchAddList` | PEQ `:91,236`, SHADCN Sheet/Select/Switch | `arc/switch`, `arc/search-field`, `arc/chip-group` | LITE-NOVO sheet | M | `arc/side-sheet`, `arc/select` |
| ↳ `whats_alt/_components/tenant-channel-routing-card.tsx` (178 l.) | Regras de roteamento (select por evento) | SOMBRA `:67,135`, PEQ `:128,145` | | Órfão: não converter | - | ver nota |
| **Visão materiais** `integrations/whatsapp/materials-whatsapp-view.tsx` (152 l.) | Canal + grupos capturados + card de histórico | SOMBRA `:83,104,124` | | RESKIN | P | `tenant-channel-card`, `material-groups-card` |
| ↳ `whats_alt/_components/material-groups-card.tsx` (164 l.) | Tabela de grupos com input de filtro e ações | SOMBRA `:84`, PEQ `:94,117,144`, SHADCN Table | `arc/search-field` | LITE-NOVO lista | M | `arc/data-list` |
| `integrations/whatsapp/_components/template-builder-wizard.tsx` (371 l.) | Dialog wizard de template Meta (categoria, corpo, variáveis) + **preview em bolha de WhatsApp** | COR `:309` (`bg-emerald-950`), CAIXA `:310`, SOMBRA `:311`, COR/DARK `:321,339`, PEQ `:226,351-361` | `components/chat/chat-blocks.tsx` (bolhas Lite) | LITE-NOVO (wizard com `arc/stepper`, preview usando bolha do chat Lite) | G | `arc/dialog`, `arc/select`, `arc/textarea`. Renderizado por `/atendimento/mensagens` (`messages-workspace.tsx:216`) |

Nota: `tenant-channel-routing-card.tsx` é órfão confirmado (nenhum import fora do próprio arquivo). Não converter.
`/integrations/whats_alt` (`whats_alt/page.tsx:5`) é redirect para `?visao=diretoria`. MANTER.

---

## 4. `/marketing`
`marketing/layout.tsx:6` bloqueia gestor. `marketing/page.tsx:4` e `marketing/meta/page.tsx:4` redirecionam para `/marketing/campanhas`. MANTER.

### 4.1 `/marketing/campanhas`
| Componente | Padrão | Desvios | Lite | Ação | Cx | Deps |
|---|---|---|---|---|---|---|
| `marketing/campanhas/page.tsx:36-60` | Header + badge de sync + controles + dashboard + RelatedActions | SHADCN Badge | | | | |
| `meta-ads/components/meta-sync-badge.tsx` | Badge com `details` do erro | SHADCN | `arc/badge` | ARC | P | |
| `meta-ads/components/meta-capture-controls.tsx` (95 l.) | Card "captura mestre": AppSelect + botão ligar | COR `:85` (`bg-emerald-600 text-white`), PEQ `:81,85` | `arc/switch`, `arc/button` | ARC | P | `arc/select` |
| `meta-ads/components/campaigns-dashboard-view.tsx` (338 l.) | KPIs (cards de totais) + busca + **tabela de campanhas** com estado de entrega, CPL, ROI | COR `:74,136,239`, DARK `:99,136,239`, PEQ `:84,112,188,250` | `arc/metric-card`, `arc/search-field` | LITE-NOVO (KPIs Arc + `arc/data-list`) | G | `arc/data-list` |

### 4.2 `/marketing/campanhas/[id]`
| Componente | Padrão | Desvios | Lite | Ação | Cx | Deps |
|---|---|---|---|---|---|---|
| `marketing/campanhas/[id]/page.tsx:204-206` | Header + detalhe | | | | | |
| `marketing/campanhas/[id]/error.tsx:13` | `RouteError` | ver §0.2 | | RESKIN | P | |
| `meta-ads/components/campaign-detail-view.tsx` (382 l.) | Título, card "Fila de distribuição" (Switch + AppSelect), tabela de anúncios, tabela de formulários, parâmetros, **funil comercial** (barras) | SOMBRA `:174`, CAIXA `:206`, COR `:221`, DARK `:237`, PEQ ×6 | `arc/switch`, `arc/metric-card` | LITE-NOVO | G | `arc/data-list`, `arc/select`; funil em barras CSS: usar `--accent` e `--neutral-3` |

### 4.3 `/marketing/importacoes`
| Componente | Padrão | Desvios | Lite | Ação | Cx | Deps |
|---|---|---|---|---|---|---|
| `marketing/importacoes/page.tsx:31-41` | Header + client | | | | | |
| `marketing/importacoes/_components/marketing-import-client.tsx` (340 l.) | **Upload drag-and-drop** de planilha em Drawer lateral (`:101`), select de unidade, card de importação, histórico com `details`, contadores coloridos | COR ×11 (`:83-85,200-227,316-322`), SOMBRA `:192`, CAIXA `:262`, PEQ `:109,132,145,301` | `arc/file-dropzone` | ARC (dropzone) + LITE-NOVO (histórico) | M | `arc/side-sheet`, `arc/select`, `arc/badge` (tons success/warning/danger no lugar de emerald/amber/red) |

---

## 5. `/qualificacao`
`qualificacao/layout.tsx:6` bloqueia gestor; `error.tsx:7` `RouteError`; `loading.tsx` `RouteLoading`.

### 5.1 `/qualificacao` (hub com 5 abas)
Página `qualificacao/page.tsx:105` → `qualificacao/_components/qualification-hub-client.tsx` (1096 l.). Cabeçalho próprio `:519-538` com `DashboardHeader` + botões `size="sm"` + badge com `bg-emerald-500 animate-pulse` (`:529`). Abas sticky underline `:541-563`: `overview` (`:567`), `whatsapp_diag` (`:719`), `agent_triggers` (`:780`), `followup_rules` (`:849`), `simulator` (`:981`).

| Componente | Padrão | Desvios | Lite | Ação | Cx | Deps |
|---|---|---|---|---|---|---|
| `qualification-hub-client.tsx` casca + abas `:541-563` | Tabs underline sticky, `text-xs`, `min-h-10` (40px) | PEQ (abas 40px, botões `:524,533`), COR `:529` | `arc/tabs` (novo) ou `arc/segmented-control` com scroll | LITE-NOVO abas | G (arquivo grande, convém quebrar por aba) | `arc/tabs` |
| aba overview `:567-718` | 5 `StatCard` com cores por ícone (`:570-574`: amber, violet, emerald, sky), card status, identidade do assistente (form), toggles | COR ×5, DARK `:618`, color swatch `:597` (`bg-white border-gray-300`) | `arc/metric-card` | ARC + RESKIN | M | `components/dashboard/metric-card.tsx` |
| aba whatsapp_diag `:719-779` | Lista de checagens + `WhatsAppTestMessageCard` | COR `:726,735,759` | ver §3.3 | RESKIN | P | |
| aba agent_triggers `:780-848` | `AgentTriggersPanel` + `AgentTrainingTab` + tabela (`DataTableFrame` `:794`) | COR `:786` | | | | |
| ↳ `qualificacao/_components/agent-triggers-panel.tsx` (386 l.) | Lista de gatilhos com badges coloridos por tipo, Dialog de edição (form com select, textarea, switch) | COR ×13 (`:143-149,161-170,186,221,246,280`), DARK ×7, CAIXA `:185,218,245,280`, PEQ ×8 | `arc/badge` (tons), `arc/switch` | LITE-NOVO | G | `arc/dialog`, `arc/select` |
| ↳ `settings/_components/agent-training-tab.tsx` (240 l.) | Form de treinamento (exemplos, checkbox, select) | PEQ `:204,213,222`, SHADCN ×8 | `arc/input`, `arc/textarea` | ARC | M | `arc/checkbox`, `arc/select` |
| aba followup_rules `:849-980` | Form inline `:863` (`bg-muted/20`) + lista de regras | CAIXA `:864`, COR `:854,925`, PEQ | `arc/expandable-card` | LITE-NOVO | M | `arc/select`. Obs.: `features/ai-qualification/components/followup-rules-panel.tsx` existe mas está órfão (lógica duplicada inline) |
| aba simulator `:981-1095` | Chat simulado (bolhas, form de envio `:1063`) | CAIXA `:1076`, PEQ | `components/chat/chat-screen.tsx`, `chat-blocks.tsx`, `composer.tsx` | LITE-REUSO (bolhas e composer do chat Lite) | M | |
| `features/ai-qualification/components/bulk-qualification-dialog.tsx` (201 l.) | Dialog: select de filtro, contagem, botão verde | COR `:91,103,163,182` (`bg-emerald-600 text-white`), DARK `:163`, PEQ ×4 | `arc/button`, `arc/radio-cards` | LITE-NOVO | M | `arc/dialog` |
| `components/dashboard/data-table/data-table-frame` + `ui/table` `:794-843` | Tabela compacta (`density="compact"`) | PEQ | | LITE-NOVO | P | `arc/data-list` |

### 5.2 `/qualificacao/turbo`
| Componente | Padrão | Desvios | Lite | Ação | Cx | Deps |
|---|---|---|---|---|---|---|
| `qualificacao/turbo/page.tsx:18-20` | Header + admin | | | | | |
| `features/qualification-turbo/components/turbo-admin.tsx` (209 l.) | Card com `<table>` crua (`:163`) de categorias + `SettingsSheet` (Sheet com switches e inputs, `SettingRow`) | PEQ `:70,151`, SHADCN ×8 | `arc/switch`, `arc/input` | LITE-NOVO (lista + side-sheet) | M | `arc/side-sheet`, `arc/data-list` |

---

## 6. `/atendimento`
`atendimento/page.tsx:5` redireciona para `/atendimento/situacoes`. Cabeçalho comum `atendimento/_components/atendimento-heading.tsx:12` (`RouteSectionTabs`: situações, mensagens, fluxo) → ARC `segmented-control`, P.

### 6.1 `/atendimento/situacoes`
| Componente | Padrão | Desvios | Lite | Ação | Cx | Deps |
|---|---|---|---|---|---|---|
| `atendimento/situacoes/page.tsx:33-36` | Header + heading + workspace | | | | | |
| `situacoes/_components/situations-workspace.tsx` (260 l.) | `SectionCardHeader` (`:202`) + `DsSegmentedControl` (situações / sugestões) + **DataTable** com colunas ordenáveis (`:43-152`) + dropdown de filtros + `PhraseTester` (input de teste) | PEQ `:209,222`, SHADCN ×9 | `arc/segmented-control`, `arc/search-field` | LITE-NOVO | G | `arc/data-list`, `arc/menu` |
| `situacoes/_components/situation-drawer.tsx` (278 l.) | Sheet lateral de edição: `BuiltinBody`/`CustomBody`/`GuidedBody`, `PhraseEditor`, `ReplyEditor`, `ChannelSection`, `window.confirm` | PEQ `:55,87,182`, SHADCN Sheet/Select/Switch | `arc/textarea`, `arc/chip-group` (frases), `arc/switch` | LITE-NOVO | G | `arc/side-sheet`, `arc/select`, `arc/dialog` (no lugar do confirm) |
| `situacoes/_components/suggestion-drawer.tsx` (171 l.) | Sheet: evidências, criar nova ou mesclar (select) | PEQ `:81`, SHADCN | | LITE-NOVO | M | `arc/side-sheet`, `arc/select` |

### 6.2 `/atendimento/mensagens`
| Componente | Padrão | Desvios | Lite | Ação | Cx | Deps |
|---|---|---|---|---|---|---|
| `atendimento/mensagens/page.tsx:26-29` | Header + heading + workspace | | | | | |
| `mensagens/_components/messages-workspace.tsx` (220 l.) | `SectionCardHeader` + `ChannelChips` + segmented + DataTable (`:54-82`) + dropdown "novo" + Sheet com `MessagePoliciesPanel` (`:200-205`) + `TemplateBuilderWizard` (`:216`) | PEQ `:133,148`, SHADCN ×9 | `arc/chip-group`, `arc/segmented-control` | LITE-NOVO | G | `arc/data-list`, `arc/menu`, `arc/side-sheet` |
| `mensagens/_components/message-drawer.tsx` (306 l.) | **Editor de mensagem** em Sheet: tipo, canal, texto com variáveis, preview, memória do agente | PEQ `:83,95,138,257`, SHADCN Sheet/Select/Textarea | `arc/textarea`, bolhas do chat Lite para preview | LITE-NOVO | G | `arc/side-sheet`, `arc/select` |
| `qualificacao/_components/message-policies-panel.tsx` (478 l.) | Lista de políticas + Dialog de edição (select, switch, textarea, input), `window.confirm` | SOMBRA `:319`, PEQ `:450,451`, SHADCN ×10 | `arc/switch`, `arc/textarea` | LITE-NOVO | G | `arc/dialog`, `arc/select` |
| `integrations/whatsapp/_components/template-builder-wizard.tsx` | ver §3.3 | | | | G | |

### 6.3 `/atendimento/fluxo`
| Componente | Padrão | Desvios | Lite | Ação | Cx | Deps |
|---|---|---|---|---|---|---|
| `atendimento/fluxo/page.tsx:22-25` | Header + heading + editor | | | | | |
| `fluxo/_components/flow-editor.tsx` (135 l.) | **Editor de ordem de perguntas**: lista ordenada (`<ol>` `:93`) com número em círculo 32px, `Textarea` por pergunta, subir/descer (`size="icon"` 32px `:121,122`), `Switch`, Desfazer/Salvar `size="sm"` (`:87,88`) | PEQ (todos os botões), SHADCN Card/SectionCardHeader | `arc/textarea`, `arc/switch`, `arc/button` | ARC + RESKIN (estrutura simples) | M | `arc/panel`. Opção: reordenar por arrastar com `@dnd-kit` (já instalado), mantendo os botões para acessibilidade |

---

## 7. `/fluxos-whatsapp`
Página `fluxos-whatsapp/page.tsx:24` → `features/automations/components/whatsapp-flows-client.tsx` (293 l.). **Não é editor visual**: dois cards (modelos disponíveis, fluxos ativos) + Dialog de configuração com 6 inputs.

| Componente | Padrão | Desvios | Lite | Ação | Cx | Deps |
|---|---|---|---|---|---|---|
| `whatsapp-flows-client.tsx` | Título h2 `text-3xl font-bold` (`:128`), grid de 2 cards, lista de modelos e fluxos ativos com Badge, botões `size="sm"` ativar/excluir (`:189,192`), Dialog de parâmetros (`:210-290`), botão `bg-indigo-600` (`:286`) | COR/DARK ×12 (`slate-*` em `:128-200`), COR `:286`, PEQ `:153,189,192`, `confirm()` | `arc/expandable-card`, `arc/input` | LITE-NOVO | M | `arc/dialog` |
| **Órfão relevante**: `features/workflow-automation/components/workflow-automation-studio.tsx` (1134 l.) | Canvas próprio com nós, arestas, zoom/pan, modos node/connect/move, tooltips | COR/DARK `:179-184,855,856,1024`, SOMBRA ×8, GRAD `:679`, CAIXA `:581,1041,1101`, PEQ ×22 | nenhuma | Fora do escopo (nenhuma rota). Se for religado: LITE-NOVO, G+ | G | ver §0.3 |
| Órfãos: `features/automations/components/automations-client.tsx` (464 l., COR ×15, DARK ×6), `ai-agent-wizard-client.tsx` (320 l.) | | | | Fora do escopo | | |

---

## 8. `/ferramentas`

### 8.1 `/ferramentas`
| Componente | Padrão | Desvios | Lite | Ação | Cx | Deps |
|---|---|---|---|---|---|---|
| `ferramentas/page.tsx:14-16` | Header + catálogo | | | | | |
| `features/tools/components/tools-catalog.tsx` (74 l.) | Grid de `ToolTile` (Card com ícone, badge, link) | SOMBRA `:39` | lista de `light-settings` / `light-more-sheet.tsx` | RESKIN | P | |

### 8.2 `/ferramentas/materiais-operadoras`
| Componente | Padrão | Desvios | Lite | Ação | Cx | Deps |
|---|---|---|---|---|---|---|
| `ferramentas/materiais-operadoras/page.tsx:26-28` | Header + workspace | | | | | |
| `operator-catalog/components/materials-workspace.tsx` (185 l.) | `SectionCardHeader` + segmented (materiais/catálogo/revisão) + dropdown + **`UploadSheet`** (drag-and-drop, `accept=`) | PEQ `:132,143`, SHADCN ×7 | `arc/segmented-control`, `arc/file-dropzone` | ARC + LITE-NOVO | M | `arc/side-sheet`, `arc/menu` |
| `operator-catalog/components/materials-panel.tsx` (199 l.) | DataTable de materiais + `Stat` + `MaterialDrawer` (Sheet com seções) + Select | PEQ `:150,154` | `arc/metric-card` | LITE-NOVO | M | `arc/data-list`, `arc/side-sheet` |
| `operator-catalog/components/catalog-panel.tsx` (170 l.) | DataTable de operadoras/áreas + `CarrierDrawer` + segmented | SHADCN | `arc/segmented-control` | LITE-NOVO | M | `arc/data-list`, `arc/side-sheet` |
| `operator-catalog/components/review-panel.tsx` (263 l.) | DataTable de fatos extraídos com `RowMenu` (dropdown aprovar/rejeitar), select, segmented, `window.confirm` | PEQ ×5 (`:24,170,211,214,239`) | | LITE-NOVO | M | `arc/data-list`, `arc/menu`, `arc/dialog` |
| `operator-catalog/components/broker-quotes-sheet.tsx` (98 l.) | Sheet com linhas de cotação | SHADCN Sheet | `arc/bottom-sheet` | RESKIN | P | `arc/side-sheet` |

### 8.3 `/ferramentas/validador-comprovante`
| Componente | Padrão | Desvios | Lite | Ação | Cx | Deps |
|---|---|---|---|---|---|---|
| `ferramentas/validador-comprovante/page.tsx:14-16` | Header + validador | | | | | |
| `features/payment-proof-validator/components/payment-proof-validator.tsx` (293 l.) | Dois `FileSlot` de **upload** (boleto e comprovante, `accept=`), resultado com `ReadData` (dados lidos), `details`, badges de veredito | PEQ `:120,124`, SHADCN Card/SectionCardHeader | `arc/file-dropzone`, `arc/badge` | ARC + RESKIN | M | `arc/panel` |

---

## 9. `/assinatura`
| Componente | Padrão | Desvios | Lite | Ação | Cx | Deps |
|---|---|---|---|---|---|---|
| `assinatura/page.tsx` (346 l., tudo inline, server) | h1 (`:131`), card "Plano atual" com lista de funcionalidades (`:147-204`), card "Uso e limites" com barras de progresso (`:211-300`), card "Dados da empresa" (`:302`) | CAIXA `:182` (`uppercase tracking-wider`), PEQ `:201,254` (`size="sm"`), SHADCN Card/Badge | `arc/metric-card`, `arc/slider` (não: barra é display), `arc/panel` | RESKIN | M | barra de uso: div com `--accent` sobre `--neutral-3` |

---

## 10. `/guia` e `/guia/webhook`
| Componente | Padrão | Desvios | Lite | Ação | Cx | Deps |
|---|---|---|---|---|---|---|
| `guia/page.tsx:11-13` | Header + guia + RelatedActions | | | | | |
| `features/guide/components/system-guide.tsx` (182 l.) | Busca + nav lateral de seções (`GuideNavItem`) + cards de seção com `Separator` | CAIXA `:105,154`, PEQ ×5 (`:94-172`) | `arc/search-field`, `arc/expandable-card` | RESKIN + ARC | M | |
| `guia/webhook/page.tsx:7-8` | Header + tutorial | | | | | |
| `guia/webhook/webhook-tutorial.tsx` (355 l.) | Tutorial em passos (cards), `CodeBlock` com copiar (`CopyCheckIcon`), form de teste (`FormData`) | PEQ `:109`, SHADCN Card/Separator | `arc/stepper` (vertical), `arc/action-button` | RESKIN | M | `components/motion/copy-check-icon.tsx`; bloco de código: fundo `--neutral-2`, fonte mono |

---

## 11. `/roadmap`
| Componente | Padrão | Desvios | Lite | Ação | Cx | Deps |
|---|---|---|---|---|---|---|
| `roadmap/page.tsx` (458 l., server, inline) | Card de progresso ponderado (`:189-194`), **form de flags super-admin** com AppSelect (`:205-230`), Tabs "Implementados / Novas" (`:263-266`), linha do tempo por dia (`:277`) com ícones coloridos por status | COR ×11 (`:24-35` mapa de status, `:346-443`), CAIXA `:186,276`, PEQ `:287,436,438`, SHADCN Tabs/Card/Select | `arc/segmented-control`, `arc/badge` | RESKIN + ARC | M | `arc/select` (form super-admin) |

---

## 12. `/welcome`
| Componente | Padrão | Desvios | Lite | Ação | Cx | Deps |
|---|---|---|---|---|---|---|
| `welcome/page.tsx:49` | Server: busca onboarding e renderiza tela | | | | | |
| `features/onboarding/components/welcome-screen.tsx` (551 l.) | Tela de boas-vindas animada (motion): saudação, `FloatingDots`, `WarningShapes`, 4 features com **ícones em gradiente** (`:48-98`), `OnboardingStepsCard` com `StepDots`/`StepIcon`, CTA | **GRAD ×14** (`:48,64,80,96,160-175`), COR ×15, DARK ×7, SOMBRA ×8 (`:50,66,82,98,364,378,460,473`), CAIXA `:249`, PEQ `:281,378` | `components/chat/lite-welcome.tsx` (+ `.module.css`), `components/chat/welcome-video.tsx` | LITE-REUSO do padrão `lite-welcome` (reescrever conteúdo do diretor sobre ele) | G | `arc/stepper`, `light-motion.tsx`. Relacionados no layout (fora da rota, mas o diretor vê): `onboarding/components/director-wizard.tsx` (390 l.) e `tenant-onboarding-dialog.tsx` montados em `app/(dashboard)/layout.tsx` (provavelmente no inventário do shell) |

---

## 13. `/internal/design-system` e `/internal/design-system/motion`
| Componente | Padrão | Desvios | Lite | Ação | Cx | Deps |
|---|---|---|---|---|---|---|
| `internal/design-system/page.tsx` (151 l.) | Catálogo dos primitivos shadcn (Button, AppSelect, AppCombobox, Input, Tabs) | COR `:139`, PEQ `:93` | n/a | Recomendo trocar o conteúdo para catalogar os componentes Arc/Lite (vira o QA visual da migração) | M | todos os primitivos Lite novos |
| `internal/design-system/motion/page.tsx` (224 l.) | Playground de motion | SOMBRA `:93`, COR `:151`, **PESO `:180` (`font-extrabold`)**, PEQ ×5 | `arc/motion-tokens.ts` | RESKIN | P | |

---

## 14. Rotas fora do `(dashboard)` que o diretor vê

### 14.1 `(auth)` (já com casca Lite)
`(auth)/layout.tsx:5` usa `components/light/light-auth-shell.tsx` (Lite, `arc-venancor`; `:20` logo h-9 apenas visual). 

| Rota / arquivo | Padrão | Desvios | Lite | Ação | Cx | Deps |
|---|---|---|---|---|---|---|
| `(auth)/login/page.tsx` (258 l.) | Form email/senha com Arc Button/Input/PasswordField + `LoginTransition` | Já Lite (só `toast` shadcn `:12`) | Ele mesmo | MANTER | - | `components/login-transition.tsx` → `components/branding/animated-logo.tsx` (hex de marca `#094174/#60CA99` `:8-60`, legítimo; `DARK :117` remover) |
| `(auth)/recuperar-senha/page.tsx` | Arc Button + PasswordField | Já Lite | Ele mesmo | MANTER | - | |
| `(auth)/2fa/page.tsx` (98 l.) | Form código 2FA + checkbox "lembrar" | COR/DARK `zinc-*` `:41,42,47,72,91`, COR `red-*` `:78`, CAIXA `:59`, SHADCN ×5 | padrão do `login/page.tsx` + `LightAuthTitle` | ARC | P | `arc/checkbox` (ou `arc/switch`) |
| `(auth)/admin/login/page.tsx` (140 l.) | Form login admin | CAIXA `:123`, SHADCN ×4 | padrão do login | ARC | P | |
| `(auth)/invite/accept/page.tsx` (27 l.) | Form aceitar convite | SHADCN ×4 | padrão do login | ARC | P | |
| `(auth)/verify/page.tsx` (17 l.) | Texto "verifique seu email" | **COR hex escuro de tema dark** `#F5F5F5 #A1A1AA #52525B` (`:4,7,11`) dentro da casca clara: texto quase invisível (bug visual) | `LightAuthTitle` | RESKIN | P | |
| `(auth)/access-denied/page.tsx` (13 l.) | Título + link | `text-sm underline` link pequeno | `LightAuthTitle` + `arc/button` | RESKIN | P | |

### 14.2 `onboarding`, `primeiro-acesso`
| Rota / arquivo | Padrão | Desvios | Lite | Ação | Cx | Deps |
|---|---|---|---|---|---|---|
| `primeiro-acesso/page.tsx:17,51,66,73` | Notice (erros) ou wizard | | | | | |
| `primeiro-acesso/onboarding-wizard.tsx` (349 l.) | Wizard Arc (Stepper, Input, PasswordField) em `LightAuthShell` | Já Lite; `:321` `shadow-(--shadow-floating)` | Ele mesmo | MANTER (revisar sombra flutuante) | P | |
| `primeiro-acesso/onboarding-notice.tsx` | `LightAuthShell` + título | Já Lite | Ele mesmo | MANTER | - | |
| `onboarding/page.tsx` (77 l.) | Reusa `OnboardingWizard` (`:63`) + `ErrorMessage` local | SOMBRA `:71` (`shadow-sm` no card de erro), fora da `LightAuthShell` | `onboarding-notice.tsx` | LITE-REUSO (trocar `ErrorMessage` por `OnboardingNotice`) | P | |
| `onboarding/[token]/page.tsx:8` | Redirect | | | MANTER | - | |

### 14.3 Links curtos e públicos
| Rota / arquivo | Padrão | Desvios | Lite | Ação | Cx | Deps |
|---|---|---|---|---|---|---|
| `l/[id]/page.tsx:8`, `lead/[id]/page.tsx:17` | Redirect para `/leads/:id` | | | MANTER | - | |
| `l/[id]/feedback/page.tsx:31` → `features/broker-workspace/components/light-feedback-view.tsx` (135 l.) | Feedback Lite (ActionButton, EmptyState Arc) | Já Lite; `:86,111` `shadow-(--shadow-resting)` ok | Ele mesmo | MANTER | - | |
| `compartilhado/[token]/page.tsx` (329 l., client) | Planilha pública: gate de senha (Card + form `:178-186`), **`<table>` crua** (`:252`) com dados, entrada animada (motion `:144`) | PEQ ×6 (`:147,246,307-320`), SHADCN Card/Input/Label/Button | `LightAuthShell` (gate), `arc/password-field` | LITE-NOVO (gate Lite + tabela Lite) | M | `arc/data-list` |
| `confirm_presence/page.tsx` (61 l.) | Card de confirmação de plantão | PEQ `:52,57`, SHADCN Card | `LightAuthShell` | RESKIN | P | `confirm-duty-presence-button.tsx` (`StatefulButton`) → ARC `arc/action-button` |
| `termos/page.tsx` (57 l.) | Card com texto legal + logo | PEQ `:29`, SHADCN Card | `LightAuthShell` | RESKIN | P | `components/ancora-logo.tsx:15` (`dark:` remover) |

### 14.4 Erros
| Arquivo | Padrão | Desvios | Ação | Cx |
|---|---|---|---|---|
| `app/error.tsx:6`, `(dashboard)/error.tsx:6`, `qualificacao/error.tsx:7`, `marketing/campanhas/[id]/error.tsx:13` | `components/route-error.tsx` | SOMBRA `:74,82` | RESKIN do `RouteError` (1 lugar), base `arc/empty-state` | P |
| `app/not-found.tsx:4`, `(dashboard)/not-found.tsx:5` | `components/route-not-found.tsx` | SOMBRA `:50` | RESKIN (1 lugar) | P |
| `app/global-error.tsx` (85 l.) | HTML próprio com estilos inline (substitui o root layout, sem CSS do app) | COR hex inline `:51,67,74` (`#3b2dff`, `#e4e4e7`) | RESKIN com valores literais do Arc (neutros oklch, accent `oklch(33% 0 0)`), pois tokens não carregam aqui | P |

---

## 15. Resumo quantitativo e ordem sugerida

**Contagem** (componentes únicos de UI no grupo, sem testes): ~150 arquivos tsx. Já Lite: 12 (`light-settings`, `light-whatsapp-section`, `light-auth-shell`, `login`, `recuperar-senha`, `onboarding-wizard`, `onboarding-notice`, `light-feedback-view`, `accessibility-preferences`, `ranking-preferences`, `light-availability-section`, `supervisor-lite-settings`/`manager-lite-settings-parts`).

**Piores desvios** (por volume): `welcome-screen.tsx` (GRAD ×14), `qualification-hub-client.tsx` (1096 l.), `agent-triggers-panel.tsx` (COR/DARK), `situational-playbooks-panel.tsx` (ver nota abaixo), `whatsapp-flows-client.tsx` (slate + dark), `passkey-section.tsx` (GRAD), `template-builder-wizard.tsx`, `integrations-tab.tsx`, `marketing-import-client.tsx`.

Nota: `qualificacao/_components/situational-playbooks-panel.tsx` (605 l., COR ×12 `:58-64,371`, DARK `:382-402`, SOMBRA `:318,393,401`, PEQ ×23) **não é importado por nenhuma rota** (órfão), assim como `ai-settings-tab.tsx`, `waha-connections-card.tsx`, `followup-rules-panel.tsx`, `workflow-automation-studio.tsx`, `automations-client.tsx`, `ai-agent-wizard-client.tsx`. Não converter; arquivar.

**Contagem de ações** (aprox.): MANTER 15 (inclui 12 redirects/Lite), RESKIN 35, ARC 25, LITE-REUSO 9, LITE-NOVO 30. Complexidade G: 14 (`commission-rules-manager`, `meta-integration-view`, `meta-marketing-wizard`, `campaigns-dashboard-view`, `campaign-detail-view`, `qualification-hub-client`, `agent-triggers-panel`, `situations-workspace`, `situation-drawer`, `messages-workspace`, `message-drawer`, `message-policies-panel`, `template-builder-wizard`, `welcome-screen`).

**Ordem sugerida**
1. Primitivos Lite faltantes (§0.1): `arc/panel`, `arc/dialog`, `arc/side-sheet`, `arc/select`, `arc/checkbox`, `arc/tabs`, `arc/menu`, `arc/data-list`, reskin do `Toaster`. Sem eles, cada tela vira re-skin manual.
2. Peças de 1 lugar com efeito amplo: `RouteError`, `RouteNotFound`, `RouteLoading`, `RelatedActions`, `StatCard`, `ConfirmDialog`, `global-error`.
3. Rotas públicas e auth (P, rápidas, já há casca Lite): `2fa`, `admin/login`, `invite/accept`, `verify` (bug de contraste), `access-denied`, `termos`, `confirm_presence`, `onboarding` (ErrorMessage), `compartilhado`.
4. `/settings` via `LightSettings` para o diretor (casca pronta) e abas uma a uma.
5. Telas de listagem/edição com drawer: `/atendimento/*`, `/ferramentas/materiais-operadoras`, `/integrations/whatsapp`.
6. Telas grandes: `/qualificacao` (quebrar por aba), `/marketing/campanhas*`, `/integrations/meta` (wizard), `/welcome`.
7. Por último: `/roadmap`, `/assinatura`, `/guia*`, `/internal/design-system` (virar catálogo Lite para QA).
