# Matriz de Funcionalidades e Preservação — Âncora CRM

**Data:** 2026-09-04  
**Etapa:** UX-1A (Auditoria)  
**Status dos Recursos:** 100% PRESERVADOS

---

## 1. Matriz de Mapeamento de Funcionalidades (Preserved / Moved / Consolidated)

| Funcionalidade Original | Localização / Mecanismo Anterior | Nova Localização Canônica | Status | Justificativa / Impacto UX |
|---|---|---|---|---|
| **Criação de Lead** | Botão em múltiplos locais | `PageHeader` Primário em `/leads` | `CONSOLIDATED` | Uma ação primária consistente no topo da página de Leads. |
| **Importação de Leads** | Botão avulso na toolbar | `PageActions` (Menu `•••`) | `MOVED` | Ação secundária não polui a visão diária do corretor. |
| **Exportação de Leads** | Botão avulso na toolbar | `PageActions` (Menu `•••`) | `MOVED` | Ação administrativa agrupada sob demanda. |
| **Reatribuição em Massa** | Caixa de diálogo avulsa | `SelectionToolbar` (Bulk Dialog) | `PRESERVED` | Aparece somente quando 1+ linhas da tabela estão selecionadas. |
| **Filtro de Período** | Selects independentes por tela | `PeriodSelect` Canônico (`?period=N`) | `CONSOLIDATED` | Governa todas as métricas com 7/14/30/90 dias sincronizados. |
| **Busca de Leads** | Input com comportamentos variados | `FilterBar` com debounce e botão limpar | `CONSOLIDATED` | Input acessível com atalho de teclado e reset imediato. |
| **Filtros Avançados** | Dezenas de dropdowns horizontais | Sheet/Popover `+ Filtros` + `ActiveFilterChips` | `CONSOLIDATED` | Remove poluição visual e exibe apenas os filtros aplicados. |
| **Ações por Lead** | Botões espalhados nas colunas | `RowActions` (`•••`) com grupos | `CONSOLIDATED` | Agrupamento em: Principal (Abrir/Chat), Gestão (Status/Corretor), Perigo (Excluir). |
| **Atendimento WhatsApp** | Telas separadas de chat | `/conversas` 3-pane com drawer contextual | `CONSOLIDATED` | Integra histórico, chat e dados do cliente em um único fluxo. |
| **Sincronização Meta** | Botões em páginas diferentes | `/qualificacao?tab=meta_templates` | `CONSOLIDATED` | Catálogo de templates com suporte a "Editar e Recriar" centralizado. |
| **Edição e Recriação de Templates** | Formulário manual complexo | Modal assistido com validação de placeholders | `PRESERVED` | Converte `{{nome}}` para `{{1}}` automaticamente com feedback sólido. |
| **Controle de Disponibilidade do Corretor** | Toggle espalhado no header | Header Pill + `LightAvailabilityBanner` | `CONSOLIDATED` | Permite pausar/retomar com 1 clique e feedback via toast. |
| **Relatórios por Unidade/Equipe** | Rotas fragmentadas | `/relatorios` com `PageTabs` | `CONSOLIDATED` | Carregamento otimizado de SSR governado pela URL. |
| **Configurações do Robô IA** | Menus com muitas opções visíveis | `SettingsSection` + `SettingsToggleRow` | `CONSOLIDATED` | Complexidade revelada progressivamente apenas quando a IA está ligada. |

---

## 2. Garantia de Integridade de Regras de Negócio

- **Multi-tenancy:** Nenhuma mudança visual altera o isolamento de `tenant_id`. Todo acesso continua sendo resolvido estritamente no servidor via `getRequiredTenantContext()`.
- **RBAC & Capabilities:** Os botões e ações continuam renderizados condicionalmente com base em `hasCapability(role, capability)`.
- **Motor de Distribuição & SLA:** Inalterados no backend (`src/features/lead-distribution/`, `src/features/sla/`).
- **Comunicação & Webhooks:** Totalmente preservados (`src/features/communication-channels/`, `src/app/api/webhooks/`).
