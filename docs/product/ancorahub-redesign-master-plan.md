# Plano mestre — redesign e experiência de conversão do AncoraHub

**Status:** proposto para aprovação  
**Escopo:** todas as superfícies do produto — operação, gestão, administração, plataforma, fluxos públicos e extensão de navegador.  
**Referência visual:** imagens em `NewDesignRefs/` e linguagem de workspace da Firecrawl.  
**Regra de marca:** a referência define composição, densidade, superfícies e hierarquia. A cor de ação continua sendo a marca configurada pelo tenant; não será copiada a cor laranja da referência.

---

## 1. Resultado esperado

O AncoraHub deixa de parecer um conjunto de páginas com cards independentes e passa a ser um único workspace operacional: claro, técnico, rápido de ler e orientado à próxima decisão.

Cada tela deve responder em até dois segundos:

1. Onde estou e qual é o meu escopo?
2. O que exige atenção agora?
3. Qual é a ação principal disponível?
4. O que vai acontecer depois da ação?

O redesign não altera regras de negócio, RBAC, integrações, contratos de API ou dados. Ele muda exclusivamente a apresentação, a composição, a descoberta e o feedback da interface.

## 2. Linguagem visual alvo

### Workspace Firecrawl adaptado ao AncoraHub

- Canvas neutro e superfícies sólidas; nenhum card ou dialog translúcido.
- Grid estrutural discreto, bordas hairline e sombra somente quando existir elevação real.
- Sidebar com modo expandido para leitura e rail compacto para execução.
- Header global compacto: contexto de empresa/unidade, ações da rota, busca, tema e notificações.
- Conteúdo com largura operacional controlada e alinhamento consistente.
- Tipografia densa: título de página entre 20 e 24px; seção em 16px; apoio em 12–13px; tabela em 11px; cabeçalho de tabela em 12px semibold.
- Números e prazos usam `tabular-nums`; metadados não competem com dados decisórios.
- Uma ação visualmente primária por contexto. Estados usam semântica, nunca cores improvisadas.
- Light e dark mantêm a mesma relação de contraste, borda, elevação e foco.

### Tokens finais a consolidar

| Família | Contrato |
|---|---|
| Superfícies | `background`, `card`, `muted`, `popover`, `sidebar`, `input`; todas opacas. |
| Texto | `foreground`, `muted-foreground`, `primary-foreground`; sem preto puro ou cinza sem contraste. |
| Marca | `primary` vem da identidade do tenant; não é usado para status. |
| Status | `success`, `warning`, `destructive` e variantes suaves, centralizadas no `Badge`. |
| Forma | 6px em controles internos, 8px em componentes, 10px em superfícies, 16px somente em containers amplos. |
| Espaço | 4, 8, 12, 16, 20, 24, 28, 32, 48 e 56px; sem novos valores locais recorrentes. |
| Elevação | sem sombra em listas e tabelas; sombra de superfície somente em popovers, sheets e dialogs. |
| Motion | 50/200/500ms; foco em estados úteis e compatível com `prefers-reduced-motion`. |

## 3. Estrutura de informação e conversão

### Hierarquia obrigatória de página

| Camada | Conteúdo | Limite |
|---|---|---|
| Contexto | empresa, unidade, período, papel e breadcrumb | persistente no shell |
| Atenção | exceções e pendências acionáveis | até 4 itens |
| Trabalho | tabela, fila, formulário, kanban ou agenda | foco principal da página |
| Resultado | métricas, evolução e histórico | abaixo da tarefa principal |
| Detalhe | inspector, sheet ou perfil | apenas sob demanda |

### Experiência por papel

