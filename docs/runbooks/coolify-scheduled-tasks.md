# Agendador Coolify — todas as tarefas agendadas do CRM

## Objetivo

Única fonte de agendamento dos jobs internos do CRM. Produção roda no Coolify
(VPS); a Vercel não é mais usada e o antigo `vercel.json` foi removido. Cada job
abaixo é uma Scheduled Task do serviço CRM no Coolify. Job novo entra nesta
tabela.

## Pré-requisitos

- `CRON_SECRET` com o mesmo valor no serviço CRM e em cada tarefa.
- Comando base de cada tarefa (troque o caminho):

```sh
curl --fail --silent --show-error \
  -H "Authorization: Bearer $CRON_SECRET" \
  http://127.0.0.1:3000<caminho>
```

## Tarefas

| Caminho | Frequência | O que faz | Detalhes |
|---|---|---|---|
| `/api/internal/jobs/whatsapp` | `* * * * *` | Outbox do WhatsApp (Meta e número da empresa): envia a fila, retentativas e avisos segurados por horário, espaçamento ou limite | Sem ele, avisos fora do horário comercial ou segurados pelo espaçamento não saem |
| `/api/internal/jobs/distribution` | `*/2 * * * *` | Distribuição contínua de leads | `coolify-lead-distribution-scheduler.md` |
| `/api/internal/jobs/qualification-timeout` | `*/2 * * * *` | Tempo limite da qualificação | `coolify-qualification-timeout-scheduler.md` |
| `/api/internal/jobs/waha-sync` | `* * * * *` | Reconciliação de mensagens WAHA das conexões dos corretores | `coolify-waha-message-sync-scheduler.md` |
| `/api/internal/jobs/lead-effects` | `* * * * *` | Efeitos pós-entrada do lead (outbox durável) | |
| `/api/internal/jobs/purge` | `* * * * *` | Expurgo agendado de dados | |
| `/api/internal/sla` | `*/5 * * * *` | SLA de primeiro contato: avisa gestores e diretores | |
| `/api/internal/reminders` | `*/5 * * * *` | Lembretes de notificações | |
| `/api/internal/jobs/meta-sync` | `0 * * * *` | Sincronização com a Meta | O código também limita a sincronização automática a uma vez por hora e aplica espera progressiva quando a Meta retorna limite de chamadas. |
| `/api/internal/jobs/situation-learning` | `*/30 * * * *` | Aprendizado de situações: agrupa com a IA as perguntas que nenhuma situação cobriu e gera as sugestões de Atendimento → Situações; anexa a resposta do corretor; apaga perguntas com mais de 90 dias | No máximo 12 chamadas de IA por empresa por dia. Modelo: Super-admin → IA → "Modelo das sugestões de situações" (vazio = modelos padrão) |
| `/api/internal/jobs/waha-cadence` | `*/5 * * * *` | Cadências WAHA corporativas | Desligadas no código (`getWahaCadenceConfig`); a tarefa é opcional e hoje não envia nada |
| `/api/internal/jobs/engagement` | `*/2 * * * *` | Jornada do corretor: lê os fatos novos (mensagem enviada ao cliente, aceite, retorno, nota) e grava os pontos no extrato | Desligado pela flag `feature_broker_engagement_enabled` (responde `skipped`). Idempotente: pode repetir sem duplicar ponto. Antes do primeiro deploy, rodar `scripts/apply-0188-engagement-relationship.mjs --apply` (índices CONCURRENTLY). Plano: `docs/implementations/active/2026-10-10-central-relacionamento-corretor.md` |

Os caminhos antigos em `/api/internal/cron/*` continuam respondendo para
tarefas já publicadas; tarefas novas usam os caminhos acima.

## Validação

Cada execução saudável responde HTTP 200 com `success: true` e contadores. Após
criar ou alterar tarefas, confira duas execuções seguidas de cada uma nos logs
do Coolify. Mantenha uma única tarefa por caminho: duas fontes de agendamento
para o mesmo job geram trabalho em dobro.

## Rollback

Desative a tarefa no Coolify. Os jobs são idempotentes: reativar retoma a fila
sem perder itens.
