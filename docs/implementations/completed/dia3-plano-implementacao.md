# Plano de Implementação — Dia 3: Núcleo do CRM

> **Data:** 12/07/2026
> **Status atual:** 🟡 ~50% (5/10 itens concluídos)
> **Objetivo:** Implementar os 5 itens restantes para completar o coração do sistema — distribuição automática, disponibilidade do corretor, motores de SLA e notificações.

---

## 📊 Resumo do Estado Atual

| # | Funcionalidade | Status | Esforço Estimado |
|---|---|---|---|
| 3.1 | Cadastro manual de lead | ✅ **Concluído** | — |
| 3.2 | Webhook genérico de recebimento de leads | ✅ **Concluído** | — |
| 3.3 | Funil de status do lead (9 etapas + regras) | ✅ **Concluído** | — |
| 3.4 | Timeline de interações do lead | ✅ **Concluído** | — |
| 3.5 | Distribuição round-robin | ❌ Pendente | **Médio** (4h) |
| 3.6 | Status "pausado/disponível" do corretor | ❌ Pendente | **Médio** (3h) |
| 3.7 | Motor de SLA — "Não Trabalhado" | ❌ Pendente | **Grande** (6h) |
| 3.8 | Motor de SLA — "Estagnado" | ❌ Pendente | **Grande** (6h) |
| 3.9 | Motivo de perda (lista fixa) | ✅ **Concluído** | — |
| 3.10 | Notificações in-app (sino) + push | ❌ Pendente | **Grande** (8h) |

**Total restante:** ~27 horas de implementação

---

## 🧱 Pré-requisitos comuns

Antes de iniciar qualquer item, verificar:

- [ ] Nenhuma decisão bloqueante pendente em `docs/decision-log.md` para os comportamentos abaixo
- [ ] Permissões necessárias registradas em `src/shared/auth/permissions.ts`
- [ ] Migrations Drizzle geradas e aplicadas ao Neon (staging) quando schema for alterado
- [ ] `docs/business-rules.md` atualizado com novas regras implementadas
- [ ] Testes unitários para lógica crítica incluídos em cada item
- [ ] Logs de auditoria para operações sensíveis (reatribuição, SLA alertas)

---

## 3.5 — Distribuição Round-Robin 🔴 P0

### O que já existe
- `src/features/leads/assignment.ts` — função `chooseAvailableBroker()` que seleciona o corretor com **menos leads ativos** (load-based) dentro da filial
- Já é chamada por `manual-create.ts` e `create-lead-from-webhook.ts`
- Filtra por: `role === "broker"`, `status === "active"`, `availabilityStatus === "available"`, `user.active === true`
- Schema tem `assignedAt` no lead

### O que precisa ser implementado

**Problema:** A distribuição atual é load-based (menor carga), não round-robin verdadeiro. Isso significa que o mesmo corretor pode receber leads consecutivos se sua carga for sempre a menor.

**Solução:** Implementar round-robin real que:
1. Rastreia o **último corretor que recebeu** um lead (por tenant+branch)
2. Na próxima distribuição, começa a busca a **partir do próximo** na lista ordenada
3. Se atingir o final da lista, volta ao início (circular)

### Arquivos a criar/modificar

| Arquivo | Ação |
|---|---|
| `src/shared/db/schema.ts` | Adicionar tabela `lead_distribution_log` (tenant_id, branch_id, last_broker_id, created_at) |
| `src/features/leads/assignment.ts` | Reescrever `chooseAvailableBroker()` com lógica round-robin circular |
| `src/features/leads/assignment.test.ts` | **Criar** — testar: rotação correta com 3+ corretores, salto de corretor pausado, filial sem corretores, corretor com carga máxima |
| `docs/decision-log.md` | Registrar decisão DEC-002 (round-robin circular em vez de load-based) |

### Fluxo detalhado

