# Inventário do chrome do modo diretor (NORMAL) e proposta de conversão para o estilo Lite

Repo: `C:/Users/kyper/Desktop/Kyper/Projects/ancorahub-lite-listas` (somente leitura). Caminhos relativos a `src/`.
Data: 2026-10-24.

---

## 0. Resumo executivo

- O diretor **nunca** cai no LightChrome hoje. `isLightBroker` do layout só é verdadeiro para corretor, supervisor Lite ou gestor Lite (`app/(dashboard)/layout.tsx:168-172`). Mesmo com cookie `ancora_experience_mode=LIGHT`, um diretor recebe o shell NORMAL (`components/app-shell.tsx:192-235`). Então a conversão é **reestilizar o shell NORMAL**, não trocar para o LightChrome.
- O shell NORMAL tem 3 camadas: (1) `AppShell` com `SidebarProvider` + `CorreTopSidebar` + `SidebarInset`; (2) o header **mora em cada página** (`DashboardHeader`, 65 arquivos), não no shell; (3) overlays globais montados no layout (CommandPalette, SystemFeedbackDrawer, AgentDrawer, notificações realtime, onboarding, WhatsApp, PWA).
- Muito código de chrome está **morto** (sem import): `corretor-sidebar.tsx`, `workspace-rail.tsx`, `quick-actions-menu.tsx` (só usado pelo rail morto), `app-page-header.tsx`, `ui/page-header.tsx`, `ui/breadcrumb.tsx`, `degraded-state.tsx`, `loading/app-boot-loader.tsx`, `onboarding/onboarding-checklist.tsx`, `onboarding/onboarding-help-button.tsx`, `light/light-bottom-nav.tsx` e `light/light-side-rail.tsx` (só em teste). `corretop-financeiro-sidebar.tsx` também é morto na prática: não existe rota `/financeiro` em `app/` (o `isFinanceiro` de `app-shell.tsx:87` nunca fica verdadeiro). Proposta: não converter código morto (arquivar ou deixar).
- Escopo de tokens: o Lite aplica `.arc-venancor` **só nas peças do chrome**, nunca nas telas (`light/light-chrome.tsx:30-37`). Para o diretor dá pra seguir igual: classe nas peças do chrome (sidebar, header, sheets, popovers). Ponto técnico crítico: tudo que é portal (Dropdown, Sheet, Dialog, Popover, Tooltip) renderiza em `document.body`, fora do escopo; cada popup precisa receber `className="arc-venancor"` (o `LightMoreSheet` já faz isso em `light/light-more-sheet.tsx:65`).
- Conflitos com as regras Lite dentro do próprio Lite: `--shadow-resting` é sombra empilhada (2 camadas) em `arc/venancor-scope.css:114`; gradientes no `whatsapp-missing-banner.module.css:7,10` e no `view-as.module.css:8-13`. Precisam de decisão (ver §7).

---

## 1. Como o modo é decidido (o que renderiza)

| Função | Arquivo:linha | Regra |
|---|---|---|
| `getExperienceMode` | `features/broker-workspace/experience-mode.ts:39-83` | Gestor com flag MANAGER_LITE: sempre LIGHT (58-61). Depois cookie `ancora_experience_mode` (63), depois `tenantMemberships.preferredExperienceMode` (67-74), depois default: corretor LIGHT, supervisor Lite LIGHT, resto NORMAL (76-82). |
| `setExperienceModeAction` | `experience-mode.ts:89-131` | Grava DB + cookie 1 ano. Gestor com flag não pode voltar a NORMAL (94-99). |
| `isSupervisorLiteAvailable` | `features/broker-workspace/lite-audience.ts:8-12` | role supervisor + `supervisorTeamScope` + flag SUPERVISOR_LITE. |
| `isManagerLiteAvailable` | `lite-audience.ts:15-19` | role manager + flag MANAGER_LITE. |
| `getLiteAudience` | `lite-audience.ts:21-27` | broker, manager ou supervisor; **diretor nunca** (retorna null). |
| `isCleanUiOperationalEnabled` | `features/clean-ui/feature.ts:25-29` | Liga por padrão (só desliga se a setting for "false" ou o tenant estiver na lista legado). Vira `data-ui-refinement="clean"` no `SidebarProvider` (`app-shell.tsx:146,195`), que ativa `styles/operational-ui.css` (tokens em `:root:has(...)` linhas 4-23, dark 25-40, rail 177-221). |
| Layout | `app/(dashboard)/layout.tsx:168-173` | `isLightBroker` (broker+LIGHT), `isLightSupervisor`, `isLightManager`; qualquer um deles manda `AppShell` para o ramo LightChrome (`layout.tsx:222`). |
| Guarda de rotas Lite | `layout.tsx:178-182` + `light/light-routes.ts:78-88` | Só para audiência Lite. Diretor não tem allowlist. |
| Overlays por modo | `layout.tsx:249-250, 257, 266-268` | Diretor recebe: RouteOnboardingLoader, BrokerAvailabilityOnboardingLoader (retorna null p/ não-corretor), toasts de lead estilo `"toast"`, CommandPalette, SystemFeedbackDrawer, AgentDrawer. |

**Implicação:** para o diretor ganhar o visual Lite sem perder estrutura, basta trocar o estilo do ramo NORMAL de `AppShell`. Nenhuma regra de decisão precisa mudar, a não ser que se queira um flag de rollout (sugestão: `feature_director_lite_style`, decisão do Vinicios).

