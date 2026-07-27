# Plugin `lead.assigned.notify`

## Uso

Use `triggerLeadAssignedNotificationAction` em qualquer componente client ou
`executeLeadAssignedNotification` em um caso de uso server-side. O chamador
fornece apenas `leadId`, canais desejados e uma chave de idempotência; tenant,
corretor, telefone e escopo são resolvidos no servidor.

## Canais

- `push`: cria a notificação no CRM e entrega nas inscrições Web Push do usuário.
- `whatsapp`: enfileira o template `new_lead_assignment`, processa a fila e usa
  o fallback de texto quando o template não está disponível.

## Controle operacional

O super-admin pode desligar o plugin com `plugin.lead-assigned-notify.enabled=false`.
O recurso também respeita a capacidade de notificação `lead_assignment`.
Toda execução concluída grava `plugin_execution/plugin.executed` em `audit_logs`.
