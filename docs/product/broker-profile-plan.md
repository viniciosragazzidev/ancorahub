# Plano: Perfil do Corretor

**Rota:** `/corretores/[brokerId]`
**Data:** 2026-07-21
**Status:** Aprovado

---

## 1. Objetivo

Criar uma página de perfil detalhado para cada corretor, acessível por Diretor,
Gestor e pelo próprio corretor. A página espelha o padrão já estabelecido em
`/unidades/[branchId]` (perfil da filial), mas adaptada para exibir dados
individualizados de desempenho, informações profissionais e ações relevantes
conforme o papel do observador.

---

## 2. Quem acessa e o que vê

| Seção | Diretor | Gestor | Próprio Corretor |
|---|---|---|---|
| Dados profissionais | Sim | Sim | Sim (read-only) |
| Status lifecycle + badges | Sim | Sim | Sim |
| Métricas de desempenho | Sim | Sim | Sim |
| Meta individual | Sim | Sim | Sim |
| Comissões (resumo) | Sim | Sim | Sim (própria) |
| Ranking na filial | Sim | Sim | Sim (destacado) |
| Timeline de atividade | Sim | Sim | Sim |
| Ações de gestão | Sim | Sim | Não |
| Histórico de leads | Sim | Sim | Apenas próprios |

---

## 3. Estrutura de componentes

### 3.1 Rotas e páginas

```
src/app/(dashboard)/corretores/
  [brokerId]/
    page.tsx                        # Página principal do perfil
    loading.tsx                     # Skeleton loading state
```

**Listagem:** Mantida em `/equipe` existente. Botão "Ver perfil" na tabela de equipe
linka para `/corretores/[brokerId]`. Não criar página de listagem separada.

### 3.2 Feature module

```
src/features/brokers/
  queries.ts                        # getBrokerProfileData()
  actions.ts                        # Server actions (toggle availability, suspend, transfer, etc.)
  components/
    broker-profile-header.tsx       # Header com dados profissionais e badges
    broker-metrics-cards.tsx        # Métricas de desempenho do período
    broker-commission-summary.tsx   # Resumo de comissões
    broker-ranking-card.tsx         # Posição no ranking da filial
    broker-activity-timeline.tsx    # Timeline de atividade recente
    broker-leads-summary.tsx        # Resumo dos leads (histórico recente)
    broker-actions-panel.tsx        # Ações de gestão (Diretor/Gestor)
```

**Componente reutilizado (não criar novo):**
- `BrokerGoalView` → `src/features/goals/components/broker-goal-view.tsx`

---

## 4. Seções da página (composição visual)

### 4.1 Header do perfil (`broker-profile-header.tsx`)

**Componente:** `"use client"` (usa `useActionState` para ações)

**Conteúdo:**
- Botão "Voltar" → Diretor/Gestor: `/equipe`, Corretor: `/corretor/resumo`
- Avatar com iniciais (sem foto no schema atual) em circle com borda de status
- Nome profissional + código interno (`COR-000001`)
- Email + telefone
- Badges:
  - Status lifecycle: `ACTIVE` (verde), `SUSPENDED` (amarelo), `INACTIVE` (cinza)
  - Disponibilidade: `Disponível` / `Pausado` (com ícone WiFi)
  - Filial vinculada (link para `/unidades/[branchId]`)
  - Gestor responsável (se aplicável)

**Ações (conforme papel):**

| Ação | Diretor | Gestor | Corretor |
|---|---|---|---|
| Pausar/retomar disponibilidade | Sim | Sim | Sim (próprio) |
| Suspender corretor | Sim | Não | Não |
| Reativar corretor | Sim | Não | Não |
| Transferir de filial | Sim | Não | Não |
| Editar dados profissionais | Sim | Sim | Não |
| Enviar novo convite | Sim | Sim | Não |

**Animações:**
- `cardItemVariants` no container principal (fade-up 0.18s)
- Badges com `transition-colors duration-200` para mudanças de estado
- Botões de ação com `whileHover={{ y: -1 }}` e `whileTap={{ scale: 0.98 }}`

### 4.2 Métricas de desempenho (`broker-metrics-cards.tsx`)

**Componente:** Server component

**Layout:** Grid 4 colunas (desktop) / 2 colunas (mobile), usando `MetricCard` compartilhado

**Métricas:**

| Card | Valor | Subtexto | Cor condicional |
|---|---|---|---|
| Leads no período | Total | "Mês: YYYY-MM" | — |
| Taxa de conversão | X% | "X de Y leads" | ≥30% verde, ≥15% amarelo, <15% neutro |
| Em atendimento | Total | "Leads em andamento" | >0 azul |
| Aguardando contato | Total | "Distribuídos" | >0 amarelo |

