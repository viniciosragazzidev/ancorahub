# CorreTop — Plano de Desenvolvimento (7 Dias / 98 Horas)

**Regime:** Dev solo, full-time, ~14h/dia
**Objetivo:** MVP funcional para o primeiro cliente (corretora grande, 20+ corretores)
**Prioridade-base (definida pelo dono do projeto):** Core CRM > WhatsApp > Cotador/Documentos/Comissão > Metas/Dashboard/Pós-venda

**Legenda de prioridade:**
- 🔴 **P0 — Crítico**: sem isso o sistema não funciona
- 🟡 **P1 — Alto**: essencial para o cliente grande usar no dia a dia
- 🟢 **P2 — Importante, mas com fallback**: se atrasar, existe uma versão reduzida aceitável
- 🔶 **Risco externo**: depende de terceiros (verificação da Meta, DNS, etc.), fora do seu controle total

---

## 🚀 Progresso Geral

| Dia | Status | Itens ✅ | Total |
|-----|--------|----------|-------|
| **Dia 1** — Fundação e Setup | ✅ **100%** | 7/7 | 7 |
| **Dia 2** — Multi-tenancy Operacional | 🟡 ~40% | 3/7 | 7 |
| **Dia 3** — Núcleo do CRM | 🟡 ~50% | 5/10 | 10 |
| **Dia 4** — Telas de Trabalho | 🟡 ~28% | 2.5/9 | 9 |
| **Dia 5** — Cotador e Gestão Documental | ⬜ 0% | 0/10 | 10 |
| **Dia 6** — Comissão, Metas, WhatsApp | ⬜ 0% | 0/10 | 10 |
| **Dia 7** — Integridade, Segurança, Go-Live | 🟡 ~21% | 2.5/12 | 12 |
| **TOTAL** | 🟡 **~20%** | **16/65** | 65 |

---

## Dia 1 — Fundação e Setup ✅ **100%**

**Objetivo do dia:** ter o esqueleto do projeto rodando em produção (mesmo vazio), com autenticação e multi-tenancy funcionando desde a primeira linha de código.

