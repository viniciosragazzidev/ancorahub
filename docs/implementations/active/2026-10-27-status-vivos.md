# Status vivos: a operação visível em tempo real

> Plano (27/10/2026). Pedido do Vinicios: "todo o sistema ter áreas resumidas, com animação e bem explicadas. Ex.: 'Leads frios 50 (próxima requalificação automática em 00:15:33)'. Isso para tudo."
> Estado: ondas 0 e 1 entregues em `feat/lite-listas` (27/10), parcial (ver seção 8). Ondas 2 a 4 em planejamento. Contratos visuais: `docs/implementations/active/2026-10-24-diretor-lite/refinamento-espacamento.md` e `motion-e-acabamento.md`.

## 1. Objetivo

1. Cada papel abre a tela e entende em 3 segundos o que está rolando agora, o que o sistema vai fazer sozinho a seguir e quando.
2. Tudo que roda sozinho (robôs, prazos, janelas, regras de retenção) vira uma peça padrão: o **status vivo**.
3. Uma peça só, uma camada de dados só, reaproveitando o que já existe (painel do plantão, painel essencial do diretor, saúde da distribuição).

## 2. Anatomia do status vivo

```
┌───────────────────────────────────────────────┐
│ ● Leads frios                       [Revisar →]│  rótulo + ação
│ 50                                             │  número (LiteNumber)
│ Próxima requalificação automática em 00:15:33  │  próximo evento + contagem
│ ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░                             │  barra até o próximo evento
│ 12 já receberam a tentativa; 38 esperam as 3 h.│  frase do porquê
└───────────────────────────────────────────────┘
```

| Parte | Regra |
|---|---|
| Rótulo | Substantivo curto, sentence case, sem ponto ("Leads frios", "Ofertas aguardando aceite") |
| Número | `LiteNumber` com `tabular-nums`; conta de zero só na primeira carga da sessão; depois anima só a diferença. Zero vira frase ("Nenhum lead frio agora") |
| Próximo evento | Verbo + o que acontece + contagem: "próxima requalificação automática em 00:15:33". Formato: abaixo de 1 h `mm:ss`, abaixo de 24 h `hh:mm:ss`, acima disso `2 d 04 h`. Sem evento calculável: mostra o último ("última rodada há 40 s") |
| Barra de progresso | `LiteProgress` (scaleX) do início da janela até o próximo evento. Só quando existe janela conhecida (ex.: frio desde X, requalifica em X+3 h) |
| Frase explicativa | 1 frase, com ponto final, no vocabulário da operação, dizendo o porquê ou o que acontece depois ("Quem não responder vira frio e entra na fila de frios.") |
| Gravidade (cor) | `ok` (neutro/sucesso), `info`, `atencao` (`--warning`), `critico` (`--danger`). Regra de gravidade mora no provedor, nunca na tela |
| Ação | Link para a tela onde se age (com filtro já aplicado). Sem permissão para agir: sem link |
| Detalhe opcional | Até 3 quebras ("modo manual 20; antes do plantão 11") em tooltip ou linha secundária |

**Movimento (segue `motion-e-acabamento.md`):**
- Entrada em cascata com os outros cartões (`LiteStagger`, máx. 8).
- Número que muda por atualização: `LiteNumber` + `LiteAttention` **uma vez**.
- Gravidade que sobe (ok para atenção, atenção para crítico): `LiteAttention` uma vez + troca de cor em 120 ms. **Nada de pulso infinito** (o anexo proíbe movimento infinito além do skeleton). "Pulso só quando exige ação" = um pulso na mudança, depois um ponto fixo colorido.
- Contagem regressiva: só o texto troca, sem animar cada segundo (sem blur, sem y). Ao chegar a zero: troca para "rodando agora…" com `LiteSwap` e busca dado novo.
- `prefers-reduced-motion` ou `html[data-reduce-motion="1"]`: só opacidade, número final direto, barra sem transição.
- Acessibilidade: o contador tem `role="timer"` (aria-live desligado, não anuncia a cada segundo) e `aria-label` com a hora absoluta ("às 15:42"); a mudança do número é anunciada em `aria-live="polite"`.

## 3. Arquitetura proposta