| Papel | Deve ver primeiro | Ação primária | Não deve ver |
|---|---|---|---|
| Corretor | próximo lead, SLA, pendências e fila pessoal | abrir e avançar o atendimento | gestão global, integração, auditoria e dados de colegas |
| Gestor | exceções, cobertura, carga e leads sem ação | distribuir, reatribuir ou corrigir gargalo | configurações técnicas e dados fora da unidade |
| Diretor | saúde comercial, riscos, implantação e gargalos | decidir onde intervir ou configurar | detalhes operacionais sem impacto executivo |
| Cargo personalizado | apenas trabalho delegado e contexto permitido | executar sua tarefa delegada | menus herdados de corretor/diretor sem necessidade |
| Super Admin | tenants, saúde da plataforma, rollout e erros | atuar sobre plataforma e capacidade | operação diária de lead como padrão |

### Loop de conversão que a UI deve reforçar

`Lead entra → qualificação ou fluxo direto → distribuição → corretor age → próximo passo registrado → gestor resolve exceção → diretor melhora a operação.`

Cada etapa mostra somente as informações necessárias para mover o lead à próxima etapa.

## 4. Inventário completo de componentes afetados

### 4.1 Primitives compartilhados — migração obrigatória

Nenhuma página poderá criar uma versão local dos componentes abaixo. Toda exceção vira variante documentada no primitive correspondente.

| Grupo | Componentes afetados | Contrato único após o redesign |
|---|---|---|
| Ação | `button`, `button-variants`, `toggle`, `toggle-group`, `inline-group`, `selection-toolbar` | tamanhos, ícones, estados pressionado/desabilitado, ações de header e destrutivas centralizados |
| Entrada | `input`, `textarea`, `select`, `checkbox`, `currency-input`, `field`, `form`, `label` | altura, rótulo, ajuda, erro, foco, ação de salvar e leitura em mobile iguais |
| Superfície | `card`, `separator`, `context-note`, `bubble`, `progress`, `skeleton`, `shimmer-skeleton` | variantes `surface`, `split`, `metric`, `compact`, `kanban`, `inspector`, `empty-state` |
| Dados | `table`, `data-table`, `data-table-column-header`, `data-table-pagination`, `data-table-view-options`, `chart`, `badge` | toolbar, densidade, hierarquia de célula, estados, paginação e badges semânticos únicos |
| Navegação | `sidebar`, `breadcrumb`, `tabs`, `scroll-area`, `drawer` | rail, sidebar expandida, contexto persistente, tabs compactas e scroll invisível em cards |
| Sobreposição | `dialog`, `sheet`, `dropdown-menu`, `popover`, `tooltip`, `sonner` | fundo elevado opaco, foco, z-index, motion e fechamento consistentes |
| Identidade | `avatar`, `user-avatar`, `animated-theme-toggler`, `animated-icons/*` | avatar, iconografia HugeIcons, peso de traço e estados de interação consistentes |
| Ações em massa | `bulk-reassign-dialog`, `bulk-status-dialog` | confirmação de impacto, seleção, resumo e feedback reutilizáveis |

### 4.2 Shell, navegação e estados globais — migração obrigatória

| Componentes | Papel no resultado |
|---|---|
| `app-shell`, `dashboard-header`, `workspace-rail`, `mobile-bottom-nav` | shell único, contexto de workspace, ações da rota e navegação responsiva |
| `corretop-sidebar`, `corretor-sidebar`, `corretop-financeiro-sidebar` | uma taxonomia por papel e o mesmo padrão de rail/sidebar |
| `platform-admin-shell`, `platform-admin-header`, `platform-admin-sidebar`, `super-dev-shell`, `super-dev-sidebar` | separar visualmente plataforma do tenant sem duplicar primitives |
| `global-search`, `notification-popover`, `quick-actions-menu`, `keyboard-shortcuts*` | descoberta, busca, atalhos e inbox com linguagem consistente |
| `empty-state`, `route-loading`, `route-error`, `route-not-found`, `operational-placeholder`, `platform-admin-placeholder`, `app-boot-loader`, `splash-screen` | estados assíncronos e indisponibilidade reutilizáveis |
| `skip-to-content`, `accessibility-foundation`, `theme-provider`, `theme-toggle`, `interface-motion-provider`, `route-view-transition` | acessibilidade, tema, motion e transições previsíveis |
| `ancora-logo`, `corretop-logo`, `branding/animated-logo`, `huge-icons` | identidade e iconografia sem cópias locais |

