# Análise do Fluxo de Atendimento: Corretor ↔ Cliente

## Mapeamento completo de cada etapa, ações do corretor e status do sistema

> **Objetivo:** Validar se o painel de atendimento do corretor está completo e preparado para todas as etapas, identificar lacunas e priorizar melhorias.

---

## 📋 Resumo do Fluxo Ideal (9 Etapas)

```
Chegada → Atribuição → 1º Contato → Qualificação → Cotação → Negociação → Fechamento → Pós-Venda → Fidelização
```

---

## 🔷 ETAPA 1 — Chegada do Lead

**O que acontece:** O lead chega via webhook (parceiro, site, CRM externo) ou cadastro manual.

| O corretor precisa... | Status no CorreTop |
|---|---|
| Ver o lead chegar em tempo real | ✅ Notificação push + in-app (realtime) |
| Ver dados básicos (nome, telefone, origem) | ✅ Visível no perfil do lead |
| Saber a origem do lead (qual parceiro/site) | ✅ Campo `origem` (manual/webhook) + webhook credential |
| Saber se tem consentimento LGPD | ✅ Campo `consentimentoLgpd` + badge na conversa |

**Status do sistema:** `new`

**Gap:** Nenhum. ✅

---

## 🔷 ETAPA 2 — Atribuição/Distribuição

**O que acontece:** O sistema atribui o lead ao corretor disponível. O lead fica na fila do corretor.

| O corretor precisa... | Status no CorreTop |
|---|---|
| Receber o lead automaticamente | ✅ Round-robin + distribuição automática |
| Ver os leads pendentes na fila | ✅ Dashboard com `distributed` count + `/minha-fila` |
| Saber há quanto tempo o lead está esperando | ✅ Card "Pendentes" com `oldestMinutes` + SLA |
| Pausar recebimento quando estiver ocupado | ✅ `availabilityStatus` (available/paused) |
| Ser notificado de novo lead | ✅ Push + in-app notification |

**Status do sistema:** `distributed`

| Ações do corretor nesta etapa | Status |
|---|---|
| Visualizar dados do lead (com máscara) | ✅ Telefone mascarado até iniciar atendimento |
| Iniciar o atendimento (start service) | ✅ Botão "Iniciar atendimento" |
| Registrar feedback obrigatório | ✅ LeadFeedbackForm + SLA de feedback |

> **Importante:** Nesta fase, dados sensíveis (telefone, e-mail) ficam mascarados até o corretor iniciar o atendimento — proteção LGPD.

**Gap:** Nenhum. ✅

---

## 🔷 ETAPA 3 — Primeiro Contato (Abordagem)

**O que acontece:** O corretor inicia o atendimento e faz a primeira abordagem com o cliente.

| O corretor precisa... | Status no CorreTop |
|---|---|
| Iniciar o atendimento (1 clique) | ✅ `startLeadServiceAction` — libera dados + registro na timeline |
| Abrir WhatsApp Web/app do cliente | ✅ Redireciona para `wa.me/telefone` após iniciar |
| Usar o chat interno do CorreTop | ✅ Chat via WhatsApp integrado (OpenWA) |
| Ter um roteiro/mensagem de primeiro contato | ⚠️ **Modelos de mensagens é P1 planned** — não implementado |
| Registrar o resultado do contato | ✅ LeadFeedbackForm com tipos de resultado |
| Ver o histórico de mensagens trocadas | ✅ Timeline + Conversas com mensagens do WhatsApp |

**Status do sistema:** `in_contact`

| Perguntas que o corretor faz ao cliente nesta etapa |
|---|
| "Já conhece nossos planos?" |
| "Está procurando plano para você ou para família?" |
| "Qual operadora você prefere?" |
| "Tem alguma urgência ou prazo para contratar?" |

**Gaps detectados:**
- ❌ **Modelos de mensagens** (P1 planned) — não há templates de saudação/primeiro contato
- ❌ **Script de qualificação** — não há um guia/checklist de perguntas para o corretor seguir

---

## 🔷 ETAPA 4 — Qualificação e Levantamento de Necessidades

**O que acontece:** O corretor entende o perfil do cliente para recomendar o plano ideal.

