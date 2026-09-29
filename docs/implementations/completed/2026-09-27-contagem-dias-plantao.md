# Contagem mensal de plantões por data

- Problema: o resumo em `/distribuicao?view=plantao` contava regras de plantão ativas, por isso uma regra semanal aparecia como apenas um plantão no mês.
- Decisão do usuário (2026-09-27): cada data com plantão vale uma unidade na contagem mensal. Dois plantões na mesma data continuam sendo um único dia no indicador.
- Implementação: reutilizar as datas calculadas para o calendário, agrupar por `YYYY-MM-DD`, mostrar o total do mês e discriminar dias ainda por acontecer e encerrados. O indicador de dias sem cobertura também deduplica datas.
- Sem alteração de escalas, distribuição de leads, regras de vigência, persistência, permissões ou auditoria; é uma correção de apresentação de dados já autorizados.
- Arquivos: `src/features/lead-distribution/monthly-duty-plan.ts`, `src/app/(dashboard)/leads/distribuicao/plantao/_components/duty-operations-workspace.tsx` e teste em `monthly-duty-plan.test.ts`.
- Verificação: 28 testes focados do domínio e planejador passaram; TypeScript, lint direcionado e lint geral passaram (um aviso preexistente de efeito no componente). `next build` passou. `npm run build` parou antes do Next no prebuild da extensão por acesso negado. O harness completo passou em documentação, arquitetura, segurança, desempenho, lint e tipos; 1 teste preexistente do dashboard Lite falhou, 1149 passaram e 2 foram ignorados. Evidência: `reports/agent/verification/2026-09-27T12-13-28.136Z.md`.
- Limite: QA autenticado da rota ainda não executado; o item N97 permanece parcial no roadmap.
- Rollback: restaurar o cálculo anterior apenas no indicador da rota e remover o helper de resumo.
