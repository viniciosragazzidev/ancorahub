# Dia 6 — Plano de Implementação: Comissão, Pós-venda, Metas e WhatsApp

**Data:** 14/07/2026
**Objetivo:** Concluir o motor financeiro, metas comerciais, reengajamento de leads perdidos e preparar a integração WhatsApp.
**Regra crítica:** Toda configuração (regras de comissão, metas, etc.) deve ser **totalmente editável e gerenciável** pelo Diretor e, quando aplicável, pelo Gestor e Corretor — nada hardcoded, tudo persistido e com UI dedicada.

---

## Resumo de Status Atual

| # | Item | Prioridade | Status | Observação |
|---|---|---|---|---|
| 6.1 | Regras de comissão (única ou escalonada, configurável) | 🔴 P0 | ❌ | A implementar — CRUD completo |
| 6.2 | Geração automática do cronograma de repasse | 🔴 P0 | ❌ | A implementar — integrado à venda |
| 6.3 | Marcação manual de comissão paga | 🟡 P1 | ❌ | A implementar — toggle no cronograma |
| 6.4 | Exportação de relatório de comissão (Excel/CSV) | 🔴 P0 | ❌ | A implementar — exportação server-side |
| 6.5 | Criação de "Cliente Ativo" ao converter venda | 🟡 P1 | ✅ **Concluído** | Tabela `clients`, migração 0017 |
| 6.6 | Alerta de renovação/aniversário de contrato | 🟢 P2 | ✅ **Concluído** | `renewal-reminders.ts`, job diário |
| 6.7 | Reengajamento automático de leads perdidos | 🟢 P2 | ❌ | A implementar — job + notificação |
| 6.8 | Módulo de metas comerciais | 🟡 P1 | ❌ | A implementar — CRUD + progresso |
| 6.9 | WhatsApp — integração real via Meta Cloud API | 🟡/🔶 | ❌ | Depende de verificação Meta |
| 6.10 | WhatsApp — fallback (botão WhatsApp Web) | 🔶 | ✅ **Concluído** | Abertura via wa.me link |

---

## Pré-requisitos Compartilhados

### 1. Schema do Banco — Migrações Necessárias

Criar migration `0027` em `drizzle/` com as seguintes tabelas:

#### `commission_rules` (regras de comissão)
```sql
CREATE TABLE commission_rules (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  carrier_id text REFERENCES carriers(id) ON DELETE CASCADE,
  plan_id text REFERENCES carrier_plans(id) ON DELETE CASCADE,
  name text NOT NULL, -- nome amigável para exibição
  type text NOT NULL DEFAULT 'escalonada' CHECK (type IN ('unica', 'escalonada')),
  -- Percentuais em JSON: ex. [100, 25, 5] para meses 1, 2, 3+.
  -- Para 'unica', array de 1 elemento.
  percentages jsonb NOT NULL DEFAULT '[100]',
  -- Se a regra se aplica a todas as operadoras/planos ou a específicos
  applies_to_all boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_by text NOT NULL REFERENCES users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX commission_rules_tenant_idx ON commission_rules(tenant_id);
CREATE INDEX commission_rules_carrier_idx ON commission_rules(carrier_id);
CREATE INDEX commission_rules_plan_idx ON commission_rules(plan_id);
```

#### `sales` (vendas)
```sql
CREATE TABLE sales (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id text NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  client_id text REFERENCES clients(id) ON DELETE SET NULL,
  broker_id text NOT NULL REFERENCES users(id),
  carrier_plan_id text REFERENCES carrier_plans(id),
  commission_rule_id text REFERENCES commission_rules(id),
  sale_date date NOT NULL,
  sale_value numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  notes text,
  created_by text NOT NULL REFERENCES users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX sales_tenant_idx ON sales(tenant_id);
CREATE INDEX sales_lead_idx ON sales(lead_id);
CREATE INDEX sales_broker_idx ON sales(broker_id);
```