---

## 2. Tokens e tema hoje

- Tokens globais shadcn em `app/globals.css:73` (`:root`, `--primary: #3b2dff` em 96, `--sidebar: var(--card)` em 128) e tema escuro `.dark` em `globals.css:309-370` (`--primary: #1f6fe5`, sidebar `#18181b`). Variante `dark` declarada em `globals.css:15` e `styles/globals.css:17`.
- Tema escuro é real no modo normal: `ThemeProvider` (`components/theme-provider.tsx:8-35`) grava `corretop-theme` em localStorage + cookie e põe `.dark` no `<html>`; o root layout lê o cookie no servidor (`app/layout.tsx:105-108`).
- Clean UI (`styles/operational-ui.css:4-23`) já deixa o canvas branco, sem `--shadow-action`, e tem bloco dark próprio (25-40).
- Marca do tenant: `AppShell` injeta `brandColor` em `--primary`, `--ring`, `--sidebar-primary` no `<html>` e no provider (`app-shell.tsx:92-117, 202-211`).
- Arc/Venancor (`components/arc/venancor-scope.css:8-129`): `color-scheme: light` (9), `--primary #3b2dff` fixo (90), `--radius-control: 9999px` (116), alvo `--control-height-sm: 2.75rem` = 44px (121), fonte Plus Jakarta (119-120), `--shadow-resting` com 2 camadas (114), `--shadow-floating` 1 camada (115), `.lite-page` / `.lite-page-title` (186-189), split desktop `.lite-split` 360px (150-156).

---

## 3. Inventário peça por peça

Legenda da coluna "Lite": equivalente existente ou "não existe".

### 3.1 Moldura

**A. `app/(dashboard)/layout.tsx`** (275 linhas)
- Faz: autentica, busca flags, branding, usuário, membership em paralelo (50-164); redirects (177-198); monta `AgentDrawerProvider > AppShell > onboarding loaders > RealtimeSyncProvider > NotificationCountProvider > handlers + overlays + children` (217-273).
- Estilo: nenhum (servidor).
- Lite: o mesmo arquivo serve os dois.
- Conversão: sem mudança de estrutura. Opcional: passar `directorLite` (flag) ao `AppShell`.

**B. `components/app-shell.tsx`** (236 linhas)
- Faz: ramo Lite (143-190) e ramo normal (192-235): `OnboardingProvider > SidebarProvider(--sidebar-width 17rem, icon 4.5rem, header 4rem) > ViewAsBanner + CorreTopSidebar | CorreTopFinanceiroSidebar + SidebarInset(.app-shell-canvas, scroll único) + OnboardingWelcomeDialog`. Rola ao topo em troca de rota (122-127) e crossfade 150ms (130-141).
- Estilo: `.app-shell-canvas { background: var(--background) }` (`app/globals.css:432-434`); larguras por CSS var (199-201).
- Lite: `LightChrome` (ramo 169-187).
- Conversão: manter `SidebarProvider` + `SidebarInset`. Trocar o fundo do canvas para `--background` Venancor `#f7f7f9` (ou `--surface` branco, ver decisão) aplicando a classe `arc-venancor` no `<Sidebar>` e no header, e um wrapper `.lite-canvas`/`light-canvas` (`venancor-scope.css:140`) no `SidebarInset`. Sidebar com 17rem pode virar 280px (próximo do rail Lite de 360px, sem a lista de conversas). Remover o ramo do financeiro (morto).

### 3.2 Navegação lateral

