# Relatório & Plano de Reorganização da Sidebar — Âncora CRM

**Data:** 2026-09-04  
**Etapa:** UX-1C — Sidebar & Navigation Restructure  
**Status:** NOT_STARTED → PLANEJADO  
**Fonte:** Auditoria completa do código-fonte, NAVIGATION_MAP.md, UX_REDESIGN_CONTROL.md

---

## 1. Situação Atual — Inventário Completo

### 1.1 Rotas Ativas no App (89 páginas)

| Domínio | Rotas Principais | Rotas de Suporte/Deep | Total |
|---|---|---|---|
| **Auth** | `/login`, `/2fa`, `/recuperar-senha`, `/verify` | `/admin/login`, `/invite/accept`, `/access-denied` | 7 |
| **Dashboard** | `/dashboard`, `/welcome` | `/guia`, `/guia/webhook`, `/notificacoes` | 5 |
| **Leads** | `/leads`, `/leads/[id]` | `/leads/[id]/feedback`, `/leads/distribuicao`, `/leads/distribuicao/plantao`, `/minha-fila` | 6 |
| **Conversas** | `/conversas`, `/conversas/broker` | — | 2 |
| **Vendas** | `/vendas`, `/vendas/[id]` | `/propostas`, `/assinatura` | 4 |
| **Documentos** | `/documentos` | — | 1 |
| **Clientes** | `/clientes`, `/clientes/[clientId]` | `/empresas` | 3 |
| **Distribuição** | `/distribuicao` | `/leads/distribuicao/plantao` | 1+ |
| **Qualificação IA** | `/qualificacao` | — | 1 |
| **Marketing** | `/marketing/campanhas`, `/marketing/campanhas/[id]` | `/marketing/importacoes`, `/marketing/meta` | 4 |
| **Equipe** | `/equipe`, `/equipe/[id]` | `/equipe/cargos`, `/equipe/convidar`, `/equipe/recuperacoes` | 5 |
| **Filiais/Unidades** | `/filiais`, `/unidades/[branchId]` | — | 2 |
| **Relatórios** | `/relatorios`, `/relatorios/drill/[drillId]` | — | 2 |
| **Settings** | `/settings`, `/settings/whatsapp` | `/settings/extension`, `/settings/feedback-templates`, `/settings/integrations`, `/settings/meta`, `/settings/waha-diagnostic` | 7 |
| **Integrações** | `/integrations`, `/integrations/whatsapp`, `/integrations/meta` | — | 3 |
| **Financeiro** | `/financeiro` (sidebar dedicada) | `/financeiro/*` (13+ sub-rotas) | 14+ |
| **Outros** | `/noc`, `/roadmap`, `/integridade`, `/fluxos-whatsapp` | `/internal/design-system/*`, `/compartilhado/[token]`, `/onboarding`, `/primeiro-acesso`, `/termos` | 8+ |
| **Super Admin** | `/super-admin/*` (9 rotas) | `/super-dev/*` (6 rotas) | 15+ |

### 1.2 Sidebars Existentes (5 Implementações)

| Sidebar | Arquivo | Rotas Visíveis | Qtd Itens |
|---|---|---|---|
| **Principal (CorreTop)** | `corretop-sidebar.tsx` | 13 itens em 4 seções | 13 |
| **Financeiro** | `corretop-financeiro-sidebar.tsx` | 11 itens em 5 grupos colapsáveis | 11 |
| **Corretor (Light)** | `corretor-sidebar.tsx` | 6 itens (flat) | 6 |
| **Platform Admin** | `platform-admin-sidebar.tsx` | 12 itens + 4 locked | 16 |
| **Super Dev** | `super-dev-sidebar.tsx` | 6 itens | 6 |

### 1.3 Sidebar Principal Atual — Análise Crítica

```
┌─────────────────────────────────────────────┐
│  VISÃO GERAL                                │
│    ├─ Dashboard                              │
│    └─ Relatórios                             │
│  OPERAÇÃO COMERCIAL                         │
│    ├─ Conversas & WhatsApp                   │
│    ├─ Leads                                  │
│    ├─ Vendas                                 │
│    └─ Documentos                             │
│  ROTEAMENTO & INTELIGÊNCIA                  │
│    ├─ Campanhas de Marketing                 │
│    ├─ Distribuição & Desempenho              │
│    └─ Robô de Qualificação IA                │
│  ESTRUTURA & CONEXÕES                       │
│    ├─ Equipe                                 │
│    ├─ Unidades                               │
│    ├─ Entrada & Integrações                  │
│    └─ Configurações                          │
│                                             │
│  ─────────────────────────────────────────── │
│  ⚡ Agente IA (Ctrl+J)                       │
│  [Avatar] Usuário                           │
└─────────────────────────────────────────────┘
```

