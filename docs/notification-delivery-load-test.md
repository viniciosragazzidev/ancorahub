# Teste de garantias das filas de push e WhatsApp

## Objetivo

Validar que a entrega de notificações continua rápida e sem duplicidade quando há vários atendimentos e acessos simultâneos. O teste é sintético: não envia mensagens reais para a Meta nem para dispositivos.

## Garantias cobertas

- cada item recebido pelo worker é processado uma única vez;
- o limite de concorrência é respeitado (cinco tarefas por lote);
- filas vazias terminam sem erro;
- o claim transacional do outbox continua sendo a proteção contra dois workers enviarem o mesmo WhatsApp;
- retries e fallbacks permanecem contabilizados e podem ser processados na segunda passagem do lote;
- push e WhatsApp usam a mesma primitiva de concorrência, evitando loops seriais em picos.
- o caminho síncrono que cria uma nova oferta aguarda o processamento da outbox antes de
  retornar a Server Action, evitando que uma função serverless seja encerrada com trabalho pendente.

## Como executar

Na raiz do projeto:

```bash
npx vitest run src/shared/async/run-with-concurrency.test.ts
npx vitest run src/features/communication-channels/outbound-service.test.ts
npm run type-check
npm run build
```

O teste de concorrência cria 40 entregas artificiais, mede o pico de tarefas ativas e confirma que todos os identificadores aparecem exatamente uma vez. Ele não usa credenciais, banco de produção ou número de telefone.

## Verificação antes de liberar

1. Rodar os testes acima em CI e bloquear o merge se qualquer teste falhar.
2. Em staging, inserir itens de teste no outbox e confirmar `queued -> processing -> sent/failed` sem registros duplicados.
3. Confirmar que uma falha do provedor gera retry com backoff e que o fallback é processado sem intervenção manual.
4. Observar no painel de filas o tamanho, idade do item mais antigo, taxa de erro e p95 de processamento. Os testes locais validam o limite de concorrência; os números de latência reais devem ser medidos no ambiente de produção.
5. Nunca usar token da Meta, subscription real ou telefone de cliente no teste de carga.

## Operação

O push usa até cinco inscrições simultâneas por usuário. O worker de WhatsApp usa até cinco itens simultâneos por lote, com claim idempotente no banco. Esses limites são conservadores para o plano atual e podem ser parametrizados depois que as métricas de p95 e os limites do provedor estiverem disponíveis.
