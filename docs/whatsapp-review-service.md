# Serviço de revisão do WhatsApp

## Finalidade

`services/whatsapp-api` é o backend Fastify independente usado para demonstrar à Meta
o envio de uma mensagem pela Cloud API. Ele não é exposto ao navegador e mantém o
token de revisão exclusivamente no processo servidor.

```text
Super-admin no CRM
  -> Server Action autenticada e auditada
  -> WhatsApp API (Fastify, token interno)
  -> Graph API da Meta
  -> número de teste autorizado
```

O endpoint interno é `POST /api/integrations/whatsapp/send-test-message` com corpo
`{ "to": "5521999999999", "message": "..." }`. A chamada exige
`X-CorreTop-Internal-Token`; pedidos sem esse segredo recebem `401` antes de qualquer
leitura da configuração da Meta.

## Controles

- A página `/super-admin/whatsapp-review` exige Super-admin.
- A chave global `feature_whatsapp_meta_cloud_enabled` precisa estar ativa; sua mudança
  já é auditada em `platform_audit_logs`.
- Cada envio de revisão é auditado com o ID retornado pela Meta e hash do destinatário;
  texto e número não são gravados no log de auditoria.
- O Fastify também possui `WHATSAPP_REVIEW_ENABLED`; mantenha-o `false` até o momento
  da gravação da evidência.
- Logs Fastify redigem token interno, telefone e mensagem.

## Segredos por ambiente

No serviço Fastify:

- `WHATSAPP_API_INTERNAL_TOKEN`
- `META_WHATSAPP_REVIEW_ACCESS_TOKEN`
- `META_WHATSAPP_REVIEW_PHONE_NUMBER_ID`
- `META_WHATSAPP_GRAPH_API_VERSION=v25.0`
- `META_GRAPH_API_TIMEOUT_MS=15000`
- `WHATSAPP_REVIEW_ENABLED=true` somente durante o teste controlado

No CRM hospedado na Vercel:

- `WHATSAPP_REVIEW_API_URL` (URL HTTPS privada/pública do Fastify)
- `WHATSAPP_REVIEW_INTERNAL_TOKEN` (o mesmo segredo interno)

Nenhuma dessas variáveis usa prefixo `NEXT_PUBLIC_`.

## Implantação

Vercel hospeda o CRM, mas não deve hospedar este processo Fastify de longa duração.
Publique a pasta `services/whatsapp-api` como serviço Docker/Node separado, configure
os segredos no provedor escolhido e disponibilize `/health` para monitoramento. Antes
da gravação, configure o domínio do serviço no CRM, habilite a capacidade global e use
somente o número de teste autorizado pela Meta.

## Próximas fases

O serviço já contém fronteiras para `messages`, `templates` e `webhook`. A criação e a
consulta de modelos, o Embedded Signup e a persistência de tokens por WABA serão
conectados após a aprovação das permissões e com uma decisão explícita sobre o cofre de
segredos compartilhado.
