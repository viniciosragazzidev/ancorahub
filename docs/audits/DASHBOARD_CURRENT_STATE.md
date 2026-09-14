# Auditoria do `/dashboard`

Data: 2026-09-14

## Rota e decisão atual

`src/app/(dashboard)/dashboard/page.tsx` resolve o contexto tenant-side e desvia o corretor Lite para `LightDashboard`. Os demais perfis usam `ReportingCenterView` quando a feature `REPORTING_CENTER` está ativa e `LegacyReportsView` como fallback.

## Inventário

| Item | Arquivo/área | Classificação | Evidência |
| --- | --- | --- | --- |
| Rota principal | `dashboard/page.tsx` | KEEP / REBUILD | Faz seleção por experiência e feature flag, mas não resolve uma visão operacional por perfil. |
| Experiência corretor Lite | `broker-workspace/components/light-dashboard.tsx` | KEEP | Já prioriza carteira/fila do corretor; deve virar a implementação do perfil corretor no novo contrato. |
| Centro de relatórios | `relatorios/_components/reporting-center-view.tsx` | MOVE | Possui tabs Overview, Commercial, Team, Units e Financial; pertence a `/relatorios`, não à decisão imediata. |
| Fallback legado | `relatorios/_components/legacy-reports-view.tsx` | LEGACY / MOVE | Contém muitos cards, gráficos, exportações e consultas históricas. |
| Métricas agregadas | `features/reports/metrics/metrics-service.ts` | KEEP / EXTRACT | Já centraliza queries e escopo; deve fornecer agregadores para o DashboardQueryService. |
| Catálogo e escopo | `features/reports/metrics/metric-catalog.ts`, `metric-scope.ts` | KEEP | Reutilizar definições, sem duplicar métricas no dashboard. |
| Drill-downs | `dashboard/drill/[drillId]/page.tsx` | KEEP | Deep links operacionais já existem e devem ser usados por alertas. |
| Seleção por tabs | `reporting-center-view.tsx` | REMOVE FROM GLOBAL | O dashboard global não deve exigir troca de contexto para descobrir prioridades. |
| Período histórico | `PeriodSelect` no centro de relatórios | MOVE | Deve permanecer em relatórios; dashboard usa janela operacional curta e explícita. |

## Consultas e desempenho

O centro atual executa consultas em paralelo, mas a renderização e a decisão de quais dados carregar ficam acopladas às tabs. A próxima versão deve resolver um único `DashboardViewModel` server-side, reutilizando `metrics-service` e evitando consultas por corretor (N+1).

## Escopo e autorização

O escopo atual deriva de `TenantContext` e `metric-scope`; isso é a base correta. O novo resolver deve preservar tenant, unidade, equipe, usuário e capabilities no servidor, sem aceitar esses valores como autoridade do cliente.

## Plano KEEP / MOVE / REMOVE / REBUILD

- **KEEP:** contexto tenant, escopo de métricas, drill-downs, experiência Lite do corretor e serviços agregados existentes.
- **MOVE:** tabs analíticas, período histórico, rankings, funil detalhado e exportações para `/relatorios` ou mini dashboards dos módulos.
- **REMOVE:** tabs globais para alternar perfil/contexto, cards decorativos e listas extensas na primeira viewport.
- **REBUILD:** `DashboardViewModel`, `DashboardResolver`, painel “Atenção agora”, quatro KPIs por perfil e seção principal contextual.

## Não alterado nesta etapa

Nenhum JSX do dashboard foi substituído. Esta auditoria é a etapa de contrato antes da migração visual.