**Problemas identificados:**
1. 4 seções → 13 itens — excesso de carga cognitiva
2. "Vendas" e "Documentos" não deveriam ser itens de sidebar separados
3. "Campanhas de Marketing" é verboso para uma sidebar
4. "Distribuição & Desempenho" e "Robô de Qualificação IA" são operacionalmente próximos mas separados
5. Não há agrupamento semântico claro entre "operacional" e "administrativo"
6. Itens que só aparecem para gerentes/diretores misturados com itens de corretor

---

## 2. Mapeamento de Funcionalidades por Importância

### 2.1 Classificação de Importância

| Nível | Critério | Funcionalidades |
|---|---|---|
| **CRÍTICO** (diário) | Usado múltiplas vezes por dia, sem ele a operação para | Dashboard, Leads/Minha Fila, Conversas WhatsApp, Distribuição (plantão) |
| **IMPORTANTE** (semanal) | Usado semanalmente para gestão ou operação avançada | Relatórios, Marketing/Campanhas, Qualificação IA, Equipe |
| **OPERACIONAL** (sob demanda) | Configuração ou consulta pontual | Settings, Integrações, Documentos, Filiais/Unidades |
| **ADMINISTRATIVO** | Acesso restrito a gestão/admin | Financeiro, NOC, Roadmap, Integridade |

### 2.2 Função de Cada Rota

| Rota | Função | Acessa Quem? | Frequência |
|---|---|---|---|
| `/dashboard` | Visão executiva, KPIs, próximo lead | Todos | Diário |
| `/leads` | Pipeline de oportunidades, criação, filtros | Corretor+, Gestão | Diário |
| `/minha-fila` | Fila pessoal do corretor (touch-first) | Corretor | Diário |
| `/conversas` | Central de atendimento WhatsApp 3-pane | Corretor+, Gestão | Diário |
| `/distribuicao` | Regras de roleta, plantão ao vivo | Gestão | Diário |
| `/vendas` | Fechamentos e apólices concluídas | Corretor+, Gestão | Semanal |
| `/documentos` | Repositório de anexos e propostas | Corretor+ | Sob demanda |
| `/marketing/campanhas` | Gestão de campanhas Meta | Marketing, Diretor | Semanal |
| `/qualificacao` | Agente IA, templates Meta, simulador | Diretor, Gerente | Semanal |
| `/equipe` | Colaboradores, cargos, convites | Gestão | Quinzenal |
| `/filiais` | Unidades físicas e regionais | Diretor | Mensal |
| `/relatorios` | Métricas, inteligência comercial | Gestão | Semanal |
| `/integrations` | Catálogo de conexões (WAHA, Meta, etc.) | Diretor | Mensal |
| `/settings` | Preferências pessoais e do tenant | Todos | Mensal |
| `/clientes` | Base de clientes consolidada | Corretor+ | Semanal |
| `/propostas` | Propostas geradas | Corretor+ | Sob demanda |
| `/noc` | Monitoramento de operações | Diretor | Sob demanda |
| `/roadmap` | Roadmap de desenvolvimento | Diretor | Mensal |

---

## 3. Proposta — Sidebar com 5 Grupos, Máximo 5 Itens

### 3.1 Princípio de Design

```
REGRAS PARA A NOVA SIDEBAR:
  1. Máximo 5 itens de navegação na sidebar
  2. Cada item = 1 domínio funcional (pode ter sub-rotas internas via tabs)
  3. Itens são agrupados em seções visuais com separadores sutis
  4. "Plantão ao vivo" permanece como badge/alerta acima do menu (quando ativo)
  5. "Agente IA" permanece no footer (atalho global)
  6. Avatar/perfil permanece no footer
```

### 3.2 Organização Proposta — 5 Itens, 5 Grupos Lógicos