| O corretor precisa... | Status no CorreTop |
|---|---|
| Registrar faixas etárias dos beneficiários | ✅ No modal de cotação (`lives` com `ageBand` + `quantity`) |
| Saber a operadora de preferência | ✅ Catálogo de operadoras disponível |
| Registrar observações da conversa | ✅ LeadTimeline com notas (textarea + quick messages) |
| Anotar detalhes importantes do cliente | ✅ Notas na timeline |
| Criar tarefas de follow-up | ✅ LeadTasks com prioridade/prazo |

**Informações que o corretor coleta:**
- Quantas vidas (titular + dependentes)?
- Faixas etárias de cada um
- Operadora de preferência (se houver)
- Tipo de plano: Individual, Familiar, Empresarial, PME
- Cobertura desejada (ambulatorial, hospitalar, odontológico?)
- Orçamento mensal disponível
- Carências já cumpridas em plano anterior (portabilidade)
- Condições de saúde preexistentes (se aplicável)

**Status do sistema:** `in_contact` (continua)

**Gaps detectados:**
- ❌ **Campos de perfil do cliente** — não há campos estruturados para armazenar as necessidades coletadas (orçamento, preferências, condições de saúde). Tudo vai como nota solta na timeline.

---

## 🔷 ETAPA 5 — Cotação / Proposta Comercial

**O que acontece:** O corretor monta a proposta com planos, calcula valores por faixa etária e compartilha com o cliente.

| O corretor precisa... | Status no CorreTop |
|---|---|
| Selecionar planos do catálogo | ✅ Catálogo de operadoras + planos por tenant |
| Calcular valores por faixa etária | ✅ `carrierPlanPrices` com `ageBand` + `monthlyPrice` |
| Gerar cotação com múltiplos planos | ✅ `createQuoteAction` — até N planos |
| Marcar um plano como recomendado | ✅ `recommended` no `quoteItems` |
| Adicionar observações à cotação | ✅ Campo `notes` na cotação |
| Compartilhar link público com o cliente | ✅ `shareQuoteAction` → link público `/proposta/[token]` |
| Gerar PDF da proposta | ✅ PDF server-side com logo, corretor, planos |
| Acompanhar se o cliente visualizou | ✅ Status: draft → shared → sent → accepted |
| Registrar cotação na timeline | ✅ `leadInteractions` com `quote_generated` |
| Criar tarefa automática de follow-up da cotação | ⚠️ **Não gera tarefa automaticamente** |

**Ações do corretor na interface:**
1. Clica em "Criar cotação" no lead → abre `QuoteModal`
2. Seleciona planos → sistema calcula valores por faixa etária
3. Adiciona observações
4. Cotação gerada como "draft"
5. Compartilha → status vira "shared" → link público ativado
6. Envia o link/PDF para o cliente via WhatsApp

**Status do sistema:** `quote_sent`

**Gaps detectados:**
- ⚠️ **Tarefa automática de follow-up da cotação** — não é gerada automaticamente
- ⚠️ **Notificação quando cliente abre o link** — não temos tracking de visualização pública
- ❌ **"Cotação aceita" não dispara fluxo automático** — o sistema não tem um evento de `quote.accepted` que avance o lead automaticamente para `negotiation` ou gere ação

---

## 🔷 ETAPA 6 — Negociação

**O que acontece:** O corretor negocia condições (preço, carências, rede credenciada) e responde dúvidas do cliente.

| O corretor precisa... | Status no CorreTop |
|---|---|
| Conversar com o cliente (WhatsApp/chat) | ✅ Chat interno integrado ao WhatsApp |
| Registrar objeções do cliente | ✅ Notas na timeline |
| Ajustar a proposta (nova cotação) | ✅ Cada cotação é versionada (nova = nova versão) |
| Registrar que está em negociação | ✅ `LeadStatusSelector` → `negotiation` |
| Criar tarefas de follow-up | ✅ LeadTasks |
| Registrar feedback periódico | ✅ LeadFeedbackForm |

