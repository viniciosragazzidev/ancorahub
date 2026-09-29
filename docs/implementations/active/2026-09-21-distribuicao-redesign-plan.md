# 2026-09-21 — Redesign da Central de Distribuição (plano e Lote 0)

**Estado:** Lote 0 (kit) em validação visual · Lotes 1–7 aguardando aprovação do kit
**Rota:** `/distribuicao` (canônica) — `/leads/distribuicao` e `/leads/distribuicao/plantao` viram redirects
**Referências:** `docs/design-system.md`, `docs/ux/UX_REDESIGN_CONTRACT.md`, skill `dataviz` (KPI/estado)

## Diagnóstico (a partir do código)

- Casca da página usa o design system (134 usos de `ds-*`); os 9 painéis internos usam 0.
- `distribution-dashboard.tsx`: 42 cores cruas (`emerald`/`amber`/`sky`), inclusive em números.
- `queue-control-center.tsx` (1.933 linhas): 42 usos de `text-[Npx]` (10px, abaixo do mínimo de 11px)
  e três badges cromáticos no mesmo cabeçalho do card de fila.
- 6 abas com "entradas" duplicado (Entradas e regras × Filas › Entradas e exceções); aba Filas
  empilha 5 blocos (regras, unidades, filas, SLA, política); 3 URLs competem.
- A confirmar: o bloqueio do papel `manager` está no layout de `/leads/distribuicao`, não em
  `/distribuicao` (que reexporta a mesma página).

## Decisões aprovadas

1. **5 áreas**: Operação · Plantões · Regras · Filas (diretor) · Acompanhamento
   (Resumo do dia + Auditoria + Motor, alternados por controle segmentado).
2. **Edição em drawer lateral** (`DsSheet`) para fila, plantão e regra.
3. **Ordem**: Lote 0 (kit) → **Operação** → Plantões → Regras → Filas → Acompanhamento → QA.

## Princípios

Uma ação primária por contexto · métrica só se mudar uma decisão · cor é estado (com texto),
nunca decoração · no máximo uma cor cromática por componente · cards só para grupos acionáveis ·
complexidade sob demanda · movimento só explica mudança (≤ 250 ms, desligado em
`prefers-reduced-motion`).

## Lote 0 — kit (entregue nesta branch)

`src/components/ui/`: `ds-tabs`, `ds-segmented-control` (pílula deslizante), `ds-callout`,
`ds-section-header`, `ds-sheet`, `ds-switch`, `ds-checkbox`, `ds-data-row` (`DsDataList`,
`DsDataRow`, `DsMetaChip`), `ds-selection-bar`, `ds-skeleton`, `ds-count-up`.
`src/styles/design-system/motion.css`: `ds-rise` (entrada escalonada), `ds-fade`, `ds-skeleton`.
`src/features/lead-distribution/status-ui.ts` (+ teste): **mapa único** estado de domínio →
badge (tom + texto). Revisão visual interativa em `/dev/distribuicao-kit` (somente `next dev`).

Pendente do kit: `DsSelect` (entra no Lote 4, primeiro uso real).

## Próximos lotes

| Lote | Entrega |
| --- | --- |
| 1 | Casca + 5 áreas + rota canônica + contadores nas abas + URL como estado |
| 2 | Operação (faixa de 3 indicadores, filtros segmentados, lista, ação em lote) |
| 3 | Plantões (faixa "de plantão agora", grade semanal, edição em drawer) |
| 4 | Regras (regra em frase legível, simulador lateral, `DsSelect`) |
| 5 | Filas (lista + drawer com seções; quebra de `queue-control-center`) |
| 6 | Acompanhamento |
| 7 | QA 375/768/1280, teclado, dark, movimento reduzido; documentação; limpeza |

**Critério de saída de cada lote (verificável por `grep`):** 0 cores cruas, 0 `text-[Npx]`,
no máximo 1 cor cromática por componente, 1 CTA primária por tela. Nenhuma regra de negócio,
action ou consulta é alterada; rollback = reverter o commit do lote.
