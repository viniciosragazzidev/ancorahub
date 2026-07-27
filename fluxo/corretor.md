# Fluxo — Corretor (Perfil Operacional)

## Hierarquia

- O Corretor é o perfil **operacional** dentro de um tenant.
- **Opera a própria carteira** de leads.
- Pode ter seu recebimento de leads **pausado** pelo Gestor/Diretor ou por si mesmo.
- Reporta ao **Gestor** (da filial) e/ou ao **Diretor**.
- ❌ **Não gerencia** outros membros.

---

## 1. Autenticação e Primeiro Acesso

### Login

`/login` → Formulário de e-mail + senha.

- Após login bem-sucedido, consulta `checkOnboardingRedirect`.
- Se onboarding completo → redireciona para **`/minha-fila`** (diferente de Diretor/Manager que vão para `/dashboard`).
- Se onboarding pendente → `/welcome`.

---

## 2. Navegação Principal (Sidebar)

Layout: `<AppShell>` → `<SidebarProvider>` → `<CorreTopSidebar>` (com itens severamente filtrados).

### Itens visíveis no menu

#### Operação
| Item | Rota | Descrição |
|------|------|-----------|
| Conversas | `/conversas` | Chat interno — **apenas leads próprios**, pode enviar mensagens |
| Leads | `/leads` | Fila de oportunidades — **apenas leads próprios** |
| Tarefas | `/tarefas` | **Apenas tarefas atribuídas a si** |
| Cotações | `/cotacoes` | Propostas criadas para seus leads |
| Documentos | `/documentos` | ❌ **Redireciona para `/access-denied`** |
| Clientes | `/clientes` | Seus leads convertidos |
| Vendas | `/vendas` | **Apenas suas vendas** (`brokerId === context.userId`) |

#### Gestão
- ❌ **Nenhum item** (Equipe, Metas, Relatórios, Filiais, Distribuição, Comissões)

#### Atendimento
- O Corretor tem acesso a um **sidebar próprio** (arquivo `corretor-sidebar.tsx`) que contém:
  - Minha fila (`/minha-fila`)
  - Conversas (`/conversas`)
  - Tarefas (`/tarefas`)
  - Checklist (`/checklist`)
  - Cotações (`/cotacoes`)
  - Documentos (`/documentos`)
  - Clientes (`/clientes`)

#### Desempenho
- Resumo (`/corretor/resumo`)
- Minha meta (`/minha-meta`)
- Notificações (`/notificacoes`)

#### Administração
- Roadmap (`/roadmap`) — apenas visualização

#### ❌ Itens **não visíveis** para Corretor
- Dashboard executivo (vê apenas `/minha-fila` como home)
- Equipe (`/equipe`) — acesso negado
- Relatórios (`/relatorios`) — acesso negado
- Metas (`/metas`) — acesso negado (usa `/minha-meta`)
- Filiais (`/filiais`) — exclusivo Diretor
- Catálogo (`/catalogo`) — exclusivo Diretor
- Configurações (`/settings`) — exclusivo Diretor
- Distribuição (`/leads/distribuicao`) — exclusivo Manager/Director
- NOC, Integridade — exclusivo Manager/Director

#### Financeiro (subnavegação)
| Item | Rota | Acesso |
|------|------|--------|
| Dashboard Financeiro | `/financeiro` | ✅ Visão pessoal |
| Extrato | `/financeiro/extrato` | ✅ (ver comissão própria) |
| Comissões | `/financeiro/comissoes` | ✅ (ver comissão própria) |
| Repasses | `/financeiro/repasses` | ✅ (ver próprios) |
| Fluxo de Caixa | `/financeiro/fluxo-caixa` | ❌ |
| Taxas & Custos | `/financeiro/taxas` | ❌ |
| Metas Financeiras | `/financeiro/metas` | ✅ (ver meta própria) |
| Resultado por Corretor | `/financeiro/resultado-corretor` | ❌ |
| Comissionamento | `/financeiro/comissionamento` | ❌ |
| Relatórios Financeiros | `/financeiro/relatorios` | ❌ |
| Exportar Dados | `/financeiro/exportar` | ❌ |
| Cronograma de Repasses | `/financeiro/cronograma` | ❌ |
| Configurações Financeiras | `/financeiro/configuracoes` | ❌ |

