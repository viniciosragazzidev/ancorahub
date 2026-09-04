# Inventário de métricas — Dashboard executivo

**Data:** 2026-09-04
**Escopo:** `/dashboard` para Diretor, branch `REFINE_APP`.

| Métrica / visão | Fonte e escopo | Serviço atual | Superfícies atuais | Situação | Ação desta etapa |
|---|---|---|---|---|---|
| Leads recebidos | `leads.createdAt`, tenant + escopo derivado da sessão | `getCommercialOverview` | `/relatorios` | CANONICAL | Consumir diretamente |
| Taxa de conversão | Coorte de entrada, `leads.status` | `getCommercialOverview` / `resolveCohortConversion` | `/relatorios` | CANONICAL | Consumir diretamente |
| Vendas / receita / ticket | `sales.saleDate`, `sales.saleValue`, join de lead com escopo | `getCommercialOverview`, `getFinancialOverview` | `/relatorios`, financeiro | CANONICAL | Consumir por capability financeira |
| Funil | `leads.status` no período | `getFunnelSnapshot` | `/relatorios` | CANONICAL | Consumir diretamente |
| Itens de atenção | SLA configurado no tenant, lead/filas | `getAttentionSnapshot` | `/relatorios` | CANONICAL | Consumir diretamente, com drill-down |
| Desempenho por unidade | `leads.branchId` + vendas vinculadas | `getUnitPerformance` | `/relatorios` | CANONICAL | Consumir diretamente |
| Série diária de entradas e conversões | `leads.createdAt` + `status=converted`, escopo canônico | `getLeadTimeline` | novo consumidor: `/dashboard` | CANONICAL (nova projeção) | Centralizar em `metrics-service.ts` |
| Totais, tendência e funil do dashboard antigo | queries diretas em `src/app/(dashboard)/dashboard/data.ts` | `getDirectorDashboardData` | dashboard NOC legado | DUPLICATED / CONFLICTING | Não usar para Diretor; manter temporariamente para outros papéis |
| NOC operacional | consultas próprias para monitoramento | `src/app/(dashboard)/noc/*` | `/noc` | REUSABLE, mas finalidade distinta | Não usar como origem executiva |

## Conflitos encontrados

1. O dashboard legado fixa limiares de 15 minutos e 3 dias, enquanto a fonte
   canônica lê `slaFirstContactMinutes` e `slaStagnantDays` do tenant.
2. O dashboard legado mistura totais históricos com dados de período; o
   catálogo canônico usa os presets 7/14/30/90 com população consistente.
3. O funil legado agrupa estágios. DEC-090 exige a máquina canônica de estados.

## Regra de consumo

Nenhuma interface pode recalcular localmente estas métricas. O dashboard chama
um adaptador de leitura que compõe apenas funções de
`src/features/reports/metrics/metrics-service.ts`; ele não executa consultas
diretas ao banco.
