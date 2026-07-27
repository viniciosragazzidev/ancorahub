# Plano: Expansão do Sistema de Feedback do Corretor

**Data:** 2026-07-16
**Objetivo:** Adicionar mais formas do corretor registrar feedback sobre o atendimento, incluindo checklists estruturados, notificações toast+push com exigência de retorno em prazo configurável.

---

## 1. Diagnóstico do sistema atual

### 1.1 O que já existe

| Componente | Descrição | Observações |
|---|---|---|
| `leadFeedbacks` | Tabela com `type`, `content`, `nextAction`, `nextActionAt` | Apenas texto livre + tipo enumerado |
| `leadAssignmentAttempts` | Ciclo de atribuição com `status: open → submitted/overdue` | Já controla SLA de feedback |
| `submitLeadFeedbackAction` | Server Action que registra feedback + atualiza attempt | Tipos fixos (contacted, no_answer, etc.) |
| `LeadFeedbackForm` | Formulário no detalhe do lead | Select de tipo + inputs livres |
| `runFeedbackSlaSweep` | Job agendado que verifica attempts vencidos | Redistribui lead quando overdue |
| `createLeadFeedbackReminders` | Job que cria notificações de lembrete para leads ativos | 1x/dia, deduplicado por 24h |
| `feedbackGraceMinutes` (tenant) | Minutos extras após SLA para feedback | Configurável, default 5min |
| `slaFirstContactMinutes` (tenant) | SLA do primeiro contato | Configurável, default 15min |
| `feedbackRequiredEnabled` (tenant) | Liga/desliga feedback obrigatório | Boolean |
| `autoRedistributeOnFeedbackTimeout` (tenant) | Redistribui automaticamente no timeout | Boolean |

### 1.2 Lacunas identificadas

1. **Sem checklist estruturado** — o feedback atual é um tipo + texto livre. Não há perguntas orientadas sobre a qualidade do atendimento.
2. **Lembrete passivo** — o reminder é uma notificação in-app que o corretor pode ignorar. Não há "exigência" (não-blockante) com toast recorrente.
3. **Sem notificação push para lembrete de feedback** — o catalog mostra `lead_feedback_reminder` como apenas "Toast/in-app", sem push.
4. **Configuração limitada** — o tempo do lembrete é fixo (24h), sem intervalo configurável entre lembretes.
5. **Sem gatilho proativo** — não há popup/toast no dashboard/minha-fila quando o feedback está próximo do vencimento.

---

## 2. Propostas de implementação

### 2.1 Checklists estruturados de atendimento

#### Objetivo
Substituir o campo `type` livre (enum) por um **checklist dinâmico** com perguntas e respostas orientadas, permitindo que o gestor/diretor configure os checklists por unidade ou globalmente.

#### Migração de schema

**Nova tabela: `feedback_checklist_templates`**
```sql
CREATE TABLE feedback_checklist_templates (
  id          UUID PRIMARY KEY,
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  name        TEXT NOT NULL,              -- "Checklist de 1º contato"
  description TEXT,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_feedback_templates_tenant ON feedback_checklist_templates(tenant_id);
```

**Nova tabela: `feedback_checklist_items`**
```sql
CREATE TABLE feedback_checklist_items (
  id          UUID PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES feedback_checklist_templates(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  question    TEXT NOT NULL,              -- "Conseguiu falar com o cliente?"
  answer_type TEXT NOT NULL DEFAULT 'boolean',  -- 'boolean' | 'rating' | 'text' | 'select'
  options     JSONB,                     -- Para answer_type = 'select'
  required    BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_feedback_items_template ON feedback_checklist_items(template_id, sort_order);
```

**Extensão da tabela `lead_feedbacks`:**
```sql
ALTER TABLE lead_feedbacks ADD COLUMN checklist_id UUID REFERENCES feedback_checklist_templates(id);
ALTER TABLE lead_feedbacks ADD COLUMN answers JSONB;  -- {"checklist_item_id": "answer_value"}
```

#### Templates sugeridos

| Template | Perguntas |
|---|---|
| **1º Contato** | Conseguiu falar com o cliente? · Cliente demonstrou interesse? · Enviou proposta? · Agendou retorno? |
| **Acompanhamento** | Cliente está analisando proposta? · Precisa de documentação adicional? · Há objeções identificadas? |
| **Fechamento** | Cliente aceitou a proposta? · Documentos enviados para a operadora? · Data prevista de vigência? |
| **Perda** | Motivo principal da perda? · Cliente escolheu outra operadora? · Preço? · Cobertura? |
| **Pós-venda** | Cliente satisfeito com a ativação? · Carteirinha já foi emitida? · Há dúvidas pendentes? |

#### Fluxo de uso

1. Diretor/Gestor cria templates em `/settings/feedback-templates` (server action)
2. Ao registrar feedback, o sistema carrega o template adequado para o status do lead
3. Corretor responde às perguntas do checklist (boolean, rating 1-5, texto, select)
4. Respostas são salvas em `lead_feedbacks.answers` (JSONB)
5. Timeline do lead exibe as respostas formatadas

