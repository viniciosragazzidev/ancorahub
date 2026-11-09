# Fechamento até a negativa do cliente e foto diária do Fechamento (09/11/2026)

## Decisão do diretor (09/11)

> "O lead em fechamento pode continuar em fechamento até ter alguma negativa do cliente. O processo de fechamento
> é demorado e não significa que o cliente foi perdido."

> "Guarda a foto diária do fechamento."

## Problema

Em Negociações, o nível "Fechamento" pedia conversa nos dois sentidos nos últimos 3 dias. Cerca de 90 leads em
Documentação ou Em análise apareciam como "Esfriando" ou "Sem conversa no CRM" e o card Fechamento mostrava 1.
Nessas etapas quem responde é a operadora; o silêncio do cliente é normal.

## O que muda

1. **Fechamento fixo** (`src/features/negotiations/negotiation-model.ts`): status `documentation_pending` ou
   `under_analysis` é sempre nível `closing`, com ou sem conversa recente ou no CRM. Só sai quando alguém muda a
   etapa. Os sinais viram selos no lead (`noCrmConversation`, `exchangeStale`, `customerWaiting`, `daysAtStage`).
   O fechamento pela leitura da IA em Cotação ou Negociação continua pedindo troca recente nos dois sentidos.
2. **"Em fechamento agora"** (`negotiation-closing-now.tsx`): ordem pelo cliente que falou por último, dias na
   etapa e "sem conversa no CRM" em cada linha; mostra 6 e "Ver todos os N" filtra a lista paginada.
3. **Regra de chat parado** (`src/features/leads/stale-stage-rule.ts`): continua sem tocar Documentação e Em
   análise (teste dedicado).
4. **Foto diária** (`negotiation_daily_snapshots`, `drizzle/0222_negotiation_daily_snapshots.sql`): uma linha por
   empresa e dia de São Paulo com os números da tela (`counts`) e quem está em Fechamento (`closing_leads`: lead,
   nome, corretor, unidade, etapa, dias na etapa). Job `/api/internal/jobs/negotiation-snapshot` às 23:55 de SP
   (`55 2 * * *` UTC no Coolify), calculado como o diretor vê a empresa toda; idempotente (a última rodada do dia
   vence).
5. **Faixa do diretor** (`negotiation-closing-history.tsx`): "Fechamento nos últimos dias" com a contagem das 7
   últimas fotos mais a de agora, e "Desde a foto de <dia>: X entraram e Y saíram" com nomes e corretor. Sem foto
   (tabela ainda não criada ou job ainda não rodou), a faixa não aparece; a leitura pega a falta da tabela e volta
   vazio.

## Ordem de deploy

1. Rodar `drizzle/0222_negotiation_daily_snapshots.sql` no Supabase.
2. Deploy.
3. Criar a tarefa no Coolify: `/api/internal/jobs/negotiation-snapshot`, `55 2 * * *`.

A faixa aparece a partir do dia seguinte à primeira foto; a comparação usa a foto mais recente de antes de hoje.