```
1. Receber lead (manual ou webhook)
2. Buscar corretores elegíveis da filial (ordenados por created_at)
3. Buscar último corretor que recebeu lead nesta tenant+branch
4. Encontrar índice do último corretor na lista
5. Avançar para o próximo índice (circular)
6. Se corretor do próximo índice está disponível → atribuir
7. Se não → pular para o próximo (até 2 tentativas, depois fallback para load-based)
8. Atualizar lead_distribution_log com o corretor escolhido
9. Retornar corretorId (ou null se nenhum disponível)
```

### Testes unitários

- [ ] Rotação correta com 3 corretores elegíveis
- [ ] Pular corretor pausado e atribuir ao próximo
- [ ] Voltar ao início após atingir o fim da lista
- [ ] Filial sem corretores elegíveis → retorna null
- [ ] Corretor com carga máxima é pulado
- [ ] Log é atualizado após cada distribuição

---

## 3.6 — Status "Pausado/Disponível" do Corretor 🔴 P0

### O que já existe
- `schema.ts` — campo `availabilityStatus` no `tenantMemberships` (enum: `available`/`paused`)
- `src/features/leads/availability-action.ts` — `toggleBrokerAvailabilityAction()` server action completa (altera DB, revalida path)
- `assignment.ts` — já filtra por `availabilityStatus === "available"`
- `src/app/(dashboard)/corretor/resumo/_components/` — estrutura do dashboard do corretor
- Já existe `availability-toggle.tsx` referenciado no broker-resume-dashboard

### O que precisa ser implementado

| Arquivo | Ação |
|---|---|
| `src/app/(dashboard)/corretor/resumo/_components/availability-toggle.tsx` | **Criar** — componente de toggle visual (switch/button) com feedback visual claro |
| `.env.example` | Verificar se precisa de alguma env |

**Importante:** Verificar se o arquivo `availability-toggle.tsx` já existe antes de criar. O `BrokerResumeDashboard` já faz `import { AvailabilityToggle } from "./availability-toggle"`.

### Especificação do Componente

```
┌─────────────────────────────────────┐
│  [🟢] Disponível     │ Pausar │
│  Recebendo novos leads automáticos  │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  [🔴] Pausado        │ Retomar │
│  Não receberá novos leads           │
└─────────────────────────────────────┘
```

- Usar `useActionState` para o toggle (padrão do projeto, como em `addLeadNoteAction`)
- Mostrar toast de feedback (sonner) ao mudar estado
- Botão desabilitado durante a transição (loading)
- Revalidar path `/dashboard` após sucesso

### Testes

- [ ] Render correto baseado no `initialStatus`
- [ ] Toggle alterna entre disponível/pausado
- [ ] Loading state durante a transição
- [ ] Apenas corretores podem usar (ação já valida no servidor)
- [ ] A distribuição round-robin respeita o status

---

## 3.7 — Motor de SLA — "Não Trabalhado" 🔴 P0

### O que já existe
- Schema fields: `assignedAt`, `firstContactAt`, `stageEnteredAt`
- `lead_distribution_log` (será criada no 3.5)
- `integrity_alerts` no docs de estrutura de dados (ainda não no schema)
- `notifications` no docs de estrutura de dados (ainda não no schema)

### O que precisa ser implementado

**Regra de négocio (BR-025):** SLA de "Não Trabalhado" dispara quando um lead é distribuído a um corretor mas **não tem nenhuma interação** (primeiro contato) dentro de um período configurável (ex: 24h para P0, 48h para P1).

#### Itens:

| Arquivo | Ação |
|---|---|
| `src/shared/db/schema.ts` | Adicionar tabela `integrity_alerts` e `sla_configs` |
| `src/features/distribution/sla/unworked-sla.ts` | **Criar** — motor de verificação de SLA "não trabalhado" |
| `src/features/distribution/sla/stagnation-sla.ts` | **Criar** — motor de verificação de estagnação (item 3.8) |
| `src/features/distribution/sla/sla-constants.ts` | **Criar** — constantes de SLA (prazos, labels) |
| `src/features/distribution/sla/sla.test.ts` | **Criar** — testes para ambos os motores |
| `src/features/leads/actions.ts` | Adicionar verificação de SLA ao criar interação (resetar contadores) |
| `src/app/api/cron/sla-check/route.ts` | **Criar** — API Route para ser chamada por cron (Vercel Cron Jobs) |
| `drizzle/migration` | Gerar migration para novas tabelas |

