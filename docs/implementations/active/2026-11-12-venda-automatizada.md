# Venda Automatizada (piloto) · plano e registro de implementação

- Data: 12/11/2026. Branch: `feat/venda-automatizada`, criada sobre `origin/feat/diretor-visual-lite` (sem push).
- Prompt-base: [2026-11-12-venda-automatizada-prompt.md](2026-11-12-venda-automatizada-prompt.md).
- Decisão: DEC-182 em `docs/decision-log.md`. Pattern Blueprint da tela: `docs/design-system/patterns/list-page.md` (lista + `Sheet` de detalhe).
- Status: F1 a F3 implementadas; F4 (Autopiloto) implementado atrás de flag própria desligada; F5 só como suíte de replay. Nada aplicado em produção.

## Resumo

Um vendedor de IA conduz **uma** negociação por empresa, com um lead quente que o diretor (ou gestor) escolhe. O agente confirma os dados, cota com o catálogo real do `/cotacao`, envia 2 ou 3 opções com PDF personalizado e imagem por plano, recomenda uma, trata objeções, oferece a opção mais em conta, pede o fechamento e os documentos e, quando precisa de uma pessoa, **chama o gestor que escolheu a negociação**. Só o gestor, por escolha manual, assume, devolve ao agente ou entrega a um corretor que ele escolhe.

Regras fortes, todas cobertas por teste:

1. O agente nunca muda o dono do lead, nunca cria oferta para corretor e nunca avisa corretor. Só `handOffAutoSaleDealAction` (gestor, manual, auditado) muda `leads.corretorId`.
2. Todo preço que sai vem de um snapshot de `auto_sale_offers`, gerado pelo `simulate`. O texto da IA é barrado se contiver um valor em reais que não esteja no snapshot.
3. Nada sai sem modo explícito: Simulação (nada sai), Copiloto (cada mensagem espera aprovação), Autopiloto (flag própria, desligada).

## Decisões adotadas (as recomendadas; o Vinicios pediu para seguir as recomendadas)

| # | Decisão | Adotado |
|---|---|---|
| D1 | Lead que já tem corretor | **Só entra lead que nenhum corretor aceitou.** Lead em oferta pendente (dono provisório, `assignmentSource` `automatic_offer`/`manual_offer`, sem oferta aceita) entra: na escolha, as ofertas pendentes são canceladas e o dono provisório é solto, na mesma transação (revisão). Lead com corretor que aceitou não aparece como elegível. |
| D2 | Quem escolhe | **Diretor** no piloto. O layout de `/vendas` já tira o gestor da versão antiga (`redirectManagerAway`, fail closed); o código aceita o gestor de unidade para quando essa regra mudar. |
| D16 | Base legal (revisão) | Elegível com `consentimentoLgpd` **ou** com mensagem recebida do próprio cliente no WhatsApp (procedimento preliminar a contrato a pedido do titular, LGPD art. 7º, V). Sem isso, o lead não entra. |
| D17 | Fim da negociação (revisão) | Nada fica preso: "Encerrar e devolver à distribuição" (padrão) limpa a remoção, cria o job de distribuição e restaura o estado da conversa de IA; "Encerrar como perdida" não muda a etapa (a pessoa marca a perda); "Assumir" deixa o lead com o gestor fora da distribuição; opt-out grava `optOutAt` e mantém o lead fora das réguas. Pausada ou aguardando o gestor por mais de 72 h (editável), volta sozinha à distribuição com aviso. |
| D3 | Sábado | **Não envia** no piloto: dias úteis das 8h às 21h (São Paulo). Mensagem do cliente fora do horário fica para a abertura seguinte. |
| D4 | Plano ainda pendente de revisão comercial | No **Copiloto** pode cotar plano `pending` (não `incompatible`), com o PDF marcado "Valores da tabela da operadora; condições em conferência"; o gestor aprova cada envio. No **Autopiloto** só planos `ready`. |
| D5 | Revisão comercial antes do piloto | Revisar, no Super-admin › Catálogo, os planos que mais vendem: Klini 200, Amil Bronze, Leve Top 400 e Assim (PF e adesão da capital). Ação humana listada no fim. |
| D6 | Transcrição de áudio | Liga junto com a Venda Automatizada, sem depender de `feature_ai_audio_transcription_<tenantId>`. Até **10 áudios por negociação por dia**, até **5 minutos** cada. Custo entra no custo da negociação. |
| D7 | Agente responde em áudio | Não no piloto. |
| D8 | Canal | Meta oficial por padrão; WAHA (número da empresa conectado) só se o gestor escolher. WAHA envia só texto: PDF e imagens seguem pelo Meta quando a janela de 24h está aberta, senão ficam retidos com o motivo visível e o gestor baixa no `Sheet`. |
| D9 | Promoções | Tabela `auto_sale_promotions` por empresa, cadastrada pelo diretor, com início e fim. Sem promoção vigente, o agente não fala em promoção. |
| D10 | Rajada do cliente | Espera **75 s** sem mensagem nova antes de responder. |
| D11 | Limites de envio | 6 mensagens por hora e 25 por dia por negociação; 3 envios de PDF por negociação. |
| D12 | Follow-up | Na sessão (45 min após a cotação), antes de 24h (20 h), D+2 e D+5; depois disso a regra de "Aguardando retorno" volta a valer. |
| D13 | Modelo | `chat-smart` pelo `ai-gateway`, `sensitive: true` (só provedores pagos que não treinam). |
| D14 | Fonte do PDF | Helvetica do `pdf-lib` com codificação WinAnsi, que cobre todos os acentos do português (ç, ã, õ, é, ê). Sem fonte nova embutida no piloto; a cor de ação e os cinzas vêm dos tokens do Lite (`--chat-action`, `--foreground`, `--text-secondary`). |
| D15 | Retenção | Turnos e ofertas por 12 meses; PDF no R2 por 12 meses; transcrição segue a regra da mensagem. Expurgo entra no job de purge numa fase seguinte. |

