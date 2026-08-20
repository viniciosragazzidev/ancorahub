# Fluxo — Gestor (Perfil Gerencial de Filial)

## Hierarquia

- O Gestor gerencia uma **filial específica** dentro do tenant.
- Pode criar **apenas Corretores**.
- Reporta ao **Diretor**.
- Só vê dados da **própria filial**.

---

## 1. Autenticação e Primeiro Acesso

### Login

`/login` → Formulário de e-mail + senha.

- Após login, consulta `checkOnboardingRedirect`.
- Se onboarding completo → `/dashboard`.
- Se onboarding pendente → `/welcome`.

---

## 2. Navegação Principal (Sidebar)

Layout unificado: `<AppShell>` → `<SidebarProvider>` → `<CorreTopSidebar>` (com itens filtrados) + `<WorkspaceRail>` + `<MobileBottomNav>`.

### Itens visíveis no menu (filtrados por permissão)

#### Operação
| Item | Rota | Descrição |
|------|------|-----------|
| Conversas | `/conversas` | Central de mensagens — **apenas leads da filial** |
| Leads | `/leads` | Fila de oportunidades — **apenas leads da filial** |
| Tarefas | `/tarefas` | Tarefas da filial |
| Cotações | `/cotacoes` | Propostas da filial |
| Documentos | `/documentos` | Gestão documental + aprovação |
| Clientes | `/clientes` | Leads convertidos da filial |
| Vendas | `/vendas` | Vendas realizadas — **apenas filial** |

#### Gestão
| Item | Rota | Descrição |
|------|------|-----------|
| Resumo | `/dashboard` | Dashboard da filial |
| Equipe | `/equipe` | Gestão de membros — **Gestor vê/cria apenas Corretores** |
| Metas | `/metas` | Gerenciar metas (pode criar/editar) |
| Relatórios | `/relatorios` | Relatórios + exportação CSV |
| Distribuição | `/leads/distribuicao` | ⚠️ Distribuição da filial (apenas visualizar corretores) |

#### ❌ Itens **não visíveis** para Gestor
- Filiais (`/filiais`) — exclusivo Diretor
- Catálogo (`/catalogo`) — exclusivo Diretor
- Comissões (`/configuracoes/comissoes`) — exclusivo Diretor
- Assinatura (`/assinatura`) — exclusivo Diretor
- Configurações (`/settings`) — exclusivo Diretor
- Roadmap (`/roadmap`) — exclusivo Diretor

#### Operação
| Item | Rota | Descrição |
|------|------|-----------|
| NOC | `/noc` | Visão operacional da filial |
| Integridade | `/integridade` | Painel de integridade |
| Notificações | `/notificacoes` | Central de notificações |

#### Ajuda
| Item | Rota | Descrição |
|------|------|-----------|
| Guia do sistema | `/guia` | Documentação de uso |

#### Financeiro (subnavegação)
| Item | Rota | Descrição |
|------|------|-----------|
| Dashboard Financeiro | `/financeiro` | Visão geral financeira |
| Fluxo de Caixa | `/financeiro/fluxo-caixa` | ✅ |
| Extrato | `/financeiro/extrato` | ✅ |
| Comissões | `/financeiro/comissoes` | ✅ |
| Repasses | `/financeiro/repasses` | ✅ |
| Taxas & Custos | `/financeiro/taxas` | ✅ |
| Metas Financeiras | `/financeiro/metas` | ✅ |
| Resultado por Corretor | `/financeiro/resultado-corretor` | ✅ |
| Comissionamento | `/financeiro/comissionamento` | ❌ (exclusivo Diretor) |
| Relatórios Financeiros | `/financeiro/relatorios` | ✅ |
| Exportar Dados | `/financeiro/exportar` | ✅ |
| Cronograma de Repasses | `/financeiro/cronograma` | ✅ |
| Configurações Financeiras | `/financeiro/configuracoes` | ❌ (exclusivo Diretor) |

---

## 3. Dashboard da Filial (`/dashboard`)

### Cabeçalho
- "Filial — Operacional"
- Corretores ativos / total
- Total de leads na filial
- Badges: leads novos, não trabalhados

### Seções

1. **Métricas** — 5 cards:
   - Corretores Ativos (+ percentual)
   - Leads Novos (+ percentual do total)
   - Em Atendimento (+ percentual)
   - Não Trabalhados (urgente/ok)
   - Estagnados (atenção/ok)

2. **Visão Geral da Equipe** — barras de progresso:
   - Corretores Ativos
   - Leads Novos
   - Em Atendimento

3. **Alertas** — cards de atenção:
   - Não trabalhados (distribuídos > 15 min)
   - Estagnados (> 3 dias)
   - Sem responsável

4. **Atividades Recentes** — feed

5. **Stats bottom** — resumo numérico

---

## 4. Gestão de Equipe (`/equipe`)

### Acesso
- Permissão: `convidar_corretor`
- Gestor pode **apenas criar Corretores** (não pode criar Gestores)
- Se `branchId` existe → convite já vinculado à filial do Gestor

### Visão
- **Tabela de membros filtrada** — Gestor vê:
  - Todos os membros do tenant (Diretor + outros Gestores) em modo leitura
  - Só pode **editar/gerenciar Corretores da própria filial**

### Ações disponíveis
- **Convidar Corretor** (vinculado automaticamente à filial)
- **Editar Corretor**: nome, e-mail, cargo, filial (apenas da própria filial)
- **Ativar/Desativar** corretor
- **Transferir leads** entre corretores da filial

