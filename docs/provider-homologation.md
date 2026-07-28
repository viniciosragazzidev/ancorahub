# Homologação isolada de provedores

## Segurança

Os testes usam somente ambiente de QA, tenant de teste e números sintéticos. Nunca
utilize `DATABASE_URL`, canais, telefones, mensagens ou credenciais de produção.
Logs devem registrar apenas IDs técnicos, status e latência.

## PostgreSQL de teste

Defina `TEST_DATABASE_URL` para um PostgreSQL descartável e diferente de
`DATABASE_URL`/`SUPABASE_DB_URL`. A preparação deve aplicar todas as migrations,
criar tenant, filial, credencial e usuários sintéticos, e limpar os dados ao fim.

O gate deve executar simultaneamente dois POSTs com a mesma `Idempotency-Key` e
validar: um único lead, uma única entrega processada, um evento de fila e efeitos
`DISTRIBUTE_LEAD`/`NOTIFY_LEAD_ARRIVED` únicos. Com a mesma chave e payload
diferente, o resultado esperado é `409`.

## Meta Cloud

Use App, WABA e número de teste exclusivos. Configure o webhook de QA com segredo
próprio e envie uma mensagem de um número de teste controlado. O gate verifica a
assinatura, persistência única por `providerMessageId`, roteamento pelo
`phone_number_id` e criação/atualização da outbox. Não envie templates ou textos a
contatos externos.

## OpenWA

Suba a sessão QA com `docker-compose.openwa.yml`, secret exclusivo e dois números
sintéticos. O gate envia uma mensagem inbound, repete o mesmo `messageId` e confirma
que há somente uma mensagem persistida e uma única execução de automação. Uma falha
de adaptador deve ser reportada como indisponibilidade, nunca reprocessada como novo
lead.

## Operação

Execute a homologação manualmente ou em agendamento separado do CI de PR. Antes do
piloto, valide backlog zero/esperado, ausência de dead-letter inesperado, tempo até
atribuição e logs sem PII. O kill switch global fica em **Super-admin → Configurações
da Plataforma → Outbox do recebimento de leads**.
