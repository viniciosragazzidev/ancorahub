# Reparo de schema da Central de Distribuição

## Resultado

`/leads/distribuicao` voltou a carregar sem modificar filas, leads ou regras de distribuição existentes.

## Causa confirmada

O runtime de produção selecionava `lead_queues.exclusive_duty_schedule_id`, enquanto a coluna não existia no banco. O PostgreSQL retornava `42703`, interrompendo a renderização server-side da rota.

## Alterações

- Incluída a migration idempotente `0124_lead_queue_exclusive_duty_schedule` para criar a coluna opcional e seu índice.
- Aplicada a migration no banco de produção.
- O salvamento de fila agora aceita um plantão exclusivo apenas quando ele pertence ao tenant e à unidade da fila.

## Evidências

- Consulta equivalente à usada pela página executada no banco de produção: coluna presente e 2 filas retornadas.
- `npm run type-check`: aprovado.
- `npm test -- --run src/features/lead-distribution/domain.test.ts src/features/lead-distribution/jobs.test.ts`: 2 arquivos e 10 testes aprovados.
- `npm run agent:docs`: aprovado.
- Verificação integral anterior: testes (93 arquivos/383 testes), type-check e build aprovados; o lint global permanece bloqueado exclusivamente por erros pré-existentes em diretórios externos `temp_deskcomm_crm/`, `.agents/skills/` e `update_cards.js`.