**Objeções comuns do corretor precisa saber lidar:**
- "Está muito caro" → explicar cobertura, rede, benefícios
- "Vou pensar" → agendar follow-up
- "Tem carência" → explicar portabilidade
- "Minha empresa já dá plano" → explicar vantagens de plano próprio

**Status do sistema:** `negotiation`

**Gap:** Nenhum crítico. ⚠️ **Templates de mensagens para objeções comuns** (P1 planned) ajudaria muito aqui.

---

## 🔷 ETAPA 7 — Fechamento (Documentação + Análise + Conversão)

**O que acontece:** Cliente aceita a proposta, corretor coleta documentos, operadora analisa, contrato é assinado.

### Sub-etapa 7.1 — Documentação

| O corretor precisa... | Status no CorreTop |
|---|---|
| Saber quais documentos pedir | ✅ `documentRequirements` configuráveis por operadora/plano |
| Solicitar documentos ao cliente | ✅ Seção de documentos no lead com requisitos |
| Fazer upload dos documentos | ✅ `LeadDocumentsSection` com upload por requisito |
| Acompanhar status da aprovação | ✅ Status: pending → approved/rejected + badges |
| Reenviar documento rejeitado | ✅ Botão "Substituir" quando rejeitado |
| Gestor/Diretor aprovar/rejeitar | ✅ `reviewDocumentAction` + fila de aprovação |
| Aprovar em lote | ✅ `bulkReviewDocumentsAction` |

**Documentos típicos solicitados:**
- RG/CNH do titular
- CPF
- Comprovante de residência
- Comprovante de renda
- Exames médicos (se aplicável)
- Contrato social (para PME)

**Status do sistema:** `documentation_pending`

**Gap:** ❌ **Armazenamento de documentos** — o sistema faz upload para `/api/documents/upload` mas o usuário mencionou que "ainda não temos como armazenar documentos". Precisamos verificar se o upload está realmente funcional ou se o endpoint retorna erro. O sistema usa um `fileUrl` que é salvo no banco, mas pode ser que o armazenamento real (S3, R2, etc.) não esteja configurado.

### Sub-etapa 7.2 — Análise da Operadora

| O corretor precisa... | Status no CorreTop |
|---|---|
| Acompanhar a análise da operadora | ✅ Status `under_analysis` no lead |
| Registrar resultado da análise | ✅ Notas na timeline |
| Ser notificado quando a análise concluir | ⚠️ **Não há notificação automática** — o corretor precisa consultar manualmente |
| Informar o cliente sobre o resultado | ✅ Chat/WhatsApp integrado |

**Status do sistema:** `under_analysis`

**Gap:** ⚠️ **Notificação de conclusão de análise** — dependeria de webhook da operadora (fora do escopo atual).

### Sub-etapa 7.3 — Conversão (Fechamento da Venda)

| O corretor precisa... | Status no CorreTop |
|---|---|
| Registrar o valor do fechamento | ❌ **`saleValue = 0`** — valor fixado em 0 no código |
| Registrar o plano contratado | ✅ `sales.carrierPlanId` vincula o plano |
| Definir a data de vigência | ✅ `saleDate` na venda |
| Registrar condições especiais | ✅ Campo `notes` na venda |
| Cliente virar cliente ativo | ✅ `clients` criado automaticamente na conversão |
| Gerar cronograma de comissão | ✅ `generateCommissionSchedule` automático |
| Notificar equipe da conversão | ✅ Notificação `lead_converted` |

**⚠️ GRAVE — GAP CRÍTICO:**

O `changeLeadStatus` quando converte o lead para `converted` faz:

```typescript
const saleValue = 0; // ← VALOR FIXO!
// Valor será preenchido via cotação aceita em versão futura
await tx.insert(schema.sales).values({
  ...
  saleValue: String(saleValue),  // = "0"
  ...
});
```

**Isso significa que:**
1. ✅ O lead vira cliente (`clients` criado)
2. ✅ Uma venda é registrada
3. ✅ Cronograma de comissão é gerado
4. ❌ **O valor da venda é sempre 0,00** — sem possibilidade de o corretor informar o valor real
5. ❌ **Comissão calculada sobre R$ 0** — mesmo com regras configuradas, o repasse será zero

