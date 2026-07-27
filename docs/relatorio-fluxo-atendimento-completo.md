# Relatório: Fluxo de Atendimento Completo (sem WhatsApp)

> **Data:** 21/07/2026
> **Escopo:** Leads → Distribuição → Atendimento → Feedbacks → Registro de Venda → Cliente
> **Exclui:** WhatsApp/Meta Cloud API, push notifications externas

---

## 1. Status geral por etapa

### 1.1 Leads → Entrada no sistema

| Subetapa | Status | Detalhes |
|----------|--------|----------|
| Cadastro manual | ✅ Pronto | Formulário manual com nome, telefone, email, plano, tipo (PF/PME) |
| Webhook autenticado | ✅ Pronto | POST /api/webhooks/leads com Bearer token, Zod validation |
| Importação CSV em massa | ✅ Pronto | Upload CSV com mapeamento de colunas, deduplicação por telefone |
| Fonte/rastreamento | ✅ Pronto | `source`, `sourceCampaign`, `tipo` (PF/PME) persistidos |
| Idempotência | ✅ Pronto | Chave por `external_id` + `webhook_credential_id` |
| Tests de contrato/intake | ⚠️ Parcial | Testes deterministas ok; integração PostgreSQL + E2E dependem de `TEST_DATABASE_URL` |

### 1.2 Distribuição → Atribuição a corretores

| Subetapa | Status | Detalhes |
|----------|--------|----------|
| Distribuição round-robin por capacidade | ✅ Pronto | Menor carga ativa, desempate por criação |
| Branch routing (por filial) | ✅ Pronto | Lead vai para filial da credencial ou fallback para primeira ativa |
| Fila de distribuição (sem corretor) | ✅ Pronto | Fica como `new` com `distributionStatus: queued` |
| Pausar/Retomar disponibilidade | ✅ Pronto | Toggle no dashboard, respeitado pelo distribuidor |
| Reatribuição manual | ✅ Pronto | Gestor/Diretor podem reatribuir com reinício de SLA |
| Inbox geral (gerenciamento de fila) | ⚠️ Parcial | Interface em `/leads/distribuicao` criada, mas **jobs de processamento/recuperação** ainda precisam ser conectados |
| Plantão (duty roster) | ⚠️ Parcial | Schema e rota existem; integração com distribuição ainda não completa |
| Regras de distribuição por unidade | ✅ Pronto | Escopo por branchId, fallback para matriz/geral |

### 1.3 Atendimento → Ações do corretor

| Subetapa | Status | Detalhes |
|----------|--------|----------|
| Detalhe do lead | ✅ Pronto | Perfil completo com nome, contato, status, responsável, unidade |
| LeadActionHub | ✅ Pronto | Hub central com próxima ação, atalhos, tarefas |
| LeadProgressStepper | ✅ Pronto | Stepper visual: Recebido → Em contato → Cotação → Negociação → Fechamento |
| Iniciar atendimento | ✅ Pronto | Botão que muda status para `in_contact`, registra timeline |
| Seletor de status | ✅ Pronto | Transições válidas por regra de negócio |
| Timeline de interações | ✅ Pronto | Histórico completo com notas, sistema, documentos |
| Tarefas no lead | ✅ Pronto | CRUD completo com assignee, prioridade, vencimento |
| Lembretes de retorno | ✅ Pronto | Presets hoje/amanhã/data personalizada |
| Notas rápidas | ✅ Pronto | LeadQuickNote inline |
| Central de conversas | ✅ Pronto | Rota `/conversas` com histórico, perfil, atalhos |
| SLA (não trabalhado) | ✅ Pronto | Motor cron a cada 5 min, notifica gestores |
| SLA (estagnado) | ✅ Pronto | Identifica leads sem avanço no status |
| SupervisionPanel (gestor/diretor) | ✅ Pronto | Métricas, assumir conversa, reatribuir, investigar |

### 1.4 Feedbacks → Registro de andamento