Dúvida visual registrada (não bloqueante): o design system não especifica PDF nem imagem de plano para o cliente. Usei os tokens existentes (cor de ação, cinzas, raio de cartão) sem criar token novo e registrei a lacuna como DG em `docs/design-system/DESIGN_GAPS.md` para o Vinicios aprovar o visual.

## 1. Escopo do piloto e acesso

- **Flag por empresa:** `feature_auto_sale_<tenantId>` (`FEATURE_FLAGS.AUTO_SALE`, escopo `tenant`, padrão `false`), ligada no Super-admin › Empresas, com `platform_audit_logs` (`auto_sale.tenant_updated`). Autopiloto: `feature_auto_sale_autopilot_<tenantId>` (`FEATURE_FLAGS.AUTO_SALE_AUTOPILOT`). Kill switch global: `feature_auto_sale_global_enabled` (escopo `global`, padrão `true`); desligado, o job não faz nada e a tela mostra "Pausada pela plataforma".
- **Uma negociação ativa por empresa:** índice parcial único `auto_sale_deals_one_active_per_tenant` em `(tenant_id) WHERE status IN ('active','paused','waiting_manager')`.
- **Elegível** (`isLeadEligibleForAutoSale`, puro, em `src/features/auto-sale/eligibility.ts`): `qualificationStatus = 'hot'`; status em `new`, `distributed`, `in_contact`, `quote_sent`, `negotiation`, `awaiting_reply`; sem `deletedAt`/`archivedAt`; telefone válido; `consentimentoLgpd = true`; sem `optOutAt` na `ai_conversations`; sem falha 131049 nos últimos 30 dias em `whatsapp_outbound_messages`; sem `corretorId` (D1); fora de pós-venda (`status <> 'converted'` e sem `post_sale_opt_outs`).
- **Ao entrar:** a conversa de IA do lead vai para `PAUSED` (`automationState`), com `pausedByUserId` = gestor (para a qualificação, o silêncio e a transcrição da qualificação), e os ganchos de §8 tiram o lead da distribuição, do turbo, da conversa inteligente, da régua WAHA e da regra de chat parado enquanto a negociação está ativa.
- **Apresentação:** "Oi, {primeiro nome}! Aqui é a assistente virtual da {corretora}." Sempre em nome da corretora.

## 2. Modelo de dados (migration `drizzle/0228_auto_sale.sql`)

Próximo número livre conferido em todas as branches `origin/*` em 12/11 (maior era 0227). Journal com a entrada `0228_auto_sale`. O deploy não roda migration. Todo leitor trata 42P01 (`isUndefinedTableError`): sem tabela, a área mostra "Aguardando a migração" e os ganchos respondem "sem negociação".

| Tabela | Conteúdo | Índices |
|---|---|---|
| `auto_sale_deals` | lead, `stage`, `status` (`active`, `paused`, `waiting_manager`, `handed_off`, `won`, `lost`, `cancelled`), `mode` (`simulation`, `copilot`, `autopilot`), `channel` (`meta`, `waha`), `waha_number_id`, `chosen_by` (gestor), `handed_to_user_id` (vazio até a entrega), `facts` (jsonb), `limits` (jsonb), `manager_call_reason`, `misunderstood_count`, `follow_up_step`, `next_follow_up_at`, `reply_due_at` (fim da rajada), `last_customer_message_at`, `ai_cost_usd`, `transcription_cost_usd`, `ended_reason`, datas | único parcial por empresa (ativa); único parcial por `(tenant_id, lead_id)` ativo; `(tenant_id, created_at)`; `(reply_due_at)` e `(next_follow_up_at)` parciais para o job |
| `auto_sale_turns` | cada mensagem recebida ou enviada e cada decisão: `direction`, `kind`, `provider_message_id`, `body`, `intent`, `objection`, `facts`, `decision`, `guard`, `model`, `ai_cost_usd` | único `(tenant_id, provider_message_id)` quando não nulo (idempotência por mensagem); `(deal_id, created_at)` |
| `auto_sale_offers` | snapshot imutável: `version`, `input` (QuoteInput), `plans` (resultados do `simulate`), `recommended_plan_id`, `recommendation_reason`, `relaxed` (o que mudou na opção mais em conta), `previous_offer_id`, `release`, `catalog_date`, `pdf_key`, `pdf_sha256`, `image_keys` | único `(deal_id, version)` |
| `auto_sale_outbox` | outbox da negociação, inclusive **documento e imagem**: `kind` (`text`, `document`, `image`), `body`, `media_key`, `media_filename`, `media_mime`, `offer_id`, `status` (`draft`, `simulated`, `approved`, `sending`, `sent`, `held`, `failed`, `cancelled`), `hold_reason`, `channel`, `idempotency_key`, `approved_by`, `provider_message_id`, `error`, `attempts` | único `(tenant_id, idempotency_key)`; `(status, scheduled_at)` |
| `auto_sale_promotions` | `operator`, `title`, `description`, `starts_on`, `ends_on`, `active`, `created_by` | `(tenant_id, active, ends_on)` |