| # | Funcionalidade | Prioridade | Status | Como funciona |
|---|---|---|---|---|
| 1.1 | Inicializar projeto Next.js + TypeScript + Tailwind + ESLint/Prettier/Husky | 🔴 P0 | ✅ | `create-next-app`, strict mode, **Prettier** (`.prettierrc`), **Husky** (lint-staged no pre-commit, `npm test` no pre-push) |
| 1.2 | Estrutura de pastas por domínio (`features/`, `shared/`, etc.) | 🔴 P0 | ✅ | Pastas criadas conforme Seção 3 do doc de arquitetura |
| 1.3 | Setup do banco (Neon) + Drizzle + primeira migration | 🔴 P0 | ✅ | Neon configurado (`DATABASE_URL`), Drizzle ORM, **7 migrations aplicadas** no banco |
| 1.4 | BetterAuth configurado (login, sessão, papéis) | 🔴 P0 | ✅ | 3 papéis (Diretor/Gestor/Corretor), **proxy.ts como middleware** Next.js 16, RBAC unificado |
| 1.5 | Deploy inicial na Vercel (ambiente de staging) | 🔴 P0 | ✅ | **deploy ao vivo** em [corretop.vercel.app](https://corretop.vercel.app) 🚀 |
| 1.6 | Iniciar verificação da conta Meta Business da CorreTop | 🔶 Risco | ⏳ | Processo externo (2-10 dias úteis), iniciado em paralelo |
| 1.7 | Configurar GitHub Actions (lint + type-check básico) | 🟡 P1 | ✅ | CI pipeline com lint, type-check e build |

**Entrega do dia:** login funcionando ✅, tenant isolado ✅, deploy ao vivo ✅.

**Arquivos de relatório:** `implementations/dia1-fundacao.md`

---

## Dia 2 — Multi-tenancy Operacional 🟡 **~40%** (3/7)

**Objetivo do dia:** uma corretora consegue ser criada, configurada e ter sua equipe convidada.

| # | Funcionalidade | Prioridade | Status | Como funciona |
|---|---|---|---|---|
| 2.1 | Painel de super-admin básico (listar tenants, ativar/desativar) | 🟡 P1 | 🔶 Parcial | Rotas `/super-admin` + `/super-admin/tenants/[tenantId]` existem, mas ações de ativar/desativar precisam ser validadas |
| 2.2 | CRUD de filiais/unidades dentro do tenant | 🔴 P0 | 🔶 Parcial | Rota `/filiais` existe, conteúdo a verificar |
| 2.3 | Convite de Gestor/Corretor por e-mail (link para criar senha) | 🔴 P0 | ✅ | `src/features/team/invites.ts` + `src/app/(auth)/invite/accept/page.tsx` — fluxo completo de convite com hash de senha |
| 2.4 | Menu de navegação diferenciado por papel | 🔴 P0 | 🔶 Parcial | `AppShell` + `CorretopSidebar` + `CorretorSidebar` existem, mas menus específicos por papel precisam ser validados |
| 2.5 | Tela de boas-vindas / checklist de primeiros passos (Diretor) | 🟡 P1 | ❌ | Não implementado |
| 2.6 | White-label básico (logo + cor por tenant) | 🟢 P2 | 🔶 Parcial | `ColorPicker` existe em settings, `brandColor` e `logoUrl` no schema, mas UI de upload e aplicação do tema não está completa |
| 2.7 | 2FA opcional (TOTP) | 🟢 P2 | ❌ | Não implementado |

**Entrega do dia:** Diretor consegue logar, criar filiais, convidar Gestor e Corretor, e cada um vê seu próprio menu.

---

## Dia 3 — Núcleo do CRM 🟡 **~50%** (5/10)

**Objetivo do dia:** o coração do sistema — leads entrando, sendo distribuídos e monitorados. Este é o item #1 da sua priorização.

| # | Funcionalidade | Prioridade | Status | Como funciona |
|---|---|---|---|---|
| 3.1 | Cadastro manual de lead | 🔴 P0 | ✅ | `src/features/leads/manual-create.ts` — formulário com validação de telefone, email, LGPD, duplicidade |
| 3.2 | Webhook genérico de recebimento de leads (token por tenant) | 🔴 P0 | ✅ | **Endpoint `/api/webhooks/leads/[tenantId]`** — autenticação Bearer com hash SHA-256, idempotência, 38 testes unitários, doc completa |
| 3.3 | Funil de status do lead (9 etapas + regras de permissão) | 🔴 P0 | ✅ | Motor de transição com regras: broker só próprio lead, manager só filial, director tudo. Reabertura restrita, `convertido` bloqueado manualmente, `perdido` exige motivo |
| 3.4 | Timeline de interações do lead | 🔴 P0 | ✅ | Componente `LeadTimeline` com ícones por tipo, ordenação cronológica, destaque visual para reaberturas |
| 3.5 | Distribuição round-robin (respeitando filial e status de disponibilidade) | 🔴 P0 | ❌ | Campo `corretorId` no schema existe, lógica de distribuição automática não implementada |
| 3.6 | Status "pausado/disponível" do corretor | 🔴 P0 | ❌ | Schema de user tem `status`, mas toggle e lógica de disponibilidade não implementados |
| 3.7 | Motor de SLA — "Não Trabalhado" (sem interação em X tempo) | 🔴 P0 | ❌ | Não implementado |
| 3.8 | Motor de SLA — "Estagnado" (mesma etapa por muito tempo) | 🟡 P1 | ❌ | Campo `stage_entered_at` existe no schema e é resetado a cada mudança de status, mas motor de verificação não implementado |
| 3.9 | Motivo de perda (lista fixa) | 🔴 P0 | ✅ | `MOTIVOS_PERDA` em `lead-status-constants.ts` — 7 motivos fixos, campo obrigatório ao marcar como perdido |
| 3.10 | Notificações in-app (sino) + push (Service Worker) | 🟡 P1 | ❌ | Não implementado |

**Entrega do dia:** um lead pode entrar (manual ✅ ou via webhook ✅), ser distribuído automaticamente ❌, e o sistema já sinaliza quando ele está esquecido ou parado ❌.

**Arquivos de relatório:** `implementations/lead-webhook.md`, `implementations/lead-status-funnel.md`

---

## Dia 4 — Telas de Trabalho 🟡 **~28%** (2.5/9)

**Objetivo do dia:** transformar a lógica do Dia 3 em telas que o corretor e o gestor realmente usam no dia a dia.

| # | Funcionalidade | Prioridade | Status | Como funciona |
|---|---|---|---|---|
| 4.1 | Fila de leads do corretor (lista ordenável/filtrável, paginação tradicional) | 🔴 P0 | ❌ | Tabela com badge de urgência (ícone + cor) |
| 4.2 | Filtros salváveis | 🟢 P2 | ❌ | Persistir combinação de filtro em JSON vinculado ao usuário |
| 4.3 | Busca global (Cmd/Ctrl+K) | 🟢 P2 | ❌ | Busca simples em leads/clientes, se der tempo no dia |
| 4.4 | Tela de detalhe do lead (dados + botões de ação) | 🔴 P0 | 🔶 Parcial | Rota `/leads/[id]` existe com timeline e status selector, mas faltam dados completos e botões de ação |
| 4.5 | Modal de confirmação para ações críticas | 🔴 P0 | ✅ | Implementado no `LeadStatusSelector` (dialog de confirmação ao perder lead) |
| 4.6 | Home do Corretor (dashboard pessoal: conversão, leads pendentes) | 🟡 P1 | 🔶 Parcial | `BrokerResumeDashboard` existe, conteúdo a verificar |
| 4.7 | Home do Gestor (alertas + visão da equipe + funil) | 🟡 P1 | 🔶 Parcial | `ManagerDashboard` existe, conteúdo a verificar |
| 4.8 | Seletor de filial ativa (para Gestor/Diretor com múltiplas filiais) | 🟡 P1 | ❌ | Não implementado |
| 4.9 | Estado vazio da fila (corretor novo sem leads) | 🟢 P2 | ❌ | Não implementado |

**Entrega do dia:** o corretor já consegue trabalhar 100% dentro do sistema (ver lead, mudar status, agir); o gestor já enxerga sua equipe.

---

## Dia 5 — Cotador e Gestão Documental ⬜ **0%** (0/10)

**Objetivo do dia:** os dois módulos que sustentam o fechamento da venda.

| # | Funcionalidade | Prioridade | Status | Como funciona |
|---|---|---|---|---|
| 5.1 | Catálogo global de operadoras/planos (upload manual de tabela) | 🔴 P0 | ❌ | Upload de planilha/documento pelo Diretor/equipe CorreTop |
| 5.2 | Catálogo próprio do tenant (planos exclusivos da corretora) | 🟡 P1 | ❌ | Mesma estrutura, escopo isolado por tenant |
| 5.3 | Scraping automático de tabelas de operadoras | ❌ 🔶 | ❌ | Cortado do MVP |
| 5.4 | Geração de cotação (modal single-step, dentro da tela do lead) | 🔴 P0 | ❌ | Escolher operadora/plano/beneficiários, calcular valor |
| 5.5 | Versionamento de cotações (histórico, não sobrescreve) | 🟡 P1 | ❌ | Novo registro a cada geração |
| 5.6 | Exportação de cotação em PDF | 🔴 P0 | ❌ | Geração server-side |
| 5.7 | Checklist de documentos obrigatórios por plano/operadora | 🔴 P0 | ❌ | Configuração simples de itens obrigatórios |
| 5.8 | Upload de documento (pelo corretor ou cliente) | 🔴 P0 | ❌ | Storage S3-compatible, vinculado ao lead |
| 5.9 | Fila central de aprovação de documentos | 🔴 P0 | ❌ | Lista consolidada de pendências |
| 5.10 | Aprovação em lote (bulk actions) | 🟡 P1 | ❌ | Selecionar múltiplos documentos e aprovar de uma vez |

**Entrega do dia:** o corretor cota, o cliente manda documento, o gestor aprova.

---

## Dia 6 — Comissão, Pós-venda, Metas e WhatsApp ⬜ **0%** (0/10)

**Objetivo do dia:** o motor financeiro + o item #2 da sua priorização (WhatsApp). Dia mais denso — se algo escorregar, é aqui.

| # | Funcionalidade | Prioridade | Status | Como funciona |
|---|---|---|---|---|
| 6.1 | Regras de comissão (única ou escalonada, configurável) | 🔴 P0 | ❌ | Configuração por operadora/plano |
| 6.2 | Geração automática do cronograma de repasse ao converter venda | 🔴 P0 | ❌ | Calcula mês a mês com base na data de venda |
| 6.3 | Marcação manual de comissão paga | 🟡 P1 | ❌ | Toggle simples por linha do cronograma |
| 6.4 | Exportação de relatório de comissão (Excel/CSV) | 🔴 P0 | ❌ | Fechamento mensal |
| 6.5 | Criação de "Cliente Ativo" ao converter venda | 🟡 P1 | ❌ | Vinculado à venda |
| 6.6 | Alerta de renovação/aniversário de contrato | 🟢 P2 | ❌ | Notificação in-app + push |
| 6.7 | Reengajamento automático de leads perdidos | 🟢 P2 | ❌ | Mensagem automática após período configurável |
| 6.8 | Módulo de metas comerciais | 🟡 P1 | ❌ | Definição pelo Gestor/Diretor + barra de progresso |
| 6.9 | WhatsApp — integração real via Meta Cloud API | 🟡 / 🔶 | ❌ | Depende da verificação da Meta (item 1.6) |
| 6.10 | WhatsApp — fallback (botão WhatsApp Web) | 🔶 | ❌ | Contingência para caso a verificação não saia a tempo |

**Entrega do dia:** comissão calculada, metas visíveis, WhatsApp funcionando (ou fallback).

---

## Dia 7 — Integridade, Segurança, Polimento e Go-Live 🟡 **~21%** (2.5/12)

**Objetivo do dia:** fechar o diferencial antifraude, revisar tudo, e colocar o primeiro cliente no ar.

| # | Funcionalidade | Prioridade | Status | Como funciona |
|---|---|---|---|---|
| 7.1 | Log de exportação de dados | 🔴 P0 | ❌ | Registrado automaticamente em toda exportação |
| 7.2 | Histórico de login/sessão (IP, dispositivo) | 🟡 P1 | ❌ | Visível para Gestor/Diretor |
| 7.3 | Alerta de taxa de perda anormal por corretor | 🔴 P0 | ❌ | Comparação estatística com a média da equipe |
| 7.4 | Painel de Integridade/Auditoria | 🔴 P0 | ❌ | Tela central consolidando alertas |
| 7.5 | Reabertura de lead perdido + reatribuição manual | 🟡 P1 | ✅ (core) | Motor de reabertura implementado no `change-lead-status`, falta integração com UI de reatribuição |
| 7.6 | Exportação de relatório de evidências | 🟢 P2 | ❌ | Histórico completo do lead |
| 7.7 | Consentimento LGPD + logs de auditoria | 🔴 P0 | 🔶 Parcial | Consentimento existe no cadastro manual de lead, `auditLogs` implementado em mudanças de status e criação |
| 7.8 | Dark mode | 🟢 P2 | ✅ | Tema escuro configurado via CSS variables (`globals.css`), ativo por padrão no `layout.tsx` |
| 7.9 | PWA instalável | 🟢 P2 | ❌ | Não implementado |
| 7.10 | Testes E2E (Playwright) | 🔴 P0 | ❌ | 4 fluxos críticos |
| 7.11 | QA manual geral + correção de bugs | 🔴 P0 | ❌ | Passar por todas as telas |
| 7.12 | Deploy final em produção + onboarding | 🔴 P0 | ❌ | Cadastrar corretora real |

**Entrega do dia:** sistema no ar, primeiro cliente operando, módulo antifraude ativo.

---

## O Que Fica Fora dos 7 Dias (Backlog Imediato Pós-Semana 1)

| Item | Por que ficou de fora |
|---|---|
| Scraping automático de tabelas de operadoras | Alto esforço de engenharia + manutenção contínua; upload manual já resolve a necessidade imediata |
| Assinatura eletrônica de documentos | Já definido como Fase 2/3 desde o levantamento de requisitos |
| Conciliação com relatório de apólices da operadora (antifraude avançado) | Depende de disponibilidade externa das operadoras; não é bloqueante para o go-live |
| Gamificação/ranking de corretores | Não prioritário, confirmado pelo próprio dono do projeto |
| Reatribuição em massa de leads | Reatribuição manual (um a um) já cobre o caso de uso no volume esperado |
| Exportação/portabilidade de dados (LGPD self-service) | Processo manual via suporte já é suficiente no início |
| Página dedicada de histórico de notificações | Dropdown simples já cobre a necessidade do dia a dia |

---

## Riscos da Semana e Como Reagir

1. **Se a verificação da conta Meta Business não sair a tempo do Dia 6** → seguir com o fallback (botão WhatsApp Web) e trocar pela integração completa via Cloud API assim que aprovada, sem bloquear o go-live do Dia 7.
2. **Se o Dia 6 (o mais denso) atrasar** → o primeiro corte é o item 6.7 (reengajamento automático de perdidos) e 6.6 (alerta de renovação), que são 🟢 P2 — não comprometem a operação básica.
3. **Se sobrar tempo em qualquer dia** → puxar itens 🟡/🟢 do dia seguinte para frente, nunca adiantar um item 🔴 P0 de um módulo ainda sem sua base pronta (ex: não adianta mexer em comissão antes do funil de leads estar sólido).
4. **Checkpoint diário recomendado:** ao final de cada dia, confirmar que os itens 🔴 P0 daquele dia estão realmente funcionando antes de avançar — é melhor perder 30 minutos revalidando do que descobrir no Dia 7 que a base do Dia 3 tinha um bug silencioso.
5. **Meta Business iniciada mas não verificada** (item 1.6) — processo externo de 2-10 dias úteis; não bloqueia nenhum item de código, mas impacta o WhatsApp do Dia 6.

---

*Plano de desenvolvimento gerado com base no Documento de Requisitos e no Documento de Arquitetura de Desenvolvimento do CorreTop, sequenciado para execução solo em 7 dias / 98 horas.*

*Última atualização: 12/07/2026 — Progresso ~20% (16/65 itens concluídos)*