**Status do sistema:** `converted`

**Gaps:**
- ❌ **Não há formulário de fechamento** — o corretor não tem onde registrar:
  - Valor mensal da mensalidade contratada
  - Valor total anual do contrato
  - Número de vidas contratadas (quantas pessoas no plano)
  - Plano específico contratado (já tem o `planId`, mas poderia ser refinado)
  - Data de assinatura do contrato
  - Condições especiais negociadas
  
- ❌ **Comissão sempre zero** — porque `saleValue = 0`, toda comissão gerada é 0,00
- ❌ **Sem integração cotação-aceita → conversão** — a cotação pode ser "accepted" mas não dispara a conversão automaticamente

---

## 🔷 ETAPA 8 — Pós-Venda

**O que acontece:** Cliente já é ativo, precisa de acompanhamento.

| O corretor precisa... | Status no CorreTop |
|---|---|
| Ver lista de clientes ativos | ✅ `/clientes` com dados da conversão |
| Acompanhar aniversário de contrato | ✅ `renewal-reminders.ts` — notificação 30 dias antes |
| Ver cronograma de comissões | ✅ `/vendas/[id]` com `commissionSchedule` |
| Saber se a comissão foi paga | ✅ Status: pending → paid + `paidAt` |
| Registrar cancelamento | ✅ `saleStatus` com "cancelled" |
| Fazer follow-up de renovação | ⚠️ Notificação existe, mas **não gera tarefa automática** |
| Acessar documentos do cliente | ✅ Documentos vinculados ao lead |

**Status do sistema:** `converted` (cliente ativo)

**Gaps:**
- ⚠️ **Próximo contato de pós-venda** — não há sugestão automática de quando o corretor deve entrar em contato (ex: 30 dias após conversão para feedback de satisfação)

---

## 🔷 ETAPA 9 — Reativação / Reengajamento

**O que acontece:** Leads perdidos ou clientes inativos são reativados.

| O corretor precisa... | Status no CorreTop |
|---|---|
| Ver leads perdidos na fila | ✅ Dashboard mostra `lost` |
| Reabrir lead perdido | ✅ `changeLeadStatus` com permissão (gestor/diretor) |
| Ser notificado de leads perdidos antigos | ✅ `reengagement.ts` notifica leads perdidos > 30 dias |
| Cliente cancelou → virar lead novamente | ⚠️ **Não há fluxo cancelamento → reabertura automática** |

**Gap:** ⚠️ **Lead perdido não pode ser reaberto pelo próprio corretor** — só gestor/diretor pode reabrir. Isso limita a autonomia do corretor.

---

## 📊 MATRIZ DE GAPS PRIORIZADOS

| # | Gap | Impacto | Prioridade | Esforço |
|---|---|---|---|---|
| 1 | **Valor de venda sempre R$ 0** — sem formulário de fechamento | 🔴 Comissão sempre zero, relatórios financeiros incorretos | **P0 — Crítico** | Médio |
| 2 | **Sem formulário de fechamento** — corretor não registra valor, vidas, condições | 🔴 Venda incompleta sem dados financeiros | **P0 — Crítico** | Médio |
| 3 | **Cotação aceita não dispara conversão** — fluxo manual | 🟡 Fricção operacional | **P1** | Alto |
| 4 | **Modelos de mensagens** para primeiro contato, follow-up, objeções | 🟡 Corretor perde tempo digitando | **P1** | Médio |
| 5 | **Campos estruturados de perfil do cliente** (orçamento, preferências) | 🟡 Dados soltos em notas não-estruturadas | **P2** | Baixo |
| 6 | **Tarefa automática de follow-up de cotação** ao compartilhar | 🟡 Corretor pode esquecer de follow-up | **P2** | Baixo |
| 7 | **Corretor reabrir lead perdido** (hoje só gestor/diretor) | 🟡 Autonomia limitada | **P2** | Baixo |
| 8 | **Pós-venda: próximo contato sugerido** (ex: 30 dias) | 🟢 Experiência do cliente | **P3** | Baixo |

---

## 🏗️ ARQUITETURA ATUAL DO FECHAMENTO

