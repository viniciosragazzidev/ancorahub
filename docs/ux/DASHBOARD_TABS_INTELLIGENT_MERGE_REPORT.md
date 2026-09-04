# Relatório & Plano: Absorção Inteligente de /relatorios nas Tabs do /dashboard

**Data:** 2026-09-04  
**Etapa:** UX-1D — Dashboard unificado  
**Status:** PARCIAL — abas internas aplicadas; rollout, extração estrutural e validação visual pendentes
**Objetivo:** Eliminar a duplicação entre `/dashboard` e `/relatorios` tornando o dashboard a única home de inteligência operacional

---

## Adendo obrigatório — Conflitos resolvidos para UX-1D

Este adendo prevalece sobre descrições anteriores deste documento que possam sugerir
uma migração imediata, criação de um dashboard paralelo ou disponibilidade de dados
que o produto ainda não possui.

### 0.1 Gate de entrada

UX-1D **não inicia código de migração** enquanto UX-1C não registrar a validação da
rail por papel, viewport estreito e teclado. A etapa usa o contrato atual de UX e as
fundações em `src/components/foundations/`; não depende do design system legado que
foi descontinuado.

### 0.2 Não haverá um segundo dashboard

O destino é exclusivamente `/dashboard`. Não criar `DashboardV2`, rota paralela nem
um conjunto local de componentes que concorra com `/relatorios`. Componentes
reutilizáveis de métricas saem das rotas e passam a `src/features/reports/components/`.
O servidor interpreta `tab` e `period` na URL, valida-os contra sessão e capability e
busca somente o domínio da aba ativa.

### 0.3 Catálogo real versus nomenclatura desejada

O catálogo atual sustenta os domínios `overview`, `commercial`, `team`, `units` e
`financial`. Portanto, a primeira entrega de UX-1D contém somente:

| Perspectiva de produto | Fonte canônica existente | Decisão UX-1D |
|---|---|---|
| Resumo | `overview` + timeline | Entregar para Diretor e Gerente |
| Leads e Conversão | `commercial` | Tratar como seções internas da perspectiva Comercial; não criar dois cálculos nem dois `ReportTabId` ainda |
| Equipe | `team` | Entregar dentro do escopo derivado no servidor |
| Unidades | `units` | Entregar somente onde o catálogo já autoriza; Gerente vê apenas sua unidade |
| Financeiro | `financial` | Entregar apenas com `ver_relatorios_financeiros`; exportar exige `exportar_relatorios` |
| Atendimento | — | `GAP-UX1D-001`: exige definição de SLA, tempo de primeira resposta, origem e drill-down antes de virar aba |
| Metas | — | `GAP-UX1D-002`: exige modelo, fonte de verdade, permissão e métricas de meta antes de virar aba |

Atendimento e Metas não serão apresentados como abas vazias, cards decorativos ou
estimativas calculadas no cliente. A expansão futura só ocorre após decisão registrada
e contrato de dados correspondente.

### 0.4 Escopo por perfil e segurança

A matriz inicial deriva de `reportTabsForRole` e das capabilities atuais, não da
aparência pretendida: Diretor e Gerente recebem os domínios permitidos; Supervisor,
somente Comercial e Equipe; Corretor mantém seu workspace próprio; Marketing mantém
seu dashboard de campanhas. Qualquer ampliação de acesso requer alteração explícita
no catálogo de métricas, decisão de produto e testes de escopo. Tenant, unidade,
equipe e carteira nunca vêm da URL ou do cliente.

### 0.5 Migração de rota e rollout

`/relatorios` permanece acessível enquanto a paridade não estiver comprovada. A flag
atual `REPORTING_CENTER` não é suficiente para governar a absorção: a implementação
deve introduzir uma flag específica, editável pelo Super-Admin e auditável, para
habilitar o dashboard unificado de modo reversível. Só após canário e paridade a rota
antiga pode redirecionar temporariamente para `/dashboard?tab=...`; nunca usar 301 ou
redirect permanente nesta etapa. O item da rail e a command palette só mudam ao final
desse rollout.

### 0.6 Filtros e drill-downs

Período é o único filtro global já comprovado. Filtros de unidade, equipe ou canal só
entram quando cada resolvedor aplicar a interseção com o escopo autorizado no servidor.
Cada KPI acionável terá destino explícito para um filtro suportado em Leads ou para um
`DetailDrawer`; não será criado link genérico para uma lista sem correspondência de
dados.

---

## 1. Diagnóstico — O Que Existe Hoje

### 1.1 `/dashboard` — Visão Atual

| Perfil | Componente Renderizado | Conteúdo |
|---|---|---|
| Diretor/Gerente/Supervisor | `ExecutiveDashboard` | 4 KPI cards + gráfico timeline + alertas + funil + tabela unidades (top 6) + tabela equipe (top 6) |
| Corretor (Full) | `BrokerWorkspace` ou `NocDashboardContent` | Lista de leads pessoal + métricas pessoais |
| Corretor (Light) | `LightDashboard` | Card do próximo lead + contadores |
| Marketing | `MarketingDashboardContent` | KPIs de campanhas + funil + tendências |