| Subetapa | Status | Detalhes |
|----------|--------|----------|
| Feedback inline no hub | ✅ Pronto | Acordeão expandível no LeadActionHub (P1) |
| Modo rápido (2 campos) | ✅ Pronto | Tipo de contato + próxima ação (P2) |
| Checklist pós-submissão | ✅ Pronto | Widget colapsável que aparece após feedback salvo (P2) |
| Tipos de feedback | ✅ Pronto | 9 tipos: contacted, no_answer, callback_requested, etc. |
| Checklist templates | ✅ Pronto | Perguntas configuráveis por tenant (boolean, rating, text, select) |
| SLA de feedback | ✅ Pronto | Timeout → redistribuição automática |
| Lembretes de feedback | ✅ Pronto | Job cron para leads sem feedback recente |
| Reengajamento de perdidos | ✅ Pronto | Notifica corretor após 30 dias sem contato |

### 1.5 Registro de Venda → Conversão

| Subetapa | Status | Detalhes |
|----------|--------|----------|
| RegisterSalePanel | ✅ Pronto | Formulário com apólice, vigência, valor, documento de confirmação |
| Operadora no registro | ✅ Pronto | Select de operadora + resolução automática de plano (P4) |
| Validação de beneficiários | ✅ Pronto | Exige titular cadastrado antes de converter |
| Validação de documentos | ✅ Pronto | Verifica documentos obrigatórios aprovados |
| Geração de comissão | ✅ Pronto | Cronograma de parcelas gerado na conversão |
| Criação de cliente ativo | ✅ Pronto | `activeCustomers` + `clients` criados na transação |
| Notificação de conversão | ✅ Pronto | Push + in-app notification |
| Cálculo de cotação por linha (UI) | ❌ **Pendente** | O QuoteBuilder existe, mas o rateio por beneficiário na UI não está conectado ao fluxo de venda |
| Materialização checklist por beneficiário | ❌ **Pendente** | Checklist de documentos por beneficiário não está 100% materializado |

### 1.6 Cliente → Pós-venda

| Subetapa | Status | Detalhes |
|----------|--------|----------|
| Cliente criado na conversão | ✅ Pronto | Tabela `clients` com dados do lead |
| Listagem de clientes | ✅ Pronto | Rota `/clientes` |
| Cliente ativo com vigência | ✅ Pronto | `activeCustomers` com `coverageStartDate`, `contractAnniversary` |
| Cancelamento de cliente | ✅ Pronto | `cancelActiveCustomerAction` com chargeback |
| Configuração de chargeback | ✅ Pronto | Janela configurável (padrão 90 dias) |
| Alertas de aniversário/renovação | ✅ Pronto | Job diário para próximos 30 dias |
| Checklist pós-conversão | ✅ Pronto | `/checklist` com abas pré e pós-conversão |
| Fila de cancelamentos no financeiro | ❌ **Pendente** | Não há uma visão dedicada para cancelamentos pendentes |
| E2E de pós-venda | ❌ **Pendente** | Testes ponta a ponta do registro de venda → cliente ativo → cancelamento |

---

## 2. Pipeline de status (completo)

```
new ──→ distributed ──→ in_contact ──→ quote_sent ──→ negotiation ──→ documentation_pending ──→ under_analysis ──→ converted
  │                        │               │               │                      │                        │
  └──→ lost ←──────────────┴───────────────┴───────────────┴──────────────────────┴────────────────────────┘
  lost ──→ (qualquer status ativo via reabertura)
```

Transições validadas em `VALID_TRANSITIONS`. ✅

---

## 3. Gaps que impedem o build completo

### 🔴 P0 — Bloqueante para operação

| # | Gap | Impacto | Arquivos envolvidos |
|---|-----|---------|---------------------|
| G1 | **Jobs de processamento da distribuição** não conectados | Leads em fila (`queued`/`unassigned`) não são processados automaticamente; dependem de ação manual do gestor | `src/features/lead-distribution/jobs.ts`, `/leads/distribuicao` |
| G2 | **TEST_DATABASE_URL** para testes de integração | Impede testar concorrência real, idempotência PostgreSQL, rollback | `docs/lead-intake-test-plan.md` |
| G3 | **Semântica de lead sem unidade** não decidida | Quando um lead chega sem branchId e a credencial não tem filial, o comportamento atual faz fallback ambíguo | `docs/lead-intake-test-plan.md` |

### 🟡 P1 — Impacto operacional médio

