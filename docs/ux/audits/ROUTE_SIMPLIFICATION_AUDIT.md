# Auditoria de Simplificação de Rotas — Âncora CRM

**Data:** 2026-09-04  
**Versão:** 1.0 — Etapa UX-1A  
**Base:** Código-fonte real do repositório (`src/app/`, `src/features/`, `src/components/`)

---

## 1. Visão Geral da Auditoria

Esta auditoria mapeia todas as rotas ativas do CRM, identificando objetivos, papéis de acesso, ação principal, informações essenciais vs. avançadas, padrão de filtros, problemas de densidade e a proposta antes/depois com suporte a *Progressive Disclosure* e comportamento responsivo.

---

## 2. Inventário e Auditoria por Rota

### 2.1 `/dashboard` (Dashboard Executivo e Operacional)
- **Objetivo:** Oferecer visibilidade em tempo real do volume de leads, funil de conversão, alertas críticos que demandam ação imediata e produtividade.
- **Papéis:** Diretor, Gerente, Supervisor, Corretor (com adaptação de densidade no modo Lite).
- **Ação Principal:** Filtrar período operacional (`?period=7|14|30|90`) e atuar no item de atenção prioritário / próximo lead.
- **Informação Essencial (Sempre Visível):**
  - Indicadores vitais (Leads recebidos, taxa de conversão, receita/comissões estimadas, alertas fora do SLA).
  - Próximo lead urgente a ser atendido (para corretores/operadores).
  - Gráfico de tendência diária de volume e conversão.
  - Seção "O que exige atenção" com badges quantitativos.
- **Informação Avançada (Progressive Disclosure):**
  - Funil comercial detalhado em abas específicas de Relatórios (`/relatorios?tab=commercial`).
  - Desempenho por canal de entrada e por corretor em abas contextuais.
- **Filtros:**
  - *Sempre Visíveis:* Seletor de Período canônico (7, 14, 30, 90 dias).
  - *Avançados:* Filtro por unidade/filial (quando aplicável ao cargo de gestão).
- **Problemas Atuais:** Existência histórica de múltiplos painéis paralelos ou cards decorativos sem valor decisório imediato.
- **Proposta Antes/Depois:**
  - *Antes:* Cards com métricas estáticas e ausência de priorização do próximo passo.
  - *Depois:* Topo com "Seu próximo lead" (para o corretor) ou "Alertas Críticos & KPIs Acionáveis" (para gestão), seguido de gráfico de tendência e funil comercial consolidado.
- **Estratégia Mobile:** Cards de métricas em grid de 2 colunas com scroll vertical limpo, barra de período compacta no topo e bottom nav dedicada.

---

### 2.2 `/leads` & `/minha-fila` (Gestão de Oportunidades e Fila)
- **Objetivo:** Triagem, acompanhamento, qualificação e avanço de leads no funil de vendas de saúde e seguros.
- **Papéis:** Corretor, Supervisor, Gerente, Diretor.
- **Ação Principal:** `+ Novo Lead` (Primária destacada no PageHeader).
- **Ações Secundárias / More Actions (`•••`):**
  - Importar Leads (CSV/Planilha).
  - Exportar Base.
  - Reatribuição em lote (Bulk Reassign).
  - Alteração de status em lote (Bulk Status).
- **Ações de Linha (`RowActions`):**
  - Abrir Lead (`/leads/[id]`), Iniciar WhatsApp direto, Agendar Tarefa, Alterar Responsável, Arquivar / Excluir (com `ConfirmDialog`).
- **Informação Essencial (Tabela/Cards):**
  - Nome do cliente, telefone/WhatsApp formatado, produto/operadora de interesse, status atual com badge semântico, responsável e tempo decorrido no estágio (SLA).
- **Informação Avançada:**
  - Origem da campanha Meta, UTM tags, histórico completo de interações de IA, dados demográficos secundários.
- **Filtros:**
  - *Sempre Visíveis:* Campo de busca rápida (nome, telefone, produto) + Filtro rápido de Status + Filtro rápido de Unidade.
  - *Avançados (Drawer/Sheet):* Origem/Campanha, Corretor Responsável, Qualificação por IA, Intervalo de Datas personalizado.
  - *ActiveFilterChips:* Exibição de chips removíveis para cada filtro ativo com ação `Limpar todos`.
- **Estratégia Mobile:** Alternância fluida entre tabela (desktop) e cards com toque direto para WhatsApp e telefone (mobile), com filtros em Bottom Sheet.

---

