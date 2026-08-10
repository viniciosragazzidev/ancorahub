# Matriz de Auditoria de Arquitetura de Informação e Cobertura — AncoraHub

Esta matriz documenta o status de cada rota do sistema, garantindo alinhamento por domínio, navegação por tabs, tooltips explicativos, links relacionados, busca por palavras-chave e controle de acesso RBAC.

| Rota / Módulo | Domínio | Descrição & Propósito | Navigation / Tabs | Tooltips Explicativos | Links Relacionados | Empty State Educativo | RBAC Scoping | Status |
|---|---|---|---|---|---|---|---|---|
| `/dashboard` | Visão Geral | Resumo executivo da operação comercial e atitudes pendentes | Subnav de escopo | Sim (`InfoTooltip`) | Leads, Vendas, Plantão, NOC | Sim | `acessar_dashboard` | Concluído |
| `/leads` | Comercial | Gestão centralizada de oportunidades e funil de vendas | Tabs: Todos, Minha Fila, Distribuição, Plantão | Sim | Conversas, Cotação, Vendas, Tarefas | Sim | `acessar_leads` | Concluído |
| `/leads?tab=minha-fila` | Comercial | Fila de atendimento individual do corretor | Tab em `/leads` | Sim | Atendimento, Conversas, Vendas | Sim | `acessar_leads` | Concluído |
| `/leads?tab=distribuicao` | Comercial / Automação | Regras de distribuição automática por fila | Tab em `/leads` | Sim | Equipe, Plantão, Qualificação IA | Sim | `leads_reassign` | Concluído |
| `/leads?tab=plantao` | Comercial / Operação | Monitor de plantão ao vivo | Tab em `/leads` | Sim | Filiais, Escala, Atendimento | Sim | `duty_schedules_manage` | Concluído |
| `/conversas` | Comercial | Central de conversas WhatsApp e histórico | Visualizador unificado | Sim | Ficha do Lead, Cotação, Documentos | Sim | `acessar_conversas` | Concluído |
| `/clientes` | Comercial | Base de clientes ativos e renovações de apólice | Tabs: Clientes, Contratos, Renovações | Sim | Vendas, Documentos, Suporte | Sim | `acessar_clientes` | Concluído |
| `/vendas` | Comercial | Histórico de contratos fechados e propostas em andamento | Tabs: Realizadas, Propostas, Esteira | Sim | Clientes, Lead, Comissões, Documentos | Sim | `acessar_vendas` | Concluído |
| `/cotacao` | Comercial | Ferramenta de cotação de planos e simulador PME | Tabs: Simulador, Tabelas, Aceitação | Sim | Leads, Catálogo Global, Propostas | Sim | `acessar_cotacao` | Concluído |
| `/qualificacao` | Automação | Central de treinamento, WhatsApp e IA de qualificação | Tabs: Visão Geral, WhatsApp Diag, Follow-up, MCP, Destinos, Corretores, Mensagens, Alertas, Simulador | Sim | Leads, Distribuição, Equipe | Sim | `acessar_qualificacao_ia` | Concluído |
| `/automacoes` | Automação | Regras de automação, disparos e fluxos WhatsApp | Tabs: Regras, Disparos, Triggers, Fluxos | Sim | Qualificação, Marketing, Leads | Sim | `acessar_automacoes` | Concluído |
| `/equipe` | Gestão | Gestão de corretores, supervisores e convites | Tabs: Integrantes, Convites, Permissões | Sim | Filiais, Metas, Comissões | Sim | `convidar_corretor` | Concluído |
| `/metas` | Gestão | Metas comerciais por unidade, equipe e indivíduo | Tabs: Visão Geral, Minha Meta, Unidades | Sim | Vendas, Corretores, Relatórios | Sim | `gerenciar_metas` | Concluído |
| `/relatorios` | Gestão | Relatórios de conversão, custos IA e vendas | Tabs: Performance, Funil, Custos IA | Sim | Dashboard, Metas, Leads | Sim | `acessar_relatorios` | Concluído |
| `/tarefas` | Operação | Gestão de tarefas e follow-ups manuais | Filtros por prioridade | Sim | Leads, Clientes, Agenda | Sim | `acessar_tarefas` | Concluído |
| `/documentos` | Operação | Repositório de documentos de proposta e apólices | Filtros por status | Sim | Leads, Vendas, Compliance | Sim | `acessar_documentos` | Concluído |
| `/catalogo` | Operação | Catálogo global de planos de saúde e operadoras | Tabs: Planos, Operadoras, Carências | Sim | Cotação, Vendas, Regras | Sim | `acessar_catalogo` | Concluído |
| `/noc` | Operação | Central de monitoramento operacional e SLAs | Painel ao vivo | Sim | Alertas IA, Plantão, Qualificação | Sim | `ver_dashboard_equipe` | Concluído |
| `/integridade` | Operação | Audits de conformidade, checklist e logs | Tabs: Checklist, Audit Logs, Security | Sim | Documentos, Permissões, Tenant | Sim | `acessar_integridade` | Concluído |
| `/marketing` | Administração | Gestão de campanhas Meta, importações e materiais | Tabs: Campanhas, Importações, Lead Ads, Materiais | Sim | Leads, Automações, ROI | Sim | `acessar_campanhas_meta` | Concluído |
| `/filiais` | Administração | Unidades e filiais da corretora | Subnav por cidade/região | Sim | Equipe, Metas, Plantão | Sim | `gerenciar_filiais` | Concluído |
| `/settings` | Administração | Parâmetros do sistema, integrações e comissões | Tabs: Perfil, Tenant, Integrações, Comissões, Segurança | Sim | Integrações, Perfil, RBAC | Sim | `acessar_configuracoes_pessoais` | Concluído |
| `/guia` | Administração | Manual, glossário e tours interativos | Tabs: Manual, Glossário, Tours NextStep | Sim | Suporte, Configurações, Documentação | Sim | `acessar_guia` | Concluído |
