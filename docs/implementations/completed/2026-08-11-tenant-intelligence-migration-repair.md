# Reparo de migration da Central de Inteligência

## Objetivo

Restaurar a disponibilidade de `/inteligencia` em produção depois que o código passou a consultar as tabelas da Central de Inteligência antes que a migration correspondente tivesse sido registrada no banco.

## Causa

O schema TypeScript já declarava as tabelas de Inteligência, mas o journal Drizzle encerrava em `0113_workflow_automation_foundation`. Assim, `tenant_intelligence_profiles` e as tabelas relacionadas não eram criadas pelo processo controlado de migration.

## Correção

- Adicionada `0114_tenant_intelligence_foundation.sql`, idempotente, contendo somente as tabelas e índices que já existem no schema da Central.
- Registrada a entrada `0114` no journal Drizzle.
- A migration foi aplicada uma única vez no banco configurado pelo passo controlado `npm run db:migrate`.

## Validações

- `npm run db:check`: aprovado.
- `npm run type-check`: aprovado.
- `npx vitest run src/features/tenant-intelligence/tenant-intelligence.test.ts --reporter=dot`: 1 arquivo e 3 testes aprovados.
- `npm run db:migrate`: aplicou `0113_workflow_automation_foundation.sql` e `0114_tenant_intelligence_foundation.sql`; nova execução deve permanecer sem alterações.

## Risco e rollback

As tabelas são novas e não alteram dados operacionais existentes. O rollback da interface consiste em desativar a capacidade pelo controle de feature; a remoção física das tabelas exige migration revisada e não deve ser feita como reversão automática.