**Problema crítico do ExecutiveDashboard:**  
As tabs de navegação no topo (`Visão Geral`, `Leads`, `Atendimento`, `Conversão`, `Equipe`, `Financeiro`) **não renderizam conteúdo diferente** — elas são apenas links que navegam PARA FORA do dashboard:

```tsx
// Hoje: tabs são apenas Links para /relatorios
const executiveTabs = [
  { label: "Visão geral", href: "/dashboard", active: true },
  { label: "Leads", href: "/relatorios?tab=commercial" },  // ← NAVEGA PARA FORA
  { label: "Atendimento", href: "/conversas" },              // ← NAVEGA PARA FORA
  { label: "Conversão", href: "/relatorios?tab=commercial" },// ← NAVEGA PARA FORA
  { label: "Equipe", href: "/relatorios?tab=team" },         // ← NAVEGA PARA FORA
  { label: "Financeiro", href: "/relatorios?tab=financial" }, // ← NAVEGA PARA FORA
];
```

**Resultado:** O usuário clica em "Equipe" e é redirecionado para uma tela completamente diferente (`/relatorios?tab=team`), perdendo o contexto do dashboard. É uma navegação disfarçada, não uma aba real.

### 1.2 `/relatorios` — Visão Atual

| Aba | Conteúdo | Dados |
|---|---|---|
| **Visão geral** | 5 KPIs com delta de comparação + Funil de 8 estágios + Alertas de atenção | `getCommercialOverview`, `getFunnelSnapshot`, `getAttentionSnapshot` |
| **Comercial** | 5 KPIs com delta + Funil + Alertas + Tabela de desempenho por canal | Mesmos + `getCommercialBySource` |
| **Equipe** | Tabela detalhada: Recebidos, Convertidos, Conversão, SLA, Parados, Vendas | `getTeamPerformance` |
| **Unidades** | Tabela detalhada: Leads, Convertidos, Conversão, Vendas, SLA | `getUnitPerformance` |
| **Financeiro** | Resumo (Receita, Vendas, Ticket) + Tabelas por unidade/corretor/canal | `getFinancialOverview` |

### 1.3 Sobreposição de Dados — A Duplificação

| Dado | `/dashboard` (Executive) | `/relatorios` | Duplicado? |
|---|---|---|---|
| KPIs principais | ✅ 4 cards (sem delta) | ✅ 5 cards (com delta) | ⚠️ SIM, mas relatorios é mais rico |
| Funil de 8 estágios | ✅ Bar chart simples | ✅ Bar chart com % progressão | ⚠️ SIM, relatorios mais completo |
| Alertas de atenção | ✅ Lista com links | ✅ Grid de cards com hover | ⚠️ SIM, formatos diferentes |
| Gráfico timeline | ✅ AreaChart (entradas vs conversões) | ❌ Não tem | ✅ ÚNICO do dashboard |
| Desempenho por unidade | ✅ Tabela top 6 | ✅ Tabela completa | ⚠️ SIM, dashboard limita a 6 |
| Desempenho da equipe | ✅ Tabela top 6 | ✅ Tabela completa | ⚠️ SIM, dashboard limita a 6 |
| Desempenho por canal | ❌ Não tem | ✅ Tabela detalhada | ❌ ÚNICO do relatorios |
| Comparação com período anterior | ❌ Não tem | ✅ Deltas em todos os KPIs | ❌ ÚNICO do relatorios |
| Financeiro | ❌ Não tem | ✅ Resumo + tabelas | ❌ ÚNICO do relatorios |

**Conclusão:** O dashboard executivo já repete ~70% do que o relatorios faz, porém de forma simplificada e sem as melhorias de UX (deltas, tabelas completas). O relatorios adiciona: comparação temporal, desempenho por canal, tabelas completas e financeiro.

---

## 2. Análise de UX — Por Que Está Ruim Hoje

### 2.1 Problemas de Navegação

| Problema | Impacto | Exemplo |
|---|---|---|
| **Tabs que navegam para fora** | Perda de contexto, usuário confuso | Clica em "Equipe" → vai para `/relatorios?tab=team` → perde visão geral |
| **Duas rotas para o mesmo dado** | Confusão sobre qual usar | "Devo ir em Dashboard ou Relatórios?" |
| **Dados incompletos no dashboard** | Usuário precisa sair para ver tudo | Tabela de equipe mostra só 6 linhas, precisa ir a `/relatorios` para ver todas |
| **Sem comparação temporal** | Dashboard não mostra tendência | KPIs mostram valor absoluto, sem indicar se melhorou ou piorou |
| **Call-to-action para sair** | Botão "Abrir Central de Relatórios" no topo | Incentiva o usuário a abandonar o dashboard |

