# Listas de importação do supervisor separadas (2026-11-24)

Decisão: DEC-191 em `docs/decision-log.md`.

## O que mudou

- Cada importação do supervisor vira uma lista própria (`supervisor_lead_lists`), como uma pasta de leads. Nome padrão "Lista DD/MM", "(2)" quando há outra no mesmo dia; o supervisor troca o nome no passo Conferir.
- `/leads?vista=lista` mostra as listas numa tabela Lite (entraram, duplicados, fora, para distribuir, responderam). `?lista=<id>` abre só os leads da lista, com renomear no menu "⋯" e o filtro "Lista"; `?lista=todas` junta todos os contatos dizendo a lista de cada um.
- Distribuir dentro de uma lista vale só para os leads dela (`listId` no `distributeSupervisorLeads`).
- Laboratório: `/dev/laboratorio`, fluxo "Lista da equipe (supervisor)": pastas, abrir lista, todos os contatos, renomear e importar com nome sugerido, sem servidor.

## Arquivos

- `drizzle/0236_supervisor_lead_lists.sql` e journal; `src/shared/db/schema.ts` (`supervisorLeadLists`).
- `src/features/supervisor-workspace/lead-import/`: `list-names.ts`, `list-schema.ts` (vínculo `leads.import_list_id` fora de `schema.leads` e checagem da migration), `service.ts`, `actions.ts`, `team-list-import.tsx`, `team-list-manager.tsx`, `team-lists-view.tsx`, `team-list-rename.tsx`.
- `src/app/(dashboard)/leads/page.tsx`, `src/app/dev/laboratorio/lab.tsx`.

## Produção

- A migration 0236 **não foi aplicada**. Aplicar só com o ok do usuário (`npm run db:migrate`). Antes disso a tela continua com a lista única de antes, sem erro.
- O backfill da migration agrupa os leads antigos pelo `importId` de cada importação.

## Verificação

- `npx tsc --noEmit` limpo; `vitest` em `src/features/supervisor-workspace` e `src/app/dev`: 23 arquivos, 169 testes passando (novos: `list-names.test.ts`, `team-lists-view.test.tsx`).
- Preview 3005 em `/dev/laboratorio` (fluxo Lista da equipe).