### 3.1 Componente (UI)
- `src/components/lite/status/live-status.tsx`: `LiteLiveStatus` (um cartão) e `LiteLiveStatusStrip` (faixa "Agora na operação", grade responsiva de 2 a 4 colunas, vira lista no celular).
- `src/components/lite/status/use-countdown.ts`: **um relógio só por página** com `useSyncExternalStore` (1 `setInterval` de 1 s compartilhado, pausa com a aba oculta). Mesmo padrão do `use-minute-clock.ts` (`src/features/broker-workspace/components/light-dashboard/`): o snapshot do servidor é `null`, então o primeiro render (SSR e hidratação) mostra a **hora absoluta** ("às 15:42") e o cliente troca para a contagem. Nada de `Date.now()` no primeiro render.
- Formatação de hora sempre em `America/Sao_Paulo` (`formatLiteDate` e `Intl` com `timeZone`).
- Substitui a contagem local do `BrokerLiveStatus` (`leads/distribuicao/plantao/_components/broker-live-status.tsx`), que hoje cria um `setInterval` por corretor.
- Página no catálogo do kit Lite com os 4 estados de gravidade, zero, sem próximo evento, número grande e movimento reduzido.

### 3.2 Camada de dados ("provedores de status")
- `src/features/live-status/`:
  - `types.ts`: contrato `LiveStatus = { id, label, value, severity, nextEvent?: { at, label, windowStartAt? }, lastEvent?: { at, label }, explanation, action?: { href, label }, breakdown?: { label, value }[], generatedAt, stale? }`. Datas em ISO.
  - `registry.ts`: cada provedor declara `id`, `roles` (diretor, gestor, supervisor, corretor, capacidade `marketing`), `ttlSeconds`, `tags` de cache e `load(scope, now)`.
  - `providers/*.ts`: um arquivo por área (distribuição, plantão, whatsapp, meta, pós-venda, jornada...). Funções puras para a regra (testáveis com `now` injetado), consulta agregada única por provedor (sem N+1).
  - `service.ts`: `getLiveStatuses(context, ids)` filtra pelos papéis, monta o escopo e chama em paralelo com orçamento de tempo (provedor lento devolve o último valor com `stale: true`).
  - `job-schedule.ts`: espelho da tabela do runbook `docs/runbooks/coolify-scheduled-tasks.md` (caminho, cron) + `nextRunAt(cron, now)` puro. É o que calcula "próxima rodada do robô".
- **Escopo por papel igual às telas atuais:** reaproveitar `buildNocLeadScope` e `buildNocMembershipScope` (`src/features/noc/role-scope.ts`) e `distribution-view-access.ts`. O escopo vira chave de cache simples (`tenant:branch` ou `tenant:supervisor:<id>` ou `tenant:broker:<id>`), nunca o objeto de sessão.
- **Cache curto:** `unstable_cache` por `provedor + chave de escopo`, `revalidate` 15 a 60 s conforme o provedor, com `tags` por tenant (mesmo padrão do `leaderboard-queries.ts`). Ações que mudam estado (atribuir, requalificar, liberar agora, confirmar presença) chamam `revalidateTag`.
- **Pool do banco:** as leituras rodam no pool das telas (`DB_POOL_MAX` 4). Por isso cada provedor é 1 consulta agregada, com índice existente, e o cache é compartilhado entre usuários do mesmo escopo.

### 3.3 Atualização sem recarregar
- Primeira pintura: Server Component busca os status e passa como props (sem skeleton para o caso comum).
- Cliente: hook `useLiveStatuses(ids, initial)` que:
  1. busca `GET /api/live-status?ids=...` (`cache: "no-store"`, contexto do tenant, mesmos papéis) a cada **60 s com a aba visível** (padrão do `celebration-host.tsx`);
  2. busca de novo **quando uma contagem chega a zero**, com folga de 20 s (o robô roda em degraus de 1, 2 ou 5 min);
  3. escuta o sinal `domain.invalidated` do `realtime-sync-provider.tsx` (domínios `leads`, `team`) para atualizar na hora quando o realtime estiver vivo; sem realtime, o fallback de 60 s cobre.
- Sem `router.refresh()` da página inteira por causa de um cartão.

