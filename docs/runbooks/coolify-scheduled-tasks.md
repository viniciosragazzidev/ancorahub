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
curl --fail --silent --show-error --max-time 280 \
  -H "Authorization: Bearer $CRON_SECRET" \
  http://127.0.0.1:3000<caminho>
```

### Banco de dados das tarefas (24/10/2026)

As tarefas e os webhooks usam um grupo próprio de conexões com o banco, separado das
conexões que atendem as telas (`src/shared/db/background-pool.ts`). Assim, uma tarefa
demorada não trava a navegação de ninguém.

- `DB_POOL_MAX` (padrão 4): conexões das telas.
- `DB_BACKGROUND_POOL_MAX` (padrão 3): conexões das tarefas, dos webhooks e das ações em massa.
- A soma das duas, mais qualquer outro app ou script, precisa caber no `pool size` do
  pooler de sessão do Supabase (30 desde 06/10).
- Tarefas que não podem rodar duas ao mesmo tempo usam uma reserva curta
  (`src/shared/db/job-lease.ts`, linhas `lease:*` em `system_settings`) em vez de uma
  transação aberta durante toda a execução.
- `--max-time 280` só encerra o `curl`; a rodada no servidor termina pelo próprio orçamento de tempo.

### Última rodada de cada tarefa (27/10/2026)

Toda rota desta tabela grava, no fim de cada rodada autorizada, uma linha `heartbeat:<tarefa>` em
`system_settings` com `<fim ISO>|<ok|erro>|<duração ms>` (`src/features/live-status/heartbeat.ts`). Um upsert
por rodada, sem tabela nova e sem migration; os leitores de configuração pulam o prefixo `heartbeat:` como já
pulam `lease:`. Os status vivos usam essa linha para dizer "última rodada há 40 s" e, quando passa de 3 ciclos
sem rodar, avisar que o robô parou. Mudou o caminho ou a frequência aqui, mude também
`src/features/live-status/job-schedule.ts` (o teste compara as duas tabelas).

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
| `/api/internal/jobs/meta-conversions` | `*/5 * * * *` | API de Conversões para CRM: envia as etapas dos leads de Lead Ads (Lead recebido, Qualificado, Quente, Venda) para a fonte de dados escolhida na tela da Meta | Só envia para empresas com o envio ligado (diretor, em Integrações › Meta). Limite da Meta deixa a fila pendente e para a rodada. Aplicar `drizzle/0208_meta_conversion_events.sql` antes. Plano: `docs/implementations/active/2026-10-20-meta-conversoes-crm.md` |
| `/api/internal/jobs/meta-sync` | `0 * * * *` | Sincronização com a Meta | O código também limita a sincronização automática a uma vez por hora e aplica espera progressiva quando a Meta retorna limite de chamadas. |
| `/api/internal/jobs/qualification-cadence` | `*/2 * * * *` | Lembretes da qualificação (qualificação turbo): para o lead que recebeu a 1ª mensagem e não respondeu, manda T1 (20 min, utilidade), T2 (3h, marketing), T3 (dia seguinte 10h) e T4 (despedida, 3 dias), só entre 8h e 20h, parando na primeira resposta, "Agora não", corretor ou limite da Meta (131049) | Só envia templates aprovados (`anc_t1_lembrete`, `anc_t2_beneficio`, `anc_t3_ligacao`, `anc_t4_despedida`); toque sem template aprovado é pulado. Com o `anc_t2_beneficio` aprovado, substitui a requalificação automática de +3h. Liga/desliga em /qualificacao › Turbo. Sem migration. Plano: `docs/implementations/active/2026-10-21-qualificacao-turbo.md` |
| `/api/internal/jobs/conversation-intelligence` | `*/10 * * * *` | Etapa automática pela conversa: analisa com a IA os leads com mensagens novas de WhatsApp (WAHA, Meta, OpenWA, enviadas pelo CRM) e move a etapa para frente quando há certeza; Perdido e voltar etapa ficam como sugestão | No máximo 20 leads por rodada, só conversas dos últimos 3 dias e paradas há 2 min. Pula empresas com o modo "Desligado" (Configurações › IA) e responde `skipped` com `feature_conversation_intelligence_enabled` desligada. Sem migration |
| `/api/internal/jobs/situation-learning` | `*/30 * * * *` | Aprendizado de situações: agrupa com a IA as perguntas que nenhuma situação cobriu e gera as sugestões de Atendimento → Situações; anexa a resposta do corretor; apaga perguntas com mais de 90 dias | No máximo 12 chamadas de IA por empresa por dia. Modelo: Super-admin → IA → "Modelo das sugestões de situações" (vazio = modelos padrão) |
| `/api/internal/jobs/waha-cadence` | `*/5 * * * *` | Cadências WAHA corporativas | Desligadas no código (`getWahaCadenceConfig`); a tarefa é opcional e hoje não envia nada |
| `/api/internal/jobs/engagement` | `*/2 * * * *` | Jornada do corretor: lê os fatos novos (mensagem enviada ao cliente, aceite, retorno, nota) e grava os pontos no extrato | Desligado pela flag `feature_broker_engagement_enabled` (responde `skipped`). Idempotente: pode repetir sem duplicar ponto. Antes do primeiro deploy, rodar `scripts/apply-0188-engagement-relationship.mjs --apply` (índices CONCURRENTLY). Plano: `docs/implementations/active/2026-10-10-central-relacionamento-corretor.md` |
| `/api/internal/jobs/supervisor-digest` | `0 22 * * *` | Resumo das 19h (São Paulo) para cada supervisor com equipe: o dia da equipe na conversa Âncora | Só envia com `feature_supervisor_team_scope_enabled` e depois das 19h de SP; idempotente por supervisor e dia (rodar duas vezes não duplica). 22:00 UTC = 19:00 em SP |
| `/api/internal/jobs/operator-catalog` | `*/5 * * * *` | Catálogo das operadoras: lê os materiais importados (Ferramentas › Materiais das operadoras) e os capturados dos grupos de WhatsApp, identifica operadora, planos e áreas, e grava só o que mudou; preço e plano novo esperam o diretor | Até 4 arquivos ou 4 minutos por rodada, mais antigos primeiro (inclui o material capturado antes do catálogo). Limite de IA por minuto devolve o arquivo para a fila sem gastar tentativa; falha tenta 3 vezes. Aplicar `drizzle/0213_operator_catalog.sql` ANTES do deploy. Busca por significado precisa da chave OpenAI. Plano: `docs/implementations/active/2026-10-22-catalogo-operadoras.md` |

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

### G6 e cron de engajamento

O mesmo `/api/internal/jobs/engagement` executa, sob locks transacionais independentes, o resumo semanal G6 segunda-feira as 08h de Sao Paulo e os snapshots diarios as 02h. Nao criar uma tarefa nova no Coolify. A migration `drizzle/0202_broker_metric_daily.sql` precisa ser aplicada separadamente antes da timeline e dos snapshots aparecerem; enquanto a tabela estiver ausente, o restante do cron continua.