#### UI

- **Página de configuração**: `/settings/feedback-templates` (Diretor/Gestor)
  - Lista de templates com toggle ativo/inativo
  - Drag-and-drop para reordenar perguntas
  - Modal de edição com tipos de resposta
- **Formulário de feedback**: Substituir o select simples por um checklist interativo
  - Perguntas obrigatórias destacadas
  - Progresso visual (3/5 respondidas)
  - Respostas em estrelas (rating), toggle (boolean), ou select

---

### 2.2 Toast + Push com feedback obrigatório

#### Objetivo
Criar um sistema de **lembretes progressivos** que notifica o corretor via toast in-app e push通知 com frequência configurável, até que o feedback seja registrado ou o SLA expire.

#### Configuração no tenant

Novas colunas na tabela `tenants`:
```sql
ALTER TABLE tenants ADD COLUMN feedback_reminder_interval_minutes TEXT NOT NULL DEFAULT '30';
ALTER TABLE tenants ADD COLUMN feedback_reminder_max_attempts INTEGER NOT NULL DEFAULT 5;
ALTER TABLE tenants ADD COLUMN feedback_push_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE tenants ADD COLUMN feedback_toast_enabled BOOLEAN NOT NULL DEFAULT true;
```

#### Novos jobs agendados

**`createLeadFeedbackReminders` (refatorado)** — Agora roda a cada N minutos (configurável) em vez de 1x/dia:
```typescript
export async function createLeadFeedbackReminders() {
  // 1. Busca leads com assignment_attempts em status "open"
  // 2. Calcula deadlines: assignedAt + feedbackGraceMinutes
  // 3. Se estiver dentro da janela de alerta (próximo do vencimento):
  //    a. Cria notificação in-app (tipo: lead_feedback_reminder)
  //    b. Dispara push notification se habilitado
  //    c. Incrementa contador de lembretes enviados
  // 4. Se excedeu max_attempts sem feedback → escalate para gestor
}
```

#### Notificação catalog

Atualizar `notificationCapabilities`:
```typescript
{ id: "lead_feedback_reminder", label: "Lembrete de feedback", description: "Lembrete recorrente para registrar o andamento do atendimento.", channels: "Toast + push" },
```

#### Fluxo de lembretes

```
[Lead atribuído] → feedbackDueAt = assignedAt + SLA + grace
         │
         ▼
   [Janela de alerta] → feedbackDueAt - 10min
         │
         ├─ Toast in-app: "Registre o feedback sobre João Silva (2/5 tentativas)"
         ├─ Push notification (se habilitado)
         └─ Contador +1
         │
         ▼
   [Intervalo configurável] (ex: 30min)
         │
         ├─ Novo toast + push
         └─ Se >= max_attempts → escalate para Gestor
         │
         ▼
   [feedbackDueAt] → SLA enforcement (já implementado)
```

#### Toast na UI do corretor

O toast deve ser **persistente** (não desaparece automaticamente) e conter:
- Nome do lead
- Tempo restante ("Vence em 5 min")
- Botão "Registrar agora" → abre o lead direto no feedback form
- Botão "Lembrar depois" → silencia por 5 min (configurável)

---

### 2.3 Dashboard de feedbacks pendentes

#### Novo widget na "Minha fila"

Adicionar um card "Feedbacks pendentes" na página `/minha-fila` com:
- Lista de leads que precisam de feedback
- Indicador de urgência (cor: verde > amarelo > vermelho)
- Tempo restante para o SLA
- Atalho "Registrar feedback" → modal inline sem sair da página

#### Badge no sidebar

Adicionar um badge no item "Minha fila" do sidebar do corretor:
- Mostra quantidade de feedbacks pendentes
- Atualizado via Realtime (WebSocket) ou polling

---

### 2.4 Configuração pelo Diretor/Gestor

Nova página ou seção em `/settings`:

| Configuração | Descrição | Default |
|---|---|---|
| Feedback obrigatório | Liga/desliga | Ativado |
| SLA primeiro contato | Minutos para registrar 1º feedback | 15 min |
| Graça (minutos extras) | Tempo extra após o SLA | 5 min |
| Intervalo entre lembretes | Minutos entre toast/push | 30 min |
| Máximo de tentativas | Nº de lembretes antes de escalar | 5 |
| Push habilitado | Enviar push notification | Sim |
| Toast habilitado | Mostrar toast in-app | Sim |
| Checklist obrigatório | Exige respostas do checklist | Sim |

---

## 3. Tabela de tarefas

