# UX-1B — Canonical Foundations & Grammar Specification

> **Status**: APPROVED & IMPLEMENTED  
> **Location**: src/components/foundations/  
> **Source of Truth**: docs/ux/UX_REDESIGN_CONTRACT.md  
> **Control Gate**: docs/ux/UX_REDESIGN_CONTROL.md (UX-1B)  
> **Production URL**: https://crm.ancorasaude.cloud  

---

## 1. Visão Geral e Princípios Fundamentais

A fundação visual e estrutural do CRM Âncora padroniza a interface em torno da regra inegociável de **Progressive Disclosure**:

`	ext
ESSENCIAL (Visível imediatamente: métrica chave, ação principal, estado atual)
    ↓
CONTEXTO (Secundário: filtros ativos, abas de agrupamento, status)
    ↓
DETALHES SOB DEMANDA (Drawers, sheets, menus de ações, confirmações)
`

### Regras de Ouro:
1. **Sem Card-Soup**: Nem todo agrupamento de dados deve ser colocado dentro de um card com borda pesada e sombra. O padrão padrão (Section) é limpo, com separadores sutis ou fundo neutro.
2. **Hierarquia Estrita de Ações**: Máximo de **1 ação primária** por contexto de página. Ações secundárias agrupadas em <PageActions moreActions={[...]} /> ou <RowActions />.
3. **Preservação Integral de Funcionalidades**: Nenhuma funcionalidade é removida; tudo é organizado em níveis canônicos.
4. **Sem bypass de multi-tenancy e segurança**: Componentes de fundação são estritamente visuais e operam como apresentação agnóstica de dados.

---

## 2. Gramática dos Componentes Canônicos

Todos os componentes canônicos estão centralizados em src/components/foundations/:

| Componente | Arquivo | Finalidade Canônica |
|---|---|---|
| <PageHeader /> | page-header.tsx | Cabeçalho canônico unificado com título, descrição, breadcrumbs, tags de contexto e slot de ações. |
| <PageActions /> | page-actions.tsx | Barra de ações no topo com 1 ação primária destacada e menu dropdown para ações secundárias e perigosas. |
| <PageTabs /> | page-tabs.tsx | Navegação horizontal por abas com sincronização de URL (?tab=), indicador animado e atalhos de teclado. |
| <FilterBar /> | ilter-bar.tsx | Barra de busca rápida com chips de filtros ágeis e gatilho para sheet de filtros avançados. |
| <ActiveFilterChips /> | ctive-filter-chips.tsx | Barra de filtros ativos com botões individuais de remoção e Limpar todos. |
| <RowActions /> | ow-actions.tsx | Menu de 3 pontos para tabelas e listas com agrupamento semântico (primary, management, danger). |
| <Section /> | section.tsx | Seção estrutural de layout com cabeçalho, contadores, ações e variante opcional card ou collapsible. |
| <CollapsibleSection /> | section.tsx | Seção expansível para configurações avançadas ou blocos densos. |
| <SettingsSection /> | settings-section.tsx | Layout para páginas de ajustes com linhas padronizadas de toggle (SettingsToggleRow). |
| <DetailDrawer /> | detail-drawer.tsx | Drawer lateral direito (Sheet) para inspeção de lead, filial, usuário ou webhook. |
| <ConfirmDialog /> | confirm-dialog.tsx | Modal de confirmação para ações destrutivas com indicação clara de impacto e botão perigo. |
| <StatusBadge /> & <StatusDot /> | status-badge.tsx | Indicadores de status com 5 tons semânticos padronizados (
eutral, info, success, warning, danger). |
| <EmptyState /> | empty-state.tsx | Estados vazios com 5 categorias semânticas e ações orientadas ao próximo passo. |
| Skeletons | skeletons.tsx | Telas de carregamento padronizadas: TableSkeleton, PageSkeleton, MetricSkeleton, DetailSkeleton. |

---

## 3. Matriz Semântica de Status (StatusBadge)

Para eliminar divergências visuais em diferentes telas, o StatusBadge padroniza os 5 tons do sistema:

| Tom (	one) | Significado | Exemplo de Uso |
|---|---|---|
| 
eutral | Estado inativo, rascunho, neutro | Filial inativa, template rascunho, usuário suspenso |
| info | Em andamento, processo ativo | Lead em atendimento, sincronização ativa, webhook configurado |
| success | Concluído, aprovado, ativo | Filial ativa, venda convertida, template aprovado pela Meta |
| warning | Atenção, pendência, pausa | Fila pausada, SLA próximo do limite, documento pendente |
| danger | Erro, crítico, rejeitado | SLA vencido, falha de webhook, template rejeitado |

---

## 4. Matriz Semântica de Estados Vazios (EmptyState)

| Tipo Semântico | Contexto | Comportamento Recomendado |
|---|---|---|
| EMPTY_DATA | Entidade sem registros cadastrados | Exibir ação primária para criar o primeiro registro. |
| EMPTY_SEARCH | Nenhum resultado retornado na busca | Exibir botão Limpar busca com foco de volta no input. |
| EMPTY_FILTER | Filtros combinados não retornaram dados | Exibir botão Limpar filtros aplicados. |
| NO_PERMISSION | Usuário sem perfil/acesso à seção | Explicar o motivo e apontar para solicitação ao administrador. |
| OPTIONAL_FEATURE | Recurso opcional ainda não ativado | Exibir resumo do benefício e botão para ativação. |

---

## 5. Hierarquia de Ações

### Nível de Página
- **1 Ação Primária**: Botão destacado à direita no <PageHeader /> (ex: Novo lead, Nova filial, Criar campanha).
- **Ações Secundárias / Exportação / Configuração**: Agrupadas no dropdown do <PageActions moreActions={[...]} />.
- **Ações Destrutivas de Lote**: Destacadas com confirmação explícita via <ConfirmDialog />.

### Nível de Linha / Tabela
- **Clique na Linha ou Título**: Abre o drawer de detalhes ou a página de visualização.
- **Ações Rápidas**: Ícone de ação primária (ex: Abrir chat, Ver perfil).
- **Ações de Gestão & Perigo**: Agrupadas em <RowActions /> com separador visual antes de ações destrutivas.

---

## 6. Caso Piloto Implementado (Pilot 1: BranchesManager)

O componente src/features/branches/components/branches-manager.tsx serviu como caso de validação e migração piloto da gramática:

1. **Antes**:
   - Tabela isolada sem estados vazios padronizados.
   - Badges manuais com cores customizadas para status e central.
   - Falta de hierarquia visual entre métricas de equipe e filiais.
2. **Depois**:
   - Encapsulado em <Section title=Filiais da corretora description=... actions={<CreateBranchSheet />} />.
   - Status unificados com <StatusBadge label=Ativa tone=success dot />.
   - <EmptyState type=EMPTY_DATA /> caso não existam filiais cadastradas.
   - Preservação 100% de forms server actions (useActionState), feedbacks por toast e métricas StatCard.

---

## 7. Próximos Passos (Transição para UX-1C)

Com as fundações canônicas e testes 100% aprovados, o próximo passo autorizado em docs/ux/UX_REDESIGN_CONTROL.md é a **Etapa UX-1C: Sidebar & Navigation Restructure**.
