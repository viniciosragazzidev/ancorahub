# Histórico de Alterações de UX/UI (UX Changelog)

> **Documento Vivo**: `docs/ux/UX_CHANGELOG.md`  
> **Framework de Governança**: `UX-GOV-1`  
> **Fonte de Verdade**: `docs/ux/UX_REDESIGN_CONTRACT.md`  

Este documento registra cronologicamente todas as alterações de UX/UI, estrutura de páginas, componentes e navegação realizadas no CRM Âncora.

---

## 2026-09-04 — /leads/[id] (UX-1F — Detalhe do Lead)

### Problema
1. O detalhe do lead continha blocos legados duplicados escondidos (`<div className="hidden">`), inflando o DOM e criando inconsistências de manutenção.
2. O espaçamento e a tipografia das abas operacionais (`<TabsList>`) possuíam classes fora de padrão (`h-30`, `py-8`), dificultando a visualização e navegabilidade em telas médias.
3. A densidade da coluna lateral e os cartões operacionais precisavam de alinhamento com a arquitetura canônica de 2 colunas responsivas do design system.

### Objetivo
1. Estruturar `/leads/[id]` em um layout canônico de 2 colunas (`max-w-[1400px]`, área operacional principal + sticky sidebar de identidade e contexto).
2. Otimizar as abas operacionais (Atendimento, Documentos, Histórico, Tarefas) com cabeçalhos e badges informativos compactos.
3. Eliminar código morto e duplicações ocultas no DOM mantendo 100% da integridade multi-tenant, autorizações de cargo e integrações (Meta Ads, IA Insight, Documentos, Tarefas, Histórico).

### Antes
- Container `max-w-[1200px]` com padding rígido.
- Bloco escondido de ~100 linhas duplicando dados de contato e beneficiários.
- Altura ad-hoc nas abas de navegação.

### Depois
- Container canônico `max-w-[1400px]` com padding responsivo (`p-4 sm:p-6 lg:p-8`).
- Header card ergonômico com avatar, status semântico, metadados de contato e ações contextuais rápidas.
- Tabs segmentadas e limpas para Atendimento, Documentos (com contagem), Histórico e Tarefas (com contagem de pendências).
- Sticky sidebar direita persistente para consulta rápida de dados de contato e unidade sem poluição visual.

### Componentes reutilizados
- `<DashboardHeader />` de `@/components/dashboard-header`.
- `<UserAvatar />` de `@/components/ui/user-avatar`.
- `<Badge />` de `@/components/ui/badge`.
- `<Button />` de `@/components/ui/button`.
- `<Card />`, `<CardHeader />`, `<CardTitle />`, `<CardDescription />`, `<CardContent />` de `@/components/ui/card`.
- `<Tabs />`, `<TabsList />`, `<TabsTrigger />`, `<TabsContent />` de `@/components/ui/tabs`.
- `<NextBestActionCard />` de `@/features/next-best-action`.
- `<SupervisionPanel />`, `<LeadActionHub />`, `<LeadStatusSelector />`, `<AiConversationInsightCard />`, `<LeadTimeline />`, `<LeadTasks />`, `<LeadChat />`, `<LeadDocumentsSection />`, `<PersonRecordDetails />`, `<BeneficiariesSection />`.

### Funcionalidades preservadas
- 100% das regras multi-tenant (`getRequiredTenantContext()`, `buildLeadScopeWhere()`), permissões de visualização e mascaramento (LGPD), alternância de modo Light do Corretor, SLAs e histórico de auditoria.

### Responsive
- Desktop/Ultrawide (>= 1280px): Grid de 2 colunas com sticky sidebar à direita.
- Tablet/Mobile (< 1280px): Layout empilhado fluído com abas deslizantes sem scroll horizontal quebrado.

### Visual QA
- [x] Hierarquia visual limpa e alinhada ao lema "Complexidade disponível, não complexidade exposta".
- [x] Zero código legado oculto no DOM.
- [x] 100% dos testes passando (652/652).