**Dados:** Mesma query de métricas da filial, mas filtrada por `corretorId`

**Animações:**
- `cardGridVariants` com stagger de 0.06s
- `whileHover={{ y: -2 }}` em cada card
- Valores numéricos com `tabular-nums` para alinhamento

### 4.3 Progresso da meta (`broker-goal-progress.tsx`)

**Componente:** Server component

**Implementação:** Reutilizar `BrokerGoalView` existente em
`src/features/goals/components/broker-goal-view.tsx`. Buscar meta via
`getBrokerGoal()` de `src/features/goals/queries.ts`.

**Dados:** Tabela `goals` com `scope: "broker"` e `scopeId: brokerUserId`,
join com `goalProgress` para progresso atual.

**Estado vazio:** Já implementado no componente ("Nenhuma meta atribuída")

### 4.4 Resumo de comissões (`broker-commission-summary.tsx`)

**Componente:** Server component

**Conteúdo:**
- Comissão do mês (valor)
- Comissão pendente (valor aguardando repasse)
- Comissão paga no mês (valor)
- Próximo repasse previsto (data)

**Estado vazio:** "Dados financeiros indisponíveis" — módulo pode não estar habilitado.
Sempre renderizar o card; se não houver dados de `commissionSchedule`, mostrar estado
vazio com ícone de bloqueio e texto explicativo.

**Restrições:**
- Corretor vê apenas próprias comissões (filter por `brokerId = userId`)
- Gestor vê comissões dos corretores da filial
- Diretor vê tudo

**Animações:**
- `cardItemVariants` para entrada
- Valores com `tabular-nums` e `font-mono`

### 4.5 Ranking na filial (`broker-ranking-card.tsx`)

**Componente:** Server component

**Conteúdo:**
- Posição do corretor no ranking da filial (ex: "#3 de 8")
- Taxa de conversão comparada com a média da filial
- Spark bar mostrando posição relativa
- Link "Ver ranking completo" → `/unidades/[branchId]`

**Animações:**
- Spark bar com `transition-all duration-500`
- Destaque visual para o corretor atual (borda primary)

### 4.6 Timeline de atividade (`broker-activity-timeline.tsx`)

**Componente:** Server component

**Conteúdo:**
- Últimas 10 interações do corretor (lead, tipo de ação, data/hora)
- Ícone por tipo: contato, cotação, documento, conversão
- Formato: linha vertical com dots coloridos

**Dados:** Query em `leads` filtrado por `corretorId`, ordenado por `updatedAt`
descendente. Cada item mostra: nome do lead, status atual, e timestamp da
última atualização. Não há tabela dedicada de interações; usar `leads` como
fonte de verdade para atividade recente.

**Estado vazio:** "Nenhuma atividade registrada no período"

**Animações:**
- Items com stagger `0.04s` cada
- Dots com `scale` de 0→1 no mount

### 4.7 Resumo de leads (`broker-leads-summary.tsx`)

**Componente:** Server component

**Conteúdo:**
- Tabela compacta com últimos 5 leads atendidos
- Colunas: Lead, Status, Etapa, Última interação
- Badge de status usando `LeadStatusBadge`
- Link "Ver todos os leads" → `/leads`

**Animações:**
- `motion.tbody` com rows stagger (0.03s cada, max 0.25s)
- Rows com slide de `x: -8`

### 4.8 Painel de ações (`broker-actions-panel.tsx`)

**Componente:** `"use client"` (usa `useActionState`)

**Ações disponíveis (conforme papel):**

#### Diretor:
1. **Pausar/Retomar disponibilidade** → `toggleBrokerAvailabilityAction`
2. **Suspender corretor** → `suspendBrokerAction` (novo)
3. **Reativar corretor** → `reactivateBrokerAction` (novo)
4. **Transferir de filial** → `transferBrokerAction` (novo) - abre Sheet com seletor de filial. Ação imediata com audit log (confiança total no Diretor).
5. **Editar dados** → abre Sheet com form de edição
6. **Enviar convite** → `resendBrokerInviteAction` (novo)

#### Gestor:
1. **Pausar/Retomar disponibilidade** → `toggleBrokerAvailabilityAction`
2. **Editar dados** → abre Sheet com form (limitado)

#### Corretor (próprio perfil):
1. **Pausar/Retomar disponibilidade** → `toggleBrokerAvailabilityAction`

