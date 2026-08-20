# Fluxo — Super Admin / Super Dev (Plataforma CorreTop)

## Hierarquia

- O Super Admin (e Super Dev) é um perfil **cross-tenant** — gerencia a plataforma inteira.
- **Não pertence a nenhum tenant** (corretora). Opera no escopo da plataforma.
- Pode criar, ativar/desativar e gerenciar **todos os tenants**.
- Separado dos papéis de tenant (Diretor, Gestor, Corretor) — usa `isPlatformAdmin` na tabela `user`.
- Login via `/admin/login` (separado do login de tenant em `/login`).

---

## 1. Autenticação

### Login Administrativo

`/admin/login` → Formulário com e-mail + senha.

- Rota exclusiva para administradores da plataforma.
- Usa `signIn.email()` com callback redirecionando para `/super-admin`.
- Após autenticação, o middleware identifica `pathname.startsWith("/super-admin")` e redireciona para `/dashboard` ou `/super-admin` conforme o caso.

### Verificação de Acesso

```typescript
// src/shared/auth/platform-admin.ts
export async function getRequiredPlatformAdmin(): Promise<PlatformAdminContext> {
  const { user: sessionUser } = await getRequiredSession();
  const [user] = await getDatabase()
    .select({ id: schema.user.id, email: schema.user.email, active: schema.user.active, isPlatformAdmin: schema.user.isPlatformAdmin })
    .from(schema.user)
    .where(eq(schema.user.id, sessionUser.id))
    .limit(1);

  if (!user?.active || !user.isPlatformAdmin) {
    throw new AuthorizationError("The current user is not a platform administrator.");
  }

  return { userId: user.id, email: user.email };
}
```

- O campo `isPlatformAdmin` na tabela `user` determina se o usuário é administrador da plataforma.
- Usuário deve estar `active === true`.

---

## 2. Navegação — Duas Áreas de Administração

Existem **duas áreas** administrativas, cada uma com layout e sidebar próprios:

### 2.1. Super Admin (`/super-admin`)

**Shell:** `PlatformAdminShell` → `<SidebarProvider>` + `<PlatformAdminSidebar>` + `<WorkspaceRail>`

**Sidebar:** `PlatformAdminSidebar`

#### Grupos de navegação da sidebar:

**Painel Geral**
| Item | Rota | Descrição |
|------|------|-----------|
| Visão Geral & DevTools | `/super-admin` | Dashboard com SQL Explorer, ações NOC, métricas do sistema |
| Empresas (Tenants) | `/super-admin/tenants` | CRUD de empresas parceiras |
| Detalhe da Empresa | `/super-admin/tenants/[id]` | Detalhes, membros, criar acesso |

**Segurança & Monitoramento**
| Item | Rota | Descrição |
|------|------|-----------|
| Logs de Auditoria | `/super-admin/audit` | Auditoria plataforma + tenants + LGPD + evidências |
| Sessões Ativas | `/super-admin/sessions` | Monitoramento de sessões ativas com opção de encerrar |
| Parâmetros do Servidor | `/super-admin/settings` | Configurações globais (feature flags, dias estagnação, busca global) |

### 2.2. Super Dev (`/super-dev`)

**Shell:** `SuperDevShell` → `<SidebarProvider>` + `<SuperDevSidebar>` + `<WorkspaceRail>`

**Sidebar:** `SuperDevSidebar`

#### Grupos de navegação da sidebar:

**Plataforma**
| Item | Rota | Descrição |
|------|------|-----------|
| Visão geral | `/super-dev` | Dashboard com KPI, alertas de perda, logs recentes |
| Empresas | `/super-dev/tenants` | CRUD de empresas (versão simplificada) |
| Auditoria & Logs | `/super-dev/audit` | Logs de auditoria + LGPD |
| Sessões Ativas | `/super-dev/sessions` | Sessões ativas no sistema |
| Configurações | `/super-dev/settings` | Visualização de parâmetros do servidor |

### Diferença entre Super Admin e Super Dev