---

## 2026-09-04 — / (Global) & /conversas

### Problema
1. A sidebar textual antiga possuía 13 itens espalhados em 4 seções, ocupando 240px de largura horizontal e gerando sobrecarga cognitiva.
2. Na rota `/conversas`, o cabeçalho (`DashboardHeader`) e o topo dos filtros estavam sendo cortados/empurrados para fora da viewport devido a um overflow de altura fixa (`h-[calc(100dvh-...)]`) somado ao padding do shell.
3. O contraste de ícones e legendas da nova sidebar em modo dark/light estava com visibilidade reduzida.

### Objetivo
1. Transformar a sidebar em uma **Vertical Rail** compacta (80px / 5rem) com tiles canônicos (ícone no topo + legenda embaixo).
2. Ajustar o contraste para alta definição (`text-slate-200`, active `text-emerald-300` com fundo `#183134`).
3. Corrigir o layout de `/conversas` para ocupar `100%` da altura útil sem scroll externo na página principal.

### Antes
- Sidebar com 240px de largura e listas textuais longas.
- `/conversas` com scroll interno duplo que fazia o cabeçalho sumir ao interagir com a lista de chats.
- Ícones da rail pouco visíveis em telas escuras.

### Depois
- Sidebar compacta de 80px com tiles ergonômicos e tooltips laterais (`src/components/corretop-sidebar.tsx`).
- Rota `/conversas` com container `flex h-dvh min-h-0 flex-col overflow-hidden` e cada painel interno com seu próprio `ScrollArea` independente.
- Ícones com contraste cristalino, active state com glow esmeralda e WhatsApp com badge BETA.

### Componentes reutilizados
- `<Sidebar />`, `<SidebarHeader />`, `<SidebarContent />`, `<SidebarFooter />` de `@/components/ui/sidebar`.
- `<Tooltip />`, `<TooltipTrigger />`, `<TooltipContent />` de `@/components/ui/tooltip`.
- `<DropdownMenu />`, `<DropdownMenuTrigger />`, `<DropdownMenuContent />` de `@/components/ui/dropdown-menu`.
- `<DashboardHeader />` de `@/components/dashboard-header`.
- `<ConversationsWorkspace />` de `@/app/(dashboard)/conversas/conversations-workspace`.

### Componentes alterados
- `src/components/corretop-sidebar.tsx`: Reescrito para o padrão vertical rail com tiles canônicos e alto contraste.
- `src/components/app-shell.tsx`: Ajustado `--sidebar-width` para `5rem` no CRM padrão e `16rem` no Financeiro.
- `src/app/(dashboard)/conversas/page.tsx`: Corrigido container raiz para `flex h-dvh min-h-0 flex-col overflow-hidden`.
- `src/app/(dashboard)/conversas/conversations-workspace.tsx`: Ajustado container raiz para `flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-card`.
- `src/app/(dashboard)/conversas/official-broker-conversations.tsx`: Ajustado container raiz para `flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-card`.

### Funcionalidades movidas
- Nenhuma funcionalidade removida. Todos os links de navegação continuam acessíveis diretamente na rail ou no menu de perfil do rodapé.

### Funcionalidades preservadas
- 100% de preservação de rotas, permissões por cargo, super-admin switcher, plantão ao vivo com pulse em tempo real, drawer de IA (Ctrl+J), logout seguro e alternância de modo Full/Lite.

### Responsive
- Desktop/Notebook: Rail fixa de 80px com tooltips ao passar o mouse.
- Mobile (<560px): `MobileBottomNav` preservado com 4 ações prioritárias e gatilho "Mais".
- Drawer de conversas mobile: Sheet lateral deslizante com botão de retorno.

### Accessibility
- Suporte a navegação por teclado (`Tab`, `Enter`, `Escape`), atributos WAI-ARIA `aria-label`, foco visível com anéis de foco, `TooltipProvider` com delay de 150ms e sem aninhamento inválido de `<button>` dentro de `<button>`.