**Padrão de ações:** Seguir o padrão existente em `unit-profile-header.tsx`:
- `useActionState<BrokerActionState, FormData>` com retorno `{ success?: boolean; error?: string }`
- `ActionFeedback` com `toast.success()` / `toast.error()`
- Formulários com `<input type="hidden">` para IDs
- `revalidatePath()` no server action

**Animações:**
- Botões com `whileHover={{ y: -1 }}` e `whileTap={{ scale: 0.98 }}`
- Sheet com transição padrão do shadcn (slide-in)
- Estados de loading com `disabled` + spinner

---

## 5. Server Action states

```typescript
// actions.ts
type BrokerActionState = {
  success?: boolean;
  error?: string;
};

// Ações:
toggleBrokerAvailabilityAction(state, formData)    // já existe
suspendBrokerAction(state, formData)               // novo
reactivateBrokerAction(state, formData)            // novo
transferBrokerAction(state, formData)              // novo
updateBrokerProfileAction(state, formData)         // novo
resendBrokerInviteAction(state, formData)          // novo
```

---

## 6. Server Query (`getBrokerProfileData`)

```typescript
// queries.ts
type BrokerProfileData = {
  broker: {
    id: string;
    professionalName: string;
    email: string;
    phone: string;
    internalCode: string;
    lifecycleStatus: BrokerLifecycleStatus;
    availabilityStatus: "available" | "paused";
    branchId: string;
    branchName: string;
    managerId: string | null;
    managerName: string | null;
    activatedAt: Date | null;
    createdAt: Date;
  };
  metrics: BrokerMetrics;        // mesmo shape de BranchMetrics
  goal: BrokerGoal | null;       // progresso da meta
  commissions: BrokerCommissions | null;  // resumo financeiro
  ranking: BrokerRanking;        // posição na filial
  recentActivity: ActivityItem[]; // timeline
  recentLeads: LeadSummary[];    // últimos leads
};
```

**Autorização:**
- Diretor: qualquer corretor do tenant
- Gestor: apenas corretores da própria filial
- Corretor: apenas a si mesmo

---

## 7. Animações e motion

### Variáveis reutilizáveis (de `src/shared/animations.ts`):
- `pageTransitionVariants` → fade-in da página
- `cardGridVariants` → stagger nos grids de métricas
- `cardItemVariants` → fade-up individual dos cards

### Novas variáveis (adicionar ao arquivo):
```typescript
export const timelineItemVariants: Variants = {
  hidden: { opacity: 0, x: -8 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.15, ease: [0, 0, 0.2, 1] },
  },
};

export const progressbarVariants: Variants = {
  hidden: { scaleX: 0 },
  visible: {
    scaleX: 1,
    transition: { duration: 0.7, ease: [0, 0, 0.2, 1] },
  },
};
```

### Regras de motion (de `DESIGN.md` e `ui-foundation.md`):
- **Sem motion decorativo** em tabelas, valores financeiros e dados sensíveis
- **`prefers-reduced-motion`** sempre respeitado
- **Durações:** 0.15s–0.25s para UI, 0.5s–0.7s para barras de progresso
- **Easing:** `[0, 0, 0.2, 1]` (ease-out) consistente
- Motion não é a única forma de comunicar estado

---

## 8. Estados da UI

| Estado | Comportamento |
|---|---|
| **Loading** | `Skeleton` com shimmer preservando layout: header, 4 cards, tabela |
| **Erro de acesso** | `redirect("/access-denied")` |
| **Corretor não encontrado** | `notFound()` |
| **Sem dados de meta** | Card com estado vazio e texto explicativo |
| **Sem comissões** | Card com "Dados financeiros indisponíveis" |
| **Sem atividade** | Timeline com "Nenhuma atividade registrada" |
| **Sem leads** | Tabela com "Nenhum lead no período" |
| **Perfil pausado** | Badge amarelo + banner discreto "Recebimento pausado" |
| **Perfil suspenso** | Badge vermelho + banner "Perfil suspenso pelo gestor" |

---

## 9. Segurança e permissões

- **Multi-tenant:** Query filtra por `tenantId` do contexto de sessão
- **Escopo por papel:**
  - Diretor: acesso total a qualquer corretor do tenant
  - Gestor: acesso apenas a corretores da própria filial
  - Corretor: acesso apenas ao próprio perfil
- **Server actions:** Todas validam permissão antes de executar
- **Audit logging:** Todas as ações de gestão (suspender, transferir, editar) geram log de auditoria
- **Dados sensíveis:** CPF exibido apenas para Diretor e Gestor (mascarado para outros)
- **LGPD:** Telefone e email visíveis apenas para quem tem permissão

---

## 10. Layout responsivo

