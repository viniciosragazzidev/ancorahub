# Plantões globais, edição de filiais e código de corretor

## Objetivo

Corrigir a edição de nome/identificador em `/filiais`, permitir código manual do
corretor na criação de equipe e tornar novos plantões globais para todas as
unidades, sem prioridade configurável. Também foi incluída exclusão permanente
com confirmação, além do arquivamento, e pesquisa de corretores por nome/código.

## Escopo e decisões

- Filiais continuam tenant-safe; atualização grava nome, identificador, `updatedAt`
  e auditoria, com feedback de sucesso/erro e refresh.
- O código informado só é aceito para cargo/perfil de corretor e é único por tenant;
  vazio mantém a geração automática.
- Novos plantões gravam `branch_id` e `queue_id` nulos, representando o tenant inteiro.
  Linhas legadas continuam válidas e podem ser migradas ao editar.
- Prioridade permanece apenas como legado de armazenamento para compatibilidade; não
  aparece nem é aceita na criação/edição nova.
- Exclusão definitiva remove regra e escala, preserva o evento de auditoria e exige
  confirmação explícita; arquivamento continua reversível.
- As tabelas de entradas e exceções de `/distribuicao` exibem apenas campanhas/anúncios
  ativos; rotas pausadas continuam preservadas no banco.

## Arquivos principais

- `src/features/branches/actions.ts`
- `src/features/branches/components/branches-manager.tsx`
- `src/app/(dashboard)/filiais/page.tsx`
- `src/features/team/create-user.ts`
- `src/app/(dashboard)/equipe/team-invite-section.tsx`
- `src/features/lead-distribution/duty-actions.ts`
- `src/features/lead-distribution/duty-schedule-input.ts`
- `src/features/lead-distribution/roster-queries.ts`
- `src/features/lead-distribution/roster-actions.ts`
- `src/app/(dashboard)/leads/distribuicao/plantao/_components/duty-operations-workspace.tsx`
- `drizzle/0152_global_duty_schedules.sql`

## Validação

- Testes focados de input de equipe e plantão: 11 aprovados.
- Type-check: sem erros introduzidos; permanece falha preexistente em
  `scripts/_tmp-diag2.ts` (`p.userId` possivelmente nulo).
- Lint dos arquivos alterados: sem erros; apenas avisos preexistentes em páginas
  maiores de leads/distribuição.

## Rollback

Reverter o commit e não aplicar `0152_global_duty_schedules.sql` em ambientes novos;
em banco já migrado, a reversão deve ser feita por migração operacional aprovada,
pois colunas que aceitaram nulo podem conter regras globais legítimas.