```
┌──────────────────────────────────────────────┐
│  [Logo / Branding]                           │
│  [⚡ Plantão ao vivo] (quando ativo)          │
│                                              │
│  ── OPERAÇÃO ─────────────────────────────── │
│  📊  Painel                                 │
│      → /dashboard (Home Canônica)            │
│      → /leads, /minha-fila, /clientes       │
│      → /vendas, /documentos, /propostas     │
│                                              │
│  💬  Atendimento                            │
│      → /conversas (Home Canônica)           │
│      → /conversas/broker                    │
│                                              │
│  ── INTELIGÊNCIA ─────────────────────────── │
│  🎯  Roteamento & IA                        │
│      → /distribuicao (Home Canônica)        │
│      → /qualificacao                        │
│      → /marketing/campanhas                 │
│                                              │
│  📈  Relatórios                             │
│      → /relatorios (Home Canônica)          │
│                                              │
│  ── ADMINISTRAÇÃO ────────────────────────── │
│  ⚙️  Sistema                                │
│      → /equipe (Home Canônica)              │
│      → /filiais                             │
│      → /integrations                        │
│      → /settings                            │
│                                              │
│  ──────────────────────────────────────────── │
│  ⚡ Agente IA (Ctrl+J)                       │
│  [Avatar] Usuário / Sair                    │
└──────────────────────────────────────────────┘
```

### 3.3 Detalhamento por Item

#### 📊 ITEM 1 — Painel (Visão Geral & Operação)

| Campo | Valor |
|---|---|
| **Rota Home** | `/dashboard` |
| **Rotas internas** | `/leads`, `/minha-fila`, `/clientes`, `/vendas`, `/documentos`, `/propostas` |
| **Navegação interna** | `PageTabs` ou links secundários na página |
| **Acessa** | Todos os perfis |
| **Importância** | CRÍTICO — usada diariamente por todos |
| **Justificativa** | Consolidar dashboard + pipeline + clientes + vendas em uma única aba "Painel". O `/dashboard` é a home canônica; leads, fila e clientes ficam acessíveis via tabs internas ou quick-nav dentro do painel. |

**Como funciona a navegação interna:**
- Na rota `/dashboard`, o PageHeader exibe tabs: `Visão Geral | Leads | Minha Fila | Clientes | Vendas`
- Cada tab carrega o conteúdo da rota correspondente via lazy loading
- A URL preserva o contexto: `/dashboard?tab=leads`, `/dashboard?tab=clients`
- Para corretor no modo Light, apenas `Visão Geral` e `Minha Fila` ficam visíveis

#### 💬 ITEM 2 — Atendimento

| Campo | Valor |
|---|---|
| **Rota Home** | `/conversas` |
| **Rotas internas** | `/conversas/broker` |
| **Navegação interna** | `PageTabs` — `Todas as Conversas | Meus Insights` |
| **Acessa** | Corretor+, Gestão (conforme permissão `acessar_conversas`) |
| **Importância** | CRÍTICO — canal de comunicação primário |
| **Justificativa** | O atendimento WhatsApp é o coração operacional. Uma aba dedicada garante acesso rápido sem competir com outras funções. |

**Como funciona:**
- `/conversas` = visão consolidada (lista + chat + drawer)
- `/conversas/broker` = aba "Meus Insights" com análise personalizada
- No mobile: interface 1-pane com navegação deslizante

#### 🎯 ITEM 3 — Roteamento & IA (Inteligência)

| Campo | Valor |
|---|---|
| **Rota Home** | `/distribuicao` |
| **Rotas internas** | `/qualificacao`, `/marketing/campanhas` |
| **Navegação interna** | `PageTabs` — `Distribuição | Qualificação IA | Campanhas` |
| **Acessa** | Diretor, Gerente, Supervisor |
| **Importância** | IMPORTANTE — usada semanalmente por gestão |
| **Justificativa** | Unifica as 3 funcionalidades de "roteamento inteligente": distribuição de leads, qualificação por IA e campanhas de aquisição. São processos complementares de um mesmo pipeline de entrada. |

**Como funciona:**
- Tab `Distribuição`: filas, regras de roleta, plantão ao vivo (`/distribuicao`)
- Tab `Qualificação IA`: agente inteligente, playbooks, templates Meta (`/qualificacao`)
- Tab `Campanhas`: gestão de campanhas Meta, importações (`/marketing/campanhas`)
- A URL preserva: `/distribuicao?tab=qualification`, `/distribuicao?tab=campaigns`

