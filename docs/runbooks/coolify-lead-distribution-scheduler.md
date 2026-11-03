# Agendador Coolify — distribuição contínua de leads

## Objetivo

Executar a cada dois minutos a recuperação de leads qualificados sem corretor. O
processador cria uma oferta exclusiva para o corretor elegível com menor carga,
aguarda o aceite e continua pelos demais. Quando um ciclo inteiro termina sem
aceite, um novo ciclo é agendado sem apagar o histórico anterior.

## Via rápida (03/11)

Lead quente ou morno deve ter corretor em até 3 minutos depois da qualificação. Cada rodada
começa pela via rápida: só os leads quentes e mornos qualificados nas últimas 6 horas, sem
corretor e sem trabalho esperando horário de nova tentativa, da qualificação mais antiga para a
mais nova, com orçamento próprio de 25 s (teto 30 s). Só depois vêm os lembretes do plantão e a
fila comum. Quando a distribuição na hora da qualificação não encontra corretor, o servidor tenta
de novo em 1 min e em 2,5 min, sem depender desta tarefa. A resposta da rodada traz `priority`
(leads vistos, ofertas, adiados) e `phaseMs.priority`.

`scripts/close-dead-distribution-jobs.ts` encerra os trabalhos de leads que a distribuição
automática nunca pega (espera manual, apagados, perdidos, desqualificados, bloqueados pela Meta,
frios sem dados). Simula por padrão; `--apply` grava em produção e só roda com autorização.

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

O job é idempotente, mas deve existir uma única Scheduled Task por ambiente. Lista
completa das tarefas: `coolify-scheduled-tasks.md`.

## Confirmação

Uma execução saudável responde com `success: true` e contadores de itens
encontrados, processados, adiados e recuperados. Valide duas execuções seguidas e
um lead sintético sem owner; ele deve ganhar uma oferta ativa ou permanecer em
retry explicável quando não existir corretor elegível.
