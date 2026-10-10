---
type: plano
status: proposto
updated: 2026-10-10
tags: [crm, ia, corretor, lite, roteamento]
---

# Plano: IA nos assistentes do corretor (roteamento central, modelos gratuitos)

Pedido do Vinicios (2026-10-10): cada conversa do app do corretor (Leads, Plantão, Agenda, Cotação, Desempenho, Insights, Âncora e a conversa de cada lead) deve ter **respostas combinadas e mais ações em cada bloco**, e o corretor deve poder **perguntar em texto livre** e ser respondido por uma IA básica que entende o contexto da rota e do agente. Tudo **centralizado**, fácil de manter, profissional, usando primeiro os **modelos gratuitos** que já usamos; avisar quando um pago fizer sentido.

## 1. O que existe hoje (levantamento de 2026-10-10)
- **Duas camadas de IA que não conversam:**
  - **A, "AI Engine"** (`src/features/ai/engine.ts`, Vercel AI SDK): Groq, OpenAI, Google e OpenRouter, com 1 fallback. Sem timeout, sem log de uso, sem tenant.
  - **B, "AI Router"** (`src/features/ai-agent/model-router.ts`, fetch direto): só Groq e OpenRouter. Tem cadeia de fallback provedor × modelo e timeout de 12s, e é usada pelo agente de qualificação do WhatsApp.
- **Config espalhada:**
  - `system_settings`: chaves de API **em texto puro**, modelos por tenant.
  - Super-admin `/super-admin/settings`.
  - `ai_qualification_configs` por tenant.
  - Prompts fixos em 6 arquivos.
- **Log de uso:** `ai_attendance_logs` grava o *propósito* na coluna `provider`, e um ponto grava "openrouter" fixo mesmo quando quem respondeu foi o Groq. Rate limit só diário e só no situation-learning.
- **Chat do corretor:** **não chama IA**. Texto livre vira nota (lead) ou resposta fixa (assistentes); as opções são roteiros determinísticos.
- **Modelo default** `llama-3.3-70b-versatile`. Já houve erro `model_not_found` no Groq (item aberto no todo), então os nomes de modelo precisam ser configuráveis, nunca fixos no código.

## 2. Princípios
1. **Determinístico primeiro, IA por cima.** Os roteiros atuais continuam sendo a base: são rápidos, grátis e testáveis. A IA **acrescenta** (resposta a texto livre, sugestões extras, resumo) e nunca é obrigatória: se cair, o chat segue igual.
2. **A IA só sugere ações que já existem.** Ela escolhe dentro de um catálogo de ações (as `ChatServerActionName` + links), validado por zod. Nunca executa sozinha: vira uma resposta sugerida que o corretor toca.
3. **Um único gateway.** Todo o CRM passa a chamar IA por um ponto só, com perfis de tarefa, cadeia de fallback, timeout, limite de uso e log real de custo.
4. **Config em um lugar.** Uma "Central de IA" no super-admin para provedores, chaves, perfis e agentes; prompts versionados.
5. **Privacidade (LGPD).** Os níveis gratuitos podem usar os dados para treino ou registrá-los. Antes de mandar, mascarar telefone e e-mail, abreviar nomes e nunca enviar CPF. Para dado pessoal em produção, preferir um provedor pago com política de não-treino (ver §6).

## 3. Arquitetura proposta

```
ChatScreen (composer / blocos)
   │ texto livre ou "mais sugestões"
   ▼
askAssistant(assistantId, route, input)          ← server action, zod, tenant/broker do contexto
   │ 1. contexto: AGENT_REGISTRY[assistantId].context(route, broker)   (dados reais, já mascarados)
   │ 2. prompt:   template versionado do agente + regras globais
   │ 3. gateway:  aiGateway.run(profile, messages, schema)
   ▼
aiGateway (src/features/ai-gateway)
   ├─ perfis de tarefa → cadeia de modelos (grátis primeiro, pago opcional)
   ├─ timeout por tentativa, fallback, circuit breaker por provedor
   ├─ rate limit por corretor/tenant/dia
   ├─ cache curto (mesma pergunta + mesmo contexto)
   └─ log: ai_usage (provedor e modelo reais, tokens, custo, latência, propósito, sucesso)
   ▼
Resposta estruturada (zod): { text, blocks?: facts|list, choices?: [{label, action ∈ catálogo}] }
   → vira ChatBlock[] (assistant + question) → o corretor toca → ação existente roda como hoje
```