### 2.2 Problemas de Informação

| Problema | Detalhe |
|---|---|
| **Funil duplicado com formatação diferente** | Dashboard: barras horizontais simples. Relatorios: barras com % de progressão e cores por estágio |
| **Alertas de atenção em formatosopostos** | Dashboard: lista vertical com badges. Relatorios: grid de cards com hover e seta |
| **KPIs sem delta** | Dashboard mostra "42 leads" mas não mostra se é +10% ou -5% vs período anterior |
| **Timeline é exclusiva do dashboard** | O gráfico de entradas vs conversões por dia não existe no relatorios — é valioso mas está preso numa rota que o usuário evita |

### 2.3 Oportunidade

O `/dashboard` já é a **Home Canônica** onde o usuário começa o dia. Em vez de mandá-lo para fora, deveria ser o **único lugar** onde ele vê tudo — de forma progressiva, sem sobrecarga.

---

## 3. Proposta — Dashboard com Tabs Reais (Single Source of Truth)

### 3.1 Princípio

```
O /dashboard se torna o PAINEL ÚNICO de inteligência.
/relatorios vira uma rota de deep-link (mantida por URLs antigas e bookmarks)
mas sem sidebar — acessada apenas via redirect ou command palette.

O conteúdo de /relatorios é absorvido pelas tabs internas do dashboard.
```

### 3.2 Arquitetura de Tabs Proposta