#### 📈 ITEM 4 — Relatórios

| Campo | Valor |
|---|---|
| **Rota Home** | `/relatorios` |
| **Rotas internas** | `/relatorios/drill/[drillId]` |
| **Navegação interna** | `PageTabs` — `Visão Geral | Comercial | Equipe | Unidades | Financeiro` |
| **Acessa** | Diretor, Gerente |
| **Importância** | IMPORTANTE — usada semanalmente |
| **Justificativa** | Já é uma rota bem estruturada. Não precisa mudar, apenas garantir que o conteúdo interno use as tabs do mapa de navegação. |

#### ⚙️ ITEM 5 — Sistema (Administração)

| Campo | Valor |
|---|---|
| **Rota Home** | `/equipe` |
| **Rotas internas** | `/filiais`, `/integrations`, `/settings/*` |
| **Navegação interna** | `PageTabs` — `Equipe | Unidades | Integrações | Configurações` |
| **Acessa** | Conforme permissão (gestão para equipe/filiais, todos para settings pessoais) |
| **Importância** | OPERACIONAL — acesso sob demanda |
| **Justificativa** | Agrupa tudo que é "configuração/estrutura" em uma única aba. Reduz a dispersão de 4 itens em 1. |

**Como funciona:**
- Tab `Equipe`: lista de membros, cargos, convites (`/equipe`)
- Tab `Unidades`: filiais e unidades regionais (`/filiais`)
- Tab `Integrações`: conexões WhatsApp, Meta, webhooks (`/integrations`)
- Tab `Configurações`: preferências do tenant e pessoais (`/settings`)
- A URL preserva: `/equipe?tab=units`, `/equipe?tab=integrations`, `/equipe?tab=settings`

---

## 4. Matriz de Visibilidade por Cargo

| Item Sidebar | Diretor | Gerente | Corretor (Full) | Corretor (Light) | Marketing |
|---|---|---|---|---|---|
| 📊 Painel | ✅ | ✅ | ✅ | ✅ (aba Visão Geral + Minha Fila) | ✅ (apenas Campanhas) |
| 💬 Atendimento | ✅ | ✅ | ✅ | ✅ | ❌ |
| 🎯 Roteamento & IA | ✅ | ✅ (parcial) | ❌ | ❌ | ❌ |
| 📈 Relatórios | ✅ | ✅ | ❌ | ❌ | ❌ |
| ⚙️ Sistema | ✅ | ✅ (parcial) | ❌ (apenas Settings) | ❌ | ❌ |

---

## 5. Mapeamento de Rotas Existentes → Nova Organização

| Rota Atual | Nova Posição | Método de Acesso |
|---|---|---|
| `/dashboard` | Painel — Home Canônica | Link direto na sidebar |
| `/leads` | Painel — Tab "Leads" | Tab interna no Painel |
| `/minha-fila` | Painel — Tab "Minha Fila" | Tab interna no Painel |
| `/clientes` | Painel — Tab "Clientes" | Tab interna no Painel |
| `/vendas` | Painel — Tab "Vendas" | Tab interna no Painel |
| `/vendas/[id]` | Painel — Deep link | URL direta preservada |
| `/documentos` | Painel — Tab "Documentos" | Tab interna no Painel |
| `/propostas` | Painel — Sub-aba de Vendas | Dentro da aba Vendas |
| `/assinatura` | Painel — Fluxo de Vendas | Deep link preservado |
| `/conversas` | Atendimento — Home Canônica | Link direto na sidebar |
| `/conversas/broker` | Atendimento — Tab "Insights" | Tab interna no Atendimento |
| `/distribuicao` | Roteamento & IA — Tab "Distribuição" | Tab interna |
| `/leads/distribuicao/plantao` | Roteamento & IA — Deep link | URL preservada |
| `/qualificacao` | Roteamento & IA — Tab "Qualificação IA" | Tab interna |
| `/marketing/campanhas` | Roteamento & IA — Tab "Campanhas" | Tab interna |
| `/marketing/importacoes` | Roteamento & IA — Sub-aba dentro de Campanhas | Deep link |
| `/marketing/meta` | Roteamento & IA — Sub-aba dentro de Campanhas | Deep link |
| `/relatorios` | Relatórios — Home Canônica | Link direto na sidebar |
| `/relatorios/drill/[drillId]` | Relatórios — Deep link | URL preservada |
| `/equipe` | Sistema — Tab "Equipe" | Tab interna |
| `/equipe/[id]` | Sistema — Deep link | URL preservada |
| `/equipe/cargos` | Sistema — Sub-aba dentro de Equipe | Deep link |
| `/equipe/convidar` | Sistema — Ação dentro de Equipe | Botão no PageHeader |
| `/filiais` | Sistema — Tab "Unidades" | Tab interna |
| `/unidades/[branchId]` | Sistema — Deep link | URL preservada |
| `/integrations` | Sistema — Tab "Integrações" | Tab interna |
| `/integrations/whatsapp` | Sistema — Deep link | URL preservada |
| `/integrations/meta` | Sistema — Deep link | URL preservada |
| `/settings` | Sistema — Tab "Configurações" | Tab interna |
| `/settings/*` | Sistema — Deep links preservados | URLs mantidas |
| `/noc` | ⚠️ A ser decidido (manter como rota oculta ou mover para Relatórios) | — |
| `/roadmap` | ⚠️ A ser decidido (manter como rota oculta ou mover para Sistema) | — |
| `/integridade` | ⚠️ A ser decidido (manter como rota oculta ou mover para Sistema) | — |