| Aspecto | Super Admin (`/super-admin`) | Super Dev (`/super-dev`) |
|---------|------------------------------|--------------------------|
| Foco | Operações, DevTools, inspeção DB | Monitoramento, governança |
| Sidebar | `PlatformAdminSidebar` | `SuperDevSidebar` |
| Dashboard | SQL Explorer + Ações NOC + Métricas DB | KPI + Alertas de perda + Logs recentes |
| Settings | ✅ Feature flags editáveis (Central Atenção, Busca Global) | ✅ Apenas leitura (informações do servidor) |
| Auditoria | ✅ Completa (platform + tenant + evidence + LGPD) | ✅ Completa (platform + tenant + evidence + LGPD) |
| Sessões | ✅ Visualizar + encerrar sessões | ✅ Visualizar + encerrar sessões |
| Tenants | ✅ CRUD + detalhes + criar acesso | ✅ CRUD + detalhes + criar acesso |
| Aparência | Header: "Super Admin / CorreTop Platform" | Header: "Super Administração / CorreTop Admin" |

> **Nota:** Ambos os painéis usam a mesma autenticação (`isPlatformAdmin`). A escolha entre `/super-admin` e `/super-dev` é uma **preferência de interface**, não de permissão. As server actions compartilham a mesma camada de serviço em `@/features/platform-admin/service.ts`.

---

## 3. Dashboard Super Admin (`/super-admin`)

Componente **client-side** com:

### Seções

1. **KPI Stats Grid** (4 cards):
   - **Banco de Dados (Neon)**: tamanho do banco + conexões ativas
   - **Motor SLA Daemon**: status do cron de SLA (a cada 5 min)
   - **WhatsApp API Cloud**: status da API (mocks operantes)
   - **Ambiente de Execução**: NODE_ENV

2. **SQL Explorer & Inspector**:
   - Dropdown para selecionar tabela: tenants, user, leads, auditLogs, platformAuditLogs, session, leadInteractions, leadDocuments
   - Input de limite de linhas
   - Botão "Consultar Tabela" → executa `runDbQueryAction`
   - Visualizador de resultados em tabela (primeiros 5 campos)
   - Server action: `runDbQueryAction` — consulta direta ao banco via Drizzle

3. **Ações Rápidas & NOC** (painel lateral):
   - **SLA Sweep Manual**: dispara `runSlaSweep()` imediatamente
   - **Limpar Caches Locais**: placeholder para limpeza de buffers
   - Links diretos para Tenants, Auditoria, Sessões

---

## 4. Dashboard Super Dev (`/super-dev`)

Componente **server-side** com:

### Seções

1. **KPI Grid** (4 cards):
   - **Empresas**: total de tenants + ativos
   - **Sessões Ativas**: dispositivos conectados
   - **Logs Registrados**: total de eventos auditados
   - **Alertas Ativos**: perdas anormais detectadas

2. **Alerta de Taxa de Perda Anormal** (card warning):
   - Corretores com taxa de conversão perdida ≥ 75% e mínimo de 3 leads
   - Mostra: nome, email, total de leads, taxa de perda

3. **Quick Actions**:
   - Link para Empresas e Tenants
   - Link para Auditoria e Governança LGPD

4. **Atividades Recentes**:
   - Últimos 3 logs de auditoria da plataforma

---

## 5. Gestão de Empresas (Tenants) `/super-admin/tenants` e `/super-dev/tenants`

### Listagem de Tenants

Tabela com:
- Nome da empresa (link para detalhes)
- CNPJ
- Plano de assinatura (starter, growth, enterprise)
- Status (Ativo / Inativo / Inadimplente)
- Ação: botão Ativar/Desativar

### Criar Nova Empresa

Formulário com:
- Nome fantasia / Razão social
- CNPJ (14 dígitos, validação com regex)
- Subdomínio / Slug único (gerado automaticamente do nome)
- Plano de licença (Starter, Growth, Enterprise)