---

## 3. Home / Minha Fila (`/minha-fila`) — Página Inicial

Ao entrar, o Corretor é redirecionado para **`/minha-fila`** (não para `/dashboard`).

### O que vê:
- Lista de **seus leads** (onde `corretorId === context.userId`)
- Status de cada lead
- Ações rápidas: iniciar atendimento, abrir conversa
- Indicadores pessoais: leads na carteira, ativos, novos, convertidos

---

## 4. Dashboard Pessoal (`/dashboard`) — Visão do Corretor

### Cabeçalho
- "Minha Carteira"
- Total leads, ativos, convertidos
- Badge de disponibilidade (Disponível / Pausado)

### Seções

1. **Métricas** — 5 cards:
   - Leads na Carteira (total)
   - Ativos (em atendimento)
   - Novos (sem interação)
   - Em Contato (atendimentos em andamento)
   - Convertidos

2. **Distribuição da Carteira** — gráfico de pizza:
   - Novos, Contato, Ativos, Convertidos

3. **Atendimentos Ativos** — cards com os leads em andamento

4. **Atividades Recentes** — feed

5. **Stats bottom** — resumo numérico

---

## 5. Leads (`/leads`)

### Escopo de dados
- **Apenas leads onde `corretorId === context.userId`**

### Funcionalidades
- Filtros: por status, busca (não há filtro de filial)
- Criação manual de lead (quando cria, já fica como responsável)
- Workspace com tabela

### Detalhes do lead (`/leads/[id]`)
- **StartServiceButton** — se lead está "distributed" e é dono, pode iniciar atendimento
- **LeadStatusSelector** — pode alterar status após iniciar atendimento
- ❌ **Não pode reabrir lead perdido** (exclusivo Manager/Director)
- **LeadTasks** — pode criar tarefas (apenas para si mesmo)
- Documentos — pode enviar documentos
- Notas
- ❌ **Não vê dados pessoais** se lead está "distributed" (proteção LGPD)

### Regras de negócio
- `alterar_status_lead`: ✅ (apenas próprios leads)
- `reabrir_lead_perdido`: ❌
- `service-action.ts`: Somente o corretor responsável pode iniciar atendimento
- Se tentar acessar lead de outro corretor → retorna null

---

## 6. Conversas (`/conversas`)

### Escopo
- **Apenas leads onde `corretorId === context.userId`**
- **`canSend: true`** — Corretor pode enviar mensagens no chat interno

### Funcionalidades
- Lista de conversas da carteira
- Filtros (Todas, Com msgs, Sem conversa)
- Busca por nome/telefone/e-mail
- Perfil do cliente com documentos, mídias, resumo
- ✅ **Pode enviar mensagens** (é o atendente principal)

---

## 7. Tarefas (`/tarefas`)

### Escopo
- **Apenas tarefas onde `assignedTo === context.userId` OU está nos assignees**
- Filtro: por atenção (vencidas), por lead

### Ações
- Criar tarefa para si mesmo
- Concluir tarefa
- ✅ Prioridade: Urgente, Normal, Baixa

### Regras
- `task-actions.ts`: Corretor só pode atribuir tarefas **a si mesmo**
- ❌ Não pode atribuir tarefas para outros corretores

---

## 8. Cotações (`/cotacoes`)

### Escopo
- **Apenas cotações de leads onde `corretorId === context.userId`**
- Pode criar novas cotações para seus leads
- Pode compartilhar cotações

### Regras
- `quotes/actions.ts`: Se corretor tentar cotar lead de outro → erro
- Se tentar acessar cotação de outro → 404

---

## 9. Documentos (`/documentos`)

### Escopo
- **Apenas documentos dos seus leads**
- ✅ Pode **enviar** documentos
- ✅ Pode **ver** status dos seus documentos
- ❌ **Não pode aprovar/rejeitar** documentos
- ❌ **Não pode configurar requisitos**
- ❌ **Redirecionado para `/access-denied`** na página principal de gestão documental (acesso apenas via lead)

---

## 10. Minha Meta (`/minha-meta`) — ⚠️ Exclusivo Corretor

- Página exclusiva do Corretor
- Se Diretor/Manager acessar → redireciona para `/metas`
- Acompanha:
  - Progresso da meta pessoal
  - Resultados acumulados no período
  - Indicadores de desempenho comercial