---

## 6. Rotas Sem Sidebar (Manter como Rotas Ocultas/Deep)

Estas rotas existem mas não precisam de sidebar — são acessadas via deep link, notificações ou fluxos internos:

| Rota | Motivo da Exclusão da Sidebar |
|---|---|
| `/welcome` | Fluxo de boas-vindas (1 vez) |
| `/guia`, `/guia/webhook` | Guias de configuração (onboarding) |
| `/notificacoes` | Acessada via sino/notificação no header |
| `/clientes/[clientId]` | Deep link do Painel |
| `/leads/[id]` | Deep link do Painel |
| `/leads/[id]/feedback` | Deep link dentro do lead |
| `/propostas` | Fluxo dentro de Vendas |
| `/assinatura` | Fluxo dentro de Vendas |
| `/fluxos-whatsapp` | Configuração avançada (acessível via Integrações) |
| `/marketing/campanhas/[id]` | Deep link dentro de Campanhas |
| `/compartilhado/[token]` | Link externo compartilhado |
| `/onboarding`, `/primeiro-acesso`, `/termos` | Fluxos de entrada |

---

## 7. Sidebars Auxiliares — Manter ou Unificar?

### 7.1 Sidebar Financeiro (`CorreTopFinanceiroSidebar`)

**Recomendação: MANTER separada** com ajustes.

O módulo financeiro é um "mini-app" dedicado com 14+ sub-rotas e linguagem própria. Manter uma sidebar dedicada com 5 grupos colapsáveis:

```
💰 FINANCEIRO
  ├─ Visão Geral (Dashboard, Fluxo, Extrato)
  ├─ Comissões (Comissões, Repasses, Taxas)
  ├─ Metas (Financeiras, Resultado/Corretor, Comissionamento)
  ├─ Relatórios (Relatórios, Exportar, Cronograma)
  └─ Configurações
```

→ Já implementado com 5 grupos colapsáveis. **Nenhuma mudança necessária.**

### 7.2 Sidebar Platform Admin (`PlatformAdminSidebar`)

**Recomendação: MANTER separada** — é um ambiente de super-administração, não está no fluxo do usuário normal.

Manter como está, mas organizar melhor:

```
🛡️ SUPER ADMIN
  ├─ Painel Geral (Overview, Empresas, Onboarding, Materiais)
  ├─ WhatsApp (Oficial, Revisão)
  ├─ Segurança (Auditoria, Sessões, Parâmetros)
  └─ Em preparação (locked items)
```

### 7.3 Sidebar Corretor (`CorretorSidebar`)

**Recomendação: MANTER separada** — é uma sidebar simplificada para o modo do corretor.

Manter flat com 5-6 itens:

```
🏠 CORRETOR
  ├─ Dashboard
  ├─ Conversas & WhatsApp
  ├─ Meus Leads
  ├─ Minha Fila
  ├─ Documentos
  └─ Meu Perfil
```

→ Já está alinhado com a proposta. **Ajuste menor: remover "Minha Fila" duplicada ou integrar com "Meus Leads"** (decisão de produto).

### 7.4 Sidebar Super Dev (`SuperDevSidebar`)