### Visual QA
- [x] Page padding consistente? Sim.
- [x] Título e header visíveis sem corte no topo? Sim.
- [x] Ícones com contraste e tamanho corretos (size-6)? Sim.
- [x] Texto secundário e legendas legíveis? Sim.
- [x] Sem bugs de scroll externo? Sim.

---

## 2026-09-04 — /unidades (Piloto UX-1B)

### Problema
A listagem de filiais em `src/features/branches/components/branches-manager.tsx` usava tabelas sem container estrutural padronizado, badges manuais sem tokens semânticos e não possuía estado vazio canônico quando não haviam filiais cadastradas.

### Objetivo
Validar a biblioteca canônica de `src/components/foundations/` em uma página piloto de baixo risco.

### Antes
- Tabela isolada em card cru.
- Badges com classes Tailwind ad-hoc.
- Ausência de empty state semântico.

### Depois
- Encapsulado em `<Section title="Filiais da corretora" description="..." actions={<CreateBranchSheet />} />`.
- Status unificados com `<StatusBadge label="Ativa" tone="success" dot />`.
- `<EmptyState type="EMPTY_DATA" />` para lista vazia com instrução clara.

### Componentes reutilizados
- `<Section />`, `<StatusBadge />`, `<EmptyState />` de `src/components/foundations/`.

### Funcionalidades preservadas
- 100% de formulários server actions (`useActionState`), feedbacks por toast, métricas de equipe com sparklines (`StatCard`) e toggles de recebimento de leads.

### Visual QA
- [x] Espaçamento vertical e padding de tabela padronizados.
- [x] Status visualmente coerentes com os 5 tons semânticos.

---

## 2026-09-04 — /dashboard (UX-1D — Dashboard Unificado)

### Problema
1. Dispersão de métricas operacionais e gerenciais entre dashboards com inconsistência de padding e escalas visuais.
2. Necessidade de unificar os modos de visualização (Executivo/Diretoria, Marketing, Corretor Full, Corretor Lite) respeitando a governança UX-GOV-1 sem criar monólitos de rota nem calcular métricas no cliente.

### Objetivo
1. Alinhar o `ExecutiveDashboard` com a escala canônica de espaçamento (`p-4 sm:p-6 lg:p-8`, `space-y-6 sm:space-y-8`), tipografia (`text-2xl font-bold tracking-tight`) e abas canônicas via `<PageTabs />`.
2. Assegurar contraste aperfeiçoado nos cards de KPI (`KpiComparisonCard`), funil de 8 estágios (`FunnelSection`) e blocos de atenção (`AttentionSection`).
3. Garantir 100% de integridade com o catálogo canônico de métricas no servidor (`features/reports/metrics/metric-catalog.ts` e `metrics-service.ts`).

### Antes
- Paddings divergentes em breakpoints (`p-4 lg:p-6`).
- Badges de delta com contraste reduzido no dark mode.
- Barras de funil com cores estáticas sem adaptação a temas.

### Depois
- Layout unificado com escala de espaçamento canônica (`p-4 sm:p-6 lg:p-8`), ritmo vertical consistente e `<PageTabs />` animados com sincronização `?tab=`.
- `DeltaBadge` com contraste nítido em light (`text-emerald-600` / `text-red-600`) e dark (`dark:text-emerald-400` / `dark:text-red-400`) com tipografia `tabular-nums font-semibold`.
- `FunnelSection` com fundos semitransparentes adaptáveis e suporte total a temas claro e escuro.

### Componentes reutilizados
- `<DashboardHeader />` de `@/components/dashboard-header`.
- `<PageTabs />` de `src/components/foundations/page-tabs`.
- `<PeriodSelect />` de `@/components/period-select`.
- `<KpiComparisonCard />`, `<FunnelSection />`, `<AttentionSection />` de `src/app/(dashboard)/relatorios/_components/`.
- `<OverviewTab />`, `<CommercialTab />`, `<TeamTab />`, `<UnitsTab />`, `<FinancialTab />`.