#### `commission_schedule` (cronograma de repasse)
```sql
CREATE TABLE commission_schedule (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sale_id text NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  month_number integer NOT NULL CHECK (month_number > 0), -- mês 1, 2, 3...
  reference_month text NOT NULL, -- formato '2026-08' para agrupamento
  due_date date, -- data prevista de pagamento
  percentage numeric(5,2) NOT NULL, -- percentual aplicado nesta parcela
  amount numeric(12,2) NOT NULL, -- valor calculado
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  paid_at timestamp with time zone,
  paid_by text REFERENCES users(id),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX commission_schedule_tenant_idx ON commission_schedule(tenant_id);
CREATE INDEX commission_schedule_sale_idx ON commission_schedule(sale_id);
CREATE INDEX commission_schedule_ref_month_idx ON commission_schedule(reference_month);
CREATE INDEX commission_schedule_status_idx ON commission_schedule(status);
CREATE INDEX commission_schedule_broker_idx ON commission_schedule(broker_id); -- se adicionarmos broker_id para facilitar consultas
```

#### `goals` (metas comerciais)
```sql
CREATE TABLE goals (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('broker', 'team', 'branch', 'tenant')),
  scope_id text, -- ID do corretor, equipe (futuro) ou filial, conforme scope
  name text NOT NULL,
  target_type text NOT NULL DEFAULT 'sales_count' CHECK (target_type IN ('sales_count', 'revenue', 'conversion_rate', 'leads_contacted')),
  target_value numeric(12,2) NOT NULL, -- valor da meta
  period text NOT NULL, -- '2026-08' (mês/ano) ou '2026' (anual)
  start_date date NOT NULL,
  end_date date NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_by text NOT NULL REFERENCES users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX goals_tenant_scope_idx ON goals(tenant_id, scope);
CREATE INDEX goals_period_idx ON goals(tenant_id, period);
```

#### `goal_progress` (cache de progresso das metas — atualizado na conversão)
```sql
CREATE TABLE goal_progress (
  id text PRIMARY KEY,
  goal_id text NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  current_value numeric(12,2) NOT NULL DEFAULT 0,
  percentage numeric(5,2) NOT NULL DEFAULT 0, -- progresso percentual
  calculated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX goal_progress_goal_unique ON goal_progress(goal_id);
```

### 2. Permissões — Atualizar `src/shared/auth/permissions.ts`

Adicionar ao objeto `PERMISSIONS`:
```typescript
gerenciar_comissoes: ["director"],
ver_comissao_propria: ["broker", "manager", "director"],
ver_comissao_equipe: ["manager", "director"],
gerenciar_metas: ["director", "manager"],
ver_meta_propria: ["broker"],
ver_meta_equipe: ["manager", "director"],
exportar_relatorios: ["manager", "director"],
```

### 3. Constantes de Enum — Adicionar ao Schema

Garantir que os novos `pgEnum` sejam registrados em `src/shared/db/schema.ts`:
- `commissionRuleType` — `unica`, `escalonada`
- `commissionScheduleStatus` — `pending`, `paid`, `cancelled`
- `goalScope` — `broker`, `team`, `branch`, `tenant`
- `goalTargetType` — `sales_count`, `revenue`, `conversion_rate`, `leads_contacted`
- `saleStatus` — `active`, `cancelled`

---

## Itens a Implementar

---

### Item 6.1 — Regras de Comissão (🔴 P0 | Complexidade: Alta)

**Descrição:** Diretor cria, edita, ativa/desativa regras de comissão por operadora/plano.
Regras podem ser:
- **Única:** 1 parcela com X% (ex: 50% no mês 1)
- **Escalonada:** Múltiplas parcelas com percentuais decrescentes (ex: 100%, 25%, 5% nos meses 1, 2, 3+)

#### Arquivos a criar

| Arquivo | Propósito |
|---|---|
| `src/features/commissions/schema.ts` | Schema Zod para validação |
| `src/features/commissions/actions.ts` | Server Actions: CRUD de regras |
| `src/features/commissions/queries.ts` | Queries Drizzle |
| `src/features/commissions/commission-rules-service.ts` | Lógica de negócio (cálculo, validação) |
| `src/features/commissions/components/commission-rules-manager.tsx` | Tela de gerenciamento (cliente) |
| `src/features/commissions/components/commission-rule-form.tsx` | Formulário de criação/edição |
| `src/features/commissions/components/commission-rule-card.tsx` | Card de exibição de regra |
| `src/features/commissions/components/empty-state.tsx` | Estado vazio com CTA |
| `src/features/commissions/components/commission-rules-list.tsx` | Lista de regras com filtros |
| `src/features/commissions/tests/commission-rules.test.ts` | Testes unitários |
| `src/app/(dashboard)/configuracoes/comissoes/page.tsx` | Rota da página de configuração |
| `src/components/corretop-sidebar.tsx` | Atualizar sidebar com link |