### 3.1 Perfis de tarefa (roteamento)
| Perfil | Uso | 1ª opção (grátis) | Fallback grátis | Pago recomendado (opcional) |
|---|---|---|---|---|
| `chat-fast` | resposta curta no chat, sugestões de ação | Groq modelo rápido (classe 8B a 20B) | OpenRouter `:free` | Gemini Flash pago ou Claude Haiku |
| `chat-smart` | pergunta aberta com dados ("quem eu atendo primeiro?", "resuma meu dia") | Groq modelo grande (classe 70B a 120B) | Gemini Flash (nível grátis) e depois OpenRouter `:free` | Claude Haiku 5.5 ou GPT-4o-mini |
| `json-structured` | análise de conversa (Insights), extração | Groq grande com JSON mode | Gemini Flash | Claude Haiku 5.5 |
| `long-context` | resumo de conversa longa do WhatsApp | Gemini Flash (contexto grande) | Groq grande, com corte | Gemini Flash pago |

Os nomes exatos dos modelos ficam **na config**, não no código: mudam com frequência, e o `model_not_found` já aconteceu.

### 3.2 Registro central de agentes (`AGENT_REGISTRY`)
Um arquivo, `src/features/ai-gateway/agents.ts`, e uma entrada por assistente:
- `id`, `name`, `purpose` (1 frase), `profile` (perfil de tarefa)
- `systemPrompt` (template com variáveis), `version`
- `context(route, broker)`: função que monta o contexto real (fila, plantão, agenda, conversa do lead + análise), **mascarado**
- `allowedActions`: subconjunto do catálogo que esse agente pode sugerir
- `maxTokens`, `temperature`, `enabled`

O super-admin pode sobrescrever `systemPrompt`, `profile` e `enabled` por agente (tabela `ai_agent_overrides`). O código é o default, e o banco é o ajuste fino com versão e auditoria.

### 3.3 Catálogo de ações (mais opções em todo bloco)
Hoje a IA só poderia sugerir 10 ações. Ampliar o catálogo (todas chamando funções que já existem, com as mesmas checagens):
- **Leads:**
  - Existentes: aceitar, recusar, registrar contato, mudar etapa, agendar retorno, marcar perdido, nota.
  - Novas: **abrir cotação já preenchida**, **mandar mensagem pronta no WhatsApp** (texto sugerido + link `wa.me`), **pedir documentos** (checklist), **reatribuir para gestor** (pedido).
- **Plantão:**
  - Existentes: pausar, voltar.
  - Novas: **confirmar presença**, **ver escala da semana**.
- **Agenda:** concluir retorno, reagendar, **criar lembrete livre** ("me lembra amanhã 10h de ligar pra Maria").
- **Insights:** **gerar mensagem de resposta** ao cliente (texto sugerido, o corretor envia), **marcar como resolvido**.
- **Âncora:** abrir o aviso, marcar lido.

Cada bloco do roteiro ganha, além das opções determinísticas, um **"Mais opções"** que abre de 2 a 4 sugestões da IA para aquele contexto. Elas são geradas sob demanda (o toque do corretor aciona), para não gastar cota à toa.

### 3.4 Respostas combinadas
O roteiro determinístico monta os fatos (números, listas), e a IA acrescenta **uma frase de leitura** ("Seu ritmo hoje está acima da média: 4 aceitos em 5") e **as sugestões**. Se a IA falhar, só a frase e as sugestões somem.

## 4. Central de IA (super-admin, manutenção fácil)
Página `/super-admin/ia` com abas:
1. **Provedores e chaves:**
   - Groq, OpenRouter, Google, OpenAI, Anthropic, cada um com teste de conexão.
   - Chaves **criptografadas** (AES-GCM com chave mestra no env), nunca mais em texto puro.
2. **Perfis:** a cadeia de modelos de cada perfil (arrastar para ordenar), timeout e limite.
3. **Agentes:** a lista do `AGENT_REGISTRY`, com prompt, versão, perfil, ativo e "testar com dados de exemplo".
4. **Uso e custo:** chamadas, sucesso, latência, tokens e custo por provedor, agente e tenant, além do alerta de cota grátis.
5. **Playground:** escolher agente e corretor de exemplo, perguntar, ver o contexto enviado (mascarado) e a resposta.

