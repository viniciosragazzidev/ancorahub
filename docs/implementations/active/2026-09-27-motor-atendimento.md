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

## Fase 1 — avisos da equipe (entregue em `feat/motor-atendimento-fase1`)

- Catálogo `src/features/team-notices/catalog.ts`: dez avisos, classe (imediato, informativo, lembrete), padrão ligado/desligado, travados na Meta (oferta, convite, confirmação de presença).
- Decisão única `decision.ts`: desligado = pulado (linha `skipped`, motivo `disabled`), nunca outro canal; WhatsApp da empresa primeiro com reserva Meta; Meta primeiro com reserva no WhatsApp da empresa; número desconectado ou pausado volta à Meta.
- Porteiro `guard.ts` (valores só no código): imediatos sem limite e sem horário, só 3–5 s entre mensagens do número; demais de seg. a sex. 08:00–18:00, 60 s entre avisos à mesma pessoa, 4/h e 15/dia por pessoa, lembretes 2/dia por pessoa, sem repetir o mesmo aviso em 6 h, lembrete com mais de 12 h descartado; número da empresa 8–15 s entre mensagens, 40/h e 250/dia (15/h nos 7 primeiros dias); disjuntor de 3 falhas seguidas pausa o número 30 min, avisa o Diretor e manda tudo pela Meta.
- Fila de envio: rota `meta_then_waha` preservada, porteiro antes do envio (espera reagenda com `hold_reason`, sem falhar), vaga atômica do número (`waha_numbers.last_sent_at`), texto padrão ou mensagem livre escolhida, e envio pelo WhatsApp da empresa quando a Meta não consegue.
- Migration `0164_team_notices_delivery_guard` (aditiva, aplicada em 2026-09-27): `team_notice_settings`, `whatsapp_outbound_messages.hold_reason/notice_key`, `waha_numbers.last_sent_at/consecutive_failures/paused_until`.
- Tela: card "Avisos da equipe" em Integrações → WhatsApp (visão diretoria), substituindo a rota por evento.
- Verificação: 14 testes das regras; caracterização com banco real (transação desfeita, provedores simulados) cobrindo WAHA, Meta primeiro sem template, desligado, número caído/pausado, falha do WAHA, sábado, limite de lembretes; 688 testes das áreas afetadas.
- Fase 1b: o botão do template de oferta é só um link para `/leads/<id>` (aceite no CRM), então a oferta sai pelo WhatsApp da empresa com o mesmo link e passa a ter esse canal como padrão. A confirmação de presença ganhou a opção do WhatsApp da empresa (link `/confirm_presence?id=`), fica sempre ligada (desligar tiraria o corretor da distribuição) e continua Meta por padrão. Só o convite de primeiro acesso segue travado na Meta.
- Fica para depois: agrupar vários lembretes numa mensagem só.

## Fase 2 — biblioteca de mensagens (entregue em `feat/motor-atendimento-fase2`)

- `src/features/message-library`: tipos explícitos (template Meta, mensagem livre, resposta rápida da IA), validade por canal (Meta: template a qualquer hora, texto livre só na janela de 24h; WhatsApp da empresa: texto a qualquer hora) e "onde é usada" (avisos da equipe, rota antiga do número da empresa, situações, templates por situação, follow-ups, respostas da IA).
- Card "Biblioteca de mensagens" (tabela no padrão `/equipe`, painel lateral por mensagem) no topo de Qualificação → Mensagens; a edição continua nos painéis existentes.
- Remover mensagem livre em uso é recusado com a lista de lugares (antes desativava em silêncio e o aviso caía no texto padrão).
- Sem migration e sem mudança de envio.
- Verificação: testes do catálogo; teste com banco real e transação desfeita (uso, recusa ao remover, remoção liberada) que também gera todos os avisos da equipe com os dados do corretor de teste Vinicios Ragazzi A. (nome e links conferidos, nada enviado).

## Fase 3 — motor de fluxos (base entregue em `feat/motor-atendimento-fase3`)

- Núcleo puro `src/features/attendance-flows`: blocos (início, enviar, enviar e aguardar, condição com "senão", agente de IA, aguardar, transferir, atualizar lead, atendimento atual, encerrar), validação para publicar (saídas, blocos soltos, voltas sem espera) e executor determinístico.
- Fluxos prontos por empresa, versão 1 publicada: "Atendimento atual" (roda exatamente a entrada de hoje), "Direto para a distribuição" e "IA qualifica e distribui (motor novo)".
- Execução: um lead passa pelo fluxo da fila uma vez (reinício só explícito), cada bloco roda uma vez (chave por passo) e fica registrado; espera do agente confere a cada 2 min se o lead foi distribuído (concluiu → encerra sem distribuir de novo; 90 min sem distribuir → saída "não concluiu" → distribuição). O job de 1 min `qualification-timeout` acorda as execuções.
- Motor novo de qualificação só para leads cujo telefone é número de teste de Qualificação (DEC-126), sem depender de `feature_qualification_engine_enabled`; os demais seguem a saída "não concluiu".
- Entrada por webhook: fila com fluxo e chave ligada → fluxo; senão, entrada de hoje (inalterada). Se o fluxo não iniciar, a entrada de hoje roda.
- Chave global `feature_attendance_flows_enabled` (padrão desligada) no super-admin; campo "Fluxo de atendimento" no editor da fila só aparece com ela ligada.
- Migration `0165_attendance_flows` (aditiva, aplicada em 2026-09-27).
- Verificação: 8 testes do núcleo; teste com banco real e transação desfeita cobrindo fila sem fluxo, "Atendimento atual" uma vez, reinício bloqueado, distribuição direta com uma única distribuição, agente que não inicia, agente que conclui, agente travado e chave desligada; 520 testes das áreas afetadas.
- Pendente: envio de mensagens pelo fluxo e editor visual (fase 4); outras entradas de lead (manual, importação, WhatsApp) ainda usam só a entrada de hoje.

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
