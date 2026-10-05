# Drawer, falta e presença presencial no plantão

## Objetivo e escopo entregue

No detalhe de um plantão, o card do corretor abre um drawer com contato, presença, pausa e confirmação, além dos leads recebidos dentro da janela da ocorrência. Falta fica registrada por corretor e ocorrência na linha de presença existente, divide a escala entre ativos e faltaram e bloqueia distribuição e simulação antes do ranking. O tipo online/presencial usa `online` como padrão; plantões presenciais exigem liberação manual do gestor na unidade e não enviam convite de confirmação ao corretor.

## Arquivos e decisão de dados

- `src/app/(dashboard)/leads/distribuicao/plantao/[scheduleId]/page.tsx` e `_components/broker-occurrence-card.tsx`: card clicável, drawer, ações e grupos.
- `src/features/lead-distribution/duty-actions.ts`, `duty-presence.ts`, `duty-presence-domain.ts`, `duty-schedule-profile-queries.ts`: janela de leads, falta auditada e liberação presencial.
- `src/features/lead-distribution/service.ts`, `active-queue-duty-roster.ts`, `control-service.ts`: elegibilidade aplicada antes do ranking e no simulador.
- `src/shared/db/schema.ts`, `src/features/lead-distribution/duty-schedule-input.ts` e o formulário de edição: modo de presença com default `online`.
- `drizzle/0182_duty_attendance_mode_and_absence.sql`: coluna aditiva e ampliação do status da ocorrência para `absent`.

## Segurança, auditoria e rollback

As ações revalidam tenant, perfil de acesso e vínculo efetivo do corretor na ocorrência. A falta e sua reversão geram auditoria. O estado de falta ocupa a linha de presença única da ocorrência; o modo de presença tem default online para manter as escalas existentes. Rollback: desativar o modo presencial e remover os fluxos de falta; para reverter o schema, tratar as linhas `absent` antes de restaurar a constraint original. A migration não foi aplicada ao banco.

## Validação

- `npm.cmd exec tsc -- --noEmit --pretty false` — passou.
- Vitest direcionado para presença, janela da ocorrência e entrada do plantão — 31 testes passaram.
- Lint direcionado — passou sem erros; restam avisos preexistentes no efeito de busca do planner e em variáveis de mapeamento do roster.
- `npm.cmd run db:generate` falhou no sandbox com `uv_os_get_passwd returned ENOMEM`; a migration SQL e o journal foram preparados manualmente.
- Build não executado, conforme instrução do solicitante. Sem merge ou commit.
