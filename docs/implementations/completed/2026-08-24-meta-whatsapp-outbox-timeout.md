# Recuperação controlada do outbox WhatsApp oficial

## Objetivo

Evitar que uma chamada sem resposta da Graph API faça o job de saída do WhatsApp
oficial expirar na Vercel. O template de notificação de corretor permanece
`new_lead_broker`.

## Escopo e arquivos

- `src/features/communication-channels/meta-cloud-client.ts`: timeout de 8 segundos
  por chamada oficial à Graph API, com erro normalizado para a fila.
- `src/features/communication-channels/outbound-service.ts`: log operacional seguro
  quando o envio é adiado.
- `src/features/communication-channels/meta-cloud-client.test.ts`: contrato de uma
  requisição de template parada que termina de modo controlado.

## Decisões

- A fila persistente, sua idempotência e o retry exponencial existentes continuam
  sendo a autoridade para nova tentativa.
- O log contém apenas IDs operacionais, finalidade, tentativa e código do provedor;
  não inclui telefone, mensagem ou credencial.
- Não houve mudança em WAHA, webhook inbound, distribuição, templates ou dados.

## Validações

- `npx vitest run src/features/communication-channels/meta-cloud-client.test.ts` — 16 testes aprovados.
- `npm run type-check` — aprovado.
- `npm test` — executado sem falha reportada.
- `npm run agent:verify -- --level fast` e `--level full` — documentação e arquitetura aprovadas; o lint geral reporta apenas mojibake preexistente em `src/features/platform-admin/purge-job.ts`.
- `npm run build` — compilação de produção iniciada com sucesso; a evidência da ferramenta local não retornou o encerramento completo do processo.

## Riscos e rollback

Uma indisponibilidade da Meta passa a retornar à fila em até 8 segundos, em vez de
consumir todo o tempo da função. Para reverter, reverta o commit desta entrega;
nenhuma migração ou alteração de dados é necessária e mensagens pendentes permanecem
no outbox.
