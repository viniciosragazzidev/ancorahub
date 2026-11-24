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

- Migration 0236 aplicada em produção em 24/11/2026 com o ok do usuário, só ela, por `node scripts/apply-0236-supervisor-lead-lists.mjs --apply` (hash registrado em `drizzle.__drizzle_migrations`): 12 listas criadas, 8.813 leads ligados, 0 sem lista, índice válido.
- O backfill da migration agrupa os leads antigos pelo `importId` de cada importação.

## Verificação

- `npx tsc --noEmit` limpo; `vitest` em `src/features/supervisor-workspace` e `src/app/dev`: 23 arquivos, 169 testes passando (novos: `list-names.test.ts`, `team-lists-view.test.tsx`).
- Laboratório `/dev/laboratorio` (fluxo Lista da equipe) conferido num dev server do worktree na porta 3017, porque a 3005 estava fora do ar em 24/11: pastas, abrir lista, filtro Lista, renomear e nome sugerido "Lista 24/11 (2)" no Conferir. O merge em `preview/3005` foi feito e o `ancorahub-relatorio` está nele.
