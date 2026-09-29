# Drawer de lead: atribuição pelo plantão ativo da fila

## Objetivo

Quando o lead pertence a uma fila com plantão ativo e correspondente à origem,
listar no drawer todos os corretores ativos escalados nessa escala, sem limitar
por unidade e sem oferecer troca manual de unidade.

## Escopo implementado

- Detecta escalas vinculadas pela configuração atual da fila ou pelo vínculo
  legado `unit_duty_schedules.queue_id`, respeitando tenant, validade, dia,
  horário e credencial de origem do lead.
- Consulta escalados em todas as unidades, exigindo escala e vínculo de equipe
  ativos no tenant.
- Oculta a seção de troca de unidade enquanto a escala da fila está ativa e
  substitui a lista de corretores por esse roster. A unidade/fila do lead não muda.
- Revalida no servidor a permissão do ator, o corretor ativo e a escala elegível
  no momento da reatribuição. Sem escala ativa compatível, mantém a regra atual
  de mesma unidade.

## Arquivos

- `src/app/(dashboard)/leads/_components/lead-drawer-management-actions.tsx`
- `src/app/(dashboard)/leads/leads-workspace.tsx`
- `src/features/leads/management-actions.ts`
- `src/features/lead-distribution/active-queue-duty-roster.ts`
- `src/features/lead-distribution/duty-roster-matching.ts`
- `src/features/lead-distribution/duty-roster-matching.test.ts`
- `docs/business-rules.md`, `docs/decision-log.md`, `CONTEXT.md`

## Validação

- `npm test -- src/features/lead-distribution/duty-roster-matching.test.ts` — 8
  testes passaram, incluindo escala em outra unidade, vínculo por fila, exclusão
  de escala não relacionada e preservação da regra de mesma unidade sem plantão.
- ESLint focado nos arquivos TypeScript/TSX alterados — passou.
- Build completo pendente enquanto o trabalho paralelo no mesmo checkout está em
  andamento; não promover como conclusão de build até executá-lo.

## Risco e rollback

Sem migration. O rollback consiste em reverter somente a consulta do roster e as
condições do drawer/ação; os vínculos existentes de filas e plantões permanecem
intactos.