#### Fluxo de Implementação

1. **Schema (Drizzle + Zod)**
   - Criar tabela `commission_rules` na migration 0027
   - Criar schema Zod em `src/features/commissions/schema.ts`:
     ```typescript
     export const commissionRuleSchema = z.object({
       name: z.string().min(1, "Nome é obrigatório").max(100),
       carrierId: z.string().optional(),
       planId: z.string().optional(),
       type: z.enum(["unica", "escalonada"]),
       percentages: z.array(z.number().min(0).max(1000)).min(1).max(60),
       appliesToAll: z.boolean().default(false),
       active: z.boolean().default(true),
     });
     ```
   - Validação: se `appliesToAll` for false, `carrierId` ou `planId` é obrigatório

2. **Service Layer (`commission-rules-service.ts`)**
   - `validatePercentages(type, percentages)` — valida:
     - Se `unica`: array deve ter 1 elemento
     - Se `escalonada`: array deve ter 1-60 elementos, em ordem decrescente
     - Primeiro percentual deve ser o maior
   - `getCommissionRule(tenantId, carrierPlanId)` — busca a regra aplicável para um plano
     - Prioridade: regra específica do plano > regra da operadora > regra "apply to all" > regra padrão (100% única)
   - `calculateSchedule(saleValue, rule)` — gera as parcelas do cronograma

3. **Server Actions (`actions.ts`)**
   ```typescript
   export async function createCommissionRuleAction(prev: any, form: FormData)
   export async function updateCommissionRuleAction(prev: any, form: FormData)
   export async function toggleCommissionRuleAction(ruleId: string)
   export async function deleteCommissionRuleAction(ruleId: string)
   ```
   - Todas validam: `context.role === "director"`
   - Usam `revalidatePath` para `/configuracoes/comissoes`

4. **Queries (`queries.ts`)**
   ```typescript
   export async function getCommissionRules(tenantId: string): Promise<CommissionRule[]>
   export async function getCommissionRuleById(ruleId: string): Promise<CommissionRule | null>
   export async function getActiveRules(tenantId: string): Promise<CommissionRule[]>
   ```

5. **UI Components**
   - `CommissionRulesManager`: Página principal
     - Grid de cards de regras
     - Botão "Nova regra" → abre modal/formulário
     - Filtro por operadora/plano
     - Toggle ativar/desativar
   - `CommissionRuleForm`: Modal com:
     - Nome da regra
     - Seletor de operadora (opcional) + plano (opcional) — ou "Aplicar a todos"
     - Radio: Comissão única ou escalonada
     - Lista dinâmica de meses/percentuais com botão "+" para adicionar
     - Preview visual: "Mês 1: 100% · Mês 2: 25% · Mês 3: 5%"
   - `CommissionRuleCard`: Card com:
     - Nome, operadora/plano alvo
     - Timeline visual dos percentuais
     - Badge: "Ativa" / "Inativa"
     - Menu de ações: Editar, Desativar/Ativar, Excluir
   - `EmptyState`: Ilustração + texto "Nenhuma regra de comissão definida. Crie a primeira para começar a calcular repasses."

6. **Navegação**
   - Adicionar em `corretop-sidebar.tsx` no grupo "Sistema" ou criar sub-rota em Configurações
   - Rota: `/configuracoes/comissoes`
   - Visível apenas para `director` (via `gerenciar_comissoes`)

#### Testes
- Criação de regra única: 1 parcela com 50%
- Criação de regra escalonada: 3 parcelas [100, 25, 5]
- Validação: array vazio → erro
- Validação: `unica` com 2 parcelas → erro
- Validação: percentual > 1000 → erro
- Aplicação: lead de plano X recebe regra específica do plano
- Fallback: plano sem regra → usa regra da operadora
- Fallback: operadora sem regra → usa "apply to all"

