# Desempenho Lite do corretor (/desempenho)

Status: em andamento na branch `feat/desempenho-lite` (base `feat/lite-listas`).

## Contrato

- Papel: corretor no modo Lite (`getLiteAudience` = broker).
- Objetivo: ver o próprio resultado do período e quanto falta para a meta.
- Ação principal: trocar o período (Hoje, 7 dias, 30 dias) em `?periodo=`.
- Dados: só do próprio corretor, pelo escopo `broker` do motor de métricas canônicas, para bater com o que gestor e supervisor veem no `/gestao`.
- Decisões (Vinicios, 2026-10-26): a receita em R$ aparece para o corretor; comparação com a equipe ou ranking não entra. Origem do lead continua oculta (2026-10-16), por isso as vendas são agrupadas por operadora.
- Estados: dados, período vazio, sem meta, erro pelo boundary e flag desligada (volta a tela anterior).
- Governança: flag global `feature_broker_performance_lite_enabled` (padrão desligada), controlada pelo Super-admin; cada leitura registra `broker_performance.viewed:<janela>` em `audit_logs`.

## Implementação

1. Escopo `broker` no motor (`team-management/scope.ts`, `reports/metrics/team-metrics-service.ts`): resolvido só da sessão (papel broker), roster do próprio usuário, linhas de saída restritas ao próprio corretor.
2. Janela de 1 dia (Hoje, dia de São Paulo, comparado a ontem até a mesma hora) além de 7 e 30 dias; limites calculados por função pura.
3. Receita: `financial.gross_revenue` (soma de `sale_value` das vendas ativas) passa a sair do mesmo motor.
4. Série por dia de São Paulo (7 e 30 dias) de leads, cotações, vendas e receita, só para o insight do melhor dia da semana. Os mini gráficos saíram a pedido do Vinicios; cada cartão leva um ícone ao lado do título.
5. Meta ativa com quanto falta por dia útil; metas de métrica (cotações, SLA, tempo) usam o escopo broker.
6. Insight por regra fixa (sem IA) e vendas por operadora.
7. Tela `/desempenho` com o kit Lite e prévia `/dev/desempenho-lite-preview?periodo=&cenario=vazio|sem-meta` com dados sintéticos.
8. Entrada: cascata com `LiteStaggerItem`, números contando do zero (`LiteNumber countFromZero`), anel da meta e barras do funil enchendo em sequência depois dos cartões; movimento reduzido só mostra.

## Arquivos

- Motor: `src/features/team-management/scope.ts`, `src/features/reports/metrics/team-metrics-service.ts`, `src/features/reports/metrics/metric-windows.ts`, `src/features/team-management/metrics.ts` (só passa a janela e exporta `windowValue`).
- Corretor: `src/features/broker-performance/{domain,queries}.ts`, `components/broker-performance-lite.{tsx,module.css}`, `src/app/(dashboard)/desempenho/page.tsx`.
- Governança: `FEATURE_FLAGS.BROKER_PERFORMANCE_LITE`, interruptor em Super-admin › Configurações (card de novidades do corretor).

## Validação

- Vitest: escopo broker, janelas (Hoje em São Paulo, 7 e 30 dias), domínio da tela (variação, ritmo da meta, insight, vazio); 29 arquivos e 151 testes nas áreas tocadas.
- `npx tsc --noEmit -p .` sem erros. `npm run build -- --webpack` passou (125 páginas); o junction de `node_modules` impede o Turbopack nesta worktree.
- Prévia conferida a 375 e 390 px: seis blocos, sem rolagem horizontal, troca de período atualiza `?periodo=` e o texto de comparação ("vs ontem"), estado vazio, sem erro de hidratação. Sem `DATABASE_URL` local, o SQL do escopo broker não foi executado contra banco.

## Pendente

- Rodar o SQL do motor (escopo broker, receita, janela Hoje) e o `/gestao` contra um banco de staging antes de ligar a flag.

## Diretor: Visão da operação no mesmo estilo (2026-10-26)

- A pedido do Vinicios, a aba "Visão da operação" do `/dashboard` do Diretor Lite usa o visual do Desempenho, com os dados atuais do painel essencial e sem dados de venda (`operation-view.tsx`, que substitui `EssentialView` no `DirectorLiteDashboard`).
- Movimento no contrato do Diretor: só opacidade, `useReduce` (sistema ou preferência do site) e odômetro do `./motion`.
- Testes do painel atualizados para os blocos novos (ordem, números sem venda, plantões com alerta, filas, vazio, WhatsApp); 7 arquivos e 70 testes passando. Conferido em `/dev/diretor-shell-real` com o shell real.