**C. `components/corretop-sidebar.tsx`** (599 linhas): **a peça principal**
- Faz: menu do normal (itens em 78-200, filtros por cargo/permissão 202-259), logo (308-315), switcher super-admin + "Ver como" (322-327), atalho "Área de Plantão" quando de plantão (330-357), lista com seções (363-465), rodapé com "Agente IA" (474-496) e menu do perfil (499-594): Meu perfil, Configurações, toggle de modo (só corretor, 576-583), Sair.
- Estilo atual: `variant="floating" collapsible="icon"` (301-302); ícones coloridos por item (`iconTone` `text-sky-600 dark:text-sky-300`, `text-violet-600`, `text-amber-600`... em 86-198); chip de seção `text-[10px] font-semibold uppercase tracking-[0.14em]` (379); item `rounded-full min-h-10` (393) com indicador animado `motion.span layoutId` (402-407); chip "Beta" `uppercase tracking-[0.08em]` (448); plantão `border-emerald-500/40 bg-emerald-500/15 ... dark:text-emerald-300` (339-340); Agente IA `border-emerald-500/25 bg-emerald-500/10 ... dark:text-emerald-300` (486); avatar `ring-emerald-500/40` (515, 535); badge do cargo `bg-emerald-500/15 text-emerald-400` (544); popup `shadow-[var(--shadow-dialog)]` (526); Sair `text-red-400 focus:bg-red-500/15` (588). Cores cruas, dark mode e uppercase espalhados.
- Lite: não existe sidebar desktop equivalente. O mais próximo: o rail `.lite-rail` (`light/light-chrome.tsx:109-133`) e o `LightSideRail` morto (`light/light-side-rail.tsx`, 72px, ativo `bg-(--foreground) text-(--surface)`).
- Conversão (mantém tudo): continua sidebar desktop com as mesmas seções e itens. Fundo `--surface-muted` (#f1f1f5, igual ao `.lite-rail`, `venancor-scope.css:154`) e borda direita `--border`; sem `floating`/ring. Ícones monocromáticos `--text-secondary`, ativo como pílula `bg-(--foreground) text-(--surface)` (padrão do Lite) ou `--accent-subtle` + `--accent-strong`. Itens com `min-h-11` (44px). Rótulo de seção em sentence case, `text-xs font-medium text-(--text-muted)`, sem uppercase/tracking. "Beta" vira Arc `Badge`. Plantão e Agente IA viram linhas neutras com ponto `--success` (sem fundo verde). Avatar Arc (`arc/avatar`) com classe `light-avatar` (`venancor-scope.css:143`). Menu do perfil: manter o Dropdown (não existe menu Arc) com `className="arc-venancor"` no popup, `--shadow-floating`, Sair em `--danger`. Modo ícone (`collapsible="icon"`) pode ficar, com tooltips no estilo Arc.

**D. `components/ui/sidebar.tsx`** (750 linhas, primitivo shadcn)
- Faz: provider, cookie `sidebar_state` (32-37, 91-92), atalho Ctrl+B (37), no celular (<768px, `hooks/use-mobile.ts:3`) vira `Sheet` lateral esquerda `w-[min(86vw,18rem)]` (162-184); `floating` com `ring-1` (244); indicador ativo `border-primary/20 bg-primary/8` (541).
- Lite: não existe (o Lite usa `BottomSheet` Arc).
- Conversão: não mexer no primitivo (usado também por platform-admin e super-dev). Estilizar via classes do consumidor e tokens `--sidebar*` redefinidos dentro de `.arc-venancor` (ex.: `--sidebar: var(--surface-muted)`, `--sidebar-accent: var(--accent-subtle)`, `--sidebar-primary: var(--foreground)`). O Sheet mobile precisa da classe `arc-venancor` no `SheetContent`.

**E. `components/sidebar-collapsible-group.tsx`** (89 linhas)
- Usado só por `corretop-financeiro-sidebar` (morto), `platform-admin-sidebar`, `super-dev-sidebar`. Fora do escopo do diretor. Botão `rounded-full font-semibold` (117-121), animação de altura.
- Conversão: nenhuma no diretor.

**F. `components/corretop-financeiro-sidebar.tsx`** (69 linhas): **morto** (sem rota `/financeiro`). Itens em 18-38. Não converter; se a rota nascer, reaproveitar a sidebar convertida.

**G. `components/corretor-sidebar.tsx`** (202): **morto**. **H. `components/workspace-rail.tsx`** (52): **morto** (`fixed ... bg-sidebar`, 21). **I. `components/quick-actions-menu.tsx`** (11): só do rail morto, `shadow-sm`.

### 3.3 Header e cabeçalhos de página

**J. `components/dashboard-header.tsx`** (65 linhas, usado em 65 arquivos)
- Faz: barra sticky da página com `SidebarTrigger` (35), título animado `AnimatedPageTitle` (40), slot de ações (44-46), toggle de modo opcional (48, nenhum consumidor passa `showModeToggle`), `GlobalSearch` (49), `ThemeToggle` (50), botão "Reportar problema" (51-60), `NotificationPopover` (61).
- Estilo: `bg-background/92 backdrop-blur-md border-b` (30), botões `size-8` (32px, abaixo de 44), em <560px quebra em duas linhas e esconde busca/tema/feedback (`max-[559px]:hidden`, 48-60).
- Lite: `LightAppHeader` (`light/light-app-header.tsx:19-78`): `arc-venancor`, `bg-(--surface)/92 backdrop-blur-md` (43), `min-h-[60px]` (48), voltar 44px, título `text-xl font-medium` (raiz) ou `text-base font-medium` (53), slot `actions`, pílula de disponibilidade, botão "Mais" 44px **só abaixo de md** (71).
- Conversão: **header vira o `LightAppHeader` ampliado**, mantendo a API do `DashboardHeader` (breadcrumb, title, rightSlot) para não tocar nas 65 telas. Layout: [menu 44px] [título 16 a 22px peso 500, breadcrumb opcional em `--text-muted`] [ações da página] [busca 44px] [notificações 44px] [ajuda 44px] [avatar ou "Mais" 44px]. Sem `ThemeToggle` (ver decisão). Botões redondos `roundButton` (`light-app-header.tsx:12-13`) mas com sombra única. Mobile: igual ao Lite (uma linha, ações da página numa segunda linha rolável).

**K. `components/motion/animated-page-title.tsx`**: breadcrumb `text-xs text-muted-foreground` + título `text-sm font-medium` (24-27). Conversão: título 16/500 (`--foreground`), breadcrumb `--text-muted`.

**L. `components/app-page-header.tsx`** (48) e **`components/ui/page-header.tsx`** (39): **mortos** (nenhum import). **`components/ui/ds-page-header.tsx`** (76): só em `/dev/*` e no morto acima; `border-ds-ash bg-ds-canvas-white` (43), tokens `ds-*` próprios. Não converter (dev).

**M. `components/ui/breadcrumb.tsx`** (127): **morto**.

**N. `components/ui/route-section-tabs.tsx`** (35): abas de seção com sublinhado `bg-primary` (15-31), `min-h-10`, `text-xs`. Usado em Equipe (`equipe/team-management-tabs.tsx:5-6`), Atendimento (`atendimento/_components/atendimento-heading.tsx:10-12`), WhatsApp (`integrations/whatsapp/whatsapp-integration-heading.tsx:6-8`).
- Lite: `arc/segmented-control` (usado no `LightMoreSheet`, `light-more-sheet.tsx:114-122`) ou `arc/chip-group`.
- Conversão: manter links (rota/URL) e trocar o visual para chips/segmentos Arc: `min-h-11`, `text-sm font-medium`, ativo `bg-(--foreground) text-(--surface)` rounded-full, sem sublinhado.

### 3.4 Busca, comandos, notificações

**O. `components/command-palette.tsx`** (148): busca de funções por permissão (`FEATURE_SEARCH_INDEX`), abre com Ctrl+K (22-27) ou evento `open-command-palette`. Estilo: `rounded-xl shadow-2xl` (71), domínio `text-[10px] font-bold uppercase` (100), `text-emerald-500` (138). Lite: não existe (gestor Lite nem monta, `layout.tsx:266`). Conversão: Dialog com popup `arc-venancor`, `--radius-panel`, `--shadow-floating`, campo `arc/search-field`, grupos em sentence case `text-xs font-medium --text-muted`, linhas 44px.
- **Conflito:** `GlobalSearch` também captura Ctrl+K (`global-search.tsx:28-31`). Os dois abrem juntos no diretor. Decidir qual fica com o atalho.

**P. `components/global-search.tsx`** (121): busca de dados em `/api/search` (48), portal próprio com `bg-background/80 backdrop-blur-sm` (103), `rounded-xl shadow-xl` (104), rodapé, gatilho `Button variant="outline" size="sm"` "Buscar Ctrl K" (119, só md+). Lite: não existe. Conversão: gatilho vira botão redondo 44px (ícone) ou `arc/search-field` compacto no header desktop; painel no padrão do item O. Em 390px hoje some (escondido em `dashboard-header.tsx:49`); propor ícone de busca no header mobile.

**Q. `components/notification-popover.tsx`** (284): sino com badge (250-279), popover com overlay `bg-black/20 backdrop-blur-[1.5px] dark:bg-black/45` (129), painel `rounded-2xl bg-card/98 shadow-2xl backdrop-blur-xl` (145), lista, push manager, "Ver todas" (235-241); badge `text-[9px] font-bold` (275). Lite: o Lite usa a tela `/notificacoes` via "Mais" e o card `notifications/notice-card.tsx` (+ `notice-card.module.css`, já em tokens Arc: `--text-muted`, `--chat-action`). Conversão: manter o popover (desktop) com `arc-venancor`, sombra única `--shadow-floating`, sem blur, linhas no layout do `NoticeCard`; badge `--danger` como no Lite (`light-bottom-nav.tsx:57`); gatilho 44px. Em 390px: popover já vira largura total (`max-[559px]:inset-x-4`); alternativa Lite: `BottomSheet`.

**R. `components/notifications/*`**: `notice-card.tsx` + module (Lite, tokens Arc, ok); `incoming-lead-card.tsx` + `incoming-lead-queue.ts` = aviso dinâmico de lead (Lite). O diretor recebe estilo `"toast"` (`layout.tsx:257`, `providers/realtime-sync-provider.tsx:405-413`) via Sonner (`ui/sonner.tsx:15-45`, `!shadow-[var(--shadow-dialog)]`). Diretor raramente recebe lead; conversão: toast com classes Arc (`--radius-panel`, `--shadow-floating`) só se for exibido.

### 3.5 Controles do header e do perfil

**S. `components/theme-toggle.tsx`** (46) + **`ui/animated-theme-toggler.tsx`** (289): troca claro/escuro com animação de View Transition (`variant="circle"`, `theme-toggle.tsx:34-44`), `size-9 rounded-md border` (38). Lite: **não existe** (Lite é só claro, `venancor-scope.css:9`). Conversão: remover do header do diretor (decisão §7.1).

**T. `components/experience-mode-toggle.tsx`** (172): variantes `pill` (67-94, `animate-pulse`), `badge` (96-114), `menu-item` (116-145) e switch padrão (147-171); toast "Modo Light ativado" (52). No diretor não aparece (sidebar só para corretor, `corretop-sidebar.tsx:576`; header nenhum consumidor). Lite: o Lite não oferece volta ao normal no "Mais". Conversão: nada a fazer para o diretor.

**U. `components/super-admin-role-switcher.tsx`** (112): só para platform admin. Desktop: botão flutuante `fixed bottom-24 right-6 size-12 rounded-full shadow-lg` com ping animado (62-76); mobile: linha compacta na sidebar. Rótulos com **emoji** (27-32), `font-bold` (80). Lite: `ViewAsButton` (`features/super-admin/components/view-as.tsx`) no "Mais". Conversão: tirar emojis, botão 44px dentro da sidebar (não flutuante), sem ping, popup `arc-venancor`.

**V. `components/availability-toggle.tsx`** (71): 3 estados com cores cruas (`emerald`, `amber`, `zinc`, dark, 32-63). Não está no chrome (usado em painéis de distribuição, equipe e perfil). Lite: `arc/segmented-control` (como no Mais). Conversão: segmentado Arc; fica com quem converte as telas.

**W. `components/next-urgent-lead-button.tsx`** (38): botão âmbar `uppercase` com `dark:` (24-27). Usado em `leads/page.tsx` e `noc/page.tsx` (ação de página, no `rightSlot`). Lite: não existe. Conversão: Arc `Button variant="secondary"` com ponto `--warning`, sentence case.

**X. `components/plugins/lead-assigned-notification-button.tsx`** (46): `Button outline` "Reenviar aviso" (40-43), em `leads/[id]/supervision-panel.tsx`. Conversão: Arc `Button secondary`, texto visível também no mobile (alvo 44px).

### 3.6 Atalhos e gavetas globais

**Y. `components/keyboard-shortcuts-provider.tsx`** (342) + **`keyboard-shortcuts.tsx`** (126): registra Ctrl+N, Ctrl+T, Ctrl+Shift+C, g d/l/c/e/n/f, Ctrl+, (`keyboard-shortcuts.tsx:14-122`) e o modal de ajuda "?" com `backdrop-blur-sm` (provider:260), `shadow-2xl` (270), seções `font-bold uppercase` (295, 315). Montado para todos (`app-providers.tsx:31-35`). Lite: não existe modal. Conversão: modal com `arc-venancor`, sombra única, sentence case, `kbd` neutro.

**Z. `components/system-feedback-drawer.tsx`** (129): "Central de Feedback" em `Sheet` lateral (26-30), abre pelo evento `open-system-feedback` (21). Estilo: título `font-bold` (46), "Qual é o assunto?" `font-bold uppercase` (105), cartões `rounded-xl bg-muted/30` (65). Lite: não existe (corretor Lite não monta, `layout.tsx:267`). Conversão: trocar o Sheet lateral por `arc/bottom-sheet` no mobile e Sheet lateral com `arc-venancor` no desktop; botões Arc; sentence case.

**AA. `components/agent-drawer/*`**: `agent-drawer-provider.tsx` (Ctrl+J, 42; evento `open-agent-drawer`, 63), `agent-drawer.tsx` (Sheet direita `shadow-2xl` 77, fundo de pontos `radial-gradient` 84-90, "Agent" `text-xl font-bold` + badge `uppercase` 141-142, rótulo `font-bold uppercase` 157, `text-emerald-500` 196), `agent-shortcut-chips.tsx`. Lite: o chat (`components/chat/assistant-chat.tsx`, `chat-screen.tsx`, `composer.tsx`) é o equivalente visual de conversa com assistente. Conversão: manter o drawer e o atalho; remover o padrão de pontos (gradiente), bolhas e composer no estilo do chat Lite, título em sentence case.

### 3.7 Entrada, transições, carregamento e erro

**AB. `components/splash-screen.tsx`** (72): no root layout (`app/layout.tsx:111`) para todos; fundo `var(--surface-base,#f8f8f7)` (53). Conversão: fundo `#f7f7f9` (Venancor `--background`) ou manter (decisão menor, afeta Lite também).

**AC. `components/login-transition.tsx`** (57): só em `(auth)/login`; `bg-background` (45-48). Lite: `light/light-auth-shell.tsx`. Conversão: fora do shell do diretor; alinhar ao auth Lite se o login for convertido.

**AD. `components/route-loading.tsx`** (31): esqueleto genérico (cards em grade, 9-24); usado por `(dashboard)/loading.tsx` e loadings de clientes, equipe, integrations, leads, mensagens, qualificacao, relatorios, settings. Lite: `light/light-page-skeleton.tsx` (variantes `dashboard`, `list`) e `arc/skeleton`. Conversão: `RouteLoading` passa a usar `arc/skeleton` dentro de `.lite-page` com o mesmo grid.

**AE. `components/route-error.tsx`** (103) e **`route-not-found.tsx`** (59): ilustração grande, `text-2xl font-bold sm:text-3xl` (error 65 / not-found 37), botões `shadow-sm hover:shadow` (error 74, 82; not-found 50). Usados por `(dashboard)/error.tsx` e 8 outros `error.tsx`. Lite: `arc/empty-state`. Conversão: título `.lite-page-title` (22/500), botões Arc 44px sem sombra, detalhe técnico em `--surface-muted`.

**AF. `components/degraded-state.tsx`** (164): **morto**. **AG. `components/loading/app-boot-loader.tsx`** (48): **morto**.

**AH. `components/pwa-install-prompt.tsx`** (204): FAB `fixed bottom-6 right-6 size-12 rounded-full bg-primary shadow-lg` (117, 195) + cartão `shadow-lg` (127). Montado para todos (`app-providers.tsx:82`). No 390px sobe para `bottom-[calc(7rem+safe-area)]`. Conversão: cartão Arc com `--shadow-floating`, botão 44px; considerar mover para dentro do menu do perfil (evita FAB sobre conteúdo).

### 3.8 Onboarding

- **`components/onboarding/onboarding-provider.tsx`** (23): `NextStep` com `steps={[]}` (desativado). **`onboarding-welcome-dialog.tsx`** (6): `return null`. **`onboarding-card.tsx`** (120, `shadow-2xl` 47, `uppercase` 60): só usado pelo provider desligado. Conversão: nenhuma (tutoriais desativados).
- **`onboarding-checklist.tsx`**, **`onboarding-help-button.tsx`**: **mortos**.
- Loaders do layout: `features/onboarding/components/tenant-onboarding-dialog-loader.tsx` (diálogo de onboarding do tenant), `director-wizard-loader.tsx` (só diretor, enquanto `initialSetupCompletedAt` vazio, 14-29) → `director-wizard.tsx` (390 linhas: `backdrop-blur-sm` 106, `gradient-to-r shadow-lg shadow-xl` 377, 3 uppercase, 2 bold), `route-onboarding-loader.tsx` → `route-onboarding-dialog.tsx` (255: `backdrop-blur-sm` 116, `shadow-lg` 118, `dark:`, 6 bold, 3 uppercase), `features/broker-availability/.../broker-availability-onboarding-loader.tsx` (só corretor). `welcome-screen.tsx` (rota `/welcome`, 550 linhas, 10 gradientes, 11 `dark:`).
- Lite: `components/chat/lite-welcome.tsx`, `chat/tour/lite-tour`, `welcome-video.tsx`.
- Conversão: `DirectorWizard` e `RouteOnboardingDialog` são o primeiro contato do diretor; converter para modal Arc (padrão "modal 2 colunas com ilustração 3D", ver memória do Vinicios), sem gradiente/blur, CTA 44px.

### 3.9 WhatsApp (avisos)

- **`whatsapp/whatsapp-plantao-notice.tsx`** (246) + module (684 linhas): só corretor (`layout.tsx:263-265`). Tem `box-shadow` grande (module 34, 134) e `radial/linear-gradient` (151-152). Não afeta diretor.
- **`whatsapp/whatsapp-missing-banner.tsx`** (53): só Lite corretor (`app-shell.tsx:168`). Gradiente (module 7, 10).
- **`whatsapp/whatsapp-link-handler.tsx`** (30): lógica, sem UI. Montado para todos.
- **`whatsapp/whatsapp-status-button.tsx`** (91): usado em `chat/chat-home.tsx` (Lite).
- Para o diretor, o WhatsApp aparece no menu (item "WhatsApp" com ponto verde `statusDot`, `corretop-sidebar.tsx:161-172, 428-432`). Conversão: ponto `--success` e anel `--surface-muted`.

### 3.10 Providers (sem UI própria)

- `providers/realtime-sync-provider.tsx` (424): sincronização + avisos de lead (toast ou dinâmico, 405-413). `providers/notification-count-provider.tsx` (71): contador. `providers/performance-monitor.tsx` (217): métrica. `app-providers.tsx` (42): Nuqs, Theme, Shortcuts, PWA. `theme-provider.tsx` (44).
- Conversão: só o `ThemeProvider` é afetado pela decisão do tema escuro.

### 3.11 Faixas de "Ver como"

- `ViewAsBanner` (`features/super-admin/components/view-as.tsx:132-135`, módulo `view-as.module.css:42+`): faixa sticky no topo, igual nos dois modos. `ViewAsButton` com borda em gradiente (`view-as.module.css:8-13`). Conversão: borda sólida `--border-strong`, sem gradiente (decisão §7.6, pois afeta o Lite).

---

## 4. Lado Lite (referência para a conversão)

| Peça | Arquivo:linha | O que faz | Reuso no diretor |
|---|---|---|---|
| `LightChrome` | `light/light-chrome.tsx:38-178` | Shell Lite: rail desktop (`.lite-split`, 106-142), telas de chat sem header (145-154), demais telas com `LightAppHeader` + `<main>` (156-177), sheet "Mais" (79-96). | Padrão de escopo `arc-venancor` só no chrome; divisão desktop/mobile. |
| `useDesktopChatRail` | `light-chrome.tsx:180-227` | Busca `/api/chat/rail` só em ≥1024px, refaz em evento realtime (máx. a cada 3s) e `CHAT_RAIL_REFRESH_EVENT`. | Não se aplica ao diretor (rail é lista de conversas). Se quiser, o diretor poderia ter o rail do chat como 2ª coluna, mas isso muda estrutura: decisão. |
| `LightAppHeader` | `light/light-app-header.tsx:19-78` | Header 60px, voltar, título, pílula de disponibilidade, "Mais" só <md. | Base do novo `DashboardHeader`. |
| `LightBackButton` | `light/light-back-button.tsx:15-31` | Voltar com fallback ao pai (sem loop). | Usar em telas de detalhe do diretor (lead, cliente, venda, membro). |
| `LightMoreSheet` | `light/light-more-sheet.tsx:22-147` | BottomSheet Arc (detents 0.62/0.92): perfil, destinos, tour, disponibilidade, Sair, Ver como. | Modelo do menu do perfil/overflow no 390px. |
| `light-routes.ts` | `light/light-routes.ts` | Allowlists (8-88), destinos "Mais" por audiência (91-139), abas (118-122), títulos e pais (184-265). | Criar `director-routes.ts` análogo só para título/pai/voltar (sem allowlist). |
| `LightBottomNav` | `light/light-bottom-nav.tsx` | Barra flutuante em pílula (37-39). **Não usada** desde 2026-10-09. | Opção para o 390px (decisão §7.4). |
| `LightSideRail` | `light/light-side-rail.tsx` | Rail 72px. **Não usado**. | Referência de modo recolhido. |
| `LightPageSkeleton` | `light/light-page-skeleton.tsx` | Esqueletos. | Base do `RouteLoading`. |
| `LightAvailabilityPill` / `useLightAvailability` | `components/light-top-nav.tsx:13, 42` | Pílula de disponibilidade. | Diretor não recebe lead: não usar. |
| Arc | `components/arc/*` | avatar, badge, bottom-sheet, button, chip-group, empty-state, input, metric-card, search-field, segmented-control, skeleton, switch etc. | **Faltam no Arc:** dropdown menu, tooltip, dialog, sheet lateral, popover, command. Usar os de `ui/*` com `className="arc-venancor"` no popup. |

Observação: no Lite, entre 768px e 1023px o botão "Mais" some (`light-app-header.tsx:71`, `md:hidden`) e o rail só aparece em ≥1024px (`venancor-scope.css:152`); nessa faixa não há acesso ao "Mais" fora das telas de chat. Vale corrigir antes de reaproveitar o header.

---

## 5. Navegação completa do diretor (não pode se perder)

### 5.1 Sidebar (`corretop-sidebar.tsx:78-200`), diretor vê todos (permissões em `shared/auth/permissions.ts:4-69`)

| Seção | Item (rótulo / tooltip) | Rota | Permissão | Obs. |
|---|---|---|---|---|
| Principal | Painel / Dashboard & Visão Geral | `/dashboard` | acessar_dashboard | prefetch |
| Principal | Conversas / Atendimento e WhatsApp | `/conversas` | acessar_conversas | prefetch |
| Principal | Leads / Leads & Oportunidades | `/leads` | acessar_leads | prefetch |
| Operação | Distribuição / Distribuição de leads e roletas | `/distribuicao` (= `/leads/distribuicao`) | acessar_qualificacao_ia | |
| Operação | Vendas / Vendas e propostas | `/vendas` | acessar_vendas | prefetch |
| Operação | Equipe / Equipe & Unidades | `/equipe` | convidar_corretor ou acessar_configuracoes_unidade | abas: Equipe `/equipe`, Unidades `/equipe?visao=unidades` |
| Operação | Relacionamento / Central de relacionamento | `/relacionamento` | convidar_corretor | só com flag RELATIONSHIP_CENTER (`relationshipCenterEnabled`) |
| Marketing | Qualificação / Qualificação IA | `/qualificacao` | acessar_qualificacao_ia | |
| Marketing | Atendimento / situações e mensagens | `/atendimento/situacoes` | acessar_qualificacao_ia | abas: Situações, Mensagens `/atendimento/mensagens`, Fluxo `/atendimento/fluxo` |
| Marketing | WhatsApp / Conexões WhatsApp | `/integrations/whatsapp` | acessar_configuracoes_pessoais | Beta + ponto verde; abas: Oficial (Meta), Diretoria (WAHA) `?visao=diretoria`, Materiais `?visao=materiais` |
| Marketing | Campanhas / Campanhas de Marketing | `/marketing/campanhas` | acessar_campanhas_meta | ativo para todo `/marketing/*` |
| Ferramentas | Ferramentas / de conferência | `/ferramentas` | acessar_ferramentas | |
| Administração | Ajustes / Configurações do Sistema | `/settings` | acessar_configuracoes_pessoais | |

Também na sidebar:
- Logo → `/dashboard` (marketing → `/marketing/campanhas`) (308-315).
- "Área de Plantão" → `/distribuicao?view=plantao`, só quando de plantão e não gestor (330-357).
- Super-admin: troca de cargo + "Ver como" (322-327).
- Rodapé: "Agente IA" (Ctrl+J) (474-496).
- Menu do perfil: Meu perfil `/settings?tab=conta` (se `userProfileEnabled`), Configurações `/settings`, Sair (499-594).

### 5.2 Header da página (`dashboard-header.tsx`)
Abrir menu (SidebarTrigger, Ctrl+B), Buscar (Ctrl+K), Tema, Reportar problema (abre Central de Feedback), Notificações (popover + "Ver todas" `/notificacoes`).

### 5.3 Atalhos de teclado (todos os usuários)
Ctrl+K (palette e busca), Ctrl+J (agente), Ctrl+B (sidebar), Ctrl+N `/leads/cadastrar`, Ctrl+T `/tarefas`, Ctrl+Shift+C `/conversas`, g d `/dashboard`, g l `/leads`, g c `/clientes`, g e `/equipe`, g n `/notificacoes`, g f `/minha-fila`, Ctrl+, `/settings`, ? ajuda.

### 5.4 Rotas do diretor sem item de menu (chegam por link interno, palette ou atalho)
Pastas em `app/(dashboard)/`: agenda, assinatura, assistente, clientes, configuracoes (comissoes), cotacao, desempenho, documentos, empresas, filiais, fluxos-whatsapp, gestao, guia (+webhook), integrations (meta, página geral), integridade, jornada, mensagens, minha-fila, noc, notificacoes, plantoes, propostas, relatorios (+drill), roadmap (só diretor), tarefas, unidades, welcome, conversas/dashboard, distribuicao/dashboard, equipe/{cargos,convidar,dashboard,recuperacoes,[id]}, leads/{arquivados,dashboard,[id]}, marketing/importacoes, qualificacao/turbo, settings/{extension,feedback-templates}, vendas/{dashboard,[id]}, tarefas/dashboard. Total: 92 `page.tsx`.
- Ponto de atenção: Clientes, Relatórios, Tarefas, Documentos, NOC, Roadmap e Guia **não têm item na sidebar** hoje. A conversão não deve adicionar nem tirar itens sem decisão, mas vale perguntar (§7.9).

---

## 6. Como fica no celular (390px)

Hoje:
- Sidebar vira Sheet esquerdo de `min(86vw, 18rem)` = 288px (`ui/sidebar.tsx:162-184`), aberto pelo `SidebarTrigger` 32px no header.
- Header quebra em duas linhas; busca, tema e feedback **somem** (`dashboard-header.tsx:48-60`). Sobram: menu, título, notificações, ações da página (linha 2, rolável).
- Popover de notificações ocupa a largura (`notification-popover.tsx:145`).
- FABs: PWA (`bottom-[calc(7rem+safe)] right-3`), switcher super-admin vira linha na sidebar.
- Sem busca nem palette no celular (palette só por Ctrl+K).

Proposta (estilo Lite, mesma estrutura):
- Header 60px igual ao `LightAppHeader`: [menu 44px] [título] [notificações 44px] [avatar/Mais 44px]. Em detalhe, [voltar 44px] no lugar do menu (via `director-routes.ts`).
- Menu: manter o drawer esquerdo (mesmos itens e seções) com tokens Arc e itens de 44px; ou trocar por `BottomSheet` Arc em seções (decisão §7.4).
- "Mais"/avatar abre `BottomSheet` (como `LightMoreSheet`) com: Buscar, Agente IA, Reportar problema, Meu perfil, Configurações, Instalar app (PWA), Ver como / trocar cargo (super-admin), Sair. Isso devolve ao celular a busca e o feedback, que hoje somem.
- Ações da página: segunda linha rolável (como hoje), botões Arc 44px.

---

## 7. Decisões que precisam do Vinicios

1. **Tema escuro.** O normal tem `ThemeToggle` + `.dark` por cookie (`theme-provider.tsx`, `app/layout.tsx:105-108`); o Lite é só claro (`venancor-scope.css:9`). Opções: (a) tirar o toggle do diretor e forçar claro (ignorar o cookie quando o estilo Lite estiver ligado; senão as variantes `dark:` dos `ui/*` continuam ativas dentro do escopo); (b) manter escuro só fora do escopo Arc (vira visual misto). Recomendo (a).
2. **Cor da marca do tenant.** `AppShell` injeta `brandColor` em `--primary` (`app-shell.tsx:92-117`), mas `.arc-venancor` fixa `--primary: #3b2dff` (`venancor-scope.css:90`). No escopo Arc a marca do tenant some. Para a Âncora hoje o valor é o mesmo azul, mas o CorreTop multi-tenant precisa decidir: respeitar a marca (mapear `--accent` para brandColor) ou padronizar Venancor.
3. **Sombra empilhada.** `--shadow-resting` do Arc tem 2 camadas (`venancor-scope.css:114`) e é usada nos botões redondos do header Lite (`light-app-header.tsx:13`) e no voltar. Regra "sem sombra empilhada" pede trocar o token (afeta o Lite inteiro) ou usar outro token no diretor.
4. **Padrão de navegação no celular:** drawer esquerdo (estrutura atual) vs BottomSheet Arc vs barra inferior (`LightBottomNav`, hoje sem uso).
5. **Ctrl+K duplicado:** CommandPalette (funções) e GlobalSearch (dados) abrem juntos. Escolher um para o atalho ou unir os dois numa paleta só.
6. **Gradientes já existentes no Lite:** faixa de WhatsApp (`whatsapp-missing-banner.module.css:7,10`), botão "Ver como" (`view-as.module.css:8-13`), plantão notice (`whatsapp-plantao-notice.module.css:151-152`). Corrigir junto ou deixar.
7. **Escopo da classe `arc-venancor`:** só no chrome (como o Lite faz, seguro) ou no `SidebarInset` inteiro (converte as telas de uma vez e quebra o que ainda não foi revisado). Recomendo chrome primeiro; telas por fase.
8. **Código morto:** arquivar (`arquivo/` não se aplica ao repo; seria remover via PR) ou só ignorar: corretor-sidebar, workspace-rail, quick-actions-menu, app-page-header, ui/page-header, ui/breadcrumb, degraded-state, app-boot-loader, onboarding-checklist, onboarding-help-button, corretop-financeiro-sidebar, light-bottom-nav, light-side-rail.
9. **Itens fora do menu:** Clientes, Relatórios, Tarefas, Documentos, NOC, Roadmap, Guia existem como rota mas não estão na sidebar do diretor. Manter assim ou incluir.
10. **Ícones coloridos por item** (arco-íris, `iconTone`) vs monocromático do Lite. Recomendo monocromático.
11. **Rollout:** flag nova (ex.: `feature_director_lite_style`) para ligar por tenant/usuário, ou direto. O `data-ui-refinement="clean"` já é um precedente de flag de visual.
12. **Modo recolhido da sidebar** (só ícones, `collapsible="icon"` + cookie `sidebar_state`): manter ou tirar (o Lite não tem).

---

## 8. Ordem sugerida de execução (só chrome)

1. Tokens: bloco `.arc-venancor` com `--sidebar*` mapeados + sombra única (após decisão 3).
2. `CorreTopSidebar` (desktop + drawer mobile) com classe no `Sidebar`, `SheetContent` e popups.
3. `DashboardHeader` reescrito sobre o `LightAppHeader` (mesma API, 65 telas sem mudança) + `AnimatedPageTitle`.
4. Popovers/modais globais: notificações, busca, palette, atalhos, feedback, agente.
5. Loading/erro/404 (`RouteLoading`, `RouteError`, `RouteNotFound`) com Arc skeleton/empty-state.
6. `RouteSectionTabs` → chips Arc.
7. Onboarding do diretor (`DirectorWizard`, `RouteOnboardingDialog`).
8. PWA prompt e super-admin switcher.