### 4.3 Composites de operação — migração obrigatória

| Domínio | Componentes e padrão de apresentação |
|---|---|
| Dashboard | `metric-card`, `sparkline`, `mini-donut`, `funnel-chart`, `lead-trend-chart`, `backlog-overlay`: migrar para `MetricGroup`, gráficos com legenda e drill-down. |
| Leads | `lead-timeline`, `daily-action-panel`, `leads-workspace`, lista, kanban, filtros, bulk actions e detalhe: `OperationsToolbar`, `PriorityQueue`, `DetailInspector` e card de lead único. |
| Distribuição | fila, regras, cobertura, ranking, plantões e escalas: workspace semanal/lista responsiva e inspector lateral. |
| Conversas | lista, detalhe, filtros, estados de IA/humano e conversas de corretores: inbox de duas colunas e inspector contextual. |
| Tarefas | lista, agenda e próximas ações: tabela operacional, agrupamento por prioridade e painel de edição. |
| Equipe | tabela, convite, cargos, perfil e recuperações: perfil administrativo, linha de pessoa única e sheet de permissão. |
| Vendas e clientes | pipeline, detalhes, documentos e pós-venda: resumo de conta, próxima ação e histórico em camadas. |
| Marketing e Meta | campanhas, importações, fontes e diagnósticos: lista de ativos, readiness checklist e estado de integração. |
| IA | treinamento, qualificação, simulações, feedback e recomendações: setup progressivo, cenários e histórico de versão. |
| Plataforma | tenants, auditoria, sessões, onboarding, WhatsApp Review e flags: tabelas densas, alertas e detalhes sob demanda. |
| Extensão | popup, painel no WhatsApp Web, estado de sessão, sugestões e ações: mesmos tokens, `DetailInspector` compacto e ações nunca automáticas. |

## 5. Migração integral por superfície

| Onda | Rotas e superfícies | Componentes obrigatórios |
|---|---|---|
| 1. Fundação | `globals.css`, shell, sidebar, header, mobile nav, tema, loading/error/not-found | todos os primitives e shell global |
| 2. Corretor | `/dashboard`, `/corretor/resumo`, `/minha-fila`, `/minha-meta`, `/leads`, `/leads/[id]`, `/conversas`, `/tarefas` | `ActionCenter`, `PriorityQueue`, `MetricGroup`, `OperationsTable`, inspector |
| 3. Gestor e Diretor | `/gestor`, `/diretor/resume`, `/noc`, `/relatorios`, `/metas`, `/metas/desempenho`, `/leads/distribuicao`, `/leads/distribuicao/plantao` | filtros globais, cobertura, ranking, funil e tabela comparativa |
| 4. Gestão | `/equipe`, `/equipe/[id]`, `/equipe/cargos`, `/equipe/convidar`, `/equipe/recuperacoes`, `/filiais`, `/unidades/[branchId]` | tabela de pessoas, perfil, sheet de edição e estados de capacidade |
| 5. Comercial | `/clientes`, `/clientes/[clientId]`, `/vendas`, `/vendas/[id]`, `/documentos`, `/checklist`, `/financeiro`, `/financeiro/comissoes`, `/configuracoes/comissoes` | detalhe de conta, tabela operacional, formulários e resumo financeiro |
| 6. Administração | `/settings`, `/settings/integrations`, `/settings/meta`, `/settings/whatsapp`, `/settings/extension`, `/settings/feedback-templates`, `/catalogo`, `/catalogo/interno`, `/materiais-divulgacao`, `/materiais-divulgacao/gerenciar` | settings navigator, readiness checklist, integration cards e formulários padronizados |
| 7. Marketing | `/marketing/campanhas`, `/marketing/campanhas/[id]`, `/marketing/importacoes` | performance workspace, ativos e estados de sincronização |
| 8. Plataforma | todas as rotas `/super-admin/*` e `/super-dev/*` | platform shell, health cards, tabelas densas, inspector e rollout states |
| 9. Público | `/login`, `/2fa`, `/recuperar-senha`, `/invite/accept`, `/onboarding`, `/onboarding/[token]`, `/primeiro-acesso`, `/verify`, `/access-denied`, `/_not-found`, `/termos`, `/welcome` | auth shell, onboarding progressivo, ajuda, erros e retorno seguro |
| 10. Extensão | `apps/browser-extension/*` e instalação no CRM | painel, popup, conexão, estados de acesso e inserção de mensagem |