### Componentes alterados
- `src/app/(dashboard)/dashboard/_components/executive-dashboard.tsx`: Alinhamento canônico de layout, padding, tipografia e ritmo vertical.
- `src/app/(dashboard)/relatorios/_components/kpi-comparison-card.tsx`: Contraste e acessibilidade de badges e deltas aprimorados.
- `src/app/(dashboard)/relatorios/_components/funnel-section.tsx`: Paleta de estágios adaptativa a temas claro e escuro.

### Funcionalidades preservadas
- 100% das métricas do catálogo canônico: funil de conversão de 8 estágios, coorte diária de entradas/conversões, atenção operacional com links profundos filtrados, detalhamento por canal, equipe, unidade e financeiro (sob controle de permissão `ver_relatorios_financeiros`).

### Responsive
- Testado e visualmente consistente em 1366×768, 1440×900, 1920×1080 e dispositivos móveis (<560px).

### Accessibility
- Conformidade WCAG 2.2 AA: contraste de texto tabular, foco visível, rótulos ARIA para gráficos de coorte e tabelas com tags semânticas `<th scope="...">` e `tabular-nums`.

### Visual QA
- [x] Page padding consistente (p-4 sm:p-6 lg:p-8)? Sim.
- [x] Título no tamanho correto (text-2xl font-bold)? Sim.
- [x] Ritmo cabeçalho → abas → conteúdo (space-y-6 sm:space-y-8)? Sim.
- [x] Contraste de texto secundário e delta badges? Sim.
- [x] Sem aninhamento inválido e foco por teclado visível? Sim.
- [x] 0 erros no TypeScript (tsc --noEmit) e 100% de testes passando? Sim.

---

## 2026-09-04 — /leads (UX-1E — Leads Workspace & List Restructure)

### Problema
1. Dispersão de filtros ad-hoc com componentes customizados despadronizados.
2. Três cards de métricas (StatCards) fixos no topo de `/leads` consumindo altura útil da visualização em telas de notebook (1366×768 / 1440×900).
3. Painel de detalhes legado em `<Sheet>` básico sem diferenciação entre resumo operacional (L1) e seções colapsáveis/detalhadas (L2).
4. Necessidade de alinhar a experiência de listagem com a filosofia de *"Complexidade disponível, não complexidade exposta"*.

### Objetivo
1. Unificar a barra de filtros utilizando a `<FilterBar>` canônica e chips de filtros ativos com remoção atômica via `<ActiveFilterChips>`.
2. Remover o card-soup do topo de `/leads` para que o catálogo de oportunidades e funil dominem a viewport.
3. Integrar o `<DetailDrawer>` canônico (L1 visível, L2 sob demanda, ações de WhatsApp, ligação e links profundos).
4. Preservar 100% das regras de negócio, segurança multi-tenant no servidor, ações em lote, importação/exportação e qualificação IA.

### Antes
- Filtros em container com inputs desacoplados e chips manuais.
- 3 StatCards empurrando o Kanban e a lista para baixo.
- Sheet lateral padrão sem cabeçalho contextual de saúde do lead e atalhos rápidos.

### Depois
- `<FilterBar>` canônica com busca rápida, atalho para limpar, trigger com badge de contagem de filtros ativos e `<ActiveFilterChips>` com remoção individual.
- Tabela e Kanban ocupando 100% da viewport útil com ritmo vertical limpo (`p-4 sm:p-6 lg:p-8`, `max-w-[1400px]`).
- Quick View Drawer utilizando `<DetailDrawer>` com resumo L1, ações imediatas (Ligar, WhatsApp, Chat, Tarefas, Notas) e seções de gestão e qualificação L2.
- Ações em lote contextuais flutuantes (`SelectionToolbar`) ativadas somente sob seleção de linhas.