---

### Item 6.2 — Geração Automática do Cronograma de Repasse (🔴 P0 | Complexidade: Alta)

**Descrição:** Ao converter um lead em venda (status `converted`), o sistema deve:
1. Buscar a regra de comissão aplicável
2. Calcular o valor de cada parcela
3. Gerar os registros em `commission_schedule`
4. Atualizar o progresso das metas

#### Fluxo de Implementação

1. **Serviço Central (`commission-rules-service.ts`)**
   - `generateSchedule(saleId, saleValue, ruleId, tenantId, brokerId)`:
     ```typescript
     async function generateSchedule(params: {
       saleId: string;
       saleValue: number;
       ruleId: string;
       tenantId: string;
     }): Promise<void> {
       const rule = await getCommissionRuleById(ruleId);
       if (!rule) throw new Error("Regra de comissão não encontrada");
       
       const schedule = rule.percentages.map((percentage, index) => ({
         id: randomUUID(),
         tenantId,
         saleId,
         monthNumber: index + 1,
         referenceMonth: formatMonth(addMonths(new Date(), index)),
         percentage: Number(percentage),
         amount: Number((saleValue * percentage / 100).toFixed(2)),
         status: "pending" as const,
       }));
       
       await db.insert(schema.commissionSchedule).values(schedule);
     }
     ```

2. **Integração com Conversão de Lead**
   - Em `src/features/leads/change-lead-status.ts`, no estado `converted`:
     ```typescript
     if (newStatus === "converted") {
       // 1. Buscar regra de comissão aplicável
       const rule = await getApplicableCommissionRule(tenantId, lead.planId);
       
       // 2. Criar registro em sales
       const saleId = randomUUID();
       await tx.insert(schema.sales).values({
         id: saleId,
         tenantId,
         leadId: lead.id,
         clientId, // ID do cliente criado na conversão
         brokerId: lead.corretorId,
         carrierPlanId: lead.planId,
         commissionRuleId: rule?.id ?? null,
         saleDate: new Date(),
         saleValue: saleValue || 0, // Vindo da cotação aceita
         createdBy: context.userId,
       });
       
       // 3. Gerar cronograma se houver regra
       if (rule) {
         await generateSchedule({
           saleId,
           saleValue: saleValue || 0,
           ruleId: rule.id,
           tenantId,
         });
       }
     }
     ```

3. **Página de Vendas (listagem + detalhe)**
   - `src/app/(dashboard)/vendas/page.tsx` — listagem de vendas
   - Tabela com: lead, corretor, plano, valor, data, status
   - Link para detalhe: `/vendas/[id]`
   - `src/app/(dashboard)/vendas/[id]/page.tsx` — detalhe com cronograma

#### UI do Cronograma
- Tabela com colunas: Mês, Mês Referência, % Aplicado, Valor, Status, Data de Pagamento
- Badge de status: "A Pagar" (pending), "Pago" (paid), "Cancelado" (cancelled)
- Corretor vê apenas suas vendas
- Gestor vê da filial
- Diretor vê tudo

---

### Item 6.3 — Marcação Manual de Comissão Paga (🟡 P1 | Complexidade: Média)

**Descrição:** Diretor/Gestor pode marcar parcelas do cronograma como "paga" manualmente.

#### Implementação

1. **Server Action**
   ```typescript
   export async function markCommissionPaidAction(scheduleId: string, notes?: string)
   export async function markCommissionUnpaidAction(scheduleId: string)
   ```
   - Permissão: `gerenciar_comissoes` (director) ou `ver_comissao_equipe` (manager na filial)
   - Atualiza `status`, `paidAt`, `paidBy` no `commission_schedule`
   - Revalida path da página

2. **UI**
   - Botão "Pagar" na linha do cronograma (apenas para status "pending")
   - Modal de confirmação com campo de observação opcional
   - Toast de sucesso
   - Se já pago, mostrar "Pago por [nome] em [data]" e botão "Reverter"

3. **Auditoria**
   - Registrar em `auditLogs` a marcação de pagamento (entidade: `commission_schedule`, ação: `pagou`)