### 3.4 Pré-requisito: "o robô rodou?"
Hoje nenhum job grava a última execução: a reserva `lease:*` em `system_settings` é apagada no fim (`src/shared/db/job-lease.ts`). Sem isso, "próxima rodada em 00:01:20" é só teoria (se o Coolify parar, a tela mente).
Proposta: no fim de cada rota em `backgroundRoute`, gravar `heartbeat:<job>` = `<ISO fim>|<ok|erro>|<contadores curtos>` (1 upsert por rodada, ~12 por minuto no total). Os leitores de configuração passam a pular o prefixo `heartbeat:` como já pulam `lease:`. Com isso:
- "Próxima rodada" = `nextRunAt(cron)`; "última rodada" = heartbeat.
- Heartbeat mais velho que 3 ciclos vira `critico`: "O robô de distribuição não roda há 9 min. Avise o Vinicios." (só diretor).

## 4. Mapeamento

Legenda de custo: **barato** = leitura de linha ou contagem com índice simples; **médio** = agregação com filtro de tenant/escopo em tabela grande (leads, outbox); **caro** = varre conversas, junta muitas tabelas ou chama serviço externo.
Papéis: D diretor, G gestor de unidade, S supervisor, C corretor, M capacidade marketing.

### 4.1 Distribuição e qualificação (onde mora o grosso)

| # | Status vivo (exemplo) | Quem vê | Fonte do dado | Próximo evento calculável | Custo | Onde aparece | Prio |
|---|---|---|---|---|---|---|---|
| 1 | **Leads frios 50** (próxima requalificação automática em 00:15:33). "12 já receberam a tentativa; 38 esperam completar 3 h frios." | D, G | `leads` (cold, sem corretor) + `whatsapp_outbound_messages` com prefixo `cold-lead-requalification:` (mesma consulta do `essential-data.ts`); regra em `cold-lead-requalification-policy.ts` | Sim: menor `coldSinceAt + 180 min` entre os elegíveis ainda sem tentativa e dentro das 24 h, arredondado para o próximo degrau do job `qualification-timeout` (`*/2`). Envio segurado fora de 08h a 18h em dias úteis (`cold_lead_business_window`): mostrar "sai às 08:00". Com turbo ligado e T2 aprovado, a requalificação é substituída pela régua (`turboCadenceCoversRequalification`): o texto muda para o item 8 | médio | `/dashboard` (essencial, bloco Leads por fila), `/leads/distribuicao` | P1 |
| 2 | **Fila Leads Frios: 23 liberam para corretores** (amanhã às 09:00, em 14:22:10). "O lead frio só vai para corretor no dia em que completa 2 dias, às 9 h." | D, G | `cold-age-release-rules.ts` (`coldReleaseAt`, `coldReleaseCutoff`) + `cold-age-release.ts` (config por fila, "Liberar agora") | Sim: próximo 09:00 SP; contagem = leads com `coldReleaseAt <= próximo 09:00` | barato | `/leads/distribuicao` (seção da fila, `cold-age-release-section.tsx`), `/dashboard` | P1 |
| 3 | **Em qualificação pela IA 8** (próximo tempo limite em 00:04:12). "Quem não responder até lá vira frio; quem deu dado válido vira morno." | D, G | `ai_qualification_sessions` / `leads.qualification_state = IN_PROGRESS` + `ai_qualification_configs.timeout_minutes` (padrão 15) | Sim: menor `last_interaction_at + timeoutMinutes`, arredondado ao degrau `*/2` do job | médio | `/dashboard`, `/qualificacao` | P1 |
| 4 | **Aguardando corretor 6** (próxima tentativa em 00:01:12). "Motivo principal: nenhum corretor de plantão nesta fila." | D, G, S | `lead_distribution_jobs` (`pending`/`retrying`, `run_after`, `last_error_message`) + `getLeadDistributionJobHealth` | Sim: menor `run_after` futuro, limitado ao próximo degrau do job `distribution` (`*/2`). Motivo = agrupamento de `last_error_message` | barato | `/leads/distribuicao` (topo), `/dashboard`, `/gestao` | P1 |
| 5 | **Retidos por regra 31** (nova revisão em 00:09:40). "Fila em modo manual 20; chegaram antes do plantão 11. Esses só saem com atribuição manual." | D, G | `lead_distribution_jobs` cujo motivo bate em `HELD_DISTRIBUTION_REASON_PREFIXES` (`domain.ts`: frio retido, antes do plantão, modo manual, outra unidade, origem, "Lead anterior a" de 02/10) | Sim: `run_after` (revisão a cada 15 min, `HELD_DISTRIBUTION_RETRY_MS`), mas o evento útil é a ação humana: link "Atribuir" | barato | `/leads/distribuicao` (aba Inbox) | P2 |
| 6 | **Ofertas aguardando aceite 3** (a primeira expira em 00:02:41). "Se o corretor não aceitar, o lead vai para o próximo da fila." | D, G, S; C vê a dele | `lead_offers` (`status` ativo, `expires_at`) | Sim: menor `expires_at` (exato) | barato | `/leads/distribuicao/plantao`, cartão do corretor (`BrokerLiveStatus`), home do corretor | P1 |
| 7 | **Sem primeiro contato 4** (o mais próximo estoura em 00:06:00). "Prazo de 15 min + 5 de tolerância. Com redistribuição ligada, o lead volta para a fila." | D, G, S; C vê os dele | `lead_assignment_attempts` (`status = open`, `first_contact_at` nulo, `feedback_due_at`) + `tenants.sla_first_contact_minutes`, `feedback_grace_minutes`, `auto_redistribute_on_feedback_timeout`; varredura `runFeedbackSlaSweep` (`/api/internal/sla`, `*/5`, só horário comercial) | Sim: menor `feedback_due_at`; fora do horário comercial: "pausado até 08:00" | médio | `/dashboard`, `/gestao`, home do supervisor, `/minha-fila` (corretor: "Responda o Fulano em 00:06:00") | P1 |
| 8 | **Régua de lembretes 27 leads** (próximo envio: T2 em 00:42:00). "Lembra quem recebeu a 1ª mensagem e não respondeu, das 8 h às 20 h, e para na primeira resposta." | D, G | `qualification-turbo/cadence.ts` (`decideNextTouch`, T1 20 min, T2 3 h, T3 dia seguinte 10 h, T4 3 dias, janela 8 h a 20 h) + outbox | Sim: menor próximo toque calculado pela função pura, degrau `*/2` | médio | `/qualificacao` (aba Turbo), `/dashboard` | P2 |
| 9 | **Aguardando ação manual 5** (sem prazo). "Desqualificados 3, bloqueados pela Meta 2. O sistema não mexe neles." | D, G | `automaticDistributionHoldReason` (`domain.ts`): `disqualified`, `meta_blocked`, frio parcial | Não (estado parado); mostra "mais antigo há 2 d" | barato | `/leads/distribuicao` | P3 |
| 10 | **Motor de distribuição ativo** (última rodada há 40 s; próxima em 00:01:20). "2 leads falharam 3 vezes e pedem revisão." | D | heartbeat (seção 3.4) + `lead_distribution_jobs.failed` + `lead_effect_outbox.failed` (já no `director-distribution-health.tsx`) | Sim: cron `*/2`; atraso real só com heartbeat | barato | `/leads/distribuicao` (aba Saúde), `/dashboard` | P1 |

