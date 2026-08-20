# Fluxo — Diretor (Perfil Administrativo Completo)

## Hierarquia

- O Diretor é o cargo mais alto dentro de um **tenant** (corretora).
- Pode criar **Gestores** e **Corretores**.
- Responde diretamente ao **Super Admin** (plataforma) — fora do escopo do tenant.

---

## 1. Autenticação e Primeiro Acesso

### Login

`/login` → Formulário de e-mail + senha.

- Após login bem-sucedido, consulta `checkOnboardingRedirect`.
- Se onboarding completo ou descartado → redireciona para `/dashboard`.
- Se onboarding pendente → `/welcome`.

### Onboarding

`/welcome` → Tela de boas-vindas com `role="director"`.

> Passos sugeridos: criar filial, convidar gestores, conectar WhatsApp, configurar plano.

---

## 2. Navegação Principal (Sidebar)

Layout unificado: `<AppShell>` → `<SidebarProvider>` → `<CorreTopSidebar>` + `<WorkspaceRail>` + `<MobileBottomNav>`.

### Itens visíveis no menu da sidebar

#### Operação
| Item | Rota | Descrição |
|------|------|-----------|
| Conversas | `/conversas` | Central de mensagens — **todos os leads do tenant** |
| Leads | `/leads` | Fila de oportunidades — **todos os leads, filtrável por filial** |
| Tarefas | `/tarefas` | Tarefas de **todas as filiais** |
| Cotações | `/cotacoes` | Propostas de **todo o tenant** |
| Documentos | `/documentos` | Gestão documental + aprovação |
| Clientes | `/clientes` | Leads convertidos do tenant |
| Vendas | `/vendas` | Vendas realizadas — **todas as filiais** |

#### Gestão
| Item | Rota | Descrição |
|------|------|-----------|
| Resumo | `/dashboard` | Dashboard executivo do Diretor |
| Equipe | `/equipe` | Gestão de membros — Diretor vê/cria **Gestores e Corretores** |
| Metas | `/metas` | Gerenciar metas comerciais |
| Relatórios | `/relatorios` | Relatórios consolidados + exportação |
| Filiais | `/filiais` | ⚠️ **Exclusivo Diretor** — CRUD de filiais |
| Distribuição | `/leads/distribuicao` | Painel de distribuição de leads por filial |
| Comissões | `/configuracoes/comissoes` | ⚠️ **Exclusivo Diretor** — Configuração de comissionamento |

#### Administração
| Item | Rota | Descrição |
|------|------|-----------|
| Catálogo | `/catalogo` | ⚠️ **Exclusivo Diretor** — Catálogo de planos e operadoras |
| Assinatura | `/assinatura` | ⚠️ **Exclusivo Diretor** — Plano de assinatura CorreTop |
| Configurações | `/settings` | ⚠️ **Exclusivo Diretor** — Marca, integrações, segurança |
| Roadmap | `/roadmap` | ⚠️ **Exclusivo Diretor** — Acompanhamento da evolução do produto |

#### Ajuda
| Item | Rota | Descrição |
|------|------|-----------|
| Guia do sistema | `/guia` | Documentação de uso |

#### Financeiro (subnavegação)
| Item | Rota | Descrição |
|------|------|-----------|
| Dashboard Financeiro | `/financeiro` | Visão geral financeira |
| Fluxo de Caixa | `/financeiro/fluxo-caixa` | **Diretor/Manager** |
| Extrato | `/financeiro/extrato` | Extrato financeiro |
| Comissões | `/financeiro/comissoes` | Comissões |
| Repasses | `/financeiro/repasses` | Cronograma de repasses |
| Taxas & Custos | `/financeiro/taxas` | **Diretor/Manager** |
| Metas Financeiras | `/financeiro/metas` | Metas do período |
| Resultado por Corretor | `/financeiro/resultado-corretor` | **Diretor/Manager** |
| Comissionamento | `/financeiro/comissionamento` | ⚠️ **Exclusivo Diretor** |
| Relatórios Financeiros | `/financeiro/relatorios` | **Diretor/Manager** |
| Exportar Dados | `/financeiro/exportar` | **Diretor/Manager** |
| Cronograma de Repasses | `/financeiro/cronograma` | **Diretor/Manager** |
| Configurações Financeiras | `/financeiro/configuracoes` | ⚠️ **Exclusivo Diretor** |