```
┌──────────────────────────────────────────────────────────────┐
│  [Visão Geral do Painel]              [📅 Período: 30 dias] │
│                                                              │
│  [ Resumo ] [ Comercial ] [ Equipe ] [ Unidades ] [ Finan. ] │
│  ────────────────────────────────────────────────────────────│
│                                                              │
│  (conteúdo da aba ativa)                                     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 3.3 Detalhamento por Aba

#### ABA 1 — Resumo (Home Canônica)

**O que mostra:** Visão executiva de alto nível — "O que importa agora"

| Seção | Fonte | Comportamento |
|---|---|---|
| **Timeline de entradas vs conversões** | `getLeadTimeline` (exclusivo do dashboard) | AreaChart com gradientes — **MANTER** como diferencial |
| **4 KPIs principais** com delta | `getCommercialOverview` | Usar `KpiComparisonCard` do relatorios (com delta), não os `StatCard` simples do dashboard atual |
| **Alertas de atenção** | `getAttentionSnapshot` | Usar o `AttentionSection` do relatorios (grid de cards com hover), não a lista simples |
| **Funil resumido** | `getFunnelSnapshot` | Versão compacta — 5 linhas sem % de progressão, apenas barras |

**UX proposta:**
- Primeira coisa que o usuário vê: timeline + KPIs com delta
- Alertas de atenção em grid horizontal (não lista vertical)
- Funil como "preview" com link "Ver análise completa →" que ativa a aba Comercial
- **Nenhum link que navegue para fora do dashboard**

**Por que funciona:**
- Timeline é informação de "awareness" — o usuário precisa ver a tendência antes de agir
- KPIs com delta respondem à pergunta "está melhorando ou piorando?"
- Alertas em grid são mais escaneáveis que lista
- Funil compacto dá contexto sem sobrecarregar

---

#### ABA 2 — Comercial (Análise Detalhada do Pipeline)

**O que mostra:** Análise profunda de conversão e canais de entrada

| Seção | Fonte | Comportamento |
|---|---|---|
| **5 KPIs com delta** | `getCommercialOverview` | `KpiComparisonCard` — Conversão, Vendas, Receita, Ticket Médio, Leads Recebidos |
| **Funil de 8 estágios** | `getFunnelSnapshot` | `FunnelSection` completo do relatorios — barras coloridas com % progressão e gargalo identificado |
| **Alertas de atenção** | `getAttentionSnapshot` | `AttentionSection` do relatorios |
| **Desempenho por canal** | `getCommercialBySource` | Tabela: Canal, Leads, Convertidos, Conversão, Vendas — **NOVO** no dashboard |

**UX proposta:**
- Aba "Comercial" é onde o usuário vai quando quer entender **por que** os números estão assim
- Funil completo mostra onde os leads estão parados
- Tabela por canal responde "de onde vêm os leads que convertem?"
- **Comparação com período anterior em todos os KPIs**

**Por que funciona:**
- Separa "awareness" (Resumo) de "análise" (Comercial)
- O funil de 8 estágios é poderoso mas visualmente pesado — não cabe no Resumo
- A tabela por canal é a informação mais valiosa para decisão de investimento em marketing

---

#### ABA 3 — Equipe (Performance de Corretores)

**O que mostra:** Ranking e diagnóstico de produtividade da equipe

| Seção | Fonte | Comportamento |
|---|---|---|
| **Tabela completa** | `getTeamPerformance` | Todas as linhas (não top 6): Corretor, Recebidos, Convertidos, Conversão, SLA, Parados, Vendas |
| **Destaque visual** | — | Linhas com SLA < 80% em vermelho, conversão > taxa média em verde |
| **Métricas resumo** | Derivado da tabela | Média de conversão da equipe, total de vendas, corretores acima/abaixo da meta |

**UX proposta:**
- Tabela com sorting por coluna (clique no cabeçalho)
- Corretores "parados" (stagnant > 0) destacados com badge vermelho
- Métricas resumo no topo: "Conversão média: X% | Acima da média: Y corretores | Abaixo: Z"
- **Sem paginação** — equipe tipicamente tem < 50 membros, tabela scrollável é suficiente

**Por que funciona:**
- Gerente e diretor precisam ver **toda** a equipe, não só top 6
- Sorting permite identificar rapidamente quem precisa de atenção
- Destaque visual reduz tempo de análise

---

#### ABA 4 — Unidades (Performance por Filial)

**O que mostra:** Comparativo de performance entre unidades/filiais

| Seção | Fonte | Comportamento |
|---|---|---|
| **Tabela completa** | `getUnitPerformance` | Unidade, Leads, Convertidos, Conversão, Vendas, SLA |
| **Métricas resumo** | Derivado | Total de unidades, melhor/pior unidade, média de conversão |

**UX proposta:**
- Tabela com sorting
- Badges: 🟢 SLA ≥ 85%, 🟡 SLA 70-84%, 🔴 SLA < 70%
- Métricas resumo: "X unidades | Melhor: Y (Z% conversão) | Pior: W (V% conversão)"

**Por que funciona:**
- Gerente precisa comparar unidades rapidamente
- SLA como indicador visual permite identify problemas em segundos

---

#### ABA 5 — Financeiro (Resumo de Receita)

**O que mostra:** Visão consolidada de performance financeira

| Seção | Fonte | Comportamento |
|---|---|---|
| **3 KPIs grandes** | `getFinancialOverview` | Receita Total, Vendas, Ticket Médio |
| **Tabela por unidade** | `getFinancialOverview` | Unidade, Vendas, Receita, Ticket Médio |
| **Tabela por corretor** | `getFinancialOverview` | Corretor, Vendas, Receita, Ticket Médio |
| **Tabela por canal** | `getFinancialOverview` | Canal, Vendas, Receita, Ticket Médio |

**Condição de visibilidade:** Só aparece se `hasCapability(role, "ver_relatorios_financeiros")`

**UX proposta:**
- KPIs grandes e claros no topo
- Tabelas em accordion (colapsáveis) — "Por unidade" ▸, "Por corretor" ▸, "Por canal" ▸
- Por padrão, apenas "Por unidade" expandida
- **Exportação CSV** disponível na aba financeira

**Por que funciona:**
- Financeiro é informação de "consulta", não de "ação diária"
- Accordion reduz sobrecarga visual
- Exportação é a ação mais comum nessa aba

---

## 4. Mapeamento de Componentes — Reutilização

| Componente Atual | Origem | Uso Proposto | Mudança? |
|---|---|---|---|
| `KpiComparisonCard` | `/relatorios` | Todas as abas do dashboard | Reutilizar diretamente |
| `FunnelSection` | `/relatorios` | Aba Resumo (compacto) + Aba Comercial (completo) | Criar variante `compact` |
| `AttentionSection` | `/relatorios` | Aba Resumo + Aba Comercial | Reutilizar diretamente |
| `ReportTabs` | `/relatorios` | Tabs do dashboard | Adaptar labels e hrefs |
| `CommercialTab` | `/relatorios` | Aba Comercial do dashboard | Reutilizar com dados |
| `TeamTab` | `/relatorios` | Aba Equipe do dashboard | Reutilizar com dados |
| `UnitsTab` | `/relatorios` | Aba Unidades do dashboard | Reutilizar com dados |
| `FinancialTab` | `/relatorios` | Aba Financeiro do dashboard | Reutilizar com dados |
| `PeriodSelect` | `/components` | Header do dashboard | Reutilizar diretamente |
| AreaChart (timeline) | Dashboard atual | Aba Resumo | Manter — é diferencial |
| `StatCard` | Dashboard atual | **SUBSTITUIR** por `KpiComparisonCard` | Remover uso |

---

## 5. Fluxo de Dados — Otimização

### 5.1 Estratégia de Carregamento

```
ABA RESUMO (carrega sempre):
  → getCommercialOverview (KPIs)
  → getLeadTimeline (timeline)
  → getFunnelSnapshot (funil compacto)
  → getAttentionSnapshot (alertas)