### Componentes reutilizados
- `<FilterBar />` de `src/components/foundations/filter-bar`.
- `<ActiveFilterChips />` de `src/components/foundations/active-filter-chips`.
- `<DetailDrawer />` de `src/components/foundations/detail-drawer`.
- `<DashboardHeader />` de `@/components/dashboard-header`.
- `<SelectionToolbar />` de `@/components/ui/selection-toolbar`.
- `<LeadsDataTable />`, `<QualifyingLeadsDataTable />` de `src/app/(dashboard)/leads/leads-data-table`.
- `<NegotiationsRadarTab />` de `src/features/conversation-intelligence/components/negotiations-radar-tab`.
- `<LeadStatusBadge />`, `<LeadQualificationBadge />`, `<LeadHealthBadge />`.

### Componentes alterados
- `src/app/(dashboard)/leads/_components/leads-filters.tsx`: Integrado com `<FilterBar />` e `<ActiveFilterChips />`.
- `src/app/(dashboard)/leads/leads-workspace.tsx`: Removido card-soup do topo, integrado `<DetailDrawer />` e atualizadas abas de perspectiva.
- `src/app/(dashboard)/leads/page.tsx`: Ajustada escala de padding canônica e container `max-w-[1400px]`.
- `docs/ux/UX_REDESIGN_CONTROL.md`: Etapa `UX-1E` atualizada para `COMPLETE`.

### Funcionalidades preservadas
- 100% de integridade com autorização multi-tenant no servidor (`getRequiredTenantContext`, `buildLeadScopeWhere`).
- Distribuição de filas, reatribuição de corretores, alteração de filiais, exportação CSV, importação em lote, qualificação IA e manual.
- Modo Lite do corretor intacto e preservado.

### Responsive
- Testado e perfeitamente ajustado em 1366×768, 1440×900, 1920×1080 e mobile (<560px).

### Accessibility
- Suporte a navegação por teclado (`Tab`, `Enter`, `Escape`), conformidade WCAG 2.2 AA, botões de ação com `aria-label`, foco visível e contraste adequado em todos os badges de status.

### Visual QA
- [x] Page padding consistente (p-4 sm:p-6 lg:p-8)? Sim.
- [x] Título no tamanho correto (text-2xl font-bold)? Sim.
- [x] Sem card-soup poluindo o topo da página? Sim.
- [x] Filtros canônicos e chips ativos funcionais? Sim.
- [x] DetailDrawer com L1 e L2 ergonômicos? Sim.
- [x] 0 erros no TypeScript (tsc --noEmit) e 100% de testes passando? Sim.

---

## 2026-09-04 — /leads & /dashboard (UX Polish & Dashboard Instant Tabs)

### Problema
1. As abas do `/dashboard` apresentavam latência perceptível ao clicar devido a roundtrip de navegação no servidor sem feedback de transição imediato.
2. O gráfico de "Entradas e conversões" no dashboard executivo ocupava uma altura vertical excessiva (`h-72`), desproporcional ao restante do grid.
3. A listagem de `/leads` e o Kanban podiam ter um visual ainda mais moderno, leve e distinto no estilo "Linear/CRM Simples" (pills horizontais de status com dots luminosos, avatar com iniciais para leads, atalhos diretos de WhatsApp na linha e cartões de Kanban aprimorados).

### Objetivo
1. Tornar a troca de abas no `/dashboard` instantânea através de estado otimista com `useTransition`.
2. Compactar a altura do gráfico de linha temporal para `h-44 sm:h-48` (~180px), mantendo legibilidade total.
3. Modernizar os filtros rápidos de status em `/leads` com pills roláveis e dot badges brilhantes (`shadow-[0_0_8px_...]`).
4. Adicionar avatar com iniciais coloridas, botão de ação rápida de WhatsApp e visualização clara de contato na tabela e no Kanban de `/leads`.