---

### Item 6.4 — Exportação de Relatório de Comissão (🔴 P0 | Complexidade: Alta)

**Descrição:** Exportar relatório de comissões em Excel (.xlsx) e CSV, filtrável por período, filial, corretor.

#### Implementação

1. **Dependência**
   ```bash
   npm install exceljs
   ```

2. **Serviço de Exportação**
   ```typescript
   // src/features/commissions/export-service.ts
   
   export async function exportCommissionReport(params: {
     tenantId: string;
     startDate: string; // '2026-01'
     endDate: string;   // '2026-12'
     branchId?: string;
     brokerId?: string;
     format: 'xlsx' | 'csv';
   }): Promise<{ filename: string; buffer: Buffer }>
   ```
   - Consulta `commission_schedule` + `sales` + `users` + `branches`
   - Gera planilha com abas: "Resumo", "Detalhado por Corretor", "Detalhado por Filial"
   - Colunas: Corretor, Filial, Lead, Plano, Data Venda, Mês, % , Valor, Status, Data Pagamento

3. **API Route**
   ```typescript
   // src/app/api/internal/export/commissions/route.ts
   ```
   - GET autenticado com query params
   - Retorna arquivo com Content-Disposition: attachment
   - Registra em `dataExportLogs`

4. **UI**
   - Modal de exportação com:
     - Período (mês inicial / mês final — dropdowns)
     - Filtro opcional de filial
     - Filtro opcional de corretor
     - Formato: Excel ou CSV
     - Botão "Exportar"
   - Indicador de progresso/loading
   - Link nos dashboards (Diretor: botão "Exportar relatório")

#### Permissões
- `exportar_relatorios`: Manager (apenas filial), Director (todo tenant)
- `ver_comissao_equipe`: Manager (apenas filial)
- `ver_comissao_propria`: Broker (apenas própria)

---

### Item 6.7 — Reengajamento Automático de Leads Perdidos (🟢 P2 | Complexidade: Média)

**Descrição:** Job diário que identifica leads perdidos há mais de X dias configuráveis e cria notificações para que o corretor tente reengajar.

#### Implementação

1. **Serviço**
   ```typescript
   // src/features/leads/reengagement.ts
   
   export const DEFAULT_REENGAGEMENT_DAYS = 30;
   
   export async function createLeadReengagementReminders(now = new Date()) {
     const db = getDatabase();
     
     // Leads perdidos há mais de N dias, que não foram reengajados ainda
     const cutoff = new Date(now.getTime() - DEFAULT_REENGAGEMENT_DAYS * 24 * 60 * 60 * 1000);
     
     const lostLeads = await db
       .select({ id: schema.leads.id, tenantId: schema.leads.tenantId, nome: schema.leads.nome, corretorId: schema.leads.corretorId, branchId: schema.leads.branchId })
       .from(schema.leads)
       .where(and(
         eq(schema.leads.status, "lost"),
         lte(schema.leads.createdAt, cutoff),
       ));
     
     // Deduplicação: já notificados nos últimos 30 dias
     const existing = await db...
     
     // Criar notificações para o corretor responsável e gestor da filial
     for (const lead of lostLeads) {
       if (lead.corretorId) {
         pending.push({
           tenantId: lead.tenantId,
           recipientUserId: lead.corretorId,
           leadId: lead.id,
           type: "lead_reengagement",
           title: "Lead perdido pode ser reengajado",
           message: `${lead.nome} está em perdido há mais de ${DEFAULT_REENGAGEMENT_DAYS} dias. Considere tentar um novo contato.`,
         });
       }
     }
   }
   ```

2. **API Route**
   - Adicionar ao endpoint existente: `src/app/api/internal/reminders/route.ts`

3. **Configuração por Tenant**
   - Adicionar campo `reengagement_days` em `tenants` (valor default: 30)
   - UI de configuração em `/settings?tab=operacional` para Diretor alterar

4. **UI no Lead**
   - Na tela de detalhe do lead perdido, se estiver dentro da janela de reengajamento:
     - Badge "Pode reengajar"
     - Botão "Tentar reengajar" que abre modal com opção de reabrir lead

---