RLS ligado em todas (só o servidor acessa), como as demais tabelas.

## 3. Máquina de estados

Puro em `src/features/auto-sale/state-machine.ts`, testado em `state-machine.test.ts`.

| Etapa (`stage`) | Entra quando | Sai quando | Etapa do lead (`actorType: "ai"`) | Tempo máximo |
|---|---|---|---|---|
| `chosen` | gestor escolhe | 1ª mensagem do agente aprovada/enviada | mantém | 15 min (senão chama o gestor) |
| `confirming` | abertura enviada | cliente confirma ou corrige os dados | `in_contact` | 24 h |
| `preferences` | faltam dados para cotar (máx. 4 perguntas) | `QuoteInput` completo | mantém | 24 h |
| `quoted` | oferta gerada e enviada | cliente reage | `quote_sent` | follow-up D12 |
| `recommending` | cliente pediu ajuda ou afunilou | cliente gostou de uma | `negotiation` | follow-up |
| `objections` | objeção detectada | objeção resolvida ou gestor chamado | `negotiation` | follow-up |
| `closing` | cliente disse que gostou | cliente aceita ("vamos seguir") | `negotiation` | follow-up |
| `documents` | aceite: lista de documentos e vencimento | documentos recebidos (mídia) | `documentation_pending` | follow-up |
| `manager_called` | qualquer gatilho de §11 (status `waiting_manager`) | gestor decide | mantém | sem limite; agente segura a conversa |
| `handed_off` | gestor entregou/assumiu | fim | mantém | fim |
| `won` / `lost` | gestor marca | fim | não mexe (só pessoa marca venda) | fim |

O agente só avança a etapa do lead para frente e nunca para `converted` ou `lost`.

## 4. Serviço de cotação sem sessão

- `src/features/global-catalog/pilot/server.ts` ganha `loadPilotForTenant(tenantId)`: lê a configuração e só libera quando `config.enabled` e `config.tenantId === tenantId` (o catálogo é da empresa do piloto). `requirePilot` continua igual para a tela.
- `src/features/auto-sale/quote-service.ts` (server-only): `quoteForDeal(deal)` monta o `QuoteInput` a partir dos fatos da negociação e roda `simulate` com `reviewedPlanIds`/`hiddenPlanIds` da configuração.
- `src/features/auto-sale/facts.ts` (puro): mapeia `ai_qualification_sessions.collectedData`, `leads.qualificationDetails`, `leads.livesCount` e `leads.tipo` para fatos (`city`, `neighborhood`, `ages`, `modality`, `entity`, `businessMonths`, `budgetCents`, `coparticipation`, `currentPlan`, `currentPrice`, `hospital`), reaproveitando `parseAges`, `parseBudget` e `matchCity` de `guide/guide-flow.ts`.
- `src/features/auto-sale/offer-strategy.ts` (puro): até 3 opções dentro do orçamento, por preço; prioriza sem coparticipação e com rede no bairro (quando a rede foi consultada); marca uma recomendada com o motivo em uma frase. "Mais em conta": roda o `simulate` de novo relaxando um filtro por vez (acomodação, coparticipação, operadora, entidade) e explica o que mudou.

## 5. PDF de cotação personalizado e imagem por plano

- `src/features/auto-sale/pdf.ts` gera o PDF **só a partir do snapshot** (`auto_sale_offers`): capa (nome, data, validade de 7 dias), perfil cotado, as opções lado a lado (operadora, plano, acomodação, coparticipação, valor por vida, total), a recomendada em destaque com o motivo, rede perto do bairro (quando há), carências em linguagem simples e compra de carência quando há plano atual, promoção vigente (só da tabela), documentos e próximo passo ("Responda SIM e escolha o vencimento: 1, 5, 10 ou 20"), contato e unidades da corretora, aviso legal.
- `src/features/auto-sale/plan-image.ts`: PNG por plano (SVG → `sharp`, que já é dependência), com operadora, plano, total e por vida.
- Persistência no R2 (`auto-sale/<tenantId>/<dealId>/<offerId>.pdf`), `sha256` gravado na oferta. Cada oferta nova gera PDF novo; a "mais em conta" compara com a anterior ("R$ X a menos por mês").
- Envio pelo **outbox da negociação** (`auto_sale_outbox`, `kind = document/image`), despachado pelo job com `uploadMetaMediaObject` e `sendMetaCloudMediaMessage` (extraído de `send-lead-media.ts` para `communication-channels/meta-media-send.ts`, reaproveitado pelos dois).
- O gestor vê e baixa o PDF no `Sheet` (rota `/api/auto-sale/offers/[offerId]/pdf`, autenticada e por empresa).