---

## 11. Checklist (`/checklist`)

- Escopo: **apenas tarefas do próprio corretor** (`assignedTo === context.userId`)
- Visão de checklist com itens a completar
- Conclusão de tarefas

---

## 12. Financeiro (`/financeiro`)

### Permissões do Corretor (limitadas)
| Funcionalidade | Acesso |
|----------------|--------|
| Dashboard Financeiro | ✅ Visão pessoal ("Minhas vendas") |
| Extrato | ✅ Ver extrato próprio |
| Comissões | ✅ Ver comissão própria |
| Repasses | ✅ Ver repasses |
| Metas Financeiras | ✅ Ver meta própria |
| Fluxo de Caixa | ❌ |
| Taxas & Custos | ❌ |
| Resultado por Corretor | ❌ |
| Comissionamento | ❌ |
| Relatórios Financeiros | ❌ |
| Exportar Dados | ❌ |
| Cronograma de Repasses | ❌ |
| Configurações Financeiras | ❌ |

---

## 13. Vendas (`/vendas`)

### Escopo
- **Apenas vendas onde `brokerId === context.userId`**
- Tabela com: lead, data, valor, status
- Total de receita **apenas das próprias vendas**

---

## 14. Controle de Disponibilidade

- Corretor pode **pausar/retomar** o próprio recebimento de leads
- Ação disponível no sidebar (`Pause` button): "Disponível para leads" / "Recebimento pausado"
- Feature: `availability-action.ts` — "Apenas corretores podem alterar a própria disponibilidade"
- Gestor/Diretor também pode pausar corretores da filial

---

## 15. Outras Páginas

| Rota | Descrição |
|------|-----------|
| `/clientes` | Seus leads convertidos |
| `/corretor/resumo` | Resumo de desempenho pessoal |
| `/guia` | Documentação do sistema |
| `/notificacoes` | Central de notificações |
| `/acess-denied` | Página de acesso negado |

---

## 16. Fluxo de Atendimento (Típico)

1. Lead é **distribuído** automaticamente ao Corretor
2. Corretor vê lead na **fila** (`/minha-fila` ou `/leads`)
3. Clica **"Iniciar Atendimento"** → lead avança de "distributed" para "in_contact"
4. Abre **conversa** no chat interno → envia mensagem
5. Se necessário, cria **cotação** (`/cotacoes`)
6. Solicita **documentos** ao cliente (envia via chat)
7. Avança status: negotiation → documentation_pending → under_analysis → **converted**
8. Venda registrada → cliente aparece em `/clientes`
9. Acompanha **comissão** no financeiro

---

## 17. Permissões completas do Corretor

```typescript
// src/shared/auth/permissions.ts
acessar_conversas: ✓
acessar_leads: ✓
acessar_tarefas: ✓
acessar_cotacoes: ✓
acessar_documentos: ✓ (apenas envio, não gestão)
acessar_clientes: ✓
acessar_vendas: ✓
acessar_dashboard: ✓ (visão pessoal)
acessar_relatorios: ✗
acessar_catalogo: ✗
acessar_configuracoes: ✗
acessar_roadmap: ✓ (apenas leitura)
acessar_guia: ✓
acessar_notificacoes: ✓
acessar_financeiro: ✓ (limitado)
ver_fluxo_caixa: ✗
ver_resultado_corretor: ✗
ver_comissionamento: ✗
ver_taxas_custos: ✗
ver_relatorios_financeiros: ✗
ver_cronograma_repasses: ✗
gerenciar_financeiro: ✗
criar_lead_manual: ✓
ver_dashboard_equipe: ✗
ver_dashboard_pessoal: ✓ (exclusivo)
convidar_gestor: ✗
convidar_corretor: ✗
gerenciar_filiais: ✗
ver_painel_integridade: ✗
ver_comissao_propria: ✓
ver_comissao_equipe: ✗
gerenciar_comissoes: ✗
gerenciar_metas: ✗
ver_meta_propria: ✓ (exclusivo)
ver_meta_equipe: ✗
exportar_relatorios: ✗
aprovar_documentos: ✗
configurar_white_label: ✗
alterar_status_lead: ✓ (após iniciar atendimento)
reabrir_lead_perdido: ✗
```