### 4.2 Plantão

| # | Status vivo (exemplo) | Quem vê | Fonte do dado | Próximo evento calculável | Custo | Onde aparece | Prio |
|---|---|---|---|---|---|---|---|
| 11 | **Plantão da tarde: 5 de 7 confirmados** (termina em 02:13:00; próximo começa às 19:00). "3 estão prontos para receber agora." | D, G, S | `duty_presence_confirmations` + escalas (`dated-duty-roster.ts`, `duty-roster-live-status.ts`, `summarizeDuties` do essencial) | Sim: `shift_ends_at` e início do próximo turno | médio | `/dashboard` ("Plantões acontecendo agora", já existe: só ganha a contagem), `/leads/distribuicao/plantao` | P1 |
| 12 | **2 sem confirmar presença** (tolerância acaba em 00:12:40). "Depois de 20 min do início, só o supervisor libera." | D, G, S; C vê o dele | `duty-presence-domain.ts` (`SELF_CONFIRM_OPENS_MINUTES` 30, `SELF_CONFIRM_TOLERANCE_MINUTES` 20, `getSelfDutyConfirmationWindowState`) | Sim: início + 20 min (ou `joinedAt` + 20) | barato | `/leads/distribuicao/plantao`, `/plantoes/agora` (corretor: "Confirme sua presença: fecha em 00:12:40"), home do supervisor | P1 |
| 13 | **Você está pronto para receber** (oferta expira em 00:01:30). | C (o dele); D, G, S por corretor | `classifyBrokerLiveOfferStatus` (`duty-roster-live-status.ts`, já devolve `nextEventAt`) | Sim: já calculado | barato | home do corretor, cartão do corretor no plantão (troca o `BrokerLiveStatus` pela peça nova) | P2 |
| 14 | **Trocas de plantão pendentes 2** (sem prazo). "Esperando o colega aceitar pelo WhatsApp." | D, G, S, C envolvido | `duty_roster_swaps` (`status`, `whatsapp_a_status`, `whatsapp_b_status`) | Parcial: data do plantão trocado ("plantão em 2 d") | barato | `/plantoes`, `/leads/distribuicao/plantao` | P3 |
| 15 | **Escala de novembro: rascunho** (mês começa em 4 d 03 h). "Publique para os corretores receberem o aviso." | D, G | `duty_schedule_monthly_plans` (`status`, `published_at`) + `duty_roster_pending` | Sim: dia 1 do próximo mês | barato | `/leads/distribuicao/plantao` (planejador mensal) | P3 |

