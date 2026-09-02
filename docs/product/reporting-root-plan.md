# Plano — Reporting & Business Intelligence (`/relatorios)

Estado: **Fase Reporting 1 em implementação** — decisão DEC-090 e ADR-0040 aprovadas.
Data: 2026-09-01

## 1. Princípio

Relatórios não é um conjunto de dashboards: é a camada de **inteligência operacional e
gerencial** do CRM. O fluxo esperado é:

> Entrar em `/relatorios` → escolher o que quero entender → receber resposta concreta →
> chegar aos registros que explicam aquele número.

Quatro regras fundamentais:

1. **Todo número precisa ser explicável.** KPIs expõem numerador, denominador e
   população; drill-down leva ao registro (Lead/Venda).
2. **Relatório não cria segunda regra de negócio.** Métricas vêm do catálogo canônico
   (`src/features/reports/metrics`), que consulta os domínios oficiais (máquina de
   estados do ADR-001, qualificação, distribuição, vendas). Nenhuma tela recalcula
   "conversão" localmente.
3. **Poucos relatórios, muitas dimensões.** Famílias fortes com filtros/dimensões
   dentro delas — não uma rota por recorte.
4. **Dashboard mostra situação; Relatório explica.**

## 2. Decisões aprovadas (DEC-090)

| # | Decisão |
|---|---------|
| 1 | Unificação das métricas duplicadas via catálogo canônico; `/relatorios` e os consumidores de maior risco de divergência (NOC, `/clientes`, broker-summary) migram na Fase 1; os demais migram por telas nas próximas entregas, com dívida registrada no roadmap. |
| 2 | `commercial.conversion_rate` = **coorte de entrada**: leads recebidos no período que chegaram a `converted` ÷ leads recebidos no período (excluídos duplicados/descartados). Numerador e denominador resolvem para a mesma população. |
| 3 | Funil apresenta os **8 estágios canônicos do ADR-001** (`new → distributed → in_contact → quote_sent → negotiation → documentation_pending → under_analysis → converted`); gargalo calculado sobre progressão real entre estágios. Nenhum agrupamento inventado. |
| 4 | Período pela **DEC-059** (presets 7/14/30/90 em `?period=N`); comparação com a janela anterior equivalente derivada automaticamente. Range livre exige emenda formal da DEC-059 (futura). |
| 5 | **Matriz conservadora** papel × aba (seção 6). Abas fora do escopo nem aparecem; o seletor de unidade nunca concede acesso além do escopo da sessão. |
| 6 | Seção **"O que exige atenção"** com 4 itens deriváveis de fatos persistidos; thresholds reutilizam os parâmetros já existentes do tenant (`tenants.slaFirstContactMinutes`, `tenants.slaStagnantDays`), editáveis pelo Diretor. |
| 7 | Governança pela capability global `feature_reporting_center_enabled` (padrão DEC-070): desativada = layout legado atual; alterações auditadas em `platform_audit_logs`. |
| 8 | **Atribuição histórica** pela titularidade persistida no registro no momento do evento. Snapshot por evento (`broker_at_sale`, `unit_at_event`) é decisão explícita da fase 2/3 (dívida documentada na seção 9). |
| 9 | Exportações operacionais, planilhas importadas e documentos internos **permanecem** na rota, reorganizados; exportação contextual por família fica para a fase 2. |
| 10 | Adiados: cohorts, relatórios salvos/programados, aba Atendimento, Conversation Intelligence, AI Analyst. |

## 3. Home única: `/relatorios`

Cabeçalho com contexto (período, escopo) + abas:

```
Visão geral | Comercial | Equipe | Unidades | Financeiro
```

Aba ativa persistida em `?tab=` (contexto recuperável por URL, AI_RULES §7).
Financeiro gated pela capability `ver_relatorios_financeiros`.

## 4. Visão geral

- **5 KPIs** com comparação contra a janela anterior equivalente: Leads recebidos,
  Vendas, Conversão, Receita (se permitido), Ticket médio (se permitido).
- Diferença de taxa exibida em **pontos percentuais (pp)**, nunca como "% de aumento"
  (distinção estatística obrigatória).
- **Funil dos 8 estágios**: volume que alcançou cada estágio (ordem canônica),
  progressão entre etapas, maior gargalo (etapa com maior queda absoluta).
- **O que exige atenção** (4 itens, seção 7).

## 5. Comercial

- Entrada: recebidos, duplicados/descartados, qualificados, em qualificação.
- Por origem (`origem` canônica): leads, vendas, conversão (coorte), receita se
  permitido.
- Atendimento: tempo médio até o primeiro contato (`firstContactLatencySeconds`),
  dentro/fora do SLA de primeiro contato (parametrizado pelo tenant).