### Item 6.8 — Módulo de Metas Comerciais (🟡 P1 | Complexidade: Alta)

**Descrição:** Diretor/Gestor define metas por corretor, equipe ou filial. O progresso é calculado automaticamente com base nas vendas convertidas.

#### Arquivos a criar

| Arquivo | Propósito |
|---|---|
| `src/features/goals/schema.ts` | Schema Zod |
| `src/features/goals/actions.ts` | Server Actions CRUD |
| `src/features/goals/queries.ts` | Queries Drizzle |
| `src/features/goals/goal-service.ts` | Lógica de cálculo de progresso |
| `src/features/goals/components/goals-manager.tsx` | Tela principal de gerenciamento |
| `src/features/goals/components/goal-form.tsx` | Formulário de criação/edição |
| `src/features/goals/components/goal-card.tsx` | Card de meta com barra de progresso |
| `src/features/goals/components/goal-list.tsx` | Lista de metas com filtros |
| `src/features/goals/components/broker-goal-view.tsx` | Vista do corretor (minha meta) |
| `src/features/goals/tests/goals.test.ts` | Testes unitários |
| `src/app/(dashboard)/metas/page.tsx` | **Substituir** o placeholder atual |

#### Fluxo de Implementação

1. **Schema**
   - Migration 0027: tabelas `goals` e `goal_progress`
   - Schema Zod:
     ```typescript
     export const goalSchema = z.object({
       name: z.string().min(1).max(200),
       scope: z.enum(["broker", "team", "branch", "tenant"]),
       scopeId: z.string().optional(), // Opcional para escopo tenant
       targetType: z.enum(["sales_count", "revenue", "conversion_rate", "leads_contacted"]),
       targetValue: z.number().positive(),
       period: z.string().regex(/^\d{4}-\d{2}$/, "Formato: '2026-08'"),
       startDate: z.string(),
       endDate: z.string(),
     });
     ```

2. **Service Layer**
   - `calculateGoalProgress(goalId, tenantId)` — recalcula o progresso:
     - Se `target_type = sales_count`: conta vendas no período
     - Se `target_type = revenue`: soma `sale_value` das vendas no período
     - Se `target_type = conversion_rate`: leads convertidos / leads totais
     - Atualiza `goal_progress`
   - `recalculateAllGoals(tenantId)` — recalcula todas as metas ativas do tenant
   - Chamar `recalculateAllGoals` sempre que uma venda for registrada

3. **Server Actions**
   ```typescript
   export async function createGoalAction(prev: any, form: FormData)
   export async function updateGoalAction(prev: any, form: FormData)
   export async function deleteGoalAction(goalId: string)
   export async function toggleGoalAction(goalId: string)
   ```
   - `gerenciar_metas`: Director ou Manager
   - Manager só pode criar metas no escopo da própria filial

4. **UI — Gerenciamento (Diretor/Gestor)**
   - **`/metas` page.tsx:**
     - Header: "Metas Comerciais" com botão "Nova meta"
     - Abas: "Minha filial" (manager) / "Todas" (director)
     - Filtro: período (dropdown de meses), escopo, corretor
   - **GoalForm (Modal):**
     - Nome da meta
     - Escopo: Corretor / Equipe / Filial / Corretora
     - Seletor de alvo: dropdown de corretores (se escopo=broker) ou filiais (se escopo=branch)
     - Tipo de meta: Vendas, Receita, Taxa de Conversão, Leads Contactados
     - Valor da meta
     - Período: mês/ano
   - **GoalCard:**
     - Nome da meta + escopo
     - Barra de progresso com animação (shadcn Progress)
     - Valor atual / meta
     - Percentual em destaque
     - Badge "Atingida" se >= 100%
     - Menu: Editar, Ativar/Desativar, Excluir

5. **UI — Visualização do Corretor**
   - **`/minha-meta` page.tsx:** Substituir placeholder
   - Card principal com a meta pessoal do corretor para o mês atual
   - Barra de progresso grande
   - "Faltam X vendas para atingir a meta"
   - Tabela de vendas recentes que contribuem para a meta

