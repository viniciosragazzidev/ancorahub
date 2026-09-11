# Plano de entrega imediata das ofertas de lead

**Status:** planejado em 2026-09-11  
**Escopo:** atribuição provisória, outbox WhatsApp, oferta sequencial e SLA  
**Objetivo operacional:** a mensagem de oferta deve ser tentada imediatamente para o
corretor escolhido e nenhum prazo pode expirar antes de existir uma entrega válida.

## Diagnóstico do fluxo atual

O motor já persiste a oferta e solicita o processamento do `outboundMessageId` exato
na tentativa imediata. A outbox continua durável e o cron de WhatsApp executa a cada
dois minutos como recuperação.

Ainda existe uma corrida de relógios: `offeredAt`, `expiresAt`, `assignedAt` e
`stageEnteredAt` são gravados antes de a Meta confirmar `sent`. Se a tentativa imediata
falhar, for interrompida depois da persistência ou depender do cron, o prazo de aceite
ou o SLA de primeiro contato pode consumir tempo enquanto o corretor ainda não recebeu
a mensagem. O resultado possível é redistribuição anterior à entrega tardia.

## Invariantes

1. A atribuição e a mensagem pertencem à mesma decisão idempotente de distribuição.
2. A outbox é persistida antes de qualquer chamada externa.
3. O caminho normal processa imediatamente o ID exato; não disputa posição com avisos
   comuns e não espera o cron global.
4. O prazo de aceite começa somente quando o provedor aceita a mensagem (`sent`).
5. O SLA de primeiro contato começa somente após o corretor aceitar o lead.
6. Uma mensagem entregue depois de a atribuição mudar é cancelada ou ignorada pelo
   vínculo de versão da oferta; nunca reabre uma oportunidade antiga.
7. Falha transitória preserva a mesma oferta e faz retry curto; falha terminal ou
   orçamento de entrega esgotado transfere diretamente ao próximo corretor elegível.
8. Tenant, unidade, fila, corretor e canal são sempre derivados e revalidados no
   servidor. O navegador nunca decide prioridade ou destino.

## Plano de implementação

### Fase 1 — Regressão reproduzível e relógios explícitos

- Criar teste determinístico com provedor atrasado: atribuição em `T0`, Meta responde
  depois do prazo antigo e o corretor não pode ser redistribuído antes de `sent`.
- Separar os estados da oferta em `awaiting_delivery`, `offered` e `accepted`.
- Persistir timestamps próprios: `queuedAt`, `providerAcceptedAt`, `deliveredAt`,
  `acceptanceDeadlineAt` e `firstContactDeadlineAt`.
- Migrar ofertas existentes sem inventar entrega: usar o ledger da outbox quando houver
  `sentAt`; caso contrário, mantê-las em recuperação.

**Gate:** teste falha no código anterior e passa com o novo relógio.

### Fase 2 — Faixa prioritária de entrega imediata

- Criar uma operação canônica `dispatchLeadOfferNow` que, na mesma orquestração:
  persiste oferta + owner provisório + outbox, faz claim do ID exato e chama Meta/WAHA.
- O job de distribuição só entra em `AWAITING_BROKER_ACCEPTANCE` depois de confirmar
  `sent`; antes disso permanece `AWAITING_OFFER_DELIVERY`.
- Dar prioridade máxima ao propósito `newLeadAssignment`, com índice de claim por
  `status`, `priority`, `nextAttemptAt` e `createdAt`.
- Manter o cron de dois minutos apenas para lease vencida, queda do processo ou retry;
  o caminho normal não depende dele.
- Usar timeout curto na chamada ao provedor e retry imediato com jitter limitado,
  mantendo idempotência por oferta e sem duplicar mensagens.

**Gate:** p95 local de `assignedAt → providerAcceptedAt` abaixo de 5 segundos em carga
sintética e nenhuma duplicidade em execução concorrente.

### Fase 3 — SLA ligado ao evento correto

- Iniciar `acceptanceDeadlineAt` a partir de `providerAcceptedAt`.
- Iniciar `firstContactDeadlineAt` apenas no aceite atômico do corretor.
- O verificador de SLA ignora `awaiting_delivery` e ofertas sem confirmação do
  provedor.
- Antes de redistribuir, revalidar a versão ativa da oferta e o owner provisório na
  mesma transação, evitando que um webhook tardio vença a rotação atual.
- Se a entrega falhar definitivamente, cancelar a oferta e chamar imediatamente o
  motor central para o próximo elegível, sem deixar o lead sem owner.

**Gate:** testes com entrega tardia, webhook fora de ordem, recusa simultânea,
timeout e dois workers concorrentes.

### Fase 4 — Observabilidade e operação

- Registrar métricas por tenant sem telefone ou conteúdo:
  `assignment_to_queue_ms`, `queue_to_provider_ms`, `provider_to_delivery_ms`,
  `offer_delivery_failures_total` e `sla_started_without_delivery_total`.
- Exibir na Central de Distribuição o estado da oferta: preparando, enviada,
  entregue, lida, falhou ou em retry.
- Alertar quando p95 `assignedAt → providerAcceptedAt` ultrapassar 10 segundos ou
  existir qualquer SLA iniciado sem entrega.
- Tornar timeout, retries, backoff, prioridade e kill switch editáveis pelo
  Super-admin, com auditoria.

**Gate:** painel diferencia atraso do CRM, do worker e da Meta e permite localizar
uma oferta pelo ID sem expor dados pessoais.

## Estratégia de rollout

1. Publicar migrations e leitura compatível com os campos antigos.
2. Ativar métricas em modo sombra e medir a linha de base.
3. Habilitar a faixa imediata por tenant piloto.
4. Habilitar o novo início de SLA após confirmar ausência de ofertas órfãs.
5. Expandir gradualmente e conservar rollback para o processador durável anterior.

## Critérios de aceite

- 99% das ofertas entram em processamento em até 1 segundo após a atribuição.
- p95 de confirmação do provedor menor que 5 segundos, descontada indisponibilidade
  externa comprovada.
- Zero redistribuição por prazo antes de `providerAcceptedAt`.
- Zero início de SLA de primeiro contato antes do aceite do corretor.
- Zero mensagem duplicada ou enviada para corretor que deixou de ser o owner ativo.
- Queda entre persistência e envio é recuperada automaticamente sem ação humana.