ABA COMERCIAL (carrega ao clicar):
  → getCommercialOverview (KPIs) ← JÁ CARREGADO no Resumo, usar cache
  → getFunnelSnapshot (funil completo) ← JÁ CARREGADO, usar cache
  → getAttentionSnapshot ← JÁ CARREGADO, usar cache
  → getCommercialBySource (NOVO)

ABA EQUIPE (carrega ao clicar):
  → getTeamPerformance

ABA UNIDADES (carrega ao clicar):
  → getUnitPerformance

ABA FINANCEIRO (carrega ao clicar):
  → getFinancialOverview
```

### 5.2 Otimização Chave

O `ExecutiveDashboard` atual JÁ importa os mesmos resolvers do relatorios:

```tsx
// executive-dashboard-data.ts — JÁ USA os mesmos services
import {
  getCommercialOverview,
  getFunnelSnapshot,
  getAttentionSnapshot,
  getTeamPerformance,
  getUnitPerformance,
  getLeadTimeline,
} from "@/features/reports/metrics/metrics-service";
```

**Isso significa que a infraestrutura de dados já existe.** A mudança é puramente de UI: em vez de renderizar tudo numa página só com links para fora, renderizar por abas com conteúdo real.

### 5.3 Padrão de URL

```
/dashboard                    → Aba "Resumo" (default)
/dashboard?tab=comercial      → Aba "Comercial"
/dashboard?tab=team           → Aba "Equipe"
/dashboard?tab=units          → Aba "Unidades"
/dashboard?tab=financial      → Aba "Financeiro"
/dashboard?period=30          → Resumo com período 30 dias
/dashboard?tab=comercial&period=14 → Comercial com período 14 dias
```

**Deep links preservados:** durante a migração, `/relatorios?tab=X` permanece
compatível por feature flag. O redirect para `/dashboard?tab=X` só é ativado após
paridade comprovada e começa reversível.

---

## 6. UX por Perfil — Adaptação Inteligente

### 6.1 Diretor

| Aba | Visível | Conteúdo |
|---|---|---|
| Resumo | ✅ | Timeline + KPIs + Alertas + Funil compacto |
| Comercial | ✅ | KPIs + Funil completo + Alertas + Canal |
| Equipe | ✅ | Tabela completa de corretores |
| Unidades | ✅ | Tabela completa de filiais |
| Financeiro | ✅ (se `ver_relatorios_financeiros`) | Resumo + tabelas |

### 6.2 Gerente

| Aba | Visível | Conteúdo |
|---|---|---|
| Resumo | ✅ | Mesmo, mas escopo da unidade |
| Comercial | ✅ | Mesmo, mas escopo da unidade |
| Equipe | ✅ | Tabela da equipe da unidade |
| Unidades | ✅ | Mostra apenas sua unidade; não é comparativo entre filiais |
| Financeiro | ✅ (se permissão) | Da unidade |

### 6.3 Supervisor

| Aba | Visível | Conteúdo |
|---|---|---|
| Resumo | ❌ | Não autorizado pelo catálogo de abas atual |
| Comercial | ✅ | Mesmo |
| Equipe | ✅ | Apenas corretores da equipe |
| Unidades | ❌ | Oculta |
| Financeiro | ❌ | Oculta |

### 6.4 Corretor (Full)

| Aba | Visível | Conteúdo |
|---|---|---|
| Resumo | ❌ | Mantém workspace pessoal; não recebe central executiva |
| Comercial | ❌ | Oculta |
| Equipe | ❌ | Oculta |
| Unidades | ❌ | Oculta |
| Financeiro | ❌ | Oculta |

→ Para corretor, o dashboard continua mostrando `BrokerWorkspace` (lista pessoal de leads). As abas de relatorios NÃO aparecem.

### 6.5 Marketing

| Aba | Visível | Conteúdo |
|---|---|---|
| Resumo | ❌ | Mantém dashboard de marketing; não recebe central executiva |
| Comercial | ❌ | Oculta |
| Equipe | ❌ | Oculta |
| Unidades | ❌ | Oculta |
| Financeiro | ❌ | Oculta |

---

## 7. Plano de Implementação

### Fase 1: Criar Aba "Resumo" (Prioridade Alta)

| Passo | Arquivo | Descrição |
|---|---|---|
| 1.1 | `dashboard/page.tsx` e resolvedor de dados | Resolver `tab` e `period` no servidor, validando aba contra papel e capability |
| 1.2 | `dashboard/_components/dashboard-tabs.tsx` | Componente de tabs com links internos para `/dashboard?tab=...&period=...`; URL é a fonte de verdade |
| 1.3 | Criar `dashboard/_components/resumo-tab.tsx` | Timeline + KpiComparisonCards (4-5 cards com delta) + AttentionSection + FunnelSection compacto |
| 1.4 | Substituir `StatCard` por `KpiComparisonCard` | Importar de `relatorios/_components/kpi-comparison-card.tsx` |

### Fase 2: Criar Aba "Comercial" (Prioridade Alta)

| Passo | Arquivo | Descrição |
|---|---|---|
| 2.1 | Criar `dashboard/_components/comercial-dashboard-tab.tsx` | Adaptar `CommercialTab` do relatorios para usar dados do dashboard |
| 2.2 | Adicionar `getCommercialBySource` ao `executive-dashboard-data.ts` | Buscar dados de canal apenas quando aba Comercial é ativa (lazy) |
| 2.3 | Integrar `FunnelSection` completo | Versão com 8 estágios, cores e % progressão |

### Fase 3: Criar Abas "Equipe" e "Unidades" (Prioridade Média)

| Passo | Arquivo | Descrição |
|---|---|---|
| 3.1 | Criar `dashboard/_components/equipe-dashboard-tab.tsx` | Adaptar `TeamTab` do relatorios |
| 3.2 | Criar `dashboard/_components/unidades-dashboard-tab.tsx` | Adaptar `UnitsTab` do relatorios |
| 3.3 | Lazy loading | Carregar dados de equipe/unidades apenas ao clicar na aba |

### Fase 4: Criar Aba "Financeiro" (Prioridade Média)

| Passo | Arquivo | Descrição |
|---|---|---|
| 4.1 | Criar `dashboard/_components/financeiro-dashboard-tab.tsx` | Adaptar `FinancialTab` do relatorios com accordion |
| 4.2 | Adicionar `getFinancialOverview` ao `executive-dashboard-data.ts` | Condicional a `ver_relatorios_financeiros` |
| 4.3 | Implementar accordion para tabelas | Por unidade (expandida), por corretor (colapsada), por canal (colapsada) |

### Fase 5: Redirect e Limpeza (Prioridade Alta)

| Passo | Arquivo | Descrição |
|---|---|---|
| 5.1 | `app/(dashboard)/relatorios/page.tsx` | Manter rota atual sob feature flag até comprovar paridade; depois usar redirect reversível para `/dashboard?tab=X` |
| 5.2 | `corretop-sidebar.tsx` | Remover link separado somente após a flag estar estável e a compatibilidade confirmada |
| 5.3 | `executive-dashboard.tsx` | Remover botão "Abrir Central de Relatórios" |
| 5.4 | `command-palette.tsx` | Atualizar busca para refletir novas abas |

### Fase 6: Validação (Prioridade Alta)

| Passo | Descrição |
|---|---|
| 6.1 | Testar todas as abas por perfil (Diretor, Gerente, Supervisor, Corretor, Marketing) |
| 6.2 | Verificar que `/relatorios?tab=X` redireciona corretamente |
| 6.3 | Validar lazy loading (dados carregam apenas ao clicar na aba) |
| 6.4 | Testar preservação de período entre abas |
| 6.5 | Verificar mobile (abas com scroll horizontal) |
| 6.6 | Testar bookmarks/URLs antigas |
| 6.7 | Executar `npm run agent:verify --level full` |

---

## 7A. Sequência corrigida de implementação

As fases 1–6 acima descrevem a intenção de composição. Esta sequência define a ordem
que pode ser executada sem violar o contrato:

| Ordem | Entrega | Condição de saída |
|---|---|---|
| 0 | Fechar UX-1C | Rail validada por papel, teclado e viewport estreito; resultado registrado no Controle |
| 1 | Contrato de abas e rollout | Parser server-side de `tab`/`period`, matriz de acesso, flag específica e auditoria definidos antes da UI |
| 2 | Extração reutilizável | Componentes de relatórios movidos para `src/features/reports/components/`, sem importar UI de uma rota para outra |
| 3 | Resumo e Comercial | Apenas métricas canônicas existentes, carregadas por aba ativa e com estados completos |
| 4 | Equipe, Unidades e Financeiro | Paridade por perfil/capability e exportação financeira separada da permissão de visualização |
| 5 | Canário e compatibilidade | Flag ativada de forma reversível, paridade mensurada, `/relatorios` ainda acessível |
| 6 | Consolidação da navegação | Redirect temporário, rail e command palette só após o canário; remover código legado somente em etapa posterior |
| Futuro | Atendimento e Metas | Executar apenas depois de fechar `GAP-UX1D-001` e `GAP-UX1D-002` |

Não há autorização nesta etapa para introduzir filtros globais sem semântica de dados,
adicionar tabs de Atendimento/Metas, alterar permissões ou apagar `/relatorios`.

---

## 8. Antes vs Depois — Comparação Visual

### ANTES (Hoje)

```
┌─ SIDEBAR ──────────────┐  ┌─ /dashboard ─────────────────────────┐
│ 📊 Dashboard           │  │ Visão Executiva                      │
│ 📈 Relatórios     ←────│──│ [Visão Geral] [Leads] [Equipe] ...  │
│ 💬 Atendimento         │  │                                      │
│ ...                    │  │ 4 KPI cards (sem delta)              │
│                        │  │ Gráfico timeline                     │
│                        │  │ Alertas (lista simples)              │
│                        │  │ Funil (barras simples)               │
│                        │  │ Tabela unidade (top 6)               │
│                        │  │ Tabela equipe (top 6)                │
│                        │  │                                      │
│                        │  │ [Botão: "Abrir Central de Relatórios"]│
└────────────────────────┘  └──────────────────────────────────────┘

         ↓ Usuário clica "Equipe" → NAVEGA PARA FORA

