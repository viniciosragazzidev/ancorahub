# Agendador Coolify — reconciliação de mensagens WAHA

## Objetivo

Recuperar mensagens enviadas ou recebidas no WhatsApp móvel do corretor quando
o webhook não for entregue. A tarefa consulta somente sessões pessoais prontas,
os leads ativos da carteira do próprio corretor e passa cada mensagem pelo mesmo
ingestor autenticado do webhook. A operação é idempotente por tenant e ID da
mensagem; não cria lead, não atribui lead e não lê conversas fora da carteira.

## Scheduled Task no Coolify

- Frequência: `*/1 * * * *`
- Serviço: frontend CRM (Next.js), na mesma rede privada do serviço Fastify
- Comando:

```sh
curl --fail --silent --show-error \
  -H "Authorization: Bearer $CRON_SECRET" \
  "$CRM_CRON_URL/api/internal/jobs/waha-sync"
```

Configure no serviço CRM e na tarefa o mesmo `CRON_SECRET`. `CRM_CRON_URL` deve
ser a URL privada/HTTPS do frontend, sem depender de Vercel. A tarefa do Coolify
é a única fonte de agendamento; não mantenha um cron Vercel concorrente.

## Resultado esperado

Uma resposta saudável contém `success: true` e contadores de sessões, eventos,
mensagens processadas e ignoradas. Mensagens duplicadas são aceitas sem nova
linha. Contatos desconhecidos, leads excluídos e conversas internas permanecem
fora do CRM.

## Validação operacional

1. Conecte uma sessão de corretor e confirme o estado `ready`.
2. Envie uma mensagem pelo celular para um lead ativo dessa carteira.
3. Aguarde a próxima execução e confira a mesma mensagem em
   `/conversas/broker` e `/conversas` (gestão).
4. Execute a tarefa novamente: o contador pode registrar o evento, mas a
   restrição `(tenant_id, message_id)` impede duplicação.

O endpoint não expõe conteúdo de mensagens nem telefones nos logs. A ativação da
Scheduled Task exige acesso administrativo ao projeto Coolify.