**Recomendação: MANTER separada** — é um ambiente de desenvolvimento.

Manter como está com 6 itens em 1 grupo. **Nenhuma mudança necessária.**

---

## 8. Plano de Implementação — UX-1C

### Fase 1: Refatorar a Sidebar Principal (Prioridade Alta)

| Passo | Arquivo | Descrição |
|---|---|---|
| 1.1 | `corretop-sidebar.tsx` | Reduzir `navSections` de 4 seções/13 itens para 5 itens em 3 grupos visuais |
| 1.2 | `corretop-sidebar.tsx` | Implementar navegação por tabs internas para cada item com sub-rotas |
| 1.3 | `app-shell.tsx` | Garantir que o shell suporte o novo padrão de tabs |
| 1.4 | Criar componente `SidebarNavItem` | Componente reutilizável que mostra item + indicador de sub-rotas |

### Fase 2: Criar Páginas de Aba Internas (Prioridade Alta)

| Passo | Rota | Descrição |
|---|---|---|
| 2.1 | `/dashboard` | Adicionar `PageTabs` com abas: Visão Geral, Leads, Minha Fila, Clientes, Vendas |
| 2.2 | `/conversas` | Adicionar `PageTabs` com abas: Todas, Meus Insights |
| 2.3 | `/distribuicao` | Adicionar `PageTabs` com abas: Distribuição, Qualificação IA, Campanhas |
| 2.4 | `/relatorios` | Já tem tabs — validar alinhamento com o mapa |
| 2.5 | `/equipe` | Adicionar `PageTabs` com abas: Equipe, Unidades, Integrações, Configurações |

### Fase 3: Preservar Deep Links (Prioridade Média)

| Passo | Descrição |
|---|---|
| 3.1 | Garantir que todas as URLs existentes continuem funcionando (redirect 301 ou renderização inline) |
| 3.2 | Atualizar `command-palette.tsx` para buscar em todas as sub-rotas |
| 3.3 | Atualizar breadcrumb navigation para refletir a nova hierarquia |

### Fase 4: Atualizar Sidebars Auxiliares (Prioridade Baixa)

| Passo | Descrição |
|---|---|
| 4.1 | Revisar `CorretorSidebar` para alinhar com a proposta |
| 4.2 | Revisar `PlatformAdminSidebar` para organizar melhor os grupos |
| 4.3 | Atualizar `MobileBottomNav` para 4 itens (Painel, Atendimento, Roteamento, Mais) |

### Fase 5: Validação e Testes (Prioridade Alta)

| Passo | Descrição |
|---|---|
| 5.1 | Testar todas as rotas por cargo (Diretor, Gerente, Corretor, Marketing) |
| 5.2 | Verificar deep links e bookmarks existentes |
| 5.3 | Validar mobile (bottom nav + sidebar) |
| 5.4 | Verificar permissões (`hasCapability`) em cada aba |
| 5.5 | Testar modo Light do corretor |
| 5.6 | Executar `npm run agent:verify --level full` |

---

## 9. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Deep links quebrados | Alto | Implementar redirects ou renderização condicional para todas as rotas existentes |
| Complexidade das tabs | Médio | Usar `PageTabs` do componente foundations já validado |
| Performance ao carregar muitas sub-rotas | Médio | Lazy loading por tab, carregar apenas a aba ativa |
| Confusão de usuários com a mudança | Médio | Onboarding in-app para nova navegação, manter URLs antigas funcionando |
| Permissões incorretas nas abas | Alto | Testar `hasCapability` para cada combinação de cargo×aba |

---

## 10. Conclusão

A reorganização proposta reduz a sidebar principal de **13 itens em 4 seções** para **5 itens em 3 grupos visuais**, alinhando-se perfeitamente com:

1. O `NAVIGATION_MAP.md` (5 domínios funcionais)
2. O `UX_REDESIGN_CONTROL.md` (etapa UX-1C autorizada)
3. O `UX_REDESIGN_CONTRACT.md` (progressive disclosure, home canônica por capacidade)
4. As regras de `AI_RULES.md` (máximo 3 ações prioritárias por contexto)

**Resultado esperado:** Sidebar limpa, organizada por domínio, com navegação interna via tabs que preserva todas as funcionalidades existentes sem perda de acesso.

---

*Documento gerado como parte da etapa UX-1C — Sidebar & Navigation Restructure*
