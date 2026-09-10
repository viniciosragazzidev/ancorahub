# Agendador Coolify — distribuição contínua de leads

## Objetivo

Executar a cada dois minutos a recuperação de leads qualificados sem corretor. O
processador cria uma oferta exclusiva para o corretor elegível com menor carga,
aguarda o aceite e continua pelos demais. Quando um ciclo inteiro termina sem
aceite, um novo ciclo é agendado sem apagar o histórico anterior.

## Scheduled Task no Coolify

- Frequência: `*/2 * * * *`
- Comando:

```sh
curl --fail --silent --show-error \
  -H "Authorization: Bearer $CRON_SECRET" \
  http://127.0.0.1:3000/api/internal/jobs/distribution
```

`CRON_SECRET` precisa ter o mesmo valor no serviço CRM e na tarefa. O endpoint
legado `/api/internal/cron/distribution` continua disponível para schedulers já
publicados, mas novas tarefas devem usar o caminho canônico acima.

Não mantenha Vercel Cron e Coolify Scheduled Task ativos ao mesmo tempo. O job é
idempotente, mas deve existir uma única fonte de agendamento por ambiente.

## Confirmação

Uma execução saudável responde com `success: true` e contadores de itens
encontrados, processados, adiados e recuperados. Valide duas execuções seguidas e
um lead sintético sem owner; ele deve ganhar uma oferta ativa ou permanecer em
retry explicável quando não existir corretor elegível.