### Tabelas necessárias

#### `sla_configs`
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | text (PK) | UUID |
| `tenant_id` | text (FK → tenants) | Escopo do tenant |
| `tipo` | text | `unworked` ou `stagnation` |
| `prazo_horas` | integer | Horas limite (ex: 24) |
| `notificar_gestor` | boolean | Se notifica gestor também |
| `ativo` | boolean | Se a regra está ativa |

#### `integrity_alerts`
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | text (PK) | UUID |
| `tenant_id` | text (FK → tenants) | — |
| `lead_id` | text (FK → leads) | Lead relacionado |
| `tipo` | text | `unworked_sla`, `stagnation_sla` |
| `severidade` | text | `low`, `medium`, `high` |
| `detalhes` | jsonb | Informações do alerta |
| `status` | text | `pending`, `reviewed`, `dismissed` |
| `created_at` | timestamp | — |
| `resolved_at` | timestamp | Quando foi resolvido/dismissed |

### Fluxo do SLA "Não Trabalhado"

```
1. Cron job (Vercel Cron) chama GET /api/cron/sla-check a cada hora
2. Para cada tenant ativo, buscar:
   a. leads com status "distributed" ou "in_contact"
   b. WHERE assignedAt < (now - sla_config.prazo_horas)
   c. AND NOT EXISTS (interação com tipo = "status_change" saindo de "distributed")
   d. AND NOT EXISTS (integrity_alert ativo para este lead + tipo)
3. Para cada lead encontrado:
   a. Criar integrity_alert (status: pending, severidade: media)
   b. Criar notificação para o corretor responsável
   c. Se configurado, criar notificação para o gestor da filial
   d. Adicionar interação na timeline (tipo: "system_alert")
```

### Reset de SLA

Quando o corretor faz qualquer interação no lead, o SLA "Não Trabalhado" é resetado:
- Ao criar interação (nota, mudança de status, etc.) → `firstContactAt = now` (se era null)
- `integrity_alerts` com status `pending` para este lead são marcados como `reviewed`

### Testes

- [ ] Lead sem interação por X horas → alerta gerado
- [ ] Lead com interação recente → nenhum alerta
- [ ] Alerta duplicado não é gerado (idempotência)
- [ ] Configuração por tenant é respeitada
- [ ] Reset de SLA ao criar interação
- [ ] Notificação gerada para corretor + gestor (quando configurado)

---

## 3.8 — Motor de SLA — "Estagnado" 🟡 P1

### O que já existe
- Schema field: `stageEnteredAt` (atualizado a cada mudança de status via `change-lead-status.ts`)
- As mesmas tabelas do 3.7 (`integrity_alerts`, `sla_configs`) servem para estagnação

### O que precisa ser implementado

**Regra de negócio (BR-026):** Estagnação ocorre quando um lead **permanece na mesma etapa por muito tempo**, mesmo que haja interações (diferente do "não trabalhado" que conta ausência total de interação).

**Prazos sugeridos (itens pendentes de decisão do produto):**
| Etapa | Prazo de estagnação |
|---|---|
| `in_contact` | 48h |
| `quote_sent` | 72h (esperar retorno do cliente) |
| `negotiation` | 96h |
| `documentation_pending` | 72h |
| `under_analysis` | 48h |

**Etapas que NÃO disparam estagnação:** `new`, `distributed` (são cobertas pelo SLA "não trabalhado"), `converted`, `lost` (terminais).

### Fluxo

