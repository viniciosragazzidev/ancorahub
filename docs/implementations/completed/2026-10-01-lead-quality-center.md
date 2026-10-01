# Central de qualidade de leads

**Status:** implementado em 2026-10-01; QA autenticado por papel/viewport e rollout continuam pendentes.  
**Solicitação:** centralizar temperatura, origem de mídia, perfil, fila e sinais de atendimento dos leads.

## Entrega

- Aba “Qualidade dos leads” em `/dashboard?tab=quality`; `/relatorios` abre essa aba por compatibilidade quando não recebe uma aba antiga explícita.
- Resumo, temperatura, conversão/atribuição atuais, campanha/conjunto/anúncio/formulário, canal, fila/corretor, tipo/plano, cidade, faixa etária e heatmap dia/hora (`America/Sao_Paulo`).
- Filtros dimensionais na URL e drill-down sob demanda com nome, status, fila/corretor atuais e data; telefone e e-mail não são carregados.
- O modo Lite do corretor permanece independente. A visão e o drill-down verificam capacidades efetivas de cargos personalizados e o escopo canônico.
- Métricas e dimensões versionadas em `src/features/reports/metrics/metric-catalog.ts`; agrupamentos calculados no servidor em uma única consulta de coorte e auditados em `audit_logs`.
- Correção de runtime em 01/10: todas as projeções SQL calculadas da CTE (`planType`, `city`, `ageBand`, `weekday`, `hour` e `hasMetaAd`) agora declaram aliases Drizzle antes de serem referenciadas nos agrupamentos.
- Correção de runtime em 01/10: nomes vindos de campanha, conjunto, anúncio, formulário, fila e corretor agora recebem aliases únicos (`campaignName`, `adsetName`, `adName`, `formName`, `queueName`, `brokerName`) na CTE, evitando múltiplas colunas físicas chamadas `name` quando os agrupamentos usam `MAX`.
- O estado global `feature_reporting_center_enabled` já administrado pelo Super-admin controla a aba sem desligar a visão operacional.

## Contrato de dados e privacidade

- Coorte por `createdAt` (7/14/30/90 dias), excluindo leads apagados/arquivados. Temperatura é somente o `qualificationStatus` atual (`hot`, `warm`, `cold`); score/completude não estima intenção nem altera classificação.
- Status de conversão, temperatura, fila e corretor são atuais, sem snapshot histórico. Mídia é atribuída apenas por IDs Meta persistidos e joins também tenant-scoped.
- Faixas etárias são agregadas; categorias com menos de 3 leads são suprimidas. Cidade e perfil não são enviados como linhas individuais ao cliente.
- Não há gasto real sincronizado: investimento, CPL/CPA e causalidade de anúncio não são inferidos.
- Toda leitura deriva tenant/unidade/equipe/carteira da sessão. Custom role `own`, `branch`, `tenant` ou `none` respeita o `AccessContext`; a capacidade de campanhas não concede escopo de leads.

## Decisões e rollback

- DEC-129 e BR-075 definem temperatura persistida, atribuição atual, coorte e dimensões agregadas. CONTEXT, catálogo, inventário de métricas, UX control/changelog, plano e roadmap foram atualizados.
- Desligar `feature_reporting_center_enabled` remove a análise; a home operacional segue acessível. Não foram criados migrations ou dependências.

## Validação

- `npm run agent:context -- --task "lead quality center analytics campaign ad queue qualification profile timezone report"`: passou. O runner precisou de um shim temporário de `os.userInfo()` no Windows; o arquivo foi removido.
- Testes dirigidos: 5 arquivos, 23 testes passaram (métricas/denominadores, filtros URL, escopo de custom role, central visual e Dashboard operacional).
- Regressão: o teste `lead-quality-service.test.ts` reproduziu o erro exato de campo `planType` antes da correção e passou após os aliases; conjunto dirigido atualizado: 6 arquivos, 24 testes passaram.
- ESLint `--quiet` nos arquivos alterados: passou. `tsc --noEmit`: passou.
- `npm run agent:verify -- --level full`: documentação, changed-files, análise de segurança (0 achados), type-check e demais diagnósticos executados. Relatório: `reports/agent/verification/2026-10-01T15-27-15.756Z.md`.
- Revalidação da correção: `reports/agent/verification/2026-10-01T16-44-10.304Z.md` (docs, changed-files, arquitetura, segurança e desempenho passaram; segurança sem achados). O lint global segue falhando com 1 erro e 1.105 avisos; o type-check global para no `validator.ts` gerado em `.next/dev/types` (erros de sintaxe nas linhas 593 e 598). O lint dirigido e o type-check isolado dos arquivos do serviço passaram.
- Regressão SQL das dimensões de mídia/fila/corretor: o teste compila a projeção agregada Drizzle, exige aliases de saída únicos e rejeita `MAX("name")`; a suíte dirigida passou em 01/10 após essa correção.
- Na suíte global, 1.315 testes passaram e 2 testes expiraram no timeout de 5s sob execução paralela (`operational-dashboard.test.tsx` e `monthly-duty-planner.test.tsx`). Ambos os testes afetados passaram no ciclo dirigido do Dashboard/central; repetir a suíte com menor concorrência ficou pendente.
- ESLint global reportou 1 erro e 1.105 avisos; lint dirigido dos arquivos alterados passou. Os diagnósticos de arquitetura/desempenho apontaram somente o tamanho preexistente de `src/features/roadmap/roadmap-data.ts` (~153 KB).
- `npm run build` foi bloqueado no `prebuild` da extensão por “Access denied” ao resolver `../../../..` dentro do sandbox. Para validar a aplicação sem ampliar acesso fora da raiz, `npm --ignore-scripts run build` compilou Next 16.2.10, passou pelo TypeScript e gerou as 84 páginas com sucesso. A extensão do navegador não foi revalidada.
- Na correção de 01/10, o type-check global também encontrou um `validator.ts` incompleto em `.next/dev/types`, gerado pelo servidor de desenvolvimento ativo; type-check isolado dos arquivos alterados passou. O build não foi repetido para preservar o `.next` usado pelo servidor local. A query continua sem validação contra uma base de dados real.

## Riscos/passo restante

- A qualidade da consulta precisa ser conferida com dados reais e QA autenticado para Diretor/Gestor/Supervisor/custom roles, incluindo a amostra mínima e o filtro multi-unidade; nenhum escopo adicional deve ser concedido.
- QA mobile UX-M1.10 e rollout/telemetria permanecem pendentes. Se a tabela Meta não tiver ID persistido, ela fica fora da atribuição confirmada.
