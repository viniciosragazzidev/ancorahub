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
| `/api/internal/jobs/distribution-priority` | `* * * * *` | Via rápida: leva a um corretor os leads quentes e mornos qualificados nas últimas 6 h, no máximo 10 por rodada | Separada em 06/11: a rodada de `/distribution` passava de 2 min com a fila acumulada e um lead quente esperava até 15 min. Enquanto esta tarefa responde, `/distribution` pula a passada de quentes; se ela parar por 3 min, `/distribution` volta a fazer. Sem migration |
| `/api/internal/jobs/qualification-timeout` | `*/2 * * * *` | Tempo limite da qualificação | `coolify-qualification-timeout-scheduler.md` |
| `/api/internal/jobs/waha-sync` | `* * * * *` | Reconciliação de mensagens WAHA das conexões dos corretores | `coolify-waha-message-sync-scheduler.md` |
| `/api/internal/jobs/lead-effects` | `* * * * *` | Efeitos pós-entrada do lead (outbox durável) | |
| `/api/internal/jobs/purge` | `* * * * *` | Expurgo agendado de dados | |
| `/api/internal/sla` | `*/5 * * * *` | SLA de primeiro contato: avisa gestores e diretores | |
| `/api/internal/reminders` | `*/5 * * * *` | Lembretes de notificações e aviso "Cliente voltou a chamar" (lead distribuído há 24 h ou mais que manda mensagem no número oficial da empresa, uma vez por lead); segundo aviso da foto do plantão presencial esperando liberação há 5 min | |
| `/api/internal/jobs/meta-conversions` | `*/5 * * * *` | API de Conversões para CRM: envia as etapas dos leads de Lead Ads (Lead recebido, Qualificado, Quente, Venda) para a fonte de dados escolhida na tela da Meta | Só envia para empresas com o envio ligado (diretor, em Integrações › Meta). Limite da Meta deixa a fila pendente e para a rodada. Aplicar `drizzle/0208_meta_conversion_events.sql` antes. Plano: `docs/implementations/active/2026-10-20-meta-conversoes-crm.md` |
| `/api/internal/jobs/meta-sync` | `0 * * * *` | Sincronização com a Meta | O código também limita a sincronização automática a uma vez por hora e aplica espera progressiva quando a Meta retorna limite de chamadas. |
| `/api/internal/jobs/qualification-cadence` | `*/2 * * * *` | Lembretes da qualificação (qualificação turbo): para o lead que recebeu a 1ª mensagem e não respondeu, manda T1 (20 min, utilidade), T2 (3h, marketing), T3 (dia seguinte 10h) e T4 (despedida, 3 dias), só entre 8h e 20h, parando na primeira resposta, "Agora não", corretor ou limite da Meta (131049) | Só envia templates aprovados (`anc_t1_lembrete`, `anc_t2_beneficio`, `anc_t3_ligacao`, `anc_t4_despedida`); toque sem template aprovado é pulado. Com o `anc_t2_beneficio` aprovado, substitui a requalificação automática de +3h. Liga/desliga em /qualificacao › Turbo. Sem migration. Plano: `docs/implementations/active/2026-10-21-qualificacao-turbo.md` |
| `/api/internal/jobs/conversation-intelligence` | `* * * * *` | Etapa automática pela conversa: analisa com a IA os leads 1 minuto depois da última mensagem de WhatsApp (WAHA, Meta, OpenWA, enviadas pelo CRM) e move a etapa para frente (uma etapa a partir de 75% de confiança, pular etapas a partir de 90%); Perdido e voltar etapa ficam como sugestão. A análise também dispara sozinha 1 minuto depois de cada mensagem; o job é a rede de segurança (deploy, reinício) | Mudou de `*/10` para `* * * * *` em 28/10: trocar a frequência da tarefa no Coolify. No máximo 40 leads por rodada, 3 ao mesmo tempo, até 50 s; uma rodada por vez (lease); só conversas dos últimos 3 dias e paradas há 1 min. Pula empresas com o modo "Desligado" (Configurações › IA) e responde `skipped` com `feature_conversation_intelligence_enabled` desligada. Sem migration |
| `/api/internal/jobs/situation-learning` | `*/30 * * * *` | Aprendizado de situações: agrupa com a IA as perguntas que nenhuma situação cobriu e gera as sugestões de Atendimento → Situações; anexa a resposta do corretor; apaga perguntas com mais de 90 dias | No máximo 12 chamadas de IA por empresa por dia. Modelo: Super-admin → IA → "Modelo das sugestões de situações" (vazio = modelos padrão) |
| `/api/internal/jobs/waha-cadence` | `*/5 * * * *` | Cadências WAHA corporativas | Desligadas no código (`getWahaCadenceConfig`); a tarefa é opcional e hoje não envia nada |
| `/api/internal/jobs/engagement` | `*/2 * * * *` | Jornada do corretor: lê os fatos novos (mensagem enviada ao cliente, aceite, retorno, nota) e grava os pontos no extrato | Desligado pela flag `feature_broker_engagement_enabled` (responde `skipped`). Idempotente: pode repetir sem duplicar ponto. Antes do primeiro deploy, rodar `scripts/apply-0188-engagement-relationship.mjs --apply` (índices CONCURRENTLY). Plano: `docs/implementations/active/2026-10-10-central-relacionamento-corretor.md` |
| `/api/internal/jobs/supervisor-digest` | `0 22 * * *` | Resumo das 19h (São Paulo) para cada supervisor com equipe: o dia da equipe na conversa Âncora | Só envia com `feature_supervisor_team_scope_enabled` e depois das 19h de SP; idempotente por supervisor e dia (rodar duas vezes não duplica). 22:00 UTC = 19:00 em SP |
| `/api/internal/jobs/operator-catalog` | `*/5 * * * *` | Catálogo das operadoras: lê os materiais importados (Ferramentas › Materiais das operadoras) e os capturados dos grupos de WhatsApp, identifica operadora, planos e áreas, e grava só o que mudou; preço e plano novo esperam o diretor | Até 4 arquivos ou 4 minutos por rodada, mais antigos primeiro (inclui o material capturado antes do catálogo). Limite de IA por minuto devolve o arquivo para a fila sem gastar tentativa; falha tenta 3 vezes. Aplicar `drizzle/0213_operator_catalog.sql` ANTES do deploy. Busca por significado precisa da chave OpenAI. Plano: `docs/implementations/active/2026-10-22-catalogo-operadoras.md` |
| `/api/internal/jobs/customer-waiting` | `*/5 * * * *` | Cliente aguardando o corretor: acha os leads ativos cuja última mensagem do cliente está sem resposta de uma pessoa (número oficial ou WAHA do corretor) e mede a espera em horas úteis (dias úteis, 8h às 18h). Na F1 (modo observação) só registra no histórico, uma vez por ciclo e etapa, o que faria aos 15 min (IA acolhe e 1ª cobrança), 45 min (2ª cobrança e gestão) e 2 h (troca de corretor); não envia nada | Liga por empresa no Super-admin (`feature_customer_waiting_guard_<tenantId>` = `observe`); desligada responde com `tenants: 0`. Só conta ciclos que começaram depois de ligar. Uma rodada por vez (lease). Sem migration. Plano: `docs/implementations/active/2026-11-04-cliente-aguardando-corretor.md`. Na mesma chamada roda a regra R0 do pós-venda (cliente que voltou a escrever): desligada por empresa até o diretor ligar em Equipe > Pós-venda (`post_sale_r0_<tenantId>`), com lease próprio `post-sale-r0`; o retorno traz `postSaleR0` com iniciadas, ignoradas por motivo e escaladas. Também roda a régua automática do pós-venda (R1 a R5, Fase 4) só a cada 15 min (minutos 0 a 4 de cada quarto de hora), lease `post-sale-auto`, desligada até o diretor ligar cada regra em Equipe > Pós-venda > Régua automática (tabela `post_sale_rules`, SQL `drizzle/0224_post_sale_rules.sql`); o retorno traz `postSaleAuto` (iniciadas por regra, limite atingido, `skipped: "slot"` fora do quarto de hora). Nenhuma tarefa nova no Coolify. Plano: `docs/implementations/active/2026-11-06-pos-venda-regua-automatica.md` |