### Desktop (≥1024px):
```
[Header com badge e ações]
[Métricas: 4 colunas]
[Meta | Comissões | Ranking] ← 3 colunas
[Timeline | Leads] ← 2 colunas (2/3 + 1/3)
[Ações de gestão]
```

### Mobile (<1024px):
```
[Header empilhado]
[Métricas: 2 colunas]
[Meta]
[Comissões]
[Ranking]
[Timeline]
[Leads]
[Ações de gestão]
```

---

## 11. Dependências e reutilização

### Componentes reutilizados:
- `Card`, `CardContent`, `CardHeader`, `CardTitle` → shadcn
- `Badge` → shadcn (variantes: success, secondary, outline, destructive)
- `Button` → shadcn (variantes: ghost, outline, icon-sm)
- `Table`, `TableHeader`, `TableRow`, `TableCell`, `TableHead` → shadcn
- `Sheet`, `SheetTrigger`, `SheetContent` → shadcn (para ações de edição)
- `MetricCard` → `src/components/dashboard/metric-card.tsx`
- `LeadStatusBadge` → `src/components/status-badges.tsx`
- `ActionFeedback` → padrão existente em branches
- `Skeleton` → shadcn (loading states)

### Ícones (de `@/components/huge-icons`):
- `UserCircle` → avatar do corretor
- `ArrowLeft` → botão voltar
- `WifiHigh` → status de disponibilidade
- `ChartLineUp`, `CheckIcon`, `TrendDown`, `XCircle` → métricas
- `Target` → meta
- `Money` → comissões
- `Trophy` → ranking
- `Clock` → timeline
- `PencilSimple` → editar
- `Power` → pausar/ativar
- `ArrowSquareOut` → transferir
- `PaperPlane` → reenviar convite

---

## 12. Integração com `/equipe`

A página existente de equipe (`src/app/(dashboard)/equipe/page.tsx`) já lista
corretores. Adicionar uma coluna "Ação" com botão "Ver perfil" que linka para
`/corretores/[brokerId]`. Seguir o padrão já usado na tabela de filiais em
`branches-manager.tsx` (coluna "Ver perfil" com `ArrowSquareOut`).

---

## 13. Ordem de implementação

| # | Tarefa | Dependências |
|---|---|---|
| 1 | Criar `src/features/brokers/queries.ts` com `getBrokerProfileData()` | Schema existente |
| 2 | Criar `src/features/brokers/actions.ts` com server actions | queries.ts |
| 3 | Criar `broker-profile-header.tsx` | actions.ts, queries.ts |
| 4 | Criar `broker-metrics-cards.tsx` | queries.ts |
| 5 | Criar página `src/app/(dashboard)/corretores/[brokerId]/page.tsx` | header, metrics |
| 6 | Criar `loading.tsx` com skeletons | — |
| 7 | Integrar `BrokerGoalView` existente na página | queries.ts |
| 8 | Criar `broker-commission-summary.tsx` | queries.ts |
| 9 | Criar `broker-ranking-card.tsx` | queries.ts |
| 10 | Criar `broker-activity-timeline.tsx` | queries.ts |
| 11 | Criar `broker-leads-summary.tsx` | queries.ts |
| 12 | Criar `broker-actions-panel.tsx` | actions.ts |
| 13 | Adicionar variants de animação ao `animations.ts` | — |
| 14 | Integrar todas as seções na página principal | Todos os componentes |
| 15 | Adicionar "Ver perfil" na tabela de `/equipe` | queries.ts |
| 16 | Testar fluxos por papel (Diretor, Gestor, Corretor) | Todas as features |
| 17 | Verificar `prefers-reduced-motion` e acessibilidade | Todos os componentes |
| 18 | Rodar lint e typecheck | — |

---

## 14. Decisões tomadas

| Questão | Decisão | Justificativa |
|---|---|---|
| **Avatar/foto** | Usar iniciais em circle | Schema não tem campo de foto; iniciais são suficientes para identificação visual |
| **Comissões** | Criar card com estado vazio | Módulo pode não estar habilitado; card sempre renderiza, mostra dados ou estado vazio |
| **Metas** | Reutilizar `BrokerGoalView` existente | Já implementado com barra animada, milestones e estados vazios |
| **Transferência** | Ação imediata com audit log | Diretor tem confiança total; simplifica fluxo, mantém auditoria |
| **Histórico de atividade** | Usar `leads.updatedAt` | Não existe tabela de interações separada; leads é a fonte de verdade |
| **Listagem** | Manter em `/equipe` | Evita duplicação; botão "Ver perfil" na tabela já resolve a navegação |
