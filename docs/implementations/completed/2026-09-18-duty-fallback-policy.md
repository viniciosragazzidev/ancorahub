# Continuidade de distribuição em filas com plantão

## Objetivo

Evitar que uma fila fique sem tratamento quando o plantão selecionado ainda não
começou ou já terminou, e eliminar o atraso de jobs que foram adiados antes do
início de uma escala válida.

## Entrega

- `lead_queues` passou a persistir `duty_fallback_policy` e uma fila de
  contingência opcional.
- A configuração da fila oferece três políticas: disponibilidade normal da
  unidade, aguardar o próximo plantão e fila de contingência.
- Filas novas e legadas usam a continuidade da unidade como padrão; a gestão
  pode selecionar o modo estrito quando realmente quiser aguardar a escala.
- A fila de contingência é validada no servidor, limitada ao tenant, não pode
  apontar para si mesma ou criar ciclos e o encaminhamento gera evento de
  distribuição e auditoria.
- O worker acorda jobs pendentes/adiados quando encontra um plantão ativo para
  a fila, mantendo os filtros de disponibilidade, capacidade, unidade e origem.

## Validação

- Testes direcionados de domínio, ações de plantão e jobs.
- Type-check sem erros introduzidos pela alteração; permanece a falha
  preexistente em `scripts/_tmp-diag2.ts` (`p.userId` possivelmente nulo).
- Migração `0151_queue_duty_fallback_policy.sql` registrada no journal do
  Drizzle.

## Rollback

Desativar a política de contingência na fila ou reverter a migração e os
commits desta entrega. O comportamento estrito das filas legadas foi mantido
para permitir reversão sem redistribuir leads fora da escala configurada.
