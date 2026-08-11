# Automation Builder — fundação modular

**Estado:** em evolução  
**Objetivo:** substituir a automação acoplada a templates por um motor de workflows visual, extensível e governado.

## Entrega desta etapa

- Contrato independente para definição de nós, conexões e fluxo versionado.
- Registro central de nós, com categoria, campos editáveis, permissões e feature flag por capacidade.
- Validação determinística de gatilho, conexões, alcance, ciclos e ações protegidas antes de publicação.
- Primeiro conjunto de nós seguros: gatilhos de lead, condição, switch, espera, tarefa, etiqueta e alerta interno.
- Nós de IA e WhatsApp declarados como capacidades governadas; não podem ser publicados sem a respectiva flag e confirmação humana.

## Próximas ondas

1. Persistência versionada em andamento: o rascunho fica em `workflow_automations` e cada publicação cria um snapshot imutável em `workflow_automation_versions`. Somente Diretor edita/publica, com auditoria; a chave global `feature_workflow_automation_enabled` nasce desativada.
2. Criar executor assíncrono com idempotência, locks, waits e trilha por nó.
3. Ligar somente ações CRM permitidas e auditadas; conectar IA e canais externos depois de validação de consentimento, janela e credenciais.
4. Entregar histórico, dry-run, rollback e controles do Super-admin.

## Limites de segurança

- Não há HTTP livre, código arbitrário, segredo de tenant, transferência de responsável ou envio externo automático nesta etapa.
- Tenant, usuário e escopo permanecem resolvidos no servidor.
- Ações sensíveis permanecem sujeitas à confirmação humana e às decisões já aprovadas de IA/WhatsApp.