### Server Actions:
- `createTenantAction` → `createPlatformTenant()` → cria tenant + filial "Matriz" + registra auditoria
- `setTenantStatusAction` → `setPlatformTenantStatus()` → ativa/desativa tenant

---

## 6. Detalhes do Tenant (`/super-admin/tenants/[tenantId]`)

### Informações da Empresa
- Nome, razão social
- CNPJ
- Plano
- Status
- Filiais cadastradas

### Membros com Acesso
Tabela com: nome, email, papel (Diretor/Gestor/Corretor), filial, status
- **Apenas leitura** — não permite edição direta

### Adicionar Acesso
Formulário `CreateTenantAccessForm`:
- Selecionar filial
- Nome, email, senha (mín. 8 caracteres)
- Papel: Diretor, Gestor ou Corretor
- Cria usuário + conta (credencial) + membership em transação

### Server Action:
- `createTenantAccessAction` → `createTenantAccess()`

---

## 7. Auditoria e Logs (`/super-admin/audit` e `/super-dev/audit`)

Componente **client-side** com abas:

### Aba 1 — Auditoria Plataforma
- Tabela: ação, alvo, ID alvo, executor (nome + email), data/hora
- Fonte: `platform_audit_logs`
- Ações registradas: `tenant.created`, `tenant.status_changed`, `tenant_access.created`, `session.terminated`, `lgpd.user_purged`, `update_central_atencao_settings`, `update_global_search_settings`

### Aba 2 — Auditoria Operadoras (Tenants)
- Tabela: ação, entidade, ID entidade, corretor/membro, data/hora
- Fonte: `audit_logs` (logs de operação dos tenants)
- Ações: `atualizou_membro`, `reativou_membro`, `desativou_membro`, etc.

### Aba 3 — Relatório de Evidências (Dossiê Forense)
- Input para UUID do lead
- Server action `getLeadEvidenceReportAction`:
  - Busca dados do lead
  - Timeline de interações
  - Documentos anexados
- Retorna relatório estruturado (JSON)

### Aba 4 — Governança LGPD
- Formulário para expurgo de usuário
- Server action `purgeUserLGPDAction`:
  - Deleta sessões
  - Deleta conta (credentials)
  - Deleta tenant memberships
  - Anonimiza usuário (nome → "LGPD EXCLUÍDO", email → hash, active → false)
  - Registra auditoria

---

## 8. Sessões Ativas (`/super-admin/sessions` e `/super-dev/sessions`)

Tabela com:
- Usuário (nome)
- E-mail
- Endereço IP
- Navegador / Dispositivo (user agent)
- Expira em (data/hora)
- Ação: botão "Encerrar"

### Server Actions:
- `getActiveSessions()`: lista todas as sessões ativas com join em `user`
- `terminateSessionAction` → `terminateSession()`: deleta sessão + registra auditoria

---

## 9. Configurações da Plataforma (`/super-admin/settings`)

### Parâmetros do Servidor (leitura)
- Nome do sistema: CorreTop CRM
- Banco de dados: PostgreSQL (Neon)
- Versão do sistema: v2.10.0-prod

### Capacidades Operacionais (editáveis)

**Central Atenção Agora**:
- **Toggle**: Habilitar/Desabilitar a Central de Atenção no roadmap dos tenants
- **Dias para estagnação**: Input numérico (1-30) para configurar quantos dias sem avanço caracterizam lead estagnado
- Chaves: `feature_central_atencao_enabled`, `feature_central_atencao_stagnant_days`
- Salva em `system_settings` com upsert
- Server action: `updateCentralAtencaoSettingsAction`

**Busca Global**:
- **Toggle**: Habilitar/Desabilitar busca global no cabeçalho do sistema
- Chave: `feature_global_search_enabled`
- Server action: `updateGlobalSearchSettingsAction`

> Ambas as alterações registram auditoria em `platform_audit_logs`.

### Super Dev Settings (`/super-dev/settings`)
- Apenas **leitura**: exibe as mesmas informações do servidor
- Sem capacidade de edição

