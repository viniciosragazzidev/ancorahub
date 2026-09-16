# 2026-09-16 — Correção do Inbox de Distribuição (`/leads/distribuicao?view=operar`)

**Status:** concluída · **Build:** `npm run build` ok · **Evidência:**
`reports/agent/verification/2026-09-16T14-08-57.814Z.md`

## Objetivo da rota

Aba **"Operar & Inbox"** da Central de Distribuição (papel Diretor/Gestor). Objetivo
operacional: drenar as filas de leads **sem corretor** (`unassigned`, `queued`,
`returned_to_queue`) por envio para unidade, atribuição manual ou distribuição
automática. `?status=queued` pré-filtra "Aguardando corretor" e `#inbox-distribuicao`
ancora no card do inbox.

## Sintomas corrigidos

1. Lista desatualizada — leads com corretor continuavam no filtro "Sem corretor".
2. Botão "Auto" sem efeito visível.
3. Toasts que não disparavam em mutações consecutivas com mesmo resultado.
4. Contadores das "Filas de ação rápida" limitados aos ≤100 leads carregados.

## Causas e correções

| # | Causa | Correção | Arquivo |
|---|---|---|---|
| 1 | Query do inbox filtrava só `distributionStatus`, sem `isNull(corretorId)` (o motor já ignorava leads com corretor) | Filtro `isNull(corretorId)` na query do inbox; a fila volta a significar "sem corretor" (coerente com `seedQueuedLeadJobs` e DEC-104) | `page.tsx` |
| 2 | `distributeLeadAutomaticallyAction` só enfileirava com `onConflictDoNothing`; job ativo com `runAfter` futuro (ex.: `AWAITING_BROKER_ACCEPTANCE`) nunca era acordado | Enqueue + `wakeLeadDistributionJob` + processador em `after()` imediatamente após a resposta; mensagem atualizada | `actions.ts` |
| 3 | `publishLeadInvalidation` só ocorria **antes** do processador pós-resposta; a revalidação chegava com dado velho | Sinal imediato (commit) + revalidação **após** o processador (`continueLeadDistributionAfterResponse` e Auto) | `actions.ts` |
| 4 | Toasts comparavam `success`/`error` anteriores; segunda mutação igual não disparava toast | Feedback keyed por `mutationId` | `distribution-inbox.tsx` |
| 5 | `assumeLeadForInvestigation/Messaging` gravavam `corretorId` sem `distributionStatus` (criavam ghost na fila) | Invariante: assumir lead grava `distributionStatus: "assigned"` | `management-actions.ts` |
| 6 | Contadores das filas rápidas derivavam da lista truncada (limit 100) | Agregação própria (GROUP BY + `min(created_at)`) no mesmo escopo de tenant/filial | `page.tsx` |

## Decisões

- Mantida a DEC-104: vínculo provisório (`automatic_offer`) não é "sem corretor";
  sai do inbox e fica na carteira do corretor até aceite/recusa.
- `wakeLeadDistributionJob` acorda apenas jobs `pending`/`retrying`; job em
  `processing` com lease vivo não é tocado (sem dupla posse — DEC-097).
- Revalidação duplicada (commit + pós-processamento) é intencional: a primeira
  confirma a ação, a segunda reconcilia o estado real do motor.

## Validações

- `npx tsc --noEmit` — sem erros nos arquivos alterados.
- `npx vitest run src/features/lead-distribution` — 65/65 testes.
- `npx vitest run src/features/leads` — 106/106 testes.
- `npm run build` — produção ok.
- `agent:verify --level full` — 760/761; falha pré-existente e não relacionada:
  `src/features/broker-workspace/broker-lite-experience.test.tsx` (peso de navegação
  do workspace do corretor), que falha também sem estas alterações (registrada como
  falha preexistente separada).
- Script de reparo: `npx tsc --noEmit` limpo; dry-run e pós-execução validados
  contra o banco; idempotência confirmada por segunda execução.

## Reparo em lote dos registros legados (executado)

- Script: `scripts/repair-stale-distribution-status.ts` (dry-run padrão, `--apply`
  para gravar, `--tenant <uuid>` para escopo). Idempotente, em lotes de 500, com
  evento auditável `distribution_status_repaired` por lead e `auditLogs` por tenant
  (`lead.distribution_status_legacy_repair`).
- Semântica: tem corretor ⇒ `distributionStatus="assigned"`, sem exceção de
  terminais (lost/desqualificado também têm dono — o rótulo de fila mentia).
  Não altera `corretorId`, `assignedAt`, `status` nem titularidade.
- Execução: 2026-09-16, tenant `d47a4d41…` — 3 leads normalizados (`c0b384b3`,
  `817d6a1f`, `24e773c1`); segunda execução não encontrou registros (idempotência
  confirmada). Owners provisórios `automatic_offer` elegíveis ganham job
  `process_queued_lead` enfileirado; terminais não reentram no motor.
- Ajuste complementar no inbox: leads `lost`/`disqualified` sem corretor deixaram
  de aparecer como acionáveis na lista e nos contadores (mesma exclusão do motor
  `seedQueuedLeadJobs`).

## Riscos e rollback

- Rollback: reverter os três arquivos de feature + `page.tsx` (nenhuma migration,
  nenhuma mudança de schema).
- A revalidação pós-processamento publica duas invalidações por operação; o custo é
  uma revalidação extra de RSC por mutação, sem escrita adicional.
- `assume*` corrigido é retroativo apenas para novas operações; registros legados
  com `corretorId` + fila antiga deixam de aparecer no inbox pelo filtro servidor,
  mas seguem inconsistentes no banco até nova intervenção (reparo em lote permanece
  como evolução futura).