| # | Tarefa | Esforço | Depende |
|---|---|---|---|
| F1 | Criar migration: `feedback_checklist_templates`, `feedback_checklist_items` | M | — |
| F2 | Estender `lead_feedbacks` com `checklist_id`, `answers` | P | F1 |
| F3 | Adicionar colunas ao `tenants`: `feedback_reminder_interval_minutes`, `feedback_reminder_max_attempts`, `feedback_push_enabled`, `feedback_toast_enabled` | P | — |
| F4 | Criar server actions para CRUD de templates (list, create, update, delete, toggle) | M | F1 |
| F5 | Criar página `/settings/feedback-templates` com lista + modal de edição | G | F4 |
| F6 | Refatorar `submitLeadFeedbackAction` para aceitar `answers` (JSONB) e `checklistId` | M | F2 |
| F7 | Refatorar `LeadFeedbackForm` para renderizar checklist interativo | G | F6 |
| F8 | Refatorar `createLeadFeedbackReminders` para roda a cada N min com contador de tentativas | M | F3 |
| F9 | Criar notificação catalog `lead_feedback_push` (se separar de reminder) | P | F8 |
| F10 | Adicionar toast persistente com botões "Registrar agora" / "Lembrar depois" | M | F8 |
| F11 | Adicionar widget "Feedbacks pendentes" na página `/minha-fila` | M | F6 |
| F12 | Adicionar badge de feedbacks pendentes no sidebar do corretor (Realtime) | M | F11 |
| F13 | Criar seção de configuração de feedback no `/settings` do Diretor/Gestor | M | F3 |
| F14 | Atualizar `notificationCapabilities` com canais + push | P | — |
| F15 | Registrar decisão (DEC-030) no `decision-log.md` e regras (BR-040+) no `business-rules.md` | P | — |

**Legenda:** P = pequeno, M = médio, G = grande

---

## 4. Prioridade sugerida

### Fase 1 — Fundação (1 dia)
1. F3 — Configurações do tenant (reminder interval, max attempts, push/toast flags)
2. F14 — Atualizar catalog de notificações
3. F8 — Refatorar `createLeadFeedbackReminders` para rodar a cada N min

### Fase 2 — Lembretes progressivos (1 dia)
4. F10 — Toast persistente com ações
5. F12 — Badge de feedbacks pendentes no sidebar
6. F11 — Widget na "Minha fila"

### Fase 3 — Checklists (1.5 dias)
7. F1 + F2 — Migration das tabelas de checklist
8. F4 — CRUD de templates
9. F5 — Página de configuração de templates
10. F6 + F7 — Refatorar feedback form com checklist interativo

### Fase 4 — Polimento (0.5 dia)
11. F13 — Configuração no settings do Diretor/Gestor
12. F15 — Documentação (decision-log + business-rules)

**Total estimado:** ~4 dias

---

## 5. Regras de negócio propostas

| ID | Regra | Gatilho → resultado |
|---|---|---|
| BR-040 | Checklist de feedback é definido por template com perguntas configuráveis por tenant. | Criação/edição → template salvo com perguntas e tipos de resposta. |
| BR-041 | Resposta de checklist é obrigatória quando tenant exige feedback. | Submissão sem respostas → recusada com lista de perguntas pendentes. |
| BR-042 | Lembrete de feedback é reenviado em intervalo configurável até o limite de tentativas. | Intervalo atingido sem feedback → novo toast + push; limite excedido → escalate para gestor. |
| BR-043 | Escalation de feedback leva ao Gestor da unidade e, na ausência, ao Diretor. | Limite excedido → notificação para supervisor imediato com detalhes do lead. |
| BR-044 | Toast de lembrete de feedback é persistente até interação do usuário. | Toast exibido → só desaparece ao clicar "Registrar agora" ou "Lembrar depois". |
| BR-045 | Push de lembrete de feedback respeita a capacidade global de notificações (DEC-028). | Capacidade ativa → push enviado; desativada → apenas toast. |

---

## 6. Arquivos que serão modificados

### Schema / Migrations
- `src/shared/db/schema.ts` — novas tabelas + colunas
- `drizzle/0043_feedback_checklists.sql`

### Server logic
- `src/features/leads/feedback-actions.ts` — refatorar para checklist
- `src/features/leads/feedback-reminders.ts` — refatorar para intervalos
- `src/features/leads/feedback-sla.ts` — manter, já funcional
- `src/features/notifications/catalog.ts` — adicionar canais

### UI Components
- `src/app/(dashboard)/leads/[id]/lead-feedback-form.tsx` — checklist interativo
- `src/app/(dashboard)/minha-fila/page.tsx` — widget de feedbacks pendentes
- `src/components/corretor-sidebar.tsx` — badge de pendências
- `src/app/(dashboard)/settings/feedback-templates/page.tsx` — novo
- `src/app/(dashboard)/settings/feedback-config/page.tsx` — novo (ou seção)

### Docs
- `docs/decision-log.md` — DEC-030
- `docs/business-rules.md` — BR-040 a BR-045

---

## 7. Perguntas em aberto para o usuário

1. **Checklists devem ser globais (por tenant) ou podem variar por unidade/filial?**
2. **O toast persistente deve travar a tela (modal) ou apenas ficar flutuando até ação?**
3. **O "Lembrar depois" do toast deve ter um tempo customizável ou fixo (5 min)?**
4. **O escalation para o Gestor deve ser notificação in-app apenas ou também push?**
5. **Os templates de checklist devem vir com defaults ou o Diretor precisa criar do zero?**

---

*Documento gerado em 2026-07-16 como plano de implementação.*