## 6. Garantia de reutilização e ausência de divergência

O redesign só poderá ser considerado completo se estas regras forem cumpridas:

1. Páginas não podem importar estilos de botão, card, badge, tabela, input, dialog ou sheet localmente.
2. Toda nova necessidade visual deve primeiro ampliar a API do component-base; a página recebe somente layout e composição específica do domínio.
3. Variantes serão tipadas e documentadas no próprio primitive; não haverá classes de cor, raio, sombra, altura ou padding replicadas em páginas.
4. Um inventário automatizado identificará `bg-*`, `border-*`, `rounded-*`, `shadow-*`, `overflow-auto`, `<button>`, `<input>`, `<select>` e `<table>` fora dos primitives aprovados.
5. Testes de contrato verificarão tokens, variantes, foco, contraste e estados dos primitives. Story-like fixtures renderizarão cada variante em light, dark, compacto e mobile.
6. Screenshots Playwright por rota representarão os estados: cheio, vazio, carregando, erro, sem acesso, mobile e dark.
7. Nenhum merge visual será aceito enquanto houver divergência não justificada entre componentes do mesmo tipo.

## 7. Sequência de commits pequenos

1. Registrar decisão visual, inventário e matriz de componentes.
2. Consolidar tokens, tipografia, superfícies e breakpoints sem migrar telas.
3. Evoluir Button, Input, Select, Field, Badge, Card e Table com testes de contrato.
4. Evoluir Dialog, Sheet, Dropdown, Popover, ScrollArea, Tabs, Skeleton e feedback.
5. Criar `WorkspaceShell`, `PageFrame`, `PageActions`, `OperationsToolbar`, `MetricGroup`, `ActionCenter` e `DetailInspector`.
6. Migrar navegação, headers, estados globais e mobile nav.
7. Migrar Corretor e Leads; validar o fluxo de conversão de ponta a ponta.
8. Migrar Conversas, Tarefas, Distribuição e Plantões.
9. Migrar Gestor, Diretor, dashboards, Metas, NOC e Relatórios.
10. Migrar Equipe, Unidades, Clientes, Vendas, Financeiro e Documentos.
11. Migrar Settings, Integrações, Marketing, Catálogos e Materiais.
12. Migrar Super Admin, Super Dev, público, onboarding e extensão.
13. Remover estilos locais substituídos, rodar auditoria automatizada e fechar snapshots visuais.

## 8. Validação e aceite

- Type-check, testes existentes, build de produção e verificação rápida/completa em cada onda.
- Testes de comportamento não podem mudar: RBAC, tenant, distribuição, qualificação, IA, dados pessoais e auditoria permanecem intactos.
- QA visual em desktop, tablet e mobile; light e dark; 200% zoom; teclado; leitor de tela; `prefers-reduced-motion`.
- Teste moderado com Diretor, Gestor e Corretor usando dados sintéticos: localizar prioridade, executar ação e interpretar resultado.
- Métricas: tempo até primeira ação, tempo de primeiro contato, leads com próxima ação, abandono de formulário, redistribuições, conclusão de onboarding e conversão por etapa.

## 9. Fora do escopo

- Troca de framework, biblioteca de componentes ou dependências.
- Mudança de contrato de API, esquema de banco, regra de qualificação, distribuição, RBAC ou automação.
- Cópia literal da marca Firecrawl, incluindo seu laranja, logo, textos ou assets.
- Motion decorativo em tabelas, métricas, filas ou dados sensíveis.

