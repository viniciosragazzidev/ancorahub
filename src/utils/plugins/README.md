# Plugins

Ponto central para capacidades reutilizáveis acionadas por eventos, botões,
jobs ou APIs internas.

## Regras

- Toda execução valida entrada e autorização no servidor.
- Tenant, unidade, usuário e destinatário vêm do contexto confiável.
- Toda execução é auditável, idempotente e controlada por feature flag.
- Plugins não acessam banco diretamente sem passar por um caso de uso escopado.
- Canais como push e WhatsApp são adaptadores independentes.
- Não carregamos código arbitrário ou plugins remotos nesta fase.

## Plugin entregue: `lead.assigned.notify`

O primeiro plugin de produção entrega o aviso de um lead ao corretor responsável
por dois adaptadores independentes: notificação interna/push e WhatsApp Cloud.
Ele pode ser usado por um botão, evento ou job por meio de
`triggerLeadAssignedNotificationAction`/`executeLeadAssignedNotification`.

### Garantias

- `tenantId`, usuário e escopo da unidade são obtidos da sessão no servidor.
- `leadId`, canais e chave de idempotência são validados com Zod.
- Corretor só acessa a própria carteira; gestor, a própria filial; diretor, o tenant.
- WhatsApp usa a fila existente, templates e fallback de texto já implementado.
- A execução é registrada em `audit_logs` e pode ser desligada pela chave
  `plugin.lead-assigned-notify.enabled` (valor `false`). A capacidade
  `lead_assignment` também precisa estar ativa.
- Falha em um canal não expõe token nem interrompe o outro canal; o resultado
  devolve `warnings` sanitizados para a interface.

### Como adicionar um plugin novo

1. Crie um contrato de entrada validado em um arquivo server-only.
2. Declare um `PluginDefinition` com `featureFlag`, permissões, hosts e eventos.
3. Faça a execução passar por adaptadores de canal, nunca por chamadas diretas na UI.
4. Registre auditoria e uma chave de idempotência antes de disponibilizar o botão.
5. Exponha um componente pequeno em `src/components/plugins/` usando os componentes
   compartilhados de UI.
