# Matriz de Cobertura de Testes — Fluxo de Qualificação por IA

Data: 11 de Agosto de 2026  
Versão: 1.0

---

## 1. Cobertura de Perguntas Obrigatórias

| Pergunta (ID) | Chave | Teste Unitário Validação | Teste Unitário Preenchimento | Teste E2E |
|---|---|---|---|---|
| Q1 | `customerName` | `test_customer_name_validation` | `test_customer_name_persistence` | `test_e2e_full_qualification` |
| Q2 | `planType` | `test_plan_type_validation` | `test_plan_type_persistence` | `test_e2e_full_qualification` |
| Q3 | `numberOfLives` | `test_number_of_lives_validation` | `test_number_of_lives_persistence` | `test_e2e_full_qualification` |
| Q4 | `age` | `test_age_validation` | `test_age_persistence` | `test_e2e_full_qualification` |
| Q5 | `city` | `test_city_validation` | `test_city_persistence` | `test_e2e_full_qualification` |
| Q6 | `email` | `test_email_validation` | `test_email_persistence` | `test_e2e_full_qualification` |

---

## 2. Cobertura da Máquina de Estados

| Estado Origem | Transição / Evento | Estado Destino | Teste de Cobertura |
|---|---|---|---|
| `new` | `startQualification` | `qualification_started` | `test_state_transition_new_to_started` |
| `qualification_started` | `selectFirstQuestion` | `qualification_in_progress` | `test_state_transition_started_to_in_progress` |
| `qualification_in_progress` | `sendQuestion` | `qualification_waiting_answer` | `test_question_orchestration_next_question` |
| `qualification_waiting_answer` | `receiveMessage` | `qualification_validating` | `test_answer_received_and_validating` |
| `qualification_validating` | `validationFailed` ($< \text{maxRetries}$) | `qualification_waiting_answer` | `test_validation_failure_retry` |
| `qualification_validating` | `validationFailed` ($\ge \text{maxRetries}$) | `qualification_failed` / `human_requested` | `test_max_retries_exceeded_fallback` |
| `qualification_validating` | `validationSuccess` (dados pendentes) | `qualification_in_progress` | `test_field_persistence_and_loop` |
| `qualification_validating` | `validationSuccess` (sem pendências) | `qualification_completed` | `test_qualification_completion` |
| `qualification_completed` | `evaluateQualification` | `qualified_hot` / `qualified_warm` / `qualified_cold` / `not_qualified` | `test_classification_calculation` |
| `qualification_completed` | `triggerRouting` | `routing_pending` | `test_completed_triggers_routing_pending` |
| `routing_pending` | `resolveDestination` | `routing_in_progress` | `test_routing_destination_resolution` |
| `routing_in_progress` | `distributeLead` (corretor elegível) | `routed` | `test_lead_distribution_success` |
| `routed` | `createHandoff` | `waiting_broker` | `test_handoff_and_closing_message` |
| `waiting_broker` | `brokerAssumes` | `human_assumed` | `test_broker_assumes_lead` |

---

## 3. Cobertura de Casos de Borda e Erros

| Cenário de Borda | Resultado Esperado | Teste Dedicado |
|---|---|---|
| Múltiplas respostas em uma única mensagem | Extrai todos os dados válidos de uma vez | `test_edge_case_multi_answers_single_message` |
| Cliente corrige resposta anterior | Atualiza o dado com a nova versão | `test_edge_case_client_correction` |
| Cliente solicita atendimento humano explicitamente | Interrompe IA, transita para `waiting_human` e handoff | `test_edge_case_human_requested` |
| Webhook / mensagem duplicada rápida | Ignorado pela trava de concorrência / idempotência | `test_edge_case_duplicate_message_concurrency` |
| Falha no envio da distribuição (sem corretor online) | Mantém em `routing_pending`, alerta gestor | `test_edge_case_no_eligible_broker_fallback` |
| Mensagem recebida após qualificação concluída | Envia mensagem única de aguardando corretor | `test_edge_case_post_closing_message` |