---

## 3. Dashboard Executivo (`/dashboard`)

### Cabeçalho
- Nome do tenant + status "Operacional"
- Quantidade de membros ativos e filiais
- Data/hora em tempo real

### Seções

1. **Atenção agora** — cards de ação rápida:
   - Leads sem contato (distribuídos > 15 min)
   - Leads estagnados (> 3 dias sem avanço)
   - Equipe ativa (corretores ativos / total)
   - Configuração (acesso rápido a `/settings`)

2. **Métricas** — 5 cards animados:
   - Total de leads
   - Leads ativos
   - Conversões
   - Corretores ativos
   - Filiais (+ leads não trabalhados)

3. **Funil comercial** — gráfico de área com volume por etapa (Novo → Contato → Cotação → Negociação → Conversão)

4. **Distribuição por status** — gráfico de pizza (rosca)

5. **Desempenho por filial** — cards com barra de progresso (leads, ativos, conversão)

6. **Gargalos operacionais** — indicadores de alerta:
   - Leads não trabalhados
   - Leads estagnados
   - Equipe

7. **Atividades recentes** — feed de movimentações

8. **Stats bottom** — resumo numérico final

---

## 4. Gestão de Equipe (`/equipe`)

### Visão
- **Tabela completa** de todos os membros do tenant (Diretores, Gestores e Corretores)
- Diretor pode ver e gerenciar **todos os membros**

### Ações disponíveis
- **Convidar Gestor** ⚠️ (exclusivo Diretor)
- **Convidar Corretor**
- **Editar membro**: nome, e-mail, cargo (job title), papel (role), filial
- **Ativar/Desativar** membro
- **Transferir leads** do corretor para outro
- Ver indicadores:
  - Total de membros
  - Acessos ativos
  - Leads sem atendimento
  - Vendas acumuladas (R$)

### Regras de negócio
- Diretor **não pode ser editado/removido** por outro membro do tenant
- Diretor pode definir cargo organizacional (job title) independente do perfil de acesso

---

## 5. Leads (`/leads`)

### Escopo de dados
- **Todos os leads** de todas as filiais do tenant

### Funcionalidades
- Filtros: por status, por filial, busca por nome/telefone
- Banner de alerta de filiais com recebimento pausado
- Criação manual de lead (ManualLeadSheet)
- Workspace com tabela de leads + colunas de status, origem, corretor
- Navegação para detalhes do lead (`/leads/[id]`)

### Detalhes do lead (`/leads/[id]`)
- Próxima ação (LeadActionHub) — hub de atalhos
- Timeline de interações
- Status selector (pode alterar para qualquer status)
- **LeadManagementActions** — reatribuir lead, assumir atendimento, assumir conversa
- Tarefas do lead
- Documentos do lead
- Ações de serviço
- Notas

---

## 6. Conversas (`/conversas`)

### Escopo
- **Todas as conversas** de todas as filiais
- `canSend: false` apenas supervisão (não envia mensagens como corretor)

### Funcionalidades
- Painel lateral de conversas com filtros (Todas, Com msgs, Sem conversa)
- Busca por nome/telefone/e-mail
- Perfil do cliente no painel direito (documentos, mídias, resumo)
- Setup tutorial do WhatsApp (se não configurado)

---

## 7. Gestão Financeira (`/financeiro`)

### Permissões totais do Diretor
- **Dashboard Financeiro**: receita total, comissões pendentes/pagas, vendas
- **Fluxo de Caixa**: ✅
- **Extrato**: ✅
- **Comissões**: ✅
- **Repasses**: ✅
- **Taxas & Custos**: ✅
- **Metas Financeiras**: ✅ (pode criar/gerenciar)
- **Resultado por Corretor**: ✅
- **Comissionamento**: ✅ (exclusivo — configurar regras)
- **Relatórios Financeiros**: ✅
- **Exportar Dados**: ✅
- **Cronograma de Repasses**: ✅
- **Configurações Financeiras**: ✅ (exclusivo)

