# Modo Lite da rota /leads para corretor

**Data:** 19/08/2026
**Estado:** ativo (aguardando ciclo `agent:verify --level full`)

## Objetivo

Quando o corretor está no modo de experiência Lite, `/leads` deve exibir a mesma
linguagem visual do dashboard lite do corretor: lista simples, com busca, filtros
de situação e acesso direto ao atendimento — sem kanban, tabelas densas, filtros
de gestão ou ações de supervisão. Funcionalidades operacionais (aceitar lead,
abrir atendimento, atualizar etapa) permanecem via o detalhe do lead, que já é
lite para corretor.

## Implementação

- **`src/app/(dashboard)/leads/page.tsx`**: saída antecipada quando
  `context.role === "broker"` e `getExperienceMode(context) === "LIGHT"`.
  Consulta leve dos leads do corretor (escopo derivado do contexto, nunca do
  cliente), respeitando o mesmo filtro de leads distribuídos expirados da página
  normal, enriquecida com:
  - `productName` via `carrierPlans.name` (left join por `planId`);
  - `livesCount`, `city` e `summary` lidos de `qualification_details`
    (`qtdVidas`, `cidade`, `resumoAtendimento`/`resumoNecessidade`);
  - `dueAt` como prazo de 1º contato (SLA) para leads novos/distribuídos ou a
    tarefa pendente mais próxima; `isOverdue` derivado.
  - Renderiza `LightLeadsList` (mesmo estilo do dashboard lite: `max-w-4xl`,
    toggle de experiência, pills de filtro, busca e cards com ação primária).
- **`src/features/lead-distribution/types.ts`**: `LeadRoutingResult` com
  `queueId: string | null` — ajuste de tipo para o working tree existente que
  já permite roteamento sem fila; desbloqueia `tsc` para o recorte.

## Arquivos afetados

- `src/app/(dashboard)/leads/page.tsx`
- `src/features/lead-distribution/types.ts`

## Risco e rollback

Saída antecipada isolada no fluxo Lite do corretor; o modo normal e os demais
papéis permanecem intactos. Não há migração, alteração de dados nem efeito
externo. Rollback: remover o bloco `if (... LIGHT ...)` na página.

## Validações

- `npx tsc --noEmit` — aprovado (após ajuste de `queueId`).
- `npx eslint` nos arquivos alterados — 0 erros (avisos pré-existentes de
  `Date.now` no servidor, alinhados ao padrão de `minha-fila/page.tsx`).
- `npx vitest run src/features/broker-workspace src/features/lead-distribution`
  — 20 testes aprovados.
- `npm run agent:verify -- --level fast` — evidência em
  `reports/agent/verification/`; falha pré-existente não relacionada ao recorte
  (`src/features/meta-ads/components/meta-integration-view.test.tsx`).
- `npm run agent:verify -- --level full` — evidência em
  `reports/agent/verification/2026-08-19T12-01-51.994Z.md`; docs, changed,
  architecture, security, performance e type-check aprovados. `lint` e `test`
  falham apenas em itens pré-existentes fora do recorte: erros de lint em
  `.agents/skills/impeccable/scripts/**` e meta-ads, e teste de desconexão da
  integração Meta Ads (`meta-integration-view.test.tsx`). Nenhum erro nos
  arquivos alterados (apenas avisos de `Date.now` no servidor, alinhados ao
  padrão de `minha-fila/page.tsx`).