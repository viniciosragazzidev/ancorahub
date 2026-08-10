# Correção de schema para criação de acesso de equipe

## Problema corrigido

Ao criar um acesso de equipe, o código enviava a coluna `tenant_memberships.supervisor_id`, mas o banco de produção não possuía essa coluna. O PostgreSQL recusava o cadastro antes de criar o vínculo do usuário.

## Entrega

- Criada a migration `0112_add_tenant_membership_supervisor.sql`.
- A migration adiciona `supervisor_id` como referência opcional para `user` e cria o índice de consulta correspondente.
- A alteração é aditiva: não remove ou altera usuários, vínculos, filiais ou permissões existentes.

## Recuperação do histórico de migrations

Antes de aplicar a migration nova, foi encontrado histórico incompleto para as migrations `0103` a `0111`. A estrutura correspondente já existia no banco: tabelas, tipos, colunas, índices e a constraint WAHA foram conferidos antes de registrar somente os hashes ausentes no ledger `drizzle.__drizzle_migrations`.

## Validação

- `npm run db:migrate`: aplicou `0112_add_tenant_membership_supervisor.sql` e deixou o banco atualizado.
- Consulta controlada confirmou coluna, índice e hash da migration no ledger.
- `npm run db:check`: concluído com sucesso.
- `npm run type-check`: concluído com sucesso.
- `git diff --check`: concluído sem erro.

## Rollback

Não é necessário rollback para retomar a criação de acessos. Caso seja necessário reverter o código, a coluna adicional pode permanecer sem impacto nos dados existentes.