### 4.3 WhatsApp e mensagens

| # | Status vivo (exemplo) | Quem vê | Fonte do dado | Próximo evento calculável | Custo | Onde aparece | Prio |
|---|---|---|---|---|---|---|---|
| 16 | **Mensagens na fila 14** (9 seguradas fora do horário, saem às 08:00, em 09:12:00). "2 falharam hoje: número inválido." | D | `whatsapp_outbound_messages` (`status`, `hold_reason`: `cold_lead_business_window`, `number_spacing`, `disabled`; `next_attempt_at`, `failed_at`, `provider_error_code`) | Sim: menor `next_attempt_at`/`scheduled_at`, degrau `* * * * *` do job `whatsapp` | médio | `/dashboard`, `/integrations` (canal oficial) | P1 |
| 17 | **3 corretores com WhatsApp desconectado** (desde 10:40). "As conversas deles não entram no CRM até reconectar." | D, G, S; C vê o dele | `whatsapp_connections` / `waha_numbers` (já no bloco "WhatsApp dos corretores" do essencial) + heartbeat do `waha-sync` | Não (estado); mostra "desde" | barato | `/dashboard`, `/equipe`, home do corretor | P2 |
| 18 | **Janela de atendimento fecha em 03:12:00.** "Depois disso, só mensagem modelo aprovada pela Meta." | C, S (por conversa) | `isCustomerServiceWindowOpen` (`message-policy-service.ts`): última mensagem recebida do cliente + 24 h | Sim: última entrada + 24 h | barato (por conversa) | `/conversas` (cabeçalho da conversa), detalhe do lead | P2 |
| 19 | **Modelos aguardando a Meta 2.** "Sem o `anc_t2_beneficio` aprovado, o lembrete T2 é pulado." | D | `meta_whatsapp_templates` (status) | Não (depende da Meta) | barato | `/qualificacao` (Turbo), `/integrations` | P3 |

### 4.4 Meta Ads e captura (capacidade marketing + diretor)

| # | Status vivo (exemplo) | Quem vê | Fonte do dado | Próximo evento calculável | Custo | Onde aparece | Prio |
|---|---|---|---|---|---|---|---|
| 20 | **Último lead da Meta há 7 min** (hoje 42). "Se passar de 2 h em horário comercial, confira a conexão." | D, M | `meta_webhook_events.received_at` / `leads` com origem Meta | Não; alerta por silêncio (limiar a decidir) | barato | `/marketing`, `/dashboard` | P2 |
| 21 | **Meta sincronizada há 12 min** (próxima às 15:00, em 00:48:10). "Em espera por limite de chamadas da Meta até 15:20." | D, M | `meta_sync_logs` + `meta-sync-status.ts` (resumo e espera progressiva `META_RATE_LIMIT_*`) | Sim: cron `0 * * * *` ou fim da espera | barato | `/marketing/meta`, `/integrations/meta` | P2 |
| 22 | **Conversões para a Meta: 5 na fila** (próximo envio em 00:03:00). "Quente e Venda voltam para a Meta otimizar as campanhas." | D, M | `meta_conversion_events` (`status`, `attempts`, `next_attempt_at`, `last_error`) | Sim: menor `next_attempt_at`, degrau `*/5` | barato | `/marketing/meta` | P3 |

### 4.5 IA e inteligência

