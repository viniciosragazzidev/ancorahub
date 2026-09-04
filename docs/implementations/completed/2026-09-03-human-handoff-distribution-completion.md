# Conclusão de handoff humano na distribuição automática

**Data:** 03/09/2026  
**Estado:** concluído (correção de fluxo de domínio)

## Diagnóstico

O pedido explícito de atendimento humano encerrava visualmente a conversa, mas não
aplicava de forma consistente os estados exigidos pelo processador de distribuição.
Em especial, o lead podia continuar como `IN_PROGRESS` ou fora de `queued`; nesse
estado o job persistido o recusava antes de avaliar os corretores da unidade.

O sweep de timeout preservava a fila e criava o job, mas dependia apenas da execução
posterior do scheduler para a primeira tentativa.

## Implementação

- `buildHumanHandoffLeadUpdate` centraliza a transição atômica para
  `QUALIFIED`, `waiting_human` e `queued`.
- Quick Reply, handoff decidido pela IA e `TRANSFER_HUMAN` usam a mesma transição.
- `enqueueAndProcessLeadDistribution` persiste primeiro o job idempotente e executa
  uma tentativa imediata, limitada ao lead e ao tenant. Falhas ou ausência de
  elegível mantêm o job para recuperação auditável.
- O timeout usa o mesmo mecanismo após o commit de fila/unidade.

Não houve alteração de schema, migração, tela, credencial ou chamada externa.

## Garantias operacionais

1. Handoff ou timeout encerra a qualificação antes da distribuição.
2. A fila e a unidade já resolvidas no intake são preservadas.
3. Em horário comercial, a unidade é avaliada e um corretor elegível recebe a
   atribuição no mesmo ciclo.
4. Sem corretor elegível, a atribuição não é descartada: fica `queued`, com motivo
   e tentativa/retry registráveis no job.
5. A Central/Matriz continua excluída como destino automático.

## Arquivos afetados

- `src/features/ai-agent/human-handoff-state.ts`
- `src/features/ai-agent/conversation-state-machine.ts`
- `src/features/ai-agent/trigger-execution-engine.ts`
- `src/features/ai-agent/qualification-timeout-sweep.ts`
- `src/features/lead-distribution/jobs.ts`
- `src/features/ai-agent/human-handoff-state.test.ts`
- `docs/business-rules.md`
- `docs/decision-log.md`
- `src/features/roadmap/roadmap-data.ts`

## Verificação

- Testes focados do agente, Quick Reply e timeout: aprovados (12 testes).
- TypeScript estrito: aprovado.
- Build de produção: aprovado.
- `agent:docs` e `agent:verify --level full`: executados. Os diagnósticos não
  encontraram achado de segurança; os dois alertas de arquitetura/desempenho são os
  arquivos grandes pré-existentes. O lint global permanece bloqueado por um único
  `prefer-const` pré-existente em `conversation-state-machine.ts`, fora deste recorte.
- `git diff --check`: aprovado.

## Rollback

Reverter os arquivos de domínio acima remove apenas a tentativa imediata e a
normalização do estado de handoff. Nenhum dado novo ou migration precisa ser revertido.
