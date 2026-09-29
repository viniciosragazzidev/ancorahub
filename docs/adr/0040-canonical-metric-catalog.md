# ADR 0040: catálogo canônico de métricas para relatórios

## Context

"Conversão" era calculada em pelo menos oito superfícies com definições divergentes:
`/relatorios` e `/clientes` dividiam clientes convertidos no período por leads criados
no período (populações diferentes — uma venda de agosto pode vir de um lead de junho),
o NOC usava janela mensal, o Meta Ads dividia vendas por leads da campanha e o
broker-summary dividia convertidos por recebidos por corretor. Cada nova tela de
métrica obrigava a reinventar o cálculo, e o mesmo termo exibia números distintos
dependendo da rota — quebrando a confiança da diretoria nos relatórios.

O funil também tinha duas verdades: a máquina de estados do ADR-001 define 8 estágios
(`new → distributed → in_contact → quote_sent → negotiation → documentation_pending →
under_analysis → converted`), mas rascunhos de relatório desenhavam um funil de 5
etapas com agrupamento implícito não registrado em lugar nenhum.

## Decision

Criar um catálogo canônico de métricas versionado em
`src/features/reports/metrics`, consumido por `/relatorios` e pelos cálculos de maior
risco de divergência (NOC, `/clientes`, broker-summary) já na primeira entrega:

- Cada métrica é uma `MetricDefinition` com id estável (`commercial.conversion_rate`),
  rótulo, formato, explicação de numerador/denominador e dimensões permitidas.
- A definição canônica de conversão é **coorte de entrada**: convertidos ÷ leads
  recebidos no período (excluídos duplicados/descartados). Numerador e denominador
  resolvem para a mesma população, viabilizando o drill-down "ver os convertidos / ver
  os não convertidos" sobre uma lista concreta.
- O relatório de funil exibe exatamente os 8 estágios canônicos do ADR-001; nenhum
  agrupamento paralelo é institucionalizado.
- O escopo de dados de toda métrica deriva exclusivamente do contexto de sessão
  (`getRequiredTenantContext` + supervisão); filtros de cliente apenas refinam dentro
  do escopo autorizado.
- Atribuição histórica usa a titularidade persistida no registro; snapshot por evento
  é dívida documentada para a fase 2/3.

Alternativas rejeitadas:

- **Migrar todas as oito superfícies na primeira entrega** — multiplicaria o risco de
  regressão em telas estáveis; as telas restantes migram por entregas com dívida
  registrada no roadmap.
- **Definição por eventos do período** (conversões ÷ leads do período) — reage rápido,
  mas soma no numerador vendas de leads antigos e o denominador não explica o
  numerador, perpetuando exatamente o desvio que motivou o catálogo.
- **Funil agrupado de 5 etapas** — criaria uma segunda regra de apresentação com
  agrupamento implícito, contra o princípio de que o relatório consulta os domínios
  oficiais sem tradução própria.

## Consequences

- Números de conversão podem mudar em telas migradas (a definição anterior tinha viés
  temporal); a mudança é intencional e documentada na DEC-090.
- Telas não migradas na primeira entrega (`/dashboard`, Meta Ads, branches, MCP tools)
  podem divergir do catálogo até sua migração — dívida registrada no roadmap.
- Métricas novas exigem entrada no catálogo antes de aparecerem em qualquer superfície;
  o catálogo é o ponto único de revisão de definição.
- A nova central de relatórios é reversível pela capability global
  `feature_reporting_center_enabled` (padrão DEC-070), sem perda de dados.