### Regras de negócio
- `canManageMember`: Gestor pode gerenciar apenas `role === "broker"` com `branchId === context.branchId`
- ❌ Não pode editar/remover Gestores ou Diretores
- ❌ Não pode mudar filial do corretor para fora da sua filial

---

## 5. Leads (`/leads`)

### Escopo de dados
- **Apenas leads da filial** do Gestor (`branchId === context.branchId`)
- Filtro por filial **não aparece** (só vê a própria)

### Funcionalidades
- Filtros: por status, busca por nome/telefone
- Criação manual de lead
- Workspace com tabela

### Detalhes do lead (`/leads/[id]`)
- **LeadManagementActions** — pode reatribuir, assumir atendimento, assumir conversa
- Status selector — pode alterar status (incluindo reabrir lead perdido)
- Ver dados pessoais do lead
- Tarefas, documentos, notas

### Regras de negócio
- `alterar_status_lead`: ✅
- `reabrir_lead_perdido`: ✅
- `management-actions.ts`: Apenas Gestores e Diretores podem gerenciar leads
- Validação: se `lead.branchId !== context.branchId` → erro

---

## 6. Conversas (`/conversas`)

### Escopo
- **Apenas leads da filial** do Gestor
- `canSend: false` — não envia mensagens (função de supervisão)

### Funcionalidades
- Painel de conversas com filtros
- Perfil do cliente (documentos, mídias, resumo)
- Setup tutorial do WhatsApp

---

## 7. Gestão Financeira (`/financeiro`)

### Permissões do Gestor
| Funcionalidade | Acesso |
|----------------|--------|
| Dashboard Financeiro | ✅ Visão geral |
| Fluxo de Caixa | ✅ Ver |
| Extrato | ✅ Ver (comissão própria) |
| Comissões | ✅ Ver |
| Repasses | ✅ Ver |
| Taxas & Custos | ✅ Ver |
| Metas Financeiras | ✅ Ver |
| Resultado por Corretor | ✅ Ver |
| Comissionamento | ❌ (exclusivo Diretor) |
| Relatórios Financeiros | ✅ Ver |
| Exportar Dados | ✅ Exportar |
| Cronograma de Repasses | ✅ Ver |
| Configurações Financeiras | ❌ (exclusivo Diretor) |

---

## 8. Documentos (`/documentos`)

- ❌ **Não pode criar/excluir requisitos** (exclusivo Diretor)
- ✅ Pode **aprovar/rejeitar** documentos dos leads da filial
- ✅ Ver documentos pendentes da filial
- Scope: documentos de leads onde `branchId === context.branchId`

---

## 9. Distribuição de Leads (`/leads/distribuicao`)

- Acesso: `gerenciar_filiais` (compartilhado com Diretor)
- **Escopo limitado à própria filial**
- Pode pausar/retomar recebimento de leads da filial
- Ver corretores da filial e status de disponibilidade
- ❌ **Não pode** gerenciar recebimento de outras filiais (exclusivo Diretor)

---

## 10. Metas (`/metas`)

- Permissão: `gerenciar_metas` ✅
- Pode criar, editar e acompanhar metas
- Escopo: corretores da filial, equipe, filial

---

## 11. Tarefas (`/tarefas`)

- Escopo: **tarefas da filial** (`branchId === context.branchId`)
- Inclui tarefas de todos os corretores da filial

---

## 12. Vendas (`/vendas`)

- Escopo: **vendas da filial** (join com `leads.branchId`)
- Tabela com: lead, corretor, data, valor, status

---

## 13. Relatórios (`/relatorios`)

- ✅ Ver painel de relatórios
- ✅ Exportação rápida (CSV)
- Cards de atalho: Comissões, Metas, Funil, Equipe

---

## 14. Outras Páginas

| Rota | Descrição |
|------|-----------|
| `/clientes` | Leads convertidos — escopo: filial |
| `/cotacoes` | Propostas — escopo: filial |
| `/guia` | Documentação do sistema |
| `/notificacoes` | Central de notificações |
| `/checklist` | Checklist operacional |
| `/integridade` | Painel de integridade |
| `/acess-denied` | Página de acesso negado |

---

## 15. Permissões completas do Gestor

```typescript
// src/shared/auth/permissions.ts
acessar_conversas: ✓
acessar_leads: ✓
acessar_tarefas: ✓
acessar_cotacoes: ✓
acessar_documentos: ✓
acessar_clientes: ✓
acessar_vendas: ✓
acessar_dashboard: ✓
acessar_relatorios: ✓
acessar_catalogo: ✗
acessar_configuracoes: ✗
acessar_roadmap: ✗
acessar_guia: ✓
acessar_notificacoes: ✓
acessar_financeiro: ✓
ver_fluxo_caixa: ✓
ver_resultado_corretor: ✓
ver_comissionamento: ✗
ver_taxas_custos: ✓
ver_relatorios_financeiros: ✓
ver_cronograma_repasses: ✓
gerenciar_financeiro: ✗
criar_lead_manual: ✓
ver_dashboard_equipe: ✓
ver_dashboard_pessoal: ✗
convidar_gestor: ✗
convidar_corretor: ✓
gerenciar_filiais: ✓ (limitado à própria filial)
ver_painel_integridade: ✓
ver_comissao_propria: ✓
ver_comissao_equipe: ✓
gerenciar_comissoes: ✗
gerenciar_metas: ✓
ver_meta_propria: ✗
ver_meta_equipe: ✓
exportar_relatorios: ✓
aprovar_documentos: ✓
configurar_white_label: ✗
alterar_status_lead: ✓
reabrir_lead_perdido: ✓
```