## 6. O agente de venda

- `src/features/auto-sale/agent.ts`: `runGateway` com `profile: "chat-smart"`, `sensitive: true`, `purpose: "auto_sale_turn"`, saída validada por zod (`agentTurnSchema`): `intent`, `facts` novos, `objection`, `nextAction` (`ask`, `quote`, `recommend`, `cheaper`, `close`, `request_documents`, `call_manager`, `hold`, `end`), `messages` (1 a 4 curtas, ritmo de chat) e `managerReason`.
- Ferramentas determinísticas executadas pelo servidor conforme `nextAction`: `simulate` (cotação e mais em conta), detalhes do plano e rede (`loadPlanShard`), RAG das operadoras com citação (`operator-catalog/answer.ts`, só quando a pergunta é de cobertura ou rede) e promoções vigentes.
- Mensagens com preço **não** são escritas pela IA: a cotação sai de `quote-messages.ts`, que formata a partir do snapshot. A IA escreve o resto e passa pelos guardrails.
- `src/features/auto-sale/playbook.ts`: playbook versionado (`AUTO_SALE_PLAYBOOK_VERSION`) com a sequência dos ganhadores, os documentos padrão e as 10 objeções com a resposta que funcionou.

## 7. Guardrails de venda (`guardrails.ts`, puro)

Substituem o `PricingGuard` só aqui:

- todo valor em reais na saída precisa estar no conjunto de valores do snapshot vigente (total, por vida, diferença entre ofertas);
- rede e hospital só com fonte (oferta com rede consultada ou resposta do RAG com citação);
- promoção só da tabela vigente (palavras "promoção", "desconto", "grátis" exigem promoção ativa);
- bloqueio de promessa fora do catálogo ("sem carência", "aprovação garantida", "cobre tudo") e de conselho médico;
- anti prompt-injection na entrada (instruções ao "sistema", "ignore as regras", pedido de prompt): o texto vira dado e o turno marca `injection`;
- limites D11 e horário D3;
- parada imediata: opt-out (`parseOptOut`), 131049, "quero falar com uma pessoa", irritação, advogado/Procon, duas mensagens sem entender. Opt-out encerra a negociação; os demais chamam o gestor.

## 8. Entrada e convivência

- `src/features/auto-sale/inbound.ts` → `routeAutoSaleInbound({ tenantId, leadId, providerMessageId, messageKind })`: com negociação ativa, grava o turno (idempotente pelo índice único), marca `reply_due_at = agora + 75 s` e devolve `true`. Chamado em `ingestMetaCloudWebhook` (`communication-channels/service.ts`, ao lado do pós-venda) e `ingestWahaWebhook` (`waha-cadence/inbound.ts`, ao lado do pós-venda). Com `true`, o webhook não chama a IA de qualificação.
- Gate `isLeadInActiveAutoSale(tenantId, leadId)` (tolera 42P01) em: `processQueuedLead` (`lead-distribution/service.ts`, retorna `manual_required`), `analyzeLeadConversation` (`conversation-intelligence/analyzer.ts`), `decideNextTouch` via `cadence-job.ts` do turbo, `processDelivery` (`waha-cadence/service.ts`) e a regra de chat parado (`leads/stale-stage-sweep.ts`). A qualificação e o silêncio param pelo `PAUSED` da conversa.
- **Áudio:** `src/features/auto-sale/audio.ts` → `prepareDealAudio` reaproveita `transcribeAudio`, `readOggDurationSeconds`, `cleanTranscript` e a tabela `lead_audio_transcriptions` (sem `slot`, idempotente por mensagem), com o limite D6. Falhou ou passou do limite: pede, com gentileza, que o cliente escreva e avisa o gestor no turno.

## 9. Canal

- Escolha explícita na criação e no `Sheet` (Meta oficial ou um número WAHA da empresa conectado), com o fallback visível ("Se o WAHA cair, nada sai: a negociação pausa e o gestor é avisado").
- Meta: texto dentro da janela de 24h pelo outbox protegido (`enqueueMetaTextMessage`, `recipientType: "lead"`, `purpose: "autoSale"`). Fora da janela, só template aprovado; sem template aprovado, o item fica `held` com "Fora da janela de 24h: precisa do template aprovado".
- WAHA: texto pelo outbox com `deliveryRoute: "waha_direct"` (como o pós-venda), respeitando a pausa anti-ban do número (`pausedUntil`).
- Templates novos (para aprovar na Meta): `venda_retomada_cotacao` ({{1}} nome, {{2}} plano, {{3}} valor), `venda_condicao_prazo` ({{1}} nome, {{2}} condição, {{3}} data) e `venda_encerramento` ({{1}} nome).

