# Motor de atendimento: mensagens, canais e fluxos por fila

Decisões: DEC-125 (WAHA oficial para avisos da equipe, reserva Meta), DEC-126 (motor novo de qualificação), DEC-127 (fluxos por fila com editor visual).

## Objetivo

Atendimento previsível e configurável por fila: qual fluxo, qual agente, qual mensagem e qual canal (Meta oficial ou WAHA), sem conflito ao ligar ou desligar. Cada envio tem uma decisão única e registrada: enviar, pular ou bloquear, com motivo.

## Diagnóstico (2026-09-27)

- Cinco camadas decidem canal e texto de um aviso à equipe: política por evento, resolvedor legado de template, rota do número da empresa (`tenant_channel_routing_<tenant>` em `system_settings`), funções de aviso interno que viraram casca (`internal-notification-policy.ts`, `selectInternalBrokerDeliveryRoute`) e a migração preguiçosa de rotas no processador da outbox.
- "Desligar" não significa "não enviar": política inativa volta para o template legado; texto livre fora da janela vira template e, sem template aprovado, nada sai.
- Produção, 7 dias até 2026-09-27: 81 de 265 avisos à equipe falharam (31%), 68 por template inexistente ou não aprovado no número (`lead_assignment_expired` em outro idioma; `lead_assignment_confirmed` e `ancora_lembrete_tarefa` fora da WABA).
- Motor de qualificação em uso: o antigo (`feature_qualification_engine_enabled = false`).
- Telas sem motor: `/fluxos-whatsapp` (`whatsapp_flows`), editor de `workflow_automations`, construtor de `agent_definitions`, `ai_qualification_system_messages`. A máquina de estados cria `ai_qualification_followup_rules` em tempo de execução.

## Fase 0 — rede de segurança (esta entrega)

- `src/features/communication-channels/outbound-routing.db.test.ts`: caracterização com banco real, transação desfeita e provedores simulados (nenhuma mensagem sai). Fixa, por aviso: rota gravada, template, provedor chamado e resultado. Inclui o defeito conhecido (template fora da WABA) marcado para mudar na fase 1.
  `RUN_OUTBOUND_DB_E2E=1 npx vitest run src/features/communication-channels/outbound-routing.db.test.ts`
- Suítes do motor verdes: `ai-agent`, `ai-qualification`, `communication-channels`, `waha-cadence`, `notifications` (282 testes).
- Decisões DEC-125 a DEC-127 registradas.

Resultado da caracterização:

| Cenário | Rota | Resultado |
|---|---|---|
| Oferta (`newLeadAssignment`) | Meta `new_lead_broker` | enviado |
| Oferta expirada | Meta `lead_assignment_expired` | enviado (em produção a Meta recusa pelo idioma) |
| Atribuição confirmada | Meta `lead_assignment_confirmed` | **falha: fora da WABA, nenhum canal** |
| Lembrete de feedback | Meta `registrar_feedback_lead` | enviado |
| Lembrete de tarefa | Meta `ancora_lembrete_tarefa` | **falha: fora da WABA, nenhum canal** |
| Conta ativada | Meta `broker_account_activated` | enviado |
| Oferta expirada roteada ao WAHA | WAHA texto livre | enviado, Meta não chamada |
| Idem com WAHA fora do ar | WAHA → Meta | enviado pela Meta |
| Oferta com rota WAHA | Meta | enviado (oferta não é roteável) |
| Texto livre inativo / número desconectado | Meta | cai no defeito acima quando o template não existe |

## Fases

1. **Avisos da equipe.** Tabela única por evento (ligado, canal: WAHA com reserva Meta / Meta / WAHA / Meta com reserva WAHA, template Meta, texto livre). Função única de decisão; desligado = pulado; validação ao salvar (template precisa existir no número); oferta por WAHA com aceite por link seguro. Migra `tenant_channel_routing_*` e as políticas internas; atualiza a caracterização para o comportamento novo.
2. **Biblioteca de mensagens.** Template Meta (categoria, aprovado), texto livre (Meta só na janela de 24h, WAHA a qualquer hora), gerada por IA; validade por canal.
3. **Motor de fluxos.** `attendance_flows`, versões, execuções e passos; fluxos prontos equivalentes ao comportamento atual ligados às filas; o lead pertence a uma execução só; regras antigas só rodam para leads sem execução. Motor novo de qualificação como bloco "Agente IA", validado lado a lado com o antigo.
4. **Editor visual** (`@xyflow/react`), simulador, publicar e versionar, validação de caminhos e de canal.
5. **Agentes e autonomia** (assistido, supervisionado, autônomo).
6. **Limpeza**: camadas antigas, telas sem motor e DDL em tempo de execução.

## Riscos e proteções

- Oferta ao corretor: contrato de latência e aceite; testes de oferta e caracterização precisam passar em toda fase.
- Mensagens duplicadas entre follow-ups antigos e fluxo novo: um lead, uma execução.
- Linhas na outbox durante deploy: processador aceita rotas antigas e novas; chaves de idempotência inalteradas.
- Janela de 24h da Meta e cobrança de 01/10/2026: validação por canal e custo estimado por bloco.
- Banimento do número WAHA: reserva Meta sempre disponível; desconexão volta ao template aprovado.
- Conexão WAHA pessoal do corretor: fora do escopo de todas as fases.