┌─ /relatorios?tab=team ──────────────────────────────────────────┐
│ Gestão Comercial > Relatórios                    [📅 30 dias]   │
│ [Visão geral] [Comercial] [Equipe] [Unidades] [Financeiro]     │
│                                                                 │
│ Tabela completa de equipe (recebidos, convertidos, SLA...)     │
└─────────────────────────────────────────────────────────────────┘
```

### DEPOIS (Proposto)

```
┌─ SIDEBAR ──────────────┐  ┌─ /dashboard ─────────────────────────┐
│ 📊 Painel              │  │ Visão Executiva        [📅 30 dias]  │
│ 💬 Atendimento         │  │                                      │
│ 🎯 Roteamento & IA     │  │ [Resumo] [Comercial] [Equipe] ...   │
│ 📈 Relatórios     ←────│──│ ────────────────────────────────────│
│ ⚙️ Sistema             │  │                                      │
│                        │  │ ╔══════════════════════════════════╗ │
│ (Relatórios é aba do   │  │ ║ Timeline: entradas vs conversões║ │
│  Painel, não rota      │  │ ║ [AreaChart com gradientes]      ║ │
│  separada na sidebar)  │  │ ╚══════════════════════════════════╝ │
│                        │  │                                      │
│                        │  │ ┌─KPI─┐ ┌─KPI─┐ ┌─KPI─┐ ┌─KPI─┐  │
│                        │  │ │42   │ │12%  │ │8    │ │R$24k│  │
│                        │  │ │leads│ │conv │ │vendas│ │receita│ │
│                        │  │ │+10%↑│ │+3%↑ │ │-2 ↓ │ │+15%↑│  │
│                        │  │ └─────┘ └─────┘ └─────┘ └─────┘  │
│                        │  │                                      │
│                        │  │ ┌─ Alertas ──────────────────────┐  │
│                        │  │ │ ⚠️ 3 leads parados > 24h       │  │
│                        │  │ │ ⚠️ 5 sem primeiro contato (SLA)│  │
│                        │  │ └────────────────────────────────┘  │
│                        │  │                                      │
│                        │  │ ┌─ Funil (compacto) ─────────────┐  │
│                        │  │ │ Novo ████████████░░ 42          │  │
│                        │  │ │ Contato ██████░░░░ 28           │  │
│                        │  │ │ Cotação ███░░░░░░░ 12           │  │
│                        │  │ └────────────────────────────────┘  │
└────────────────────────┘  └──────────────────────────────────────┘

         ↓ Usuário clica "Equipe" → FICA NO DASHBOARD