## 10. Follow-up

Cadência D12, calculada em `follow-up.ts` (puro): 45 min após a cotação sem resposta (na sessão), 20 h ("ficou com o A ou o B?", plano e preço do snapshot), D+2 (condição real ou prazo, só com promoção vigente; senão a pergunta de decisão), D+5 (opção mais em conta ou encerramento cordial). Nunca sexta depois das 14h nem no fim de semana (empurra para segunda 9h). Para quando o cliente responde, em opt-out, em `waiting_manager` ou ao fim da negociação. Job no runbook (§17).

## 11. Chamar o gestor e entregar a quem ele escolher

- Gatilhos: documentos recebidos, cliente pediu uma pessoa, objeção fora do roteiro, valor fora do catálogo, dúvida de saúde, desconfiança de golpe, irritação, áudio não entendido, guardrail barrou duas vezes.
- O agente segura com "Vou confirmar isso e já te retorno." uma vez e não insiste.
- Resumo para o gestor (`manager-summary.ts`, puro): cliente, o que quer, ofertas e PDFs enviados, objeções, motivo da chamada e próximo passo sugerido.
- Aviso só para o gestor que escolheu: notificação no app (`notifications`) e WhatsApp corporativo para o telefone dele (`enqueueMetaTextMessage`, `recipientType: "user"`).
- No `Sheet`: **Devolver ao agente**, **Assumir** (encerra o agente na hora) e **Entregar a um corretor** (busca entre os corretores ativos da empresa). Só a entrega muda `leads.corretorId`, com `audit_logs` (`auto_sale.handed_off`) e `lead_stage_history` com o papel do gestor.

## 12. Modos

- **Simulação:** o agente escreve; o outbox grava `simulated` e nada sai. O `Sheet` mostra o que teria saído.
- **Copiloto (padrão):** cada item vai para `draft`; o gestor edita e envia (ou descarta) no `Sheet`.
- **Autopiloto (F4):** só com `feature_auto_sale_autopilot_<tenantId>` ligada e por negociação; só planos `ready`; limites D11.

## 13. Tela

- Rota `/vendas/automatizada` (área Comercial, aba "Venda Automatizada", `requires: "autoSale"`, papéis diretor e gestor), escondida com a flag desligada.
- Blueprint `list-page`: `SectionCardHeader` + `DataTable` das negociações (ativa e histórico) com cliente, etapa, modo, canal, última atividade e custo. CTA único: **Escolher lead quente** (abre `Sheet` com busca e "Só quentes" ligado).
- `Sheet` da negociação: etapa e status, ações (Pausar/Retomar, Assumir; Entregar a um corretor, Devolver ao agente, Modo e Canal no menu `⋯`), mensagens aguardando aprovação (editar e enviar), conversa, ofertas com PDF para baixar, decisões da IA com o motivo, custo de IA e transcrição.
- Estados: carregando, vazio ("Nenhuma negociação ainda"), migração pendente, pausada pela plataforma, erro; responsivo (tabela vira lista no celular via `responsive-data-view`).

## 14. Métricas

`metrics.ts` calcula por negociação: tempo até a 1ª cotação, respostas do cliente, opções e PDFs enviados, chegada a `documents` (sucesso principal), chamadas ao gestor por motivo, custo de IA e de transcrição. Comparação com a base (17 min até a 1ª mensagem, 10 min até a cotação, 0,9 h até os documentos) no cabeçalho da área.

## 15. Testes e avaliação

- Unitários: `guardrails.test.ts`, `state-machine.test.ts`, `offer-strategy.test.ts`, `facts.test.ts`, `follow-up.test.ts`, `eligibility.test.ts`, `pdf.test.ts` (todo número bate com o snapshot; acentos codificados), `ownership.test.ts` (nenhum caminho do agente escreve `corretorId` ou cria oferta).
- Replay (F5): `replay.test.ts` com conversas anonimizadas modeladas do estudo de 12/11 (fechamentos e perdidas, inclusive uma com áudio transcrito) e um modelo roteirizado: chega a `documents` nas que fecharam, nunca deixa sair número fora do snapshot, para em opt-out e "falar com uma pessoa", e cobre as 10 objeções.

## 16. Riscos, LGPD e conformidade

- Consentimento: só lead com `consentimentoLgpd`. Mínimo de dados de saúde: o agente não pergunta doença; dúvida de saúde chama o gestor.
- Transparência: sempre "assistente virtual da corretora".
- ANS: carência e cobertura só do catálogo, com os prazos legais (24 h urgência, 180 dias eletiva, 300 dias parto) em linguagem simples e com "conforme o contrato da operadora".
- Kill switch global e flag por empresa; "Assumir" a qualquer momento.
- Risco de preço divergente do anúncio: o agente explica tabela MEI/CNPJ só quando a oferta é PME.
- Risco de convivência: ganchos toleram tabela ausente e falham fechados para o agente (sem negociação, nada muda).