| # | Gap | Impacto | Arquivos envolvidos |
|---|-----|---------|---------------------|
| G4 | **Cálculo de cotação por linha na UI** não conectado ao fluxo de venda | O QuoteBuilder gera cotações com itens por beneficiário, mas o rateio detalhado não persiste no registro de venda | `src/features/leads/components/quote-builder/` |
| G5 | **Fila de cancelamentos no financeiro** | Não há visão dedicada para gestor/diretor revisar cancelamentos pendentes de chargeback | `src/features/post-sale/actions.ts` (cancelActiveCustomerAction existe, mas sem UI de fila) |
| G6 | **Materialização completa do checklist por beneficiário** | Checklist de documentos por beneficiário existe no banco mas a UI de acompanhamento por beneficiário não está completa | `src/features/documents/` |
| G7 | **NOC por unidade** está `partial` | Saúde operacional por filial com SLA, fila sem corretor, capacidade e atalhos | `src/features/noc/` |

### 🔵 P2 — Melhoria, não bloqueia

| # | Gap | Impacto | Arquivos envolvidos |
|---|-----|---------|---------------------|
| G8 | **E2E do fluxo completo** (Lead → Venda → Cliente) | Sem teste automatizado para regredir o fluxo principal | `tests/e2e/` |
| G9 | **Índice de prontidão dos módulos** | Usuário descobre dependências só ao clicar em ação | `src/features/guide/` |
| G10 | **Histórico de alterações do lead** (N8 - planned) | Depende de consulta separada em auditoria | `src/features/audit/` |
| G11 | **Resumo diário do Diretor** (N9 - planned) | Falta visão consolidada do dia | Dashboard do Diretor |

---

## 4. O que já está sólido (não precisa tocar)

- ✅ **Lead intake**: manual, webhook, CSV — completo com idempotência e rastreamento
- ✅ **Distribuição round-robin**: por capacidade, branch, disponibilidade — funcional
- ✅ **Atendimento**: hub, stepper, feedback inline, tarefas, timeline, SLA motors — polido (P1-P5)
- ✅ **Feedbacks**: formulário rápido, checklist pós-submissão, SLA timeout, lembretes
- ✅ **Registro de venda**: validação multi-camada (beneficiários, documentos, operadora), geração de comissão, criação de cliente ativo
- ✅ **Pós-venda**: cancelamento auditável, chargeback configurável, renovação, reengajamento
- ✅ **Catálogo de planos**: global + privado, versões, disponibilidade por tenant/unidade
- ✅ **Comissões**: regras configuráveis, cronograma, marcação de pagamento, exportação CSV
- ✅ **Metas**: por corretor/equipe/filial, cálculo automático
- ✅ **Documentos**: upload, requisitos por plano, fila de aprovação, bulk actions
- ✅ **Cotações**: geração, versionamento, PDF, link público

---

## 5. Resumo executivo

```
Fluxo completo: Leads → Distribuição → Atendimento → Feedback → Venda → Cliente
                                ↓
                  ✅ 85% implementado
                  ⚠️ 15% precisa de conexão/polimento

Itens críticos (P0) para first build:
  1. Conectar jobs de distribuição → processamento automático de fila
  2. Decidir semântica de lead sem unidade (fila geral vs fallback)
  3. Setup de TEST_DATABASE_URL para testes de integração

Sem esses 3 itens, o fluxo funciona para operação manual 
supervisionada, mas não roda automaticamente sem intervenção 
do gestor/diretor.
```

---

## 6. Estimativa de esforço

| Prioridade | Itens | Esforço estimado |
|-----------|-------|-----------------|
| P0 | G1, G2, G3 | 2-3 dias |
| P1 | G4, G5, G6, G7 | 4-5 dias |
| P2 | G8, G9, G10, G11 | 3-4 dias |
| **Total** | **11 gaps** | **~10-12 dias** |

### Atualizacao de implementacao — 21/07/2026

O checklist documental por beneficiario foi persistido no nucleo do atendimento pela migration `0069_persist_lead_document_checklist.sql`. Cada requisito individual possui uma linha por titular/dependente; requisitos familiares possuem uma linha por lead. Upload, aprovacao, rejeicao e exclusao sincronizam o estado persistido, e o detalhe do lead exibe o andamento por pessoa. O item deixa de ser uma lacuna funcional; permanecem apenas os itens de infraestrutura e cobertura E2E listados no roadmap.
