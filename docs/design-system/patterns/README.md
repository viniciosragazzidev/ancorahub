# UI Patterns & Blueprints

Patterns são a camada obrigatória entre components e features. Cada página nova declara seu blueprint no registro antes de implementação. Regras de negócio, tenant, permissão e dados continuam fora do pattern.

| Blueprint | Uso |
|---|---|
| `LIST_PAGE` | coleções operacionais e administrativas |
| `DETAIL_PAGE` | contexto e ações de uma entidade |
| `SETTINGS_PAGE` | configuração persistente |
| `DASHBOARD_PAGE` | monitoramento com decisão acionável |
| `FORM_PAGE` | criação/edição de maior foco |
| `WIZARD_PAGE` | fluxo sequencial verificável |
| `CHAT_PAGE` | atendimento, conversa e contexto |
| `CRM_PAGE` | contexto comercial completo |
| `KANBAN_PAGE` | trabalho orientado por estágio |
| `ANALYTICS_PAGE` | métricas com decisão acionável |
| `AUTH_PAGE` | autenticação e recuperação |

Consulte [PATTERN_DECISION_TREE.md](../PATTERN_DECISION_TREE.md), [PATTERN_INTERACTION_CONTRACT.md](../PATTERN_INTERACTION_CONTRACT.md), [PATTERN_UX_RULES.md](../PATTERN_UX_RULES.md) e [PATTERN_VALIDATION.md](../PATTERN_VALIDATION.md) antes de declarar uma rota.
