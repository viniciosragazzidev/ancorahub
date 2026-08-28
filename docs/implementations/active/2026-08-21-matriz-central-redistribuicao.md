# Matriz como Central de redistribuição

## Objetivo

Permitir uma única unidade por tenant como Central de redistribuição (Matriz), sem
que ela participe de qualquer seleção automática. Um lead na Central permanece em
fila para decisão do Diretor e pode ser encaminhado manualmente a uma unidade normal
e a um corretor elegível.

## Escopo e arquivos

- `drizzle/0136_distribution_hub_branch.sql` e schema: marca persistente única por tenant.
- `src/features/lead-distribution`: bloqueio da Central no resolvedor automático e
  manutenção do encaminhamento manual do Diretor.
- `src/features/leads/assignment.ts`: caminhos legados não atribuem automaticamente
  para a Central; plantão ativo sem escala não cai no fallback da unidade inteira.
- `src/features/branches`: configuração auditável para definir/remover a Central em
  `/filiais`.

## Decisões

- DEC-080, BR-029K e BR-029E foram consultadas.
- DEC-082 registra a decisão aprovada: a Central é uma unidade administrativa de
  redistribuição, não um destino automático, e sua identificação não depende do nome.

## Validações

- `npx vitest run src/features/lead-distribution/domain.test.ts --reporter=verbose`: 13 testes passaram.
- `npm run db:check`: passou.
- `npm run agent:verify -- --level full`: documentos, escopo, segurança e diagnósticos executados; lint e type-check continuam bloqueados por erros preexistentes em `react-aria-components` e por mojibake em `src/features/platform-admin/purge-job.ts`.
- `npm run build`: iniciou corretamente, mas ficou sem progresso na otimização Turbopack e foi interrompido após vários minutos; não houve erro atribuído a esta alteração.

## Riscos e rollback

Remover a marca da unidade em `/filiais` reverte a configuração operacional. Em caso
de rollback técnico, reverter o código e manter a coluna como dado inerte; a migration
não remove leads nem histórico. Antes de remover a migration, desmarcar a Central de
cada tenant que a utilize.
