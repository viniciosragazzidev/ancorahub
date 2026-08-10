# Matriz de Cobertura — Next Best Action (AncoraHub)

Este documento registra a cobertura de estados, entidades, níveis de prioridade e permissões mapeadas na camada central de Next Best Action.

---

## 1. Matriz de Entidades & Estados

| Entidade | Nível / Estado | Nível de Prioridade | Regra Determinística (`ruleId`) | Ação Recomendada | Perfil Mínimo |
|---|---|---|---|---|---|
| **Lead** | Novo sem atendimento | `critical` (se SLA < 5m) / `high` | `lead_no_first_contact` | Iniciar Atendimento | Corretor / Gestor |
| **Lead** | Qualificação IA pediu humano | `high` | `qualification_requested_human` | Assumir Atendimento do Robô | Corretor / Gestor |
| **Lead** | Qualificação concluída (Sem Cotação) | `high` | `qualification_completed_no_quote` | Criar Cotação | Corretor / Gestor |
| **Lead** | Cotação gerada não enviada | `high` | `quote_generated_not_sent` | Enviar Cotação ao Cliente | Corretor / Gestor |
| **Lead** | Cotação enviada sem retorno agendado | `normal` | `quote_sent_no_followup` | Agendar Retorno Comercial | Corretor / Gestor |
| **Lead** | Retorno agendado vencido | `high` | `followup_overdue` | Realizar Contato de Retorno | Corretor / Gestor |
| **Lead** | Documentos pendentes de solicitação | `high` | `documents_pending_request` | Solicitar Documentação | Corretor / Gestor |
| **Lead** | Documentos enviados aguardando análise | `high` | `documents_under_review` | Revisar Documentação | Gestor / Supervisor |
| **Lead** | Documentos aprovados | `high` | `documents_approved_ready_sale` | Avançar para Fechamento de Venda | Corretor / Gestor |
| **Lead** | Venda realizada | `low` | `sale_completed_post_sale` | Acompanhar Pós-Venda / Vigência | Corretor / Gestor |
| **Equipe** | Leads estourando SLA | `critical` | `team_sla_breach_alert` | Reatribuir Fila / Ajustar Plantão | Gestor / Supervisor |
| **Filial** | Desempenho de conversão abaixo | `normal` | `branch_conversion_drop` | Analisar Relatório da Unidade | Diretor |

---

## 2. Cobertura de Permissões RBAC

- **`acessar_leads`**: Permite executar ações de primeiro contato, agendamento e visualização.
- **`acessar_cotacoes`**: Permite acionar criador de cotação e envio de propostas.
- **`acessar_documentos`**: Permite solicitar e visualizar anexos do lead.
- **`aprovar_documentos`**: Permite ação de aprovação e validação cadastral.
- **`acessar_vendas`**: Permite conversão e fechamento de contrato.
- **`leads_reassign`**: Permite a gestores redistribuir atendimentos com SLA estourado.
- **`acessar_relatorios`**: Permite a diretores e gestores navegar direto para análises executivas.
