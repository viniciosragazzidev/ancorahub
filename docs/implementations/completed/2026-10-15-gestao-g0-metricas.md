# G0 — Métricas da Gestão de Equipes

Data: 2026-10-15
Branch: `feat/gestao-g0-metricas`

## Entrega

- `team-management/metrics.ts` deriva o escopo no servidor, valida a flag global do Super Admin, audita consultas e mantém cache por 60 segundos.
- `reports/metrics/team-metrics-service.ts` agrega as janelas atual e anterior em uma consulta SQL com CTEs, com períodos de redistribuição de 3 dias. A saída contém corretor, equipe e unidade; o supervisor recebe somente a própria equipe.
- Conversão consome `commercial.conversion_rate` por coorte de entrada. Métricas operacionais novas estão registradas na família canônica `team` no catálogo.
- `trend.ts`, `health.ts` e `alerts.ts` são funções puras. O score usa os pesos do plano. Os valores sem número definido para alertas têm defaults de 3 leads sem próxima ação, 3 tarefas urgentes vencidas, média de carga acima/abaixo de 50% e piora de SLA superior a 5%; a API pura aceita limites substitutos.
- `feature_team_management_enabled` fica desligada por padrão e pode ser alterada com auditoria no painel existente do Super Admin. Consultas aos indicadores geram `audit_logs`.
- SQL de conferência manual no Supabase: `docs/implementations/active/2026-10-15-gestao-g0-sql-conferencia.sql`.

## Limites de escopo

A comparação com três corretores reais precisa ser executada pelo Vinicios no Supabase; esta implementação não acessou banco. O snapshot de leads ativos, tarefas vencidas e última atividade é atual, porque o esquema atual não guarda histórico temporal desses estados. A janela anterior é retornada para métricas de eventos e coorte.

O score de atividade recebe a cobertura recente e o equilíbrio de carga como entradas puras. A camada de dados entrega a última atividade por corretor; a fase consumidora calcula os dois dias úteis pelo calendário de plantão.

## Normalizacao do score

- SLA e aceite usam suas taxas percentuais, limitadas de 0 a 100.
- Pendencias: 100 - (retornos vencidos + leads sem proxima acao) / leads ativos * 100, limitado de 0 a 100. Sem leads ativos, recebe 100 sem pendencias e 0 caso contrario.
- Conversao: taxa da equipe dividida pela media da unidade. Sem media da unidade, recebe 100 quando houve conversao e 50 quando nao houve.
- Redistribuicoes: 100 - redistribuicoes / ofertas recebidas * 100, limitado de 0 a 100. Sem ofertas, recebe 50.
- Atividade e equilibrio: media da cobertura de corretores ativos nos dois dias uteis e da proporcao com carga de ate 1,5 vez a media da equipe.

## Verificacao

- npx tsc --noEmit -p .: passou.
- Testes focados G0: 6 arquivos e 19 testes passaram.
- Testes focados existentes de escopo: 10 arquivos e 34 testes passaram.
- ESLint direcionado: passou sem erros. Avisos restantes sao variaveis nao usadas preexistentes em super-admin/actions.ts e reports/metrics/metrics-service.ts.
- npm run agent:verify -- --level full: docs, changed-file check, architecture, security, performance e typecheck passaram. O lint encontrou 995 ocorrencias preexistentes de encoding em docs/business-rules.md (992), src/features/leads/management-actions.test.ts (2) e src/features/reports/metrics/lead-quality-period.test.ts (1). A suite completa terminou com 10 arquivos falhos, 379 aprovados e 16 ignorados; 13 testes falharam, 2099 passaram e 19 foram ignorados. As falhas estao fora do G0: testes de qualificacao com DB bloqueado, mock existente sem sql em equipe/actions.test.ts, expectativas de Meta Ads e timeouts de UI; as URLs de DB apontaram para localhost:1.
- O SQL de conferencia esta entregue, mas nao foi executado; aguarda a comparacao manual do Vinicios no Supabase.