---

## 10. Service Layer (`@/features/platform-admin/service.ts`)

Todas as operações de plataforma passam por esta camada de serviço. Funções principais:

| Função | Descrição |
|--------|-----------|
| `getPlatformTenants()` | Lista todos os tenants |
| `getPlatformTenant(tenantId)` | Detalhes de um tenant |
| `getTenantMembers(tenantId)` | Membros de um tenant |
| `getTenantBranches(tenantId)` | Filiais de um tenant |
| `createPlatformTenant(input)` | Cria novo tenant + filial Matriz |
| `setPlatformTenantStatus(tenantId, status)` | Ativa/desativa tenant |
| `createTenantAccess(input)` | Cria acesso (user + account + membership) |
| `getPlatformAuditLogs()` | Logs de auditoria da plataforma |
| `getTenantAuditLogs()` | Logs de auditoria dos tenants |
| `getActiveSessions()` | Sessões ativas no banco |
| `terminateSession(sessionId)` | Encerra sessão |
| `getLossRateAlerts()` | Alertas de taxa de perda anormal |
| `purgeUserLGPD(userId)` | Expurgo LGPD de usuário |

Todas as funções chamam `getRequiredPlatformAdmin()` no início para garantir autorização.

---

## 11. Páginas e Funcionalidades Não Implementadas (Placeholder)

As seguintes páginas usam o componente `PlatformAdminPlaceholder` e exibem mensagem "Módulo preparado":

- Qualquer rota não implementada dentro de `/super-admin/`

O placeholder exibe:
- Badge "Planejado"
- Descrição: "A implementação funcional deste módulo será conectada ao domínio de super-admin."

---

## 12. Workspace Rail (Navegação entre Áreas)

O shell (`PlatformAdminShell` / `SuperDevShell`) inclui um **Workspace Rail** à esquerda com dois itens:

1. **Área do Sistema** (`/dashboard`) — leva ao dashboard do tenant (se aplicável)
2. **Área de Administração** (`/super-admin` ou `/super-dev`) — leva ao painel atual

Isso permite alternar rapidamente entre o sistema principal e a administração.

---

## 13. Resumo de Permissões

O Super Admin não usa o sistema de `PERMISSIONS` dos tenants. Em vez disso:

- **Único checkpoint**: `user.isPlatformAdmin === true && user.active === true`
- **Sem escopo de tenant**: vê absolutamente todos os dados da plataforma
- **Pode executar SQL diretamente** via `runDbQueryAction`
- **Pode disparar jobs** (SLA sweep)
- **Pode expurgar dados** (LGPD purge)
- **Pode gerenciar feature flags** globais
- **Pode criar/remover tenants** e acessos

---

## 14. Fluxo de Trabalho Típico do Super Admin

1. **Login** em `/admin/login` → redireciona para `/super-admin`
2. **Visão geral**: confere métricas do banco, executa consultas SQL de inspeção
3. **Gestão de empresas**: acessa `/super-admin/tenants`, cria nova empresa ou altera status
4. **Detalhes da empresa**: acessa `/super-admin/tenants/[id]`, vê membros, cria acesso inicial para o Diretor
5. **Monitoramento**: acessa `/super-admin/sessions` para ver sessões ativas
6. **Auditoria**: acessa `/super-admin/audit` para investigar logs, gerar dossiê de evidências
7. **Configuração**: acessa `/super-admin/settings` para ativar/desativar features globais
8. **LGPD**: se necessário, usa a aba de Governança LGPD para expurgar usuário

## 15. Fluxo de Trabalho Típico do Super Dev

1. **Login** em `/admin/login` → redireciona para `/super-dev`
2. **Dashboard**: confere KPIs, alertas de perda anormal, logs recentes
3. **Empresas**: gerencia tenants
4. **Auditoria**: investiga logs e gera relatórios de evidência
5. **Sessões**: monitora sessões ativas
6. **Configurações**: visualiza parâmetros do servidor (somente leitura)