┌─ /dashboard?tab=team ──────────────────────────────────────────┐
│ Visão Executiva               [📅 30 dias]                     │
│ [Resumo] [Comercial] [Equipe] [Unidades] [Financeiro]         │
│ ─────────────────────────────────────────────────────────────  │
│                                                                │
│ Desempenho da equipe • Últimos 30 dias                         │
│ ┌──────────┬────────┬──────────┬───────┬───────┬────────┬─────┐│
│ │ Corretor │Recebid.│Convertid.│Conver.│ SLA   │Parados │Vend.││
│ ├──────────┼────────┼──────────┼───────┼───────┼────────┼─────┤│
│ │ Ana Silva│   42   │    8     │ 19.0% │ 92.1% │   0    │  5  ││
│ │ João Souz│   38   │    5     │ 13.2% │ 78.4% │   3⚠️  │  3  ││
│ │ Maria..  │   35   │    7     │ 20.0% │ 88.5% │   1    │  4  ││
│ └──────────┴────────┴──────────┴───────┴───────┴────────┴─────┘│
│                                                                │
│ Conversão média: 17.4% | Acima da média: 2 | Abaixo: 1        │
└────────────────────────────────────────────────────────────────┘
```

---

## 9. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Performance ao carregar dados de todas as abas | Médio | Lazy loading: carregar dados apenas ao clicar na aba. Resumo sempre carrega; Comercial/Equipe/Unidades/Financeiro são sob demanda |
| Confusão de usuários com a mudança | Médio | Manter redirect de `/relatorios` → `/dashboard`. Não remover a rota, apenas redirecionar |
| Aba Financeiro visível para quem não deveria | Alto | `hasCapability` verificado no servidor antes de renderizar. Se não tem permissão, aba não aparece |
| Timeline desaparece ao mudar de aba | Baixo | Timeline fica fixa no Resumo — é o "anchor visual" do dashboard |
| URLs antigas quebradas | Médio | Compatibilidade por feature flag e redirect reversível após paridade |
| Sobrecarga visual no mobile | Médio | Abas com scroll horizontal. Em telas < 640px, mostrar apenas 3 abas visíveis + "Ver mais" |

---

## 10. Checklist de Decisões de UX

| Decisão | Recomendação | Justificativa |
|---|---|---|
| Timeline fica em qual aba? | **Resumo** | É informação de "awareness", não de "análise" |
| Funil em quantas abas? | **Resumo (compacto) + Comercial (completo)** | Resumo dá overview; Comercial dá profundidade |
| Alertas de atenção em quantas abas? | **Resumo + Comercial** | São críticos para ambos os contextos |
| Tabelas com sorting? | **Equipe e Unidades** | Permite identificar rapidamente outliers |
| Financeiro com accordion? | **Sim** | Tabelas financeiras são consultadas, não operadas — accordion reduz sobrecarga |
| Exportação CSV em qual aba? | **Financeiro** | É a ação mais comum em dados financeiros |
| Período compartilhado entre abas? | **Sim** | `?period=X` na URL afeta todas as abas — consistência |
| Botão "Abrir Relatórios" existe? | **Não** | Relatórios é aba do dashboard, não rota separada |

---

## 11. Conclusão

A absorção de `/relatorios` nas tabs do `/dashboard` resolve simultaneamente:

1. **Duplicação de dados** — eliminar 70% de sobreposição entre duas rotas
2. **Navegação quebrada** — tabs que hoje navegam para fora passam a renderizar conteúdo real
3. **Informação incompleta** — dashboard passa a mostrar tabelas completas, deltas de comparação e desempenho por canal
4. **UX fragments** — uma única home canônica para inteligência operacional
5. **Carga cognitiva** — progressive disclosure via abas (Resumo → Comercial → Equipe → Unidades → Financeiro)

O `/relatorios` vira uma rota de redirect (preservando URLs antigas), mas sem presença na sidebar. O dashboard é o único entry point para dados e métricas.

---

## 12. Contrato de Conclusão da Implementação

Esta implementação só pode ser declarada concluída quando cumprir integralmente o
Contrato de Redesign, em especial o **Contrato de simplicidade máxima**.

### Critérios inegociáveis

- `/dashboard` é a única Home de inteligência para perfis executivos; as abas são
  reais e usam `tab` e `period` na URL.
- Nenhuma aba é um link disfarçado para outra rota. Não haverá botão para abandonar a
  central e abrir uma rota concorrente de relatórios.
- Cada métrica, funil, alerta e tabela terá uma única representação principal. O
  Resumo poderá exibir preview compacto, mas a análise completa será aberta na aba
  interna correspondente.
- A tela terá uma ação primária por contexto, sem cards decorativos, sem painéis
  redundantes e sem colunas que não mudem uma decisão.
- Componentes visuais serão extraídos para `src/features/reports/components/` e
  reutilizados; o Dashboard não importará componentes de uma rota de `relatorios`.
- Métricas continuam exclusivamente em `metrics-service.ts`; nenhuma métrica será
  recalculada no cliente ou com escopo recebido do navegador.
- A aba selecionada e os dados elegíveis serão resolvidos no servidor a partir de
  sessão, capability, unidade e equipe. Financeiro exige `ver_relatorios_financeiros`;
  exportação exige `exportar_relatorios`.
- Dados são carregados apenas para a aba ativa. Não haverá pré-carregamento de equipe,
  unidades ou financeiro na aba Resumo.
- `/relatorios` permanece compatível atrás de feature flag até haver paridade provada;
  a migração começa reversível e auditável, sem redirect permanente imediato.

### Evidência mínima de aceite

| Dimensão | Evidência exigida |
|---|---|
| Simplificação | Inventário antes/depois mostra remoção de duplicações e ausência de tabs-links |
| Dados | Paridade de valores entre a experiência anterior e o Dashboard por período e perfil |
| Segurança | Testes de tenant, papel, unidade e capabilities financeiras no servidor |
| Estados | Carregamento, vazio, erro, indisponível e acesso negado revisados para cada aba aplicável |
| Acessibilidade | Teclado, foco, semântica, contraste, zoom, viewport estreito e reduced motion revisados |
| Reversibilidade | Feature flag, auditoria de mudança e retorno à rota anterior comprovados |
| Qualidade | Testes focados, typecheck, build e revisão visual autenticada registrados |

Falhar em qualquer item mantém UX-1D como `PARTIAL`; não é permitido compensar a
pendência com mudança puramente cosmética.

*Documento gerado para a etapa UX-1D — Dashboard unificado.*