### Componentes alterados
- `src/app/(dashboard)/dashboard/_components/executive-dashboard.tsx`: Otimização instantânea de abas com `useTransition` e redimensionamento do gráfico de entradas/conversões.
- `src/app/(dashboard)/leads/_components/leads-filters.tsx`: Pills de status rápidos com dots luminosos e integração de chips de filtros.
- `src/app/(dashboard)/leads/leads-table-columns.tsx`: Linhas com avatar de iniciais, botão direto do WhatsApp, badge luminoso e menu de ações expandido.
- `src/app/(dashboard)/leads/leads-workspace.tsx`: Cartões de Kanban com avatar, telefone e atalho direto para WhatsApp.

---

## 2026-09-04 — Refinamento Visual e Feedback de Estado (Sonner Toast, Loading Skeletons & Filtros)

### Problema
1. O toast do Sonner apresentava layout com botões espremidos e texto quebrado, além de vazar um texto duplicado sem background abaixo do componente.
2. A troca de abas no `/dashboard` exibia área em branco antes do carregamento completo dos dados.
3. A tabela de `/leads` e os filtros não apresentavam indicador visual de loading ao filtrar e paginar.
4. O status de filtro em `/leads` aparecia duplicado tanto nas pílulas rápidas de status quanto nos chips de filtros ativos abaixo.
5. O link de equipe na barra lateral exibia o rótulo "Contatos".

### Objetivo
1. Corrigir e refinar a estrutura do toast (Sonner) e remover o leak de texto duplicado.
2. Adicionar skeleton e barra de pulso na troca de abas do dashboard.
3. Adicionar barra de loading e transição de opacidade na tabela durante filtragem/paginação.
4. Remover a duplicação do status nos chips de filtro e no DOM.
5. Atualizar o rótulo da barra lateral para "Equipe".

### Componentes alterados
- `src/components/ui/sonner.tsx`: Sanitização das opções para impedir duplicação no container nativo do Sonner.
- `src/components/motion/animated-toast.tsx`: Novo layout com header dedicado (badge + close), corpo e botões inferiores com `whitespace-nowrap shrink-0`.
- `src/app/globals.css`: Limpeza de CSS legado do toast.
- `src/app/(dashboard)/dashboard/_components/executive-dashboard.tsx`: Inclusão de `DashboardTabLoadingSkeleton`.
- `src/components/data-table/data-table.tsx`: Adição de barra de progresso no topo e opacidade transitória no corpo da tabela.
- `src/app/(dashboard)/leads/_components/leads-filters.tsx`: Omissão do status em `chips` e remoção da chamada duplicada de `<ActiveFilterChips>`.
- `src/components/corretop-sidebar.tsx`: Atualização do label de navegação para "Equipe".

## 2026-09-04 — UX-GOV-1: refinamento transversal governado

### Entregue

- Rollout Clean UI resolvido no servidor e aplicado ao shell autenticado sem
  alterar o escopo do tenant.
- Tokens de superfície, borda, controle e raio consolidados em
  `src/styles/operational-ui.css`.
- Rail, abas, filtros e campos passaram a expor slots semânticos para uma única
  camada visual; o link de aba preserva a posição de scroll.
- Cards de KPI, atenção, funil e equipe receberam a mesma composição leve do
  dashboard.
- Removido o ocultamento global de scrollbar dentro de `Card`, preservando a
  descoberta de regiões roláveis.

### Ainda pendente

QA visual autenticado por rota, validação de estados vazios/loading/error em
desktop e mobile, extração futura das composições compartilhadas de relatórios e
certificação individual das etapas UX-1G–UX-1J.

## 2026-09-05 — `/dashboard` tabs sem espera perceptível

### Causa confirmada

A troca de tab usa `router.replace` com `searchParams`; isso reexecuta o Server
Component e as consultas métricas da aba. O cliente já atualizava o rótulo, mas
exibia um skeleton imediatamente, tornando todo o roundtrip visível.

### Correção