Como a conversão acontece hoje no código:

```
changeLeadStatus({ leadId, newStatus: "converted" })
  ↓
db.transaction:
  1. Update lead: status = "converted", stageEnteredAt = now
  2. Insert leadInteractions: "Status alterado: ... → Convertido."
  3. Insert clients: { leadId, nome, telefone, email }
  4. Insert sales: {
       saleValue: 0,    // ← FIXO!
       carrierPlanId: lead.planId,
       brokerId: lead.corretorId,
       saleDate: now
     }
  5. generateCommissionSchedule(tenantId, saleId, lead.planId, saleValue=0)
     → schedule com amount = 0,00
  6. Insert auditLog: "converted"
  7. Insert notification: "Lead convertido em cliente"
```

**O problema:** Em nenhum momento o corretor informa o valor real. A cotação tem o valor calculado (`monthlyPrice`), mas esse valor nunca é carregado para a venda.

---

## 📋 AÇÕES RECOMENDADAS

### Ação 1 (P0): Formulário de Fechamento

Criar um modal/fluxo que o corretor acessa quando vai marcar o lead como "Convertido":

1. **Selecionar a cotação aceita** (ou criar manualmente)
2. **Confirmar valor mensal** (pré-preenchido da cotação, editável)
3. **Número de vidas contratadas** (pré-preenchido, editável)
4. **Data de início da vigência** (default: now)
5. **Observações** (opcional)

Ao confirmar:
- `saleValue` = valor informado (não mais zero)
- Gera `commissionSchedule` com o valor real
- Lead vira `converted`
- Cliente criado

### Ação 2 (P1): Integração Cotação → Conversão

Quando a cotação for marcada como "accepted" (pelo cliente via link público OU manualmente pelo corretor):
- Auto-avançar lead para `negotiation` ou `converted` 
- Carregar `lives` e `monthlyPrice` da cotação aceita para a venda

### Ação 3 (P1): Modelos de Mensagens

Implementar templates editáveis para:
- Primeiro contato: "Olá {nome}, aqui é {corretor} da {corretora}..."
- Envio de cotação: "Segue a proposta com os planos que conversamos..."
- Follow-up: "E aí {nome}, conseguiu dar uma olhada na proposta?"
- Documentação: "Precisamos de alguns documentos para dar andamento..."
- Pós-venda: "Tudo certo com o plano? Alguma dúvida?"

---

## ✅ STATUS GERAL DO PAINEL DO CORRETOR

| Funcionalidade | Status |
|---|---|
| Receber leads (distribuição automática) | ✅ Completo |
| Fila de leads pendentes | ✅ Completo |
| Iniciar atendimento | ✅ Completo |
| Chat WhatsApp integrado | ✅ Completo |
| Timeline de interações | ✅ Completo |
| Tarefas e follow-up | ✅ Completo |
| Catálogo de planos e operadoras | ✅ Completo |
| Cotação com cálculo por faixa etária | ✅ Completo |
| Compartilhamento de cotação (link + PDF) | ✅ Completo |
| Checklist de documentos | ✅ Completo |
| Upload e aprovação de documentos | ⚠️ Funcional, mas armazenamento precisa ser verificado |
| Feedback obrigatório com SLA | ✅ Completo |
| Notificações push + in-app | ✅ Completo |
| Dashboard com métricas | ✅ Completo |
| Redistribuição automática por SLA | ✅ Completo |
| **Registro de fechamento (valor da venda)** | **❌ SaleValue = 0 — gap crítico** |
| **Formulário de fechamento** | **❌ Inexistente — gap crítico** |
| Modelos de mensagens | ⚠️ P1 planned |
| Reabertura de lead perdido pelo corretor | ⚠️ Só gestor/diretor |
| Integração cotação-aceita → conversão | ❌ Fluxo manual |

---

> **Resumo:** O CorreTop tem 90% do fluxo de atendimento implementado. O gap mais crítico é a **ausência de um formulário de fechamento** que permita ao corretor registrar o valor real da venda — sem isso, todo o módulo de comissões gera valores zerados, relatórios financeiros ficam incorretos, e as metas não refletem a realidade.