| `/api/internal/jobs/stale-stages` | `0 12 * * *` | Regra de chat parado: lead em Cotação ou Negociação com o cliente 5 dias úteis sem responder vai para **Aguardando retorno**; mais 10 dias úteis sem resposta vai para **Perdido** (sem contato), com aviso ao corretor 2 dias antes; venda em potencial nunca perde sozinha (avisa a gestão). Volta sozinho quando o cliente responde (logo após a mensagem; o job é a rede de segurança) | 12:00 UTC = 9h em SP, todo dia (fim de semana não conta dia útil, então não muda nada). Cada empresa começa em **simulação** (`stale_stage_rule_<tenantId>` = `simulate`): só guarda a lista do que faria, que o diretor vê em Leads e aplica com um toque (vira `on`). `feature_stale_stage_rule_enabled` = `false` para tudo. Aplicar `drizzle/0219_etapas_e_funil.sql` antes. Plano: `docs/implementations/active/2026-11-05-etapas-e-funil.md` |
| `/api/internal/jobs/negotiation-snapshot` | `55 2 * * *` | Foto diária do Fechamento: para cada empresa ativa, calcula Negociações como o diretor vê (empresa toda) e grava os números da tela e quem está em Fechamento (nome, corretor, etapa, dias na etapa) na linha do dia de São Paulo. Alimenta a faixa "Fechamento nos últimos dias" e o "entrou e saiu desde ontem" do diretor | 02:55 UTC = 23:55 em SP, todo dia. Idempotente por empresa e dia: rodar de novo sobrescreve a linha (a última rodada do dia vence). Aplicar `drizzle/0222_negotiation_daily_snapshots.sql` antes; sem a tabela responde `skipped: "table_missing"` e a tela só esconde a faixa. Plano: `docs/implementations/active/2026-11-09-fechamento-ate-negativa.md` |
| `/api/internal/jobs/daily-report` | `0 21 * * *` | Relatório das 18h por WhatsApp: leads que entraram no dia em cada fila e quantos quentes, mornos e frios, para os números cadastrados em Avisos da equipe (os mesmos do aviso de fechamento, mais os que o diretor adicionar) | 21:00 UTC = 18h em SP. Idempotente por empresa e dia. Liga/desliga e números em Integrações › WhatsApp › Avisos da equipe › "Relatório das 18h" |
| `/api/internal/jobs/plantao-report` | `0 22 * * *` | Resultado diário do plantão para o grupo WAHA configurado pela Direção | 22:00 UTC = 19h em SP. Idempotente por empresa e dia; envio manual também consome a cota diária. Setting `plantao_report_<tenantId>` ausente significa desligado. Requer o grupo exato `Fechamento Plantão Geral` no número configurado. |

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