## 17. Fases

| Fase | Flag | Pronto quando | O Vinicios revisa |
|---|---|---|---|
| F0 | n/a | decisões D1 a D15 adotadas; revisão comercial dos 4 grupos de planos (ação humana) | lista de planos revisados |
| F1 | `feature_auto_sale_<tenantId>` | migration 0228, gate, tela e escolha do lead, sem envio | tabela e `Sheet` no computador e celular |
| F2 | idem | cotação sem sessão, ofertas com snapshot, PDF e imagem, áudio na negociação, Simulação | PDF e imagem de um lead real em Simulação |
| F3 | idem | Copiloto com 1 lead, chamada ao gestor e entrega, follow-up e job | mensagens aprovadas uma a uma |
| F4 | `feature_auto_sale_autopilot_<tenantId>` | Autopiloto por negociação com limites | só depois de 5 negociações em Copiloto |
| F5 | n/a | suíte de replay; métricas comparadas | relatório |

Job: `/api/internal/jobs/auto-sale`, `* * * * *`, lease `auto-sale` e heartbeat (`JOB_SCHEDULE["auto-sale"]`). Uma rodada: responde às rajadas vencidas (até 3 negociações), despacha o outbox aprovado, dispara follow-ups e checa os tempos máximos. Registrado em `docs/runbooks/coolify-scheduled-tasks.md`.

Estimativa: F1 1 dia, F2 2 dias, F3 2 dias, F4 0,5 dia, F5 1 dia (com conversas reais anonimizadas).

## O que não entra no piloto

- Mais de uma negociação por empresa; lead com corretor; sábado.
- Resposta em áudio; PDF ou imagem pelo WAHA (o relay de produção em corretor-infra só envia texto).
- Assinatura digital e envio da proposta à operadora; registrar venda (continua com a pessoa).
- Rede por bairro em todos os planos (depende do shard de rede do catálogo; sem rede, o PDF omite a seção).
- Expurgo automático dos turnos (D15) e painel de métricas comparativo além do cabeçalho.

## Ação humana pendente

1. Revisar no Super-admin › Catálogo os planos Klini 200, Amil Bronze, Leve Top 400 e Assim (D5).
2. Criar e aprovar na Meta os templates `venda_abertura` ({{1}} nome, {{2}} corretora; para lead cuja última mensagem passou de 24 h), `venda_retomada_cotacao`, `venda_condicao_prazo` e `venda_encerramento`. Até lá, o que cair fora da janela fica retido com o motivo e o diretor decide.
3. Aplicar `drizzle/0228_auto_sale.sql` antes do deploy.
4. Criar a tarefa `/api/internal/jobs/auto-sale` (`* * * * *`) no Coolify.
5. Ligar `feature_auto_sale_<tenantId>` no Super-admin para a empresa do piloto (Autopiloto só depois).
6. Cadastrar as promoções vigentes na área (se houver).

## Revisão crítica

Ver seção "Revisão" no fim deste arquivo (preenchida após a revisão independente).

## Revisão (12/11, revisor independente com o plano e o código)

Achados e o que foi feito (A = alta, M = média, B = baixa):

| # | Achado | Correção |
|---|---|---|
| A1 | Quase nenhum lead tem `consentimentoLgpd`; lead quente ganha dono provisório na oferta | D16 (base legal pelo contato do cliente) e D1 (oferta pendente cancelada na escolha) |
| A2 | Lead preso sem dono e conversa `PAUSED` para sempre ao fim | D17: `restore_state` na negociação, devolução à distribuição com job, encerramento por inatividade |
| A3 | Depois do opt-out as réguas voltariam | `optOutAt` gravado na conversa, outbox da negociação e do WhatsApp cancelados (`purpose = autoSale`), lead fica fora da distribuição |
| A4 | Corrida webhook x job | O job reivindica com o `reply_due_at` visto; mensagem nova no meio cancela o que foi preparado e rearma a rajada |
| A5 | Corrida na escolha | Transação com `FOR UPDATE` no lead, elegibilidade conferida de novo, ofertas canceladas, remoção da distribuição e insert com índice único |
| A6 | Janela de 24 h contada também por mensagens do WAHA | `brokerMetaWindowOpen` conta só entradas pela Meta e é conferida na hora do envio; WAHA envia só texto; abertura fora da janela fica retida (template `venda_abertura` na lista de ação humana) |
| M7 | Gestor fora de `/vendas` | D2 |
| M8 | Entrega gravando `corretorId` direto | `handOffToBroker` usa `assignLeadToBroker` (histórico, eventos, aviso) e devolve a etapa que a atribuição volta para "Distribuído" |
| M9 | Preço escapando ("450 por mês", "1,2 mil", "%", texto editado) | Padrões novos, porcentagem exige promoção, só a oferta vigente vale, valor dito pelo cliente pode ser repetido, texto editado no Copiloto passa de novo e só sai com confirmação auditada (`auto_sale.guard_override`) |
| M10 | Snapshot vence antes da validade | Validade = menor entre 7 dias e o fim da vigência do preço; follow-up nunca cita preço |
| M11 | Valor por vida e orçamento por pessoa | PDF mostra o valor por idade; `budgetBasis` (por pessoa x total) |
| M12 | Autopiloto nunca cota adesão, PME ou família (sempre `pending`) | Mantido de propósito no F4 (só `ready`); registrado como limite conhecido |
| M13 | Promoção sem número | Promoção fica só como texto com data de fim; o agente não calcula valor com desconto no piloto (fica para depois) |
| M14 | Kill switch reabriria a qualificação | Com negociação existente a entrada sempre captura (falha fechado), mesmo com o kill switch desligado |
| M15 | Empresa bloqueada por negociação parada | Encerramento por inatividade (`idleManagerHours`, 72 h) |
| M16 | Parâmetros fixos no código | `auto_sale_settings_<tenantId>` editável no Super-admin com auditoria |
| M17 | Catálogo preso a uma empresa | O Super-admin só liga a flag se o catálogo do piloto é da empresa; a tela mostra "catálogo não liberado" |
| B18 | Aviso ao gestor fora da janela | Notificação no app é o canal principal; WhatsApp é tentativa |
| B19 | Follow-up de 20 h deve contar da última mensagem do cliente | Feito; passo 1 fora da janela pula para o passo 2 (template) |
| B20 | WAHA frio | Só o número em que o cliente já escreveu |
| B21 | Métrica "proposta assinada", estado sem permissão, DEC | Métrica pela etapa `under_analysis`; `/access-denied` e `notFound` com a flag desligada; DEC-182 registrada |
| B22 | Saúde ampla demais | Gravidez e cirurgia (dúvidas de carência) ficam com o playbook; só doença e tratamento chamam o gestor |