6. **Integração com Dashboard**
   - No **BrokerResumeDashboard**: substituir o backlog overlay "Meta do mês" pelos dados reais
   - No **DirectorResumeDashboard**: substituir "Meta comercial" pelo progresso consolidado
   - No **ManagerDashboard**: substituir "Metas da equipe" pelos dados reais

7. **Sidebar**
   - Em `corretop-sidebar.tsx`:
     - Grupo "Gestão" → "Metas" → `/metas` (Director/Manager)
     - Grupo "Atendimento" → "Minha Meta" → `/minha-meta` (Broker)

---

### Item 6.9 — WhatsApp via Meta Cloud API (🟡/🔶 | Complexidade: Alta)

**Descrição:** Integração real com a Meta Cloud API para envio/recebimento de mensagens WhatsApp. Depende da verificação da conta Meta Business.

> ⚠️ **Bloqueante externo:** Este item depende da verificação da conta Meta Business (item 1.6). Enquanto não for aprovada, manter o fallback (item 6.10).

#### Arquivos a criar

| Arquivo | Propósito |
|---|---|
| `src/features/whatsapp/meta-service.ts` | Serviço de integração Meta Cloud API |
| `src/features/whatsapp/webhook-handler.ts` | Handler de webhook de entrada |
| `src/features/whatsapp/template-validator.ts` | Validação de templates de mensagem |
| `src/features/whatsapp/actions.ts` | Server Actions (enviar, configurar) |
| `src/features/whatsapp/components/whatsapp-settings.tsx` | Tela de configuração |
| `src/features/whatsapp/tests/meta-service.test.ts` | Testes |
| `src/app/api/webhooks/whatsapp/route.ts` | Endpoint do webhook Meta |

#### Fluxo de Implementação

1. **Configuração**
   - `META_WHATSAPP_API_VERSION = 'v22.0'`
   - `META_WHATSAPP_PHONE_NUMBER_ID` — por tenant
   - `META_WHATSAPP_ACCESS_TOKEN` — por tenant, armazenado criptografado