As duas camadas atuais (Engine e Router) passam a ser adaptadores finos do gateway, sem quebrar quem já usa.

## 5. Fases
| Fase | Entrega | Risco |
|---|---|---|
| **F0 Fundação** | `ai-gateway`: tipos, perfis, cadeia com fallback, timeout, log real em `ai_usage`, rate limit por corretor; `AGENT_REGISTRY` com os 8 agentes; flag `feature_broker_ai_assistants_enabled` **desligada**; env documentado | baixo (nada usa ainda) |
| **F1 Texto livre** | `onFreeText` dos assistentes e do lead chama `askAssistant`; resposta estruturada + sugestões do catálogo; fallback para a resposta fixa de hoje | médio |
| **F2 Mais opções** | botão "Mais opções" em cada bloco e frase de leitura nos roteiros | médio |
| **F3 Catálogo ampliado** | ações novas (§3.3) com testes e auditoria | médio |
| **F4 Central de IA** | página no super-admin, chaves criptografadas, playground, painel de uso | médio |
| **F5 Unificação** | Engine e Router viram adaptadores do gateway; prompts fixos migram para o registro | alto (toca a qualificação do WhatsApp em produção) |

## 6. Modelos: grátis agora, pago quando valer
**Grátis (o que dá para usar já, com as chaves que existem):**
- **Groq** (chave `GROQ_API_KEY`): muito rápido e bom para `chat-fast`. Os modelos disponíveis mudam; confirmar no console do Groq quais estão ativos (classe Llama 8B/70B, GPT-OSS 20B/120B, Qwen) e pôr os nomes na Central. Limites por minuto e por dia na conta grátis.
- **OpenRouter** (chave `OPENROUTER_API_KEY`): modelos com sufixo `:free`. Funciona como fallback, com limite baixo de requisições por dia sem créditos (sobe muito com um crédito pequeno).
- **Google Gemini** (chave `GOOGLE_API_KEY`): Flash no nível grátis, com bom contexto longo. **Atenção:** no nível grátis o Google pode usar os dados para melhorar produtos, então **não mandar dado pessoal sem mascarar**.

**Quando pagar (aviso):**
- **Volume:** com todos os corretores usando, os limites grátis por minuto vão estourar no horário de pico. O sinal é o painel de uso mostrando fallback frequente.
- **Dado pessoal (LGPD):** para mandar conversa de cliente sem mascarar, use um provedor pago com política de não-treino.
- **Qualidade de JSON e ações:** modelos grátis erram mais o formato; o zod segura, mas gera retry.
- **Indicação:** **Gemini Flash pago** (o mais barato para volume) ou **Claude Haiku 5.5** (melhor em seguir regras e montar ações) para `chat-smart` e `json-structured`. Começar com o grátis e trocar só o perfil que precisar, sem mudar código.

## 7. O que o Vinicios precisa deixar pronto
- [ ] Chaves no Coolify: `GROQ_API_KEY` (já existe), `OPENROUTER_API_KEY`, `GOOGLE_API_KEY` (opcional) e, quando for pago, `ANTHROPIC_API_KEY` ou `OPENAI_API_KEY`.
- [ ] `AI_SECRETS_KEY` (32 bytes, base64) para criptografar as chaves salvas pela Central (F4).
- [ ] Conferir no console do Groq os modelos ativos e escolher um rápido e um grande.
- [ ] Ligar a flag `feature_broker_ai_assistants_enabled` só para um corretor piloto (F1).

## Revisão do Vigia (T29, 2026-10-10)

- Aprovado com a flag desligada.
- Corrigido antes de ligar (LGPD art. 11): agentes com `sensitive: true` (hoje `lead`, que leva mensagens e a leitura da IA do cliente) nunca vão a provedor grátis; sem chave paga, caem no fallback. Máscara de telefone pega número sem DDD; títulos da agenda e próximo passo são mascarados.
- Pendente (não bloqueia): rate limit em memória por instância (mover para o banco/Redis se houver mais de 1 container); API nativa da Anthropic em F2 em vez da camada compatível com OpenAI; confirmar com jurídico/DPO o uso de provedores externos.