| # | Status vivo (exemplo) | Quem vê | Fonte do dado | Próximo evento calculável | Custo | Onde aparece | Prio |
|---|---|---|---|---|---|---|---|
| 23 | **Etapa automática: 14 leads avançados hoje** (próxima análise em 00:06:00). "A IA lê as conversas novas e só avança com certeza; Perdido fica como sugestão." | D | auditoria/`lead_distribution_events` do job `conversation-intelligence` + heartbeat | Sim: cron `*/10` | médio | `/atendimento`, `/dashboard` (aba Operação) | P3 |
| 24 | **Situações sugeridas para revisar 6.** "Perguntas que nenhuma situação cobriu." | D | `situation_suggestions` (pendentes) | Sim: cron `*/30` | barato | `/atendimento/situacoes` | P3 |
| 25 | **Catálogo das operadoras: 4 arquivos na fila, 3 mudanças esperando você.** | D | fila de `operator_catalog_*` (suggestions pendentes) | Sim: cron `*/5` | barato | `/ferramentas` (Materiais das operadoras) | P3 |

### 4.6 Equipe, jornada e metas

| # | Status vivo (exemplo) | Quem vê | Fonte do dado | Próximo evento calculável | Custo | Onde aparece | Prio |
|---|---|---|---|---|---|---|---|
| 26 | **Ranking da semana fecha em 2 d 04:12:00.** "Você está em 3º, a 40 pontos do 2º." | C (o dele); S, G, D (equipe) | `journey-periods.ts` (`journeyWeek`: segunda 00:00 SP) + `leaderboard-queries.ts` (já com `unstable_cache` 60 s) | Sim: `journeyWeek(now).endsAt` | barato (cache existente) | `/jornada`, home do corretor | P2 |
| 27 | **Meta de vendas do mês 62%** (fecha em 4 d). "No ritmo atual chega a 81%; faltam 3 vendas por dia." | D, G, S; C a dele | `goals` (`period`, `end_date`) + `goal_progress` | Sim: `end_date` | barato | `/desempenho`, home do corretor | P2 |
| 28 | **Resumo do dia da equipe sai às 19:00** (em 03:10:00). | S | job `supervisor-digest` (`0 22 * * *` UTC) | Sim: próximo 19:00 SP | barato | home do supervisor | P3 |
| 29 | **Campanha "Novembro Azul" termina em 6 d.** "12 corretores já pontuaram." | D, S, C | campanhas da jornada (`campaign-actions.ts`, `endsAt`) | Sim | barato | `/jornada` | P3 |

### 4.7 Pós-venda, tarefas e documentos

| # | Status vivo (exemplo) | Quem vê | Fonte do dado | Próximo evento calculável | Custo | Onde aparece | Prio |
|---|---|---|---|---|---|---|---|
| 30 | **Tarefas vencidas 7** (a próxima vence em 00:35:00). | C (as dele); S, G, D | `lead_tasks` + `runTaskOverdueSweep` (`/api/internal/reminders`, `*/5`) | Sim: menor prazo aberto | barato | `/tarefas`, home do corretor | P2 |
| 31 | **Renovações nos próximos 30 dias 12** (a mais próxima em 3 d). "O lembrete chega ao corretor 30 dias antes do aniversário do contrato." | D, G, C | `active_customers` (`contract_anniversary`, `renewal_window_start_date`) + `customer_renewal_reminders` (`scheduled_for`); `RENEWAL_ALERT_WINDOW_DAYS` | Sim | barato | `/clientes`, `/relacionamento` | P2 |
| 32 | **Aniversariantes hoje 2.** "Mande os parabéns pelo Relacionamento." | C, D | data de nascimento em clientes (`person-record-details`; confirmar campo) | Sim (dia) | barato | `/relacionamento`, home do corretor | P3 |
| 33 | **Documentos vencendo 3** (o primeiro em 5 d). | C, D | `lead_documents.expiration_date` | Sim | barato | `/documentos` | P3 |
| 34 | **Próximo repasse em 5 d: R$ 4.320,00.** | D, capacidade financeiro, C (o dele) | `commission_schedule` (`due_date`, `paid_at`) | Sim | barato | `/financeiro`, `/vendas` | P3 |

Fora do escopo (só Super-admin): expurgo agendado (`platform_purge_jobs`), efeitos pós-entrada (`lead_effect_outbox`, entra no item 10 só as falhas).