Também corrigido durante a implementação: o `parseOptOut` da qualificação trata "não quero" e "já tenho" como saída; na venda isso é preferência ("não quero coparticipação"), então a venda usa um opt-out mais estreito (`classifyInbound`).

## Registro de implementação (F1 a F3, F4 sob flag, F5 replay)

Arquivos principais:

- Dados: `drizzle/0228_auto_sale.sql` (journal `0228_auto_sale`), tabelas em `src/shared/db/schema.ts`.
- Flags: `FEATURE_FLAGS.AUTO_SALE`, `AUTO_SALE_AUTOPILOT`, `AUTO_SALE_GLOBAL` (`src/shared/feature-flags/catalog.ts`); leitura em `src/features/auto-sale/flag.ts`; parâmetros em `settings.ts`; Super-admin em `components/super-admin-card.tsx` e `super-admin-actions.ts`.
- Regras puras: `eligibility.ts`, `facts.ts`, `offer-strategy.ts`, `guardrails.ts`, `state-machine.ts`, `follow-up.ts`, `quote-messages.ts`, `playbook.ts`, `turn-engine.ts`, `manager-summary.ts`, `metrics.ts`.
- Servidor: `service.ts` (escolha, gestor, entrega, encerramento), `quote-service.ts` (cotação sem sessão, `loadPilotForTenant` em `global-catalog/pilot/server.ts`), `pdf.ts`, `plan-image.ts`, `audio.ts`, `agent.ts`, `runner.ts`, `dispatch.ts`, `inbound.ts`, `job.ts`, `queries.ts`, `actions.ts`, `repository.ts`.
- Envio de mídia da Meta extraído para `communication-channels/meta-media-send.ts` (usado também por `send-lead-media.ts`).
- Ganchos: `communication-channels/service.ts` e `waha-cadence/inbound.ts` (entrada), `lead-distribution/service.ts` (`processQueuedLead`), `conversation-intelligence/analyzer.ts`, `qualification-turbo/cadence-job.ts`, `waha-cadence/service.ts`. A regra de chat parado só olha leads com corretor, então não precisa de gancho.
- Tela: `src/app/(dashboard)/vendas/automatizada/` (lista, `Sheet` de escolha, `Sheet` da negociação, promoções), aba em `nav-registry.ts` (`requires: "autoSale"`), título em `components/light/director-routes.ts`, PDF em `src/app/api/auto-sale/offers/[offerId]/pdf/route.ts`, prévia em `/dev/venda-automatizada-preview`.
- Job: `src/app/api/internal/jobs/auto-sale/route.ts`, `JOB_SCHEDULE["auto-sale"]`, runbook.

Verificação:

