# Status do Projeto: Conversation Intelligence Engine (Etapa IA.1)

## 1. Visão Geral e Arquitetura

O **Conversation Intelligence Engine** é o motor de inteligência que analisa conversas de WhatsApp de forma contínua e assíncrona, extraindo percepção comercial estruturada, sinais de compra, objeções e sugestões de transição de status do CRM sem que a IA faça mutações diretas ou perigosas no banco de dados.

O `PipelineRoot` permanece como a única autoridade capaz de alterar o status real do lead.

```text
WHATSAPP / WAHA / META
        ↓
Inbound / Outbound Message
        ↓
Event Debounce (45s) / Periodic Worker (120min)
        ↓
Conversation Intelligence Context Builder
(Memória Anterior + Fatos + Últimas 12 Mensagens)
        ↓
AI Structured Assessment (Zod Schema)
        ↓
Policy Executor (Limiares de Confiança)
        ↓
┌────────────────────────────────────────────────────────┐
│ Decisão:                                               │
│ • Confiança < 0.70  → INSIGHT_ONLY (Enriquece Estado) │
│ • 0.70 ≤ C < 0.90   → SUGGEST (Aparece no CRM)         │
│ • C ≥ 0.90          → AUTO_TRANSITION (Pares Seguros)  │
│ • converted         → BLOQUEADO (SYSTEM_ONLY)          │
│ • lost              → BLOQUEADO (SUGGEST_ONLY)         │
└────────────────────────────────────────────────────────┘
        ↓
Gera Feedback Estruturado com source = "AI" na Timeline
```

---

## 2. O Que Já Foi Implementado e Entregue

1. **Domain Root Canônico**:
   - Arquivo: [`src/shared/domain-root/conversation-intelligence-root.ts`](src/shared/domain-root/conversation-intelligence-root.ts)
   - Configurações de governança: `analysisDebounceSeconds` (45s), `confidenceThresholdAuto` (0.90), `confidenceThresholdSuggest` (0.70), `periodicReconciliationMinutes` (120min).
   - Invariantes de segurança: `CONVERTED_NEVER_AUTO`, `CONFIDENCE_BOUNDS_VALID`, `TENANT_ISOLATION_MANDATORY`.

2. **Tipos e Schemas Estruturados (Zod)**:
   - Arquivo: [`src/features/conversation-intelligence/types.ts`](src/features/conversation-intelligence/types.ts)
   - `ConversationAssessmentSchema`: Valida `conversationStage`, `customerIntent`, `engagement`, `sentiment`, `objections`, `buyingSignals`, `pendingFrom`, `nextBestAction`, `suggestedLeadStatus`, `statusConfidence`, `summary`, `risk`, `opportunity`, `facts`, `inferences`.
   - `LeadIntelligenceState`: Estado consolidado da inteligência para exibição no CRM.

3. **Context Builder Otimizado**:
   - Arquivo: [`src/features/conversation-intelligence/context-builder.ts`](src/features/conversation-intelligence/context-builder.ts)
   - Monta contexto compacto de alta densidade semântica (dados do lead + resumo histórico + últimas $N$ mensagens) para evitar enviar centenas de mensagens repetidas para a IA.

4. **Policy Executor Determinístico**:
   - Arquivo: [`src/features/conversation-intelligence/policy-executor.ts`](src/features/conversation-intelligence/policy-executor.ts)
   - Aplica regras de decisão: `AUTO_TRANSITION` vs `SUGGEST` vs `INSIGHT_ONLY`.
   - Formata payload de feedback automático para a timeline com `source = "AI"`.

5. **Roteiros Situacionais e Respostas Polidas em `/qualificacao`**:
   - Arquivos: [`src/features/ai-qualification/situations-catalog.ts`](src/features/ai-qualification/situations-catalog.ts), [`src/features/ai-qualification/situational-response-engine.ts`](src/features/ai-qualification/situational-response-engine.ts), [`src/app/(dashboard)/qualificacao/_components/situational-playbooks-panel.tsx`](src/app/(dashboard)/qualificacao/_components/situational-playbooks-panel.tsx).
   - 8 situações comerciais pré-configuradas (Primeiro contato acolhedor, Meta Ads, Dúvidas de preço, Hospitais, Reengajamento, Handoff, Horários, Memória Adaptativa).
   - Prompt da IA ajustado para eliminar perguntas secas como *"Qual seu nome completo?"*.

6. **Testes Unitários Automatizados**:
   - Arquivos: `conversation-intelligence.test.ts` (10 testes) e `situational-playbooks.test.ts` (10 testes). Total de 100% de sucesso.

---

## 3. Onde Paramos e Próximos Passos Técnicos

Paramos exatamente no ponto de integração do **Gatilho Operacional** com os eventos de mensagens e a Timeline do CRM:

### Próximos Passos Imediatos para Retomar:
1. **Conectar o Inbound Message Hook / Queue**:
   - Disparar o debounce de 45 segundos quando novas mensagens de WhatsApp entrarem via WABA/WAHA.
2. **Gravar o `LeadIntelligenceState` no Banco de Dados**:
   - Persistir o assessment mais recente do lead (ex: coluna JSON `intelligence_state` ou tabela dedicada).
3. **Renderizar o Feedback da IA na Timeline do Lead**:
   - Exibir na tela do lead (`/leads/[id]`) e na extensão do WhatsApp os insights gerados pela IA (Estágio, Sentimento, Objeções, Próxima Ação recomendada e Botão de Aceitar Transição Sugerida com 1 clique).
4. **Habilitar Worker de Reconciliação Periódica (BullMQ)**:
   - Identificar leads estagnados há mais de 2 horas e reavaliar para sugerir follow-up automático ou arquivamento.