### 4.8 O que já existe e será reaproveitado (não duplicar)
| Peça existente | Onde | Vira |
|---|---|---|
| `BrokerLiveStatus` (pílula + contagem `mm:ss` a partir de `nextEventAt`) | `leads/distribuicao/plantao/_components/broker-live-status.tsx` | Primeiro consumidor do `LiteLiveStatus` compacto; a contagem passa para o relógio compartilhado |
| `classifyBrokerLiveOfferStatus` | `lead-distribution/duty-roster-live-status.ts` | Provedor do item 13 sem mudança de regra |
| Painel essencial do diretor (Plantões agora, Leads por fila com requalificação, WhatsApp dos corretores) | `features/dashboard/essential/*`, `director-lite/essential-view.tsx` | Fonte dos itens 1, 11 e 17; os blocos ganham a linha de próximo evento em vez de nova tela |
| Saúde da distribuição (jobs e efeitos) | `director-distribution-health.tsx` + `getLeadDistributionJobHealth` | Provedor do item 10 |
| Resumo de sincronização Meta (`MetaSyncSummary`, tom e "há 2 h") | `meta-ads/meta-sync-status.ts` | Provedor do item 21 |
| NOC (anomalias, mapa de calor) e escopo por papel | `features/noc/*` | Escopo dos provedores; NOC continua sendo a visão analítica, status vivo é a visão "agora" |
| `useMinuteClock` (relógio sem quebrar hidratação) | `broker-workspace/components/light-dashboard/use-minute-clock.ts` | Base do `use-countdown.ts` (com tique de 1 s) |
| `LiteNumber`, `LiteProgress`, `LiteAttention`, `LiteSwap`, `LiteStagger` | `src/components/lite/motion/` | Animação da peça, sem constante nova |
| `realtime-sync-provider` (`domain.invalidated`, fallback por intervalo) | `src/components/providers/` | Gatilho de atualização imediata |
| Avisos dinâmicos (`team-notices`) | `features/team-notices` | Não usar para status: aviso é mensagem pontual; status vivo é estado contínuo |

## 5. Ondas de entrega

**Onda 0, fundação (M):** `LiteLiveStatus` + `LiteLiveStatusStrip` + `use-countdown` + catálogo; `features/live-status` (contrato, registro, serviço, rota `GET /api/live-status`, cache com tags); `job-schedule.ts` com `nextRunAt`; heartbeat dos jobs (seção 3.4). Testes: funções puras com `now` fixo, hidratação (padrão `number.hydration.test.tsx`), escopo por papel, movimento reduzido.

**Onda 1, o "agora" da operação (M), faixa no topo do `/dashboard` e do `/leads/distribuicao`:**
1. Leads frios + próxima requalificação automática (item 1).
2. Liberação da fila de frios às 9 h (item 2).
3. Em qualificação pela IA + próximo tempo limite (item 3).
4. Aguardando corretor + próxima tentativa e motivo (item 4).
5. Ofertas aguardando aceite + expiração (item 6).
6. Sem primeiro contato + estouro do prazo (item 7).
7. Plantão agora: confirmados, prontos, fim do turno, e presença com tolerância (itens 11 e 12 no mesmo cartão).
8. Fila de envio do WhatsApp: seguradas, quando saem e falhas (item 16).
Mais o item 10 (motor ativo) como selo pequeno na faixa, só para o diretor.

**Onda 2, cada papel na sua casa (M):** home do corretor (itens 6, 7, 12, 13, 26, 30), home do supervisor (7, 11, 12, 28), `/gestao` do gestor (4, 7, 11 no escopo da unidade), régua turbo (8), retidos por regra (5), WhatsApp desconectado (17), janela de 24 h na conversa (18).

**Onda 3, marketing e crescimento (P):** itens 20, 21, 22, 27, 31.

**Onda 4, cauda longa (P):** itens 9, 14, 15, 19, 23, 24, 25, 29, 32, 33, 34.

Critério de pronto de cada onda: anexo de movimento cumprido (vídeo normal e com movimento reduzido), escopo por papel testado, nenhuma consulta nova acima de 50 ms no `EXPLAIN` com dados de produção, contagem batendo com a tela de ação do link.

## 6. Riscos
- **Tela que mente:** contagem baseada só no cron sem saber se o robô rodou. Mitigação: heartbeat (3.4) e estado `stale`.
- **Pool do banco:** 8 cartões x usuários abertos x 60 s. Mitigação: cache compartilhado por escopo, 1 consulta por provedor, polling só com aba visível.
- **Regras que mudam rápido** (DEC-151 tirou o intervalo entre ofertas; turbo substitui a requalificação): a regra fica na função pura do domínio, o provedor só chama. Nunca copiar número mágico para a UI.
- **Ruído visual:** status demais vira painel de avião. Limite de 4 a 6 por faixa e gravidade `ok` com visual neutro.
- **Fuso:** todo "às 09:00" e "dia útil" calculado em `America/Sao_Paulo` no servidor, igual às regras existentes.