- Resultado: convertidos, perdidos, em andamento, conversão (coorte), tempo médio até
  a conversão (`createdAt → saleDate`).
- Drill-down por origem e por status.

## 6. Matriz papel × aba (v1)

| Papel | Abas visíveis | Restrições |
|---|---|---|
| Diretor | Todas | Escopo tenant; seletor de unidade como filtro, nunca como concessão |
| Gestor | Visão geral, Comercial, Equipe, Unidades | Somente a própria unidade; sem comparativo entre unidades; Financeiro só com capability |
| Supervisor | Comercial, Equipe | Apenas supervisionados; sem valores/comissões; sem Unidades |
| Corretor | Comercial | Somente dados próprios |

Escopo derivado exclusivamente da sessão (`getRequiredTenantContext` + serviços de
supervisão); qualquer `branchId`/`corretorId` de cliente é apenas filtro **dentro** do
escopo autorizado, validado no servidor.

## 7. O que exige atenção (v1)

Itens deriváveis de fatos persistidos, com threshold reutilizando parâmetros do tenant:

1. Leads com qualificação concluída e **alta intenção sem corretor** (score alto +
   `corretorId` nulo / aguardando distribuição).
2. **Primeiro atendimento fora do SLA** (`firstContactAt` nulo ou latência acima de
   `slaFirstContactMinutes`), para leads distribuídos no período.
3. **Negociações paradas** (`status` ativo avançado sem avanço de etapa há mais de
   `slaStagnantDays`).
4. **Corretores acima da capacidade** (leads ativos vs capacidade da fila, quando a
   fila tem `capacityEnabled`).

Cada item lista contagem + link de drill-down para a população exata. Gargalo de
unidade vs média, R$ parado em propostas e alertas dependentes da DEC-003 (SLA formal)
ficam para a fase 2.

## 8. Equipe, Unidades e Financeiro

**Equipe** — por corretor: leads recebidos, trabalhados (`serviceStartedAt`),
tempo médio até 1º contato, SLA cumprido, qualificados, vendas, conversão (coorte),
tempo até venda, leads parados, receita (se permitido). Sem "score mágico"; dimensões
separadas. Comparação entre 2 corretores fica para a fase 2.

**Unidades** — comparativo agregado (Diretor): leads, conversão, SLA de 1º contato,
tempo de resposta, vendas. Gestor vê somente a própria unidade, sem ranking.

**Financeiro** (capability) — vendas, receita bruta (`status = active`), ticket médio,
receita por unidade/corretor/origem. Comissões previstas/pagas dependem da DEC-004 e
ficam como próximos passos; o cronograma existente em `/vendas` permanece a fonte.

## 9. Dívida conhecida e fases

- **Atribuição histórica**: v1 usa titularidade do registro; transferências de
  corretor/unidade alteram retroativamente a atribuição de métricas em andamento.
  Snapshot por evento é decisão da fase 2/3.
- **Consumidores não migrados na fase 1** (`/dashboard`, meta-ads, branches,
  MCP tools): dívida registrada no roadmap; números podem divergir dessas telas até a
  migração.
- **Tempo médio por etapa**: v1 só expõe tempos deriváveis (1º contato, tempo até
  conversão); tempo por etapa exige eventos de transição históricos (PipelineRoot).

```
REPORTING 1 (esta entrega)   catálogo canônico + home por famílias + atenção + drill-down
REPORTING 2                  Atendimento/SLA formal (DEC-003) + exportação por família + range livre (emenda DEC-059)
REPORTING 3                  Conversation Intelligence + cohorts + snapshot por evento
REPORTING 4                  Insights automáticos + AI Analyst (IA nunca inventa os números)
```

## 10. Catálogo de métricas (v1)

Definições versionadas em `src/features/reports/metrics/metric-catalog.ts`. Toda
superfície nova DEVE consumir o catálogo — nunca recalcular localmente.

- `commercial.leads_received` — leads recebidos no período (excl. duplicados/descartados)
- `commercial.conversion_rate` — coorte de entrada (DEC-090)
- `commercial.sales` — vendas registradas no período
- `commercial.average_sale_cycle_time` — média `createdAt → saleDate` das vendas da coorte
- `commercial.loss_rate` — perdidos ÷ recebidos (coorte)
- `commercial.first_contact_sla_rate` — 1º contato dentro do SLA do tenant
- `commercial.average_first_contact_latency` — média de `firstContactLatencySeconds`
- `commercial.high_intent_unassigned` — alta intenção sem corretor (atenção)
- `commercial.stale_negotiations` — negociações paradas (atenção)
- `team.brokers_over_capacity` — corretores acima da capacidade (atenção)
- `financial.gross_revenue` — soma de `saleValue` (vendas ativas)
- `financial.average_ticket` — receita ÷ vendas