2. **Serviço Meta**
   ```typescript
   async function sendMessage(to: string, text: string, tenantId: string) {
     const config = await getTenantWhatsAppConfig(tenantId);
     const response = await fetch(
       `https://graph.facebook.com/${API_VERSION}/${config.phoneNumberId}/messages`,
       {
         method: 'POST',
         headers: {
           Authorization: `Bearer ${config.accessToken}`,
           'Content-Type': 'application/json',
         },
         body: JSON.stringify({
           messaging_product: 'whatsapp',
           to,
           type: 'text',
           text: { body: text },
         }),
       }
     );
     return response.json();
   }
   ```

3. **Webhook (Recepção)**
   - GET: Verificação (`hub.mode`, `hub.challenge`)
   - POST: Receber mensagens, persistir em `whatsapp_messages`
   - Validar assinatura do payload

4. **Template de Mensagens**
   - Enviar mensagens template para primeiro contato (pré-aprovadas pela Meta)
   - Gerenciar templates por tenant

5. **UI de Configuração**
   - `/settings/whatsapp` — para Diretor configurar:
     - Número do WhatsApp do tenant
     - Status da conexão (conectado/desconectado)
     - Botão "Testar conexão"
     - Webhook URL

---

## Ordem de Implementação Sugerida (Priorizada)

A ordem abaixo respeita dependências entre itens e prioridade de negócio.

### Fase 1 — Base de Dados (pré-requisito para tudo)
- [ ] Migration 0027: criar `commission_rules`, `sales`, `commission_schedule`, `goals`, `goal_progress`
- [ ] Atualizar `src/shared/db/schema.ts` com novos enums e tabelas
- [ ] Atualizar `src/shared/auth/permissions.ts` com novas permissões
- [ ] Rodar `npx drizzle-kit generate` e validar SQL

### Fase 2 — Motor Financeiro (6.1 + 6.2 + 6.3)
- [ ] 6.1: CRUD de regras de comissão (service + actions + UI + testes)
- [ ] 6.2: Geração de cronograma ao converter venda (integrar com `change-lead-status.ts`)
- [ ] 6.3: Marcação manual de comissão paga (actions + UI)
- [ ] Criar página `/vendas` com listagem de vendas
- [ ] Criar página `/vendas/[id]` com cronograma de repasses

### Fase 3 — Metas Comerciais (6.8)
- [ ] CRUD de metas (service + actions + UI + testes)
- [ ] Cálculo automático de progresso na conversão de venda
- [ ] Página `/metas` para gestão (Diretor/Gestor)
- [ ] Página `/minha-meta` com progresso pessoal do corretor
- [ ] Integrar metas nos dashboards (BrokerResume, DirectorResume, Manager)

### Fase 4 — Pós-venda e Relatórios (6.4 + 6.7)
- [ ] 6.7: Reengajamento de leads perdidos (job + notificações)
- [ ] 6.4: Exportação de relatório de comissão (Excel/CSV)
- [ ] Export audit log

### Fase 5 — WhatsApp (6.9 — quando Meta aprovar)
- [ ] Configurar webhook Meta Cloud API
- [ ] Serviço de envio/recebimento
- [ ] UI de configuração

---

## Navegação e Sidebar

### Atualizações no `corretop-sidebar.tsx`

No grupo **"Gestão"**:
```typescript
const managementItems = [
  { label: "Resumo", icon: House, url: "/dashboard" },
  { label: "Equipe", icon: Users, url: "/equipe", permission: "convidar_corretor" },
  { label: "Metas", icon: Target, url: "/metas", permission: "gerenciar_metas" },
  { label: "Relatórios", icon: ChartBar, url: "/relatorios" },
  { label: "Vendas", icon: CurrencyCircleDollar, url: "/vendas", permission: "ver_comissao_equipe" },
  { label: "Filiais", icon: Buildings, url: "/filiais", permission: "gerenciar_filiais" },
];
```

No grupo **"Atendimento"** (para corretor):
```typescript
// Adicionar ao final do array primaryItems
{ label: "Minha Meta", icon: Target, url: "/minha-meta", permission: "ver_meta_propria" },
```

### Sub-rotas de Configuração (para Diretor)
- `/configuracoes/comissoes` — Regras de comissão (só Director)
- `/settings?tab=whatsapp` — Configuração WhatsApp (só Director)

---

## Testes

### Testes Unitários (Vitest)

Para cada módulo, criar testes na pasta correspondente:

| Módulo | Arquivo | Testes |
|---|---|---|
| Regras de comissão | `src/features/commissions/tests/commission-rules.test.ts` | CRUD, validação, cálculo |
| Cronograma | `src/features/commissions/tests/commission-schedule.test.ts` | Geração, filtros |
| Metas | `src/features/goals/tests/goals.test.ts` | CRUD, cálculo de progresso |
| Reengajamento | `src/features/leads/tests/reengagement.test.ts` | Seleção de leads, deduplicação |
| Exportação | `src/features/commissions/tests/export.test.ts` | Geração de XLSX/CSV |

### Testes de Integração
- Conversão de lead + geração de cronograma + atualização de meta
- Fluxo: criar regra → criar meta → criar lead → converter lead → verificar cronograma e progresso

---

## Atualizações no Roadmap

Após implementar cada item, atualizar `src/features/roadmap/roadmap-data.ts`:
- Mudar status de `planned` para `done`
- Adicionar summary descritivo da implementação

---

## Métricas de Sucesso

| Item | Critério de Aceite |
|---|---|
| 6.1 | Diretor cria regra única e escalonada, vê preview, edita, ativa/desativa |
| 6.2 | Ao converter lead com plano, cronograma aparece automaticamente |
| 6.3 | Diretor/Gestor marca parcela como paga, vê histórico |
| 6.4 | Relatório XLSX/CSV gerado com dados reais, filtros funcionando |
| 6.7 | Notificação criada para lead perdido há 30+ dias |
| 6.8 | Diretor cria meta, corretor vê progresso, barra atualiza com venda |
| 6.9 | Mensagem enviada e recebida via WhatsApp Cloud API |
| **Regra geral** | Toda configuração é persistida no banco, editável por UI, respeita escopo de papel e filial |

---

*Plano gerado em 14/07/2026 com base no `CorreTop_Plano_Desenvolvimento_7_Dias.md`, no schema atual do banco e nos padrões de código existentes.*