```
1. Mesmo cron job (/api/cron/sla-check) também executa verificação de estagnação
2. Para cada tenant ativo, buscar:
   a. leads em etapas não-terminais E em que stageEnteredAt < (now - prazo_da_etapa)
   b. AND NOT EXISTS (integrity_alert ativo para lead + tipo "stagnation")
3. Para cada lead encontrado:
   a. Criar integrity_alert (severidade baseada no tempo excedido: >2x prazo = alta)
   b. Criar notificação para o corretor
   c. Adicionar interação "system_alert" na timeline
```

### Testes

- [ ] Lead parado na mesma etapa além do prazo → alerta gerado
- [ ] Mudança de status reseta o contador (já é automático via `stageEnteredAt`)
- [ ] Etapas terminais não disparam estagnação
- [ ] Prazos diferentes por etapa são respeitados
- [ ] Alerta não é gerado novamente se já existe um pending

---

## 3.10 — Notificações In-App (Sino) + Push 🟡 P1

### O que já existe
- `src/features/notifications/` — pasta vazia (apenas `.gitkeep`)
- Schema não tem tabela `notifications` ainda
- `BrokerResumeDashboard` já tem botão `<Bell />` no header
- Ações já criam interações na timeline e logs de auditoria — mas não notificações

### O que precisa ser implementado

| Arquivo | Ação |
|---|---|
| `src/shared/db/schema.ts` | Adicionar tabela `notifications` |
| `src/features/notifications/queries.ts` | **Criar** — queries para buscar notificações do usuário |
| `src/features/notifications/actions.ts` | **Criar** — actions para marcar como lida, marcar todas lidas |
| `src/features/notifications/components/notification-bell.tsx` | **Criar** — sino com badge de não lidas |
| `src/features/notifications/components/notification-dropdown.tsx` | **Criar** — dropdown com lista de notificações |
| `src/features/notifications/notifications-service.ts` | **Criar** — serviço central para criar notificações (chamado por outros domínios) |
| `src/features/notifications/notifications.test.ts` | **Criar** — testes |
| `public/sw.js` | **Criar** — Service Worker para push notifications |
| `src/features/notifications/push-subscription.ts` | **Criar** — gerenciamento de subscriptions push |
| `src/app/api/notifications/subscribe/route.ts` | **Criar** — API Route para salvar subscription |
| `src/app/api/notifications/send-push/route.ts` | **Criar** — API Route para disparar push |

### Tabela `notifications`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | text (PK) | UUID |
| `user_id` | text (FK → user) | Destinatário |
| `tipo` | text | `lead_novo`, `sla_unworked`, `sla_stagnation`, `lead_perdido`, `meta_atingida`, etc. |
| `titulo` | text | Título curto da notificação |
| `mensagem` | text | Corpo da notificação |
| `link` | text, nullable | Deep link (ex: `/leads/{id}`) |
| `lida` | boolean | Default false |
| `created_at` | timestamp | — |

### Arquitetura de Notificações

```
┌─────────────────────────────────────────────────┐
│                  notifications-service.ts         │
│                                                   │
│  createNotification(userId, tipo, titulo, msg) {  │
│    1. Insert na tabela notifications              │
│    2. Se push habilitado → enfileirar push        │
│  }                                                │
│                                                   │
│  markAsRead(notificationId)                       │
│  markAllAsRead(userId)                            │
│  getUnreadCount(userId)                           │
└─────────────────────────────────────────────────┘
```

### Pontos de integração (onde criar notificações)

| Evento | Tipo | Destinatário | Quando |
|---|---|---|---|
| Lead distribuído | `lead_novo` | Corretor | `assignment.ts` |
| SLA não trabalhado | `sla_unworked` | Corretor + Gestor | `unworked-sla.ts` |
| SLA estagnado | `sla_stagnation` | Corretor + Gestor | `stagnation-sla.ts` |
| Lead perdido | `lead_perdido` | Gestor (se relevante) | `change-lead-status.ts` |
| Lead reaberto | `lead_reaberto` | Gestor | `change-lead-status.ts` |

### Componentes UI