### 2.3 `/leads/[id]` (Workspace 360 do Lead)
- **Objetivo:** Atendimento aprofundado, cotação, histórico de conversa, registro de tarefas e documentos do cliente.
- **Papéis:** Corretor responsável, Supervisor, Gerente, Diretor.
- **Ação Principal:** `Abrir WhatsApp` ou `Avançar Etapa` no topo do cabeçalho.
- **Ações Secundárias:** `Gerar Proposta PDF`, `Criar Tarefa`, `Transferir Lead`, `Perder Lead`.
- **Estrutura Canônica:**
  - *Cabeçalho:* Nome, telefone, status badge, SLA timer e responsável.
  - *Abas de Domínio (`PageTabs`):*
    1. **Resumo:** Dados do titular, dependentes, plano atual, valor e observações.
    2. **Conversa / WhatsApp:** Histórico sincronizado de mensagens.
    3. **Tarefas & Atividades:** Histórico cronológico e agendamentos futuros.
    4. **Cotações & Propostas:** Comparativos gerados e status de envio.
    5. **Documentos:** Comprovantes e contratos anexados.
- **Estratégia Mobile:** Abas com scroll horizontal suave, botões flutuantes de ação rápida (WhatsApp e Telefone) na base.

---

### 2.4 `/conversas` & `/conversas/broker` (Central de Atendimento Omnichannel)
- **Objetivo:** Centralizar conversas via WhatsApp Cloud API e WAHA com histórico auditado e qualificação por IA.
- **Papéis:** Todos os operadores e corretores.
- **Ação Principal:** Enviar mensagem de resposta / Iniciar novo contato via template aprovado.
- **Estrutura Canônica:**
  - Painel 1 (Esquerda): Lista de conversas com busca rápida, badge de mensagens não lidas e status de qualificação.
  - Painel 2 (Centro): Timeline de chat, input de mensagem com suporte a áudio, imagens e templates Meta.
  - Painel 3 (Direita - Drawer/Painel Retrátil): Resumo do lead, alteração rápida de status, dados do plano e atalho para cotação.
- **Estratégia Mobile:** Modo de painel único com transição deslizante entre lista de conversas e tela de chat ativo.

---

### 2.5 `/distribuicao` & `/distribuicao/plantao` (Motor de Roteamento)
- **Objetivo:** Gestão da roleta de distribuição de leads, capacidade por corretor e escala de plantão ao vivo.
- **Papéis:** Diretor, Gerente, Supervisor.
- **Ação Principal:** `+ Nova Regra de Distribuição` | Alternar status do Plantão (Ao Vivo).
- **Informação Essencial:** Filas ativas, corretores online/pausados, contagem de leads recebidos no turno.
- **Informação Avançada:** Pesos de roleta, horários de atendimento estendidos, regras de transbordo e timeout.
- **Estratégia Mobile:** Visualização em lista de corretores com toggle individual de disponibilidade.

---

### 2.6 `/qualificacao` (Robô de Qualificação IA & Templates Meta)
- **Objetivo:** Gerenciar o agente inteligente de triagem no WhatsApp, simulador de atendimento e catálogo de templates Meta.
- **Papéis:** Super-Admin, Diretor, Gerente.
- **Ação Principal:** `Sincronizar Templates` / `Editar & Recriar na Meta` / `Salvar Diretrizes do Agente`.
- **Progressive Disclosure:** Abas dedicadas: *Diretrizes & Personalidade*, *Playbooks Situacionais*, *Templates de Mensagens (Meta)*, *Simulador em Tempo Real*.

---

### 2.7 `/equipe` & `/filiais` (Gestão Organizacional)
- **Objetivo:** Gerenciar colaboradores, filiais, metas por equipe e permissões de acesso.
- **Papéis:** Super-Admin, Diretor, Gerente.
- **Ação Principal:** `+ Convidar Membro` | `+ Nova Filial`.
- **Estrutura:** Tabela com busca por nome/email/cargo, status de convite e menu de ações (`RowActions`).

---

### 2.8 `/relatorios` (Centro de Métricas e Inteligência)
- **Objetivo:** Relatórios consolidados de vendas, conversão de funil, produtividade e financeiro.
- **Papéis:** Diretor, Gerente (financeiro condicionado à capability `ver_relatorios_financeiros`).
- **Ação Principal:** Seletor de Período (`?period=7|14|30|90`) e Exportação CSV.
- **Abas Canônicas:** Visão Geral, Comercial, Equipe, Unidades, Financeiro.

---

### 2.9 `/settings/*` & `/integrations/*` (Configurações e Conexões)
- **Objetivo:** Gerenciar credenciais de WhatsApp (Meta Cloud API e instâncias WAHA), Webhooks de Leads, Meta Lead Ads e segurança do sistema.
- **Papéis:** Super-Admin e Diretor.
- **Padrão Canônico:** `SettingsSection` e `SettingsToggleRow` (revelando parâmetros de configuração apenas quando o recurso correspondente está ativado).

---

## 3. Conclusão da Auditoria de Rotas

Todas as rotas mapeadas operam em conformidade com o modelo multi-tenant e o isolamento de permissões server-side. A padronização em torno de uma gramática única (PageHeader → PageTabs → FilterBar → Content → DetailDrawer) eliminará duplicações de layout e trará clareza cognitiva a toda a aplicação.