- `vitest` da área: 48 testes (`rules.test.ts`, `replay.test.ts`, `ownership.test.ts`, `pdf.test.ts`) e os módulos tocados.
- `agent:verify --level full`: docs, arquitetura, segurança (0), desempenho, lint e tipos passaram; a suíte inteira falhou em 72 testes rodando junto com o build. Rodando de novo só os que falharam, 47 de 55 arquivos passaram (timeouts sob carga); os 8 restantes e `webhook-intake-sync` falham igual no commit base `3b1b8ea2`. `npm run build` passou. Evidência: `reports/agent/verification/2026-11-12-venda-automatizada.md`.
- `tsc --noEmit` limpo; `eslint` sem erro nos arquivos tocados (avisos preexistentes em `send-lead-media.ts`, `waha-cadence/inbound.ts`, `analyzer.ts` e no Super-admin ficaram como estavam).
- Navegador (prévia `/dev/venda-automatizada-preview`, dados fictícios): visual Lite e normal no computador (1366 px), cartões, `Sheet` de escolha e `Sheet` da negociação no celular (375 px), sem erro no console. A rota real `/vendas/automatizada` redireciona ao login sem sessão; o job responde 401 sem `CRON_SECRET`.
- Não verificado: fluxo real contra banco (migração não aplicada), envio real pela Meta e pelo WAHA, chamada real ao modelo e à transcrição.

Limites conhecidos do piloto: WAHA não envia PDF nem imagem; Autopiloto não cota adesão, PME nem família (sempre `pending` no catálogo); promoção sem valor calculado; expurgo dos turnos (D15) fica para a próxima fase.

## Link público da cotação (pedido do Vinicios, 12/11)

- Cada oferta gera um token (24 bytes aleatórios; só o hash SHA-256 fica em `auto_sale_offers.public_token_hash`) e um link `/compartilhado/cotacao/<token>`, já liberado sem login pelo proxy (`/compartilhado`). Vale até o fim do último dia de validade da cotação (7 dias ou o fim da vigência do preço), é revogado no opt-out e para de abrir com a Venda Automatizada desligada na empresa ou o kill switch.
- A página mostra o mesmo conteúdo do PDF, só do snapshot: opções lado a lado com o valor por idade, a recomendada e o motivo, a rede perto do cliente (gravada em `auto_sale_offers.network`), carências, promoção vigente, documentos e próximo passo. Um CTA primário: "Responder no WhatsApp" (número da corretora: o WAHA da negociação ou o canal oficial); o PDF é secundário (`/compartilhado/cotacao/<token>/pdf`). Dado pessoal mínimo: primeiro nome e idades; sem telefone, e-mail ou sobrenome. `noindex` e `no-store`.
- Envio: com `quoteLink` ligado (padrão, editável no Super-admin), a cotação vai como texto mais a mensagem com o link, em qualquer canal, inclusive WAHA; imagens e PDF no chat só com `quoteLink` desligado. Isso resolve o limite do WAHA (só texto) e evita despejar mídia no chat.
- O gestor vê no painel quantas vezes o cliente abriu o link, e a primeira abertura entra nas decisões ("Cliente abriu a cotação").
- Limite por hora passou de 6 para 12: a cotação sozinha já são 4 ou 5 mensagens curtas, e 6 por hora retinha a própria cotação.
- Migration: colunas novas na `0228_auto_sale.sql` (ainda não aplicada em lugar nenhum).
- Verificação: `public-link.test.ts` (token, validade, revogação, mensagem sem valor, página sem contato do cliente, botão do WhatsApp); prévia `/dev/cotacao-publica-preview` no celular e no computador, sem erro de hidratação; token inválido cai no 404.

## Cotar todos os planos e tipos (pedido do Vinicios, 12/11)

- **Perguntas por tipo:** adesão pede a profissão ou a entidade; PME pede o tipo de empresa (MEI, ME, EPP, LTDA, S.A., EI) e o tempo de CNPJ (antes ficava fixo em MEI); "só odonto" usa as modalidades `*_ODONTO` do catálogo e "saúde com odonto" filtra planos com odonto incluso. Fatos novos: `product`, `dentalIncluded`, `businessProfile`. A qualificação já coletada é aproveitada (tipo de empresa, profissão, produto). Playbook `2026-11-12.2`.
- **Entidade de adesão:** `entity-match.ts` resolve o que o cliente disse ("OAB", "sou advogado") na entidade exata do catálogo, pela sigla, pelo nome ou pela lista de profissões do catálogo. Bateu com várias: o agente pergunta com até 3 opções; com nenhuma: pergunta a profissão de novo. A entidade resolvida fica nos fatos da negociação.
- **Pendência bloqueante x conferência de documento:** o motor marca PME, adesão e dependentes como pendentes sempre. Agora três desses motivos (tempo de empresa e grupo, vínculo de dependente, profissão e entidade da adesão) contam como "conferência de documento", que o pedido de documentos já cobre. Com só esses motivos, o Autopiloto cota (revoga a limitação M12). Plano não revisado, critério sem confirmação na fonte, preço ambíguo, município, limites de vidas e idade continuam bloqueando. O texto dos motivos é conferido contra o `simulate` real em `quote-types.test.ts`. PDF e página pública dizem "vínculo, entidade ou tempo de empresa são conferidos na documentação" nesse caso.
- **Continua dependendo de ação humana:** revisão comercial dos planos (0 de 4.922) e confirmação estruturada de idade, elegibilidade e perfil no catálogo; liberar o catálogo para outras empresas. O vínculo de cada dependente não é perguntado (o motor só distingue titular e dependente), para não passar de 4 perguntas.
