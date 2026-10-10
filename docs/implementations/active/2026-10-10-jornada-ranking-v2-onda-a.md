# T51: entrega da Onda A

Implementação do plano `2026-10-10-jornada-ranking-v2.md`, A1 a A6, usando o mapa oficial de fontes. Branch `feat/diretor-visual-lite`; sem commit, deploy ou conexão com banco.

## Entrega

- Contratos serializáveis em `src/features/engagement/journey-types.ts`, incluindo `ledger` (últimos 30 eventos) e `optedOut`.
- Migration `drizzle/0193_engagement_journey.sql`, journal idx 140, schema e script de apply. Simulação offline por padrão; os três índices em tabelas existentes são criados com `CONCURRENTLY`, com recuperação de construção interrompida, somente com `--apply`.
- Flags `BROKER_JOURNEY`, `TEAM_RANKING` e `ENGAGEMENT_CAMPAIGNS`, todas desligadas por padrão.
- Motores puros `missions.ts`, `achievements.ts`, `levels.ts`, `leaderboard.ts` e períodos em `journey-periods.ts`.
- `journey-facts.ts`: consultas em lote por tenant e corretores tocados. SLA calculado pelo primeiro envio humano após a atribuição, sem depender de `sla_breached_at`. Notas normalizadas, sem repetição e sem o teto do extrato; tarefas usam `assigned_to`, como o coletor existente. Plantão do dia tem consulta própria, inclusive após o fim do turno.
- `collector.ts` e `journey-collector.ts`: progresso, bônus, conquistas e celebrações idempotentes em lote, com transação e trava por tenant. Repetição da janela de coleta não consome novamente o limite diário.
- `leaderboard-queries.ts`: semana local de São Paulo, comparativo da semana anterior, média por corretor ativo, opt-out e cache de 60 s por tenant e semana.
- `journey-queries.ts`: `getBrokerJourneyData(tenantId, brokerId, now?)` e `getPendingJourneyCelebrations(tenantId, brokerId)`. O polling consulta somente a fila de celebrações. Leituras das tabelas novas degradam com `.catch`.

## Decisões da implementação

- Cobertura de todos os contatos, ofertas e atendimentos, além de zerar retornos, paga bônus quando o dia fecha. Evita pagar uma promessa de "todos" antes da chegada da última oferta do dia. Contagens semanais concluem ao atingir a meta.
- Cobertura vincula a evidência à atribuição/oferta/atendimento correspondente; uma nota em outro lead não cobre um atendimento sem nota.
- Virada desativada na v1, pois a temperatura histórica não existe. Conquistas de venda exigem a regra habilitada e usam as vendas ativas do mapa. A regra permanece desligada por padrão até a fonte de aprovação ser liberada. Presença usa a confirmação do próprio corretor, sem depender de pontos de presença.
- Opt-out remove o nome dos placares públicos, preserva a posição própria e não muda a média da equipe. Empates usam posições 1, 1, 3. Equipes sem corretores ativos não participam.
- O extrato mostra reversões; pontuação, níveis e placares excluem eventos estornados.
- Consultas são internas e `server-only`; tenant e escopo devem vir do contexto autenticado dos chamadores. Não há nova action pública nesta onda.

## Verificação

- `npx vitest run src/features/engagement`: **68/68**, 7 arquivos.
- Testes novos: `journey-engines.test.ts`, `journey-collector.test.ts`, `journey-queries.test.ts`, `journey-facts.test.ts`, `collector-replay.test.ts`.
- ESLint dos arquivos alterados e `node --check` do apply: passaram.
- Simulação do apply com URL fictícia: passou, 14 instruções, sem conexão.
- `git diff --check`: passou.
- `npx tsc --noEmit`: passou (exit 0). Houve tentativas anteriores com fixtures em edição e arquivos gerados de `.next` removidos pelo trabalho paralelo; o resultado final foi limpo.
- Check global de encoding: falhou por 993 ocorrências em `docs/business-rules.md` e `src/features/reports/metrics/lead-quality-period.test.ts`, ambos fora do T51. Nenhum arquivo desta entrega foi apontado.
- Verificação focada conforme a regra do executor e trabalho paralelo. O harness completo inclui testes globais e build; não foi executado para preservar o escopo de testes e não conectar ao banco.
- Portão visual da seção 4 cabe à Onda B: a Onda A não altera interfaces.

## Como testar

1. Rodar `npx vitest run src/features/engagement` e `npx tsc --noEmit`.
2. Conferir as fronteiras de semana SP, empate, opt-out, equipe vazia, replay e ausência da 0193 nos testes.
3. Rodar a simulação do script com URL fictícia; manter flags desligadas e não usar `--apply` sem autorização.