#### NotificationBell
- Ícone de sino com badge de contagem (shadcn Badge)
- Polling a cada 30s para notificações não lidas (ou usar Server-Sent Events no futuro)
- Ao clicar, abre `NotificationDropdown`

#### NotificationDropdown
- Lista das 10 notificações mais recentes
- Cada item: ícone por tipo + título + "há X minutos"
- Não lidas têm fundo destacado
- Botão "Marcar todas como lidas"
- Link leva à página relevante

### Push Notifications (Implementação Básica)

1. Service Worker (`public/sw.js`) — intercepta push events
2. No navegador, solicitar permissão (`Notification.requestPermission()`)
3. Salvar subscription no servidor via `POST /api/notifications/subscribe`
4. Quando notificação é criada, se o usuário tem subscription ativa, disparar push
5. **Fallback:** se push não estiver disponível, notificações in-app funcionam sozinhas

### Testes

- [ ] Criar notificação → persiste no banco
- [ ] Marcar como lida → atualiza status
- [ ] Marcar todas como lidas → atualiza lote
- [ ] Contagem de não lidas correta
- [ ] Buscar últimas notificações (limite 10, ordenadas por data)
- [ ] Notificação criada ao distribuir lead (integração com assignment)
- [ ] Notificação criada ao detectar SLA (integração com motores)

---

## 📋 Ordem de Implementação Sugerida

A ordem proposta respeita as dependências entre os itens:

```
1. 3.5 — Distribuição Round-Robin
    ↓ (assignment.ts será refatorado)
2. 3.6 — Status Pausado/Disponível
    ↓ (independe do round-robin, mas pode ser testado junto)
3. 3.10 — Notificações (tabela + service + componentes)
    ↓ (outros itens precisam criar notificações)
4. 3.7 — Motor SLA "Não Trabalhado"
    ↓ (precisa de integrity_alerts e notifications)
5. 3.8 — Motor SLA "Estagnado"
    ↓ (mesma base do 3.7)
```

---

## ⚠️ Dependências e Riscos

| Item | Depende de | Risco |
|---|---|---|
| 3.5 | Migration `lead_distribution_log` | Baixo — schema simples |
| 3.6 | Nada | Baixo — UI-only |
| 3.7 | Migration `integrity_alerts`, `sla_configs` + 3.10 (notificações) | **Médio** — schema novo, lógica de negócio |
| 3.8 | 3.7 (mesmas tabelas) | Baixo — reusa infra do 3.7 |
| 3.10 | Migration `notifications` | **Médio** — push depende de Service Worker + permissão do navegador |

### Riscos específicos

1. **Vercel Cron Jobs** — necessário configurar no `vercel.json` ou dashboard. Sem cron, os motores de SLA não disparam automaticamente (podem ser chamados manualmente via API).
2. **Push Notifications (3.10)** — requer HTTPS (Vercel tem), Service Worker e permissão do usuário. A implementação básica cobre o in-app primeiro; push é complementar.
3. **Permissões de SLA** — decidir se Gestor pode configurar prazos de SLA no painel ou se são fixos (hardcoded no código). Sugestão inicial: hardcoded com valores sensíveis, configurável em versão futura.

---

## 📐 Validações Finais (antes de marcar como 100%)

- [ ] **npm run lint** — 0 errors, 0 warnings
- [ ] **npx tsc --noEmit** — sem erros de tipo
- [ ] **npm test** — todos os (novos + existentes) testes passando
- [ ] **npm run build** — compilação bem-sucedida
- [ ] Migrations geradas e aplicadas ao Neon staging
- [ ] Testes E2E (se aplicável) — pelo menos fluxo de lead completo
- [ ] Roadmap (`CorreTop_Plano_Desenvolvimento_7_Dias.md`) atualizado
- [ ] `docs/business-rules.md` atualizado com novas regras
- [ ] `docs/decision-log.md` com decisões de implementação

---

*Plano gerado em 12/07/2026. Total estimado: ~27 horas de implementação.*