## 7. Decisões do Vinicios
1. Aprovar o heartbeat dos jobs (1 gravação por rodada em `system_settings`) para a tela saber se o robô parou?
2. A faixa "Agora na operação" fica no topo do `/dashboard` para todos os papéis, ou cada papel só na sua home?
3. Gestor e supervisor veem o selo "motor de distribuição" e a fila do WhatsApp, ou só o diretor?
4. Qual o limite de silêncio da Meta para virar alerta (ex.: 2 h sem lead em horário comercial)?
5. Ao chegar a zero, a contagem deve dar um pulso único chamando atenção, ou só trocar o texto em silêncio?

**Respostas (27/10):** 1) sim, 1 gravação por rodada em `system_settings`, sem migration; 2) faixa no `/dashboard` de todos os papéis (e no `/leads/distribuicao`), cada papel vendo só o que já vê hoje; 3) selo do motor e fila do WhatsApp para diretor e gestor; 4) Meta sem lead: 2 h em horário comercial (entra na onda 3, item 20); 5) pulso único e troca do texto, respeitando o movimento reduzido.

## 8. Entrega das ondas 0 e 1 (27/10)

**Onde está:**
- UI: `src/components/lite/status/` (`live-status.tsx`, `use-countdown.ts`, `format.ts`, `types.ts`). Relógio único com `useSyncExternalStore`; snapshot do servidor nulo, então SSR e hidratação mostram "às 15:42" e o cliente troca para a contagem.
- Dados: `src/features/live-status/` (`providers/*.ts` com as regras puras, `loaders.ts` com uma consulta por status, `service.ts` com cache `TtlCache` por status e escopo e orçamento de 2,5 s, `visibility.ts` com quem vê o quê, `scope.ts` com `buildNocLeadScope`).
- Atualização: `components/live-status-host.tsx` busca `GET /api/live-status` a cada 60 s com a aba visível, 20 s depois de uma contagem chegar a zero e 3 s depois de um `domain.invalidated` do tempo real (menos conversas e conexão do WhatsApp). Sem `router.refresh`.
- Heartbeat: `heartbeat.ts` (`withJobHeartbeat` em todas as rotas do runbook) e `job-schedule.ts` (espelho do runbook, testado contra ele).
- Chave: `feature_live_status_strip_<tenantId>` (catálogo `LIVE_STATUS_STRIP`, padrão desligado), liga e desliga auditado em Super-admin › Empresa › Pilotos.
- Telas: `/dashboard` (Lite do diretor e de quem usa o visual Lite, painel do dia, início Lite do corretor, supervisor e gestor) e `/leads/distribuicao` (Lite e legado). Chave desligada: nenhum elemento novo (snapshots legados e HTML do painel conferidos).

**Quem vê:** diretor e gestor (com unidade) os 8 status e o selo; supervisor (equipe) e corretor (o dele) ofertas, primeiro contato e plantão. Marketing e gestor sem unidade não veem a faixa. Aguardando corretor ficou só com diretor e gestor: o supervisor não vê leads sem corretor hoje.

**Decisões de implementação:**
- Frios e qualificação pela IA olham as últimas 48 h; primeiro contato as últimas 24 h; ofertas as das últimas 24 h ainda não vencidas (limites que usam índices existentes).
- Qualificação pela IA estima o tempo limite pela última atividade da conversa da IA (a varredura também olha a última mensagem), alinhado ao passo de 2 min do robô.
- Falhas do selo do motor contam só as últimas 24 h (falha antiga não deixa o selo laranja para sempre).
- O visual Lite é só claro: no tema escuro a faixa segue os tokens do Lite, como o resto da moldura.

**Falta (parcial):** `revalidateTag` nas ações que mudam estado (hoje o cache curto de 15 a 60 s cobre); página do status vivo no catálogo do kit Lite; vídeo do movimento normal e reduzido; `EXPLAIN` com dados de produção; ligar a chave no piloto e conferir a contagem contra as telas de ação; regra do tenant de reativação de frios (`getActiveTenantRule`) não é lida pelo status de frios.
