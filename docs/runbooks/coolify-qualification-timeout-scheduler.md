# Agendador Coolify — timeout da qualificação

## Objetivo

Executar a cada dois minutos a varredura de conversas de qualificação que estão
em `WAITING_CUSTOMER` sem resposta há mais que o tempo definido pelo tenant.

O job encerra a qualificação, preserva a fila/unidade da origem e tenta distribuir
imediatamente para um corretor elegível. Sem elegível ou fora do horário comercial,
o trabalho permanece em retry auditável.

## Configuração no Coolify

Crie uma Scheduled Task para o serviço do CRM:

- Frequência: `*/2 * * * *`
- Comando:

```sh
curl --fail --silent --show-error \
  -H "Authorization: Bearer $CRON_SECRET" \
  http://127.0.0.1:3000/api/internal/jobs/qualification-timeout
```

`CRON_SECRET` deve existir no serviço e no ambiente que executa a tarefa. Não
registre o valor em logs, commits ou telas. A rota também aceita
`INTERNAL_JOB_SECRET` apenas como compatibilidade temporária.

## Confirmação segura

Uma execução saudável retorna somente contadores, por exemplo:

```json
{"success":true,"result":{"tenantsChecked":1,"timedOutLeads":0,"distributedLeads":0}}
```

Faça duas execuções consecutivas e, em homologação, deixe uma conversa sintética
em qualificação ultrapassar o timeout: ela deve passar para a fila/unidade correta e
ser atribuída a um corretor habilitado.