---

## 8. Documentos (`/documentos`)

- **Criar requisitos** ⚠️ (exclusivo Diretor)
- **Excluir requisitos** ⚠️ (exclusivo Diretor)
- Aprovar/Rejeitar documentos
- Ver todos os documentos de todos os leads
- Configurar exigências documentais por plano/operadora

---

## 9. Filiais (`/filiais`) — ⚠️ Exclusivo Diretor

- CRUD completo de filiais
- Nome, status (ativo/inativo)
- Distribuição automática de leads (toggle)

---

## 10. Catálogo (`/catalogo`) — ⚠️ Exclusivo Diretor

- Gerenciar operadoras (carriers)
- Gerenciar planos (carrier plans)
- Ativar/desativar planos

---

## 11. Configurações (`/settings`) — ⚠️ Exclusivo Diretor

- **Empresa**: dados da corretora (nome, documento, etc.)
- **Integrações**: WhatsApp, webhooks
- **Segurança**: 2FA, sessões
- White label (marca, logo, cor primária)

---

## 12. Metas (`/metas`)

- Criar, editar e acompanhar metas comerciais
- Escopo: por corretor, equipe, filial ou corretora
- Cálculo automático com base em dados reais

---

## 13. Distribuição de Leads (`/leads/distribuicao`)

- Painel de controle de recebimento por filial
- **Pausar/Retomar** recebimento de leads por filial ⚠️ (exclusivo Diretor gerenciar todas as filiais)
- Ver status de cada filial (recebendo/pausado)
- Estatísticas de distribuição

---

## 14. Tarefas (`/tarefas`)

- Escopo: **todas as tarefas** de todas as filiais
- Filtro por atenção (vencidas, por lead)
- Criação de tarefas a partir dos leads

---

## 15. Vendas (`/vendas`)

- Escopo: **todas as vendas** de todas as filiais
- Tabela com: lead, corretor, data, valor, status
- Total de receita

---

## 16. Relatórios (`/relatorios`)

- KPI banner com: leads, clientes, cotações, vendas, conversão, receita
- Exportação rápida em CSV ⚠️ (exclusivo Manager/Director)
- Cards de atalho: Comissões, Metas, Funil, Equipe

---

## 17. Outras Páginas

| Rota | Descrição |
|------|-----------|
| `/clientes` | Leads convertidos — escopo: todo tenant |
| `/cotacoes` | Propostas — escopo: todo tenant |
| `/guia` | Documentação do sistema |
| `/notificacoes` | Central de notificações |
| `/checklist` | Checklist operacional |
| `/acess-denied` | Página de acesso negado (redirecionamento) |

---

## 18. Permissões completas do Diretor

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
acessar_catalogo: ✓ (exclusivo)
acessar_configuracoes: ✓ (exclusivo)
acessar_roadmap: ✓ (exclusivo)
acessar_guia: ✓
acessar_notificacoes: ✓
acessar_financeiro: ✓
ver_fluxo_caixa: ✓
ver_resultado_corretor: ✓
ver_comissionamento: ✓ (exclusivo)
ver_taxas_custos: ✓
ver_relatorios_financeiros: ✓
ver_cronograma_repasses: ✓
gerenciar_financeiro: ✓ (exclusivo)
criar_lead_manual: ✓
ver_dashboard_equipe: ✓
ver_dashboard_pessoal: ✗
convidar_gestor: ✓ (exclusivo)
convidar_corretor: ✓
gerenciar_filiais: ✓ (exclusivo)
ver_painel_integridade: ✓
ver_comissao_propria: ✓
ver_comissao_equipe: ✓
gerenciar_comissoes: ✓ (exclusivo)
gerenciar_metas: ✓
ver_meta_propria: ✗ (usa gerenciar_metas)
ver_meta_equipe: ✓
exportar_relatorios: ✓
aprovar_documentos: ✓
configurar_white_label: ✓ (exclusivo)
alterar_status_lead: ✓
reabrir_lead_perdido: ✓
```