`PageTabs` agora comunica intenção por hover e foco. O dashboard chama
`router.prefetch` para aquecer a próxima resposta RSC e agenda o restante em
idle. A seleção visual continua imediata, sem reset de scroll e sem cache global
de métricas entre tenants.

## 2026-09-05 — Dashboard canônico e navegação sem “Tarefas” duplicada

- `/dashboard` passou a usar o Reporting Center, mantendo abas, filtros de
  período, escopo por papel e estados da rota de relatórios.
- `/relatorios` agora é um redirecionamento de compatibilidade para
  `/dashboard`, incluindo `period` e `tab`.
- O item de sidebar “Tarefas” (que apontava incorretamente para relatórios)
  foi removido e `/qualificacao` foi adicionado como entrada explícita de
  Qualificação IA.

## 2026-09-05 — primitives compartilhados alinhados ao dashboard

- `Section` (`variant="card"`) passou a usar a mesma superfície leve e sem
  sombra do dashboard canônico.
- `Table` e `DataTable` passaram a compartilhar cabeçalho recuado, bordas
  discretas e hover de linha suave; `/filiais` e `/leads` herdam o padrão sem
  lógica específica de rota.

## 2026-09-05 — canvas claro, `/leads` e `/qualificacao`

- O canvas do tema claro do shell Clean UI passou para branco (`#ffffff`),
  mantendo o tema escuro e o rollback por tenant.
- `DataTable` e as tabelas de `/leads` passaram a usar a superfície opaca de
  card, removendo a mistura transparente que deixava o fundo acinzentado.
- Os indicadores de `/qualificacao` foram compostos com `StatCard`, os mesmos
  tokens de métrica do `/dashboard`; a subnavegação recebeu slot semântico,
  borda leve e `aria-current` para o estado ativo.

## 2026-09-05 — UX-H1: biblioteca única e fiscalização por rota

- A sidebar passou a usar fundo preto e tokens semânticos, removendo cores,
  brilho e Motion fixos do rail.
- `Button` deixou de carregar Motion obrigatoriamente; `Table` e `Field` são
  primitives estruturais server-safe.
- As duas APIs TanStack passaram a compartilhar `DataTableFrame` e o mesmo
  contrato de cabeçalho, corpo, linha e célula. `/leads` deixou de sobrescrever
  a superfície e agora herda o mesmo fundo claro de `/equipe`.
- O auditor passou a catalogar controles nativos, emoji de interface e magic
  values, com baseline de não regressão e modo strict; o catálogo transitive
  cobre todos os `page.tsx`.
- O manual e o plano de conversão deixam explícito que dívida catalogada não
  equivale a padronização concluída.

## 2026-09-05 — UX-H1: conversão do CRM operacional

- Escopo formalizado: somente páginas autenticadas do CRM; Super Admin,
  desenvolvimento/diagnóstico, autenticação e páginas públicas foram excluídos
  desta rodada sem receber aprovação implícita.
- Botões, checkboxes, inputs, selects, textareas e tabelas visíveis do CRM
  passaram a usar os primitives compartilhados de `src/components/ui`.
- Tabelas interativas convergiram para `DataTableFrame`; `/leads` herda a mesma
  superfície clara e o mesmo cabeçalho de `/equipe`.
- Emojis de chrome foram substituídos por ícones, e sombras/raios/cores
  arbitrárias detectadas no escopo foram removidas.
- `MetricCard` deixou gráficos em um client island pequeno e `Button` deixou de
  carregar Motion por padrão, reduzindo JavaScript de interação comum.
- `npm run ui:audit:strict` agora exige zero divergência no CRM. Próximo passo:
  QA visual e funcional por papel nos viewports definidos no contrato.
- Validação técnica: build direto do Next.js 16.2.10 concluído, type-check sem
  erros, 652 testes globais e 19 testes focados aprovados. O `prebuild` do
  pacote de extensão permanece bloqueado localmente por permissão de leitura do
  diretório, e o lint global mantém dívida preexistente registrada pelo harness.
