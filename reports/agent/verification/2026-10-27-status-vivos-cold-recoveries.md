# Verificação: Frios recuperados na faixa de status vivos

Data: 2026-10-27

## Escopo validado

- O cartão `Fila Leads Frios` foi substituído por um agregado de tentativas enviadas e recuperações confirmadas por resposta inbound e auditoria de classificação morna/quente.
- A consulta cobre tentativas manuais, automáticas, legado e T2 da régua turbo, respeita tenant e escopo do papel, e exclui stories e mensagens vazias.
- O início da operação usa `businessTurnStart` em `America/Sao_Paulo`; não foi criada nem executada migration.
- Fixture `/dev/diretor-shell-real` e documentação foram atualizadas. Não existe lista com filtro exato para oferecer link.

## Comandos

- `npx vitest run src/features/live-status --maxWorkers=1`: passou, 9 arquivos e 62 testes.
- `npx tsc --noEmit`: passou.
- `git diff --check`: passou.

Não foram lidos `.env.local`, acessado banco, rodados testes de banco, migrations ou build.
