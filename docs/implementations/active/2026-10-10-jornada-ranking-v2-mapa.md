# Mapa das fontes (Jornada v2), levantado em 2026-10-10

"Extrato" = `engagement_point_events` (schema.ts:3648). Índices: unique (tenant, idempotency_key), (tenant, broker, occurred_at), (tenant, period_day, rule_key). **Toda leitura filtra `reversed_at IS NULL`.**

## 1. Evidência de cada missão e conquista

**Missões do dia (A2)**
- **Todo 1º contato em até 5 min:** numerador = extrato `contact.first` com `metadata->>'tier'='5min'` no `period_day` SP; denominador = `leads.corretor_id = broker` com `assigned_at` no dia e `deleted_at IS NULL` (índice `leads_corretor_assigned_at_live_idx`). Lead reatribuído conta só para o dono atual (collector.ts:49-57).
- **Zerar retornos vencidos:** `lead_tasks.assigned_to = broker, completed_at IS NULL, due_at < now` (índice `lead_tasks_assigned_due_idx`). Decidir se inclui `lead_task_assignees` (schema.ts:877).
- **Registrar cada atendimento:** numerador direto de `lead_interactions` (`tipo='note'`, `user_id=broker`, 40+ caracteres normalizados, scoring.ts:96), não do extrato (o limite diário de 10 corta); denominador = leads com `service_started_at` hoje. Falta índice em `user_id`.
- **Aceitar oferta em até 1 min:** numerador = extrato `offer.fast_accept`; denominador = `lead_offers.broker_id, offered_at` no dia, status diferente de CANCELLED. **Falta índice (broker_id, offered_at).**

**Da semana:** dias com contato no prazo = `count(distinct period_day)` de `contact.first` na semana; 20 contatos = count de `contact.first`. Índice (tenant, broker, occurred_at) cobre.

**Conquistas**
- Raio: `contact.first` tier 5min, total.
- Plantão firme: `duty_presence_confirmations` (`status='confirmed' AND confirmed_by IS NULL`, por `duty_date`, sequência). A regra `duty.presence` está desligada, então o extrato não tem.
- Primeira venda: `sales.broker_id`, status active. Desligar enquanto `sale.approved` estiver off.
- Família protegida / Empresa cuidada: `sales.carrier_plan_id → carrier_plans.type` (familiar / pme / empresarial) ou `leads.tipo` PF/PJ.
- Retorno em dia: `return.on_time`, total.
- **Ninguém esperando:** `leads.sla_breached_at` **nunca é gravado** (só lido em leads/[id]/page.tsx:116). Calcular: leads atribuídos na semana cujo 1º envio humano passou de `assigned_at + tenants.sla_first_contact_minutes`, ou não existe.
- Virada: não há histórico de temperatura; só `leads.qualification_status='cold'` atual. Precisa de foto no momento da venda ou `audit_logs`. Deixar desligada na v1.

## 2. Plantão hoje

`getLocalDutyParts` (leads/assignment.ts:11). Padrão de referência: supervisor-workspace/queries.ts:146-176 (`duty_date = periodDay(now)` ou semanal por `day_of_week` dentro da validade). Deduplicação: `resolveEffectiveDutyAssignments` (lead-distribution/dated-duty-roster.ts:28, 61). `getBrokerWorkspaceData().duty` só dá `{active, next}`: plantão que já terminou hoje não aparece; "tem plantão hoje" precisa de consulta própria.

## 3. Encaixe na UI

- Assistentes: `ASSISTANTS` em broker-workspace/chat/assistant-scripts.ts:23-34; `AssistantId` em components/chat/types.ts:8; `buildAssistantThreads` (assistant-scripts.ts:198-276); rota `dashboard/c/[assistant]/page.tsx` com `SCRIPTED` (:19). Conversa "Jornada": união do id, entrada em ASSISTANTS (href `/dashboard/c/jornada`, hue livre 85), push com flag, script.
- DynamicNotice: só existe a fila de leads (providers/realtime-sync-provider.tsx:115, 357-392). **Não há fila de prioridade**: celebração só aparece com `incomingLeads.queue` vazia.
- Missão de etapa: broker-stats.ts:96-133, chat-home-content.tsx:63-69, week-ranking.tsx:63-70; sem barra de progresso hoje.
- Confete: privado em tour/lite-tour.tsx:487-520 (extraído para `features/journey/components/confetti.tsx`).
- Configurações: settings/page.tsx:87-101 → `LightSettings` (união fechada em _components/light-settings.tsx:9) + `SETTINGS_SECTIONS` (light-routes.ts:121).
- Lite: `LIGHT_ALLOWED_PREFIXES` (light-routes.ts:8-21, sem `/jornada`), `LIGHT_MORE_DESTINATIONS` (:82-89, `requires`), `RULES` (:132+); flags vêm de (dashboard)/layout.tsx:182.

## 4. Desempenho do placar

- Soma semanal por tenant e unidade com join em `tenant_memberships` (índices só de coluna única). Índice recomendado: `(tenant_id, period_day, broker_id) INCLUDE (points) WHERE reversed_at IS NULL`.
- Posição própria e distância precisam de `rank()`; comparar com a semana anterior dobra o intervalo.
- Cache: `TtlCache` por processo (broker-stats.ts:47) não é compartilhado; usar `unstable_cache` por tenant + semana.
- Celebrações a cada 30 s devem ler só `engagement_celebrations (user, seen_at)`.
- Limites da semana como string `'YYYY-MM-DD'` (segunda SP), nunca Date cru em `sql`.
