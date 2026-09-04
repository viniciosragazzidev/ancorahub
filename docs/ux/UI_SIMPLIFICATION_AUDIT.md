# Auditoria Global de Simplificação de UI — Âncora CRM

**Data:** 2026-09-04  
**Status:** Concluído e Validado (Etapa UX-1A)  
**Fonte de Verdade:** [`UX_REDESIGN_CONTRACT.md`](./UX_REDESIGN_CONTRACT.md) e [`UX_REDESIGN_CONTROL.md`](./UX_REDESIGN_CONTROL.md)

---

## 1. Princípios da Simplificação de UI

A auditoria global estabelece os seguintes pilares para a reconstrução da interface:

```
ESSENCIAL (Sempre Visível)
      ↓
CONTEXTUAL (Vinculado ao elemento/linha)
      ↓
SECUNDÁRIO (Abas de domínio ou painel retrátil)
      ↓
AVANÇADO SOB DEMANDA (+ Filtros, Dropdowns, Drawers)
```

1. **Uma Decisão por Contexto:** Cada tela possui uma ação principal clara e destacada (ex: `+ Novo Lead`, `Responder`, `Salvar Configuração`).
2. **Eliminação de Duplicações Visuais:** Múltiplas listagens ou cards de métricas espalhados sem finalidade operacional são consolidados em seções semânticas.
3. **Progressive Disclosure Sem Esconder Operação:** Configurações complexas só mostram parâmetros dependentes quando a feature principal está habilitada (`SettingsToggleRow`).
4. **Respeito à Autoridade Server-Side:** Nenhuma simplificação visual substitui autorizações ou regras de negócio no servidor.

---

## 2. Mapa das Áreas e Diagnóstico de Complexidade

| Domínio | Rota Principal | Diagnóstico de Complexidade Atual | Padrão Canônico de Simplificação Proposto |
|---|---|---|---|
| **Dashboard** | `/dashboard` | Cards de métricas com diferentes estilos e ausência de chamada clara para a próxima ação prioritária | `PageHeader` com período canônico + Card de Próximo Lead / Alerta Crítico + Gráfico de Tendência + Seção de Atenção |
| **Leads & Pipeline** | `/leads`, `/minha-fila` | Filtros horizontais excessivos e botões de ação repetitivos | `PageHeader` com `+ Novo Lead` + `FilterBar` compacta com busca e filtros rápidos + `+ Filtros` em Sheet/Popover + `ActiveFilterChips` |
| **Lead Workspace** | `/leads/[id]` | Telas com rolagem excessiva misturando dados cadastrais, tarefas, propostas e histórico | `PageHeader` compacto com status e SLA + `PageTabs` canônicas (Resumo, Chat, Tarefas, Propostas, Documentos) + `DetailDrawer` para edições rápidas |
| **Conversas WhatsApp** | `/conversas` | Painéis pesados com duplicação de informações cadastrais na lista e no chat | Layout 3-pane refinado: Lista compacta com badges -> Chat central limpo -> Drawer retrátil com dados do lead |
| **Distribuição & Plantão** | `/distribuicao` | Configurações densas de regras de roleta e alternância de corretores | `PageTabs` (Filas, Regras, Plantão Ao Vivo) + `SettingsToggleRow` para cada modalidade de distribuição |
| **Qualificação IA** | `/qualificacao` | Mistura de parâmetros de IA, templates da Meta e simulador na mesma visão | `PageTabs` semânticas (Agente, Playbooks, Meta Templates, Simulador) com validação visual de templates e chips de variáveis |
| **Equipe & Filiais** | `/equipe`, `/filiais` | Tabelas extensas sem agrupamento de ações | `DataTable` canônica com 5 colunas essenciais + `RowActions` (`•••`) agrupadas em Primária, Gestão e Destrutiva |
| **Relatórios** | `/relatorios` | Páginas separadas ou carregamentos pesados | `PageHeader` com `PeriodSelect` + `ReportTabs` governando o carregamento dinâmico sem quebra de SSR |
| **Configurações** | `/settings/*` | Diversos formulários dispersos | `SettingsSection` com cabeçalho explicativo, `SettingsToggleRow` para ativação e expansão progressiva |

---

## 3. Matriz de Priorização de Migração (P0 a P3)

- **P0 (Foundations & Primitivas Canônicas - UX-1B):** Criação/refinamento de `PageHeader`, `PageTabs`, `FilterBar`, `ActiveFilterChips`, `RowActions`, `Section`, `CollapsibleSection`, `SettingsSection`, `SettingsToggleRow`, `DetailDrawer`, `ConfirmDialog`, `EmptyState` e `TableSkeleton`.
- **P1 (Navegação & Shell - UX-1C):** Sidebar unificada com rotas agrupadas por domínio, navegação móvel e Command Palette global.
- **P2 (Fluxos Comerciais Core - UX-1D a UX-1G):** Dashboard, Leads List, Lead Detail Workspace e Conversas WhatsApp.
- **P3 (Governança & Administração - UX-1H a UX-1J):** Equipe, Filiais, Configurações, Integrações e Polimento Mobile/A11y.

---

## 4. Conclusão

A auditoria confirma a viabilidade de unificação da gramática visual do Âncora CRM, garantindo 100% de preservação funcional e conformidade com o Contrato de Redesign.
