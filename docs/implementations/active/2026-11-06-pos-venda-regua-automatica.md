# Pós-venda: manual e automático (plano de 06/11/2026)

Pedido do Vinicios (06/11): além da campanha manual (escolher um grupo de leads, de um corretor ou de um período), uma régua automática em que o sistema começa a conversar com o lead um dia e alguns dias depois de marcos do atendimento, colhendo do próprio lead como foi o atendimento.

Base: Fase 1 de `2026-11-05-pos-venda-auditoria.md` (`0c770b13`): tabelas `post_sale_campaigns` e `post_sale_surveys`, público com exclusões, canal de origem (WAHA ou Meta com o template `pos_venda_apresentacao`), envio idempotente pelo outbox, flag `feature_post_sale_audit_enabled` desligada.

Nota da revisão da Fase 1: números WAHA com escopo de unidade não são origens elegíveis para as campanhas atuais e devem resultar em `source_unavailable` até esse escopo ter regra explícita de envio.

## Ideia central

Uma única máquina de pesquisa (survey) com duas portas de entrada:

1. **Manual:** a direção escolhe o público (um lead, uma lista, todos os leads de um corretor, por fila, unidade, tipo PF/PJ, etapa ou período de chegada) e dispara. Já existe no backend (Fase 1); falta tela e conversa.
2. **Automática (régua):** regras por empresa criam, todo dia, uma campanha automática com os leads que atingiram o marco + atraso. Usa o mesmo enfileiramento, o mesmo roteiro e os mesmos relatórios.

## Régua automática: regras iniciais

Atrasos em dias úteis (seg a sex, 08h às 18h, BRT). Cada regra pode ser ligada ou desligada, ter o atraso trocado e filtros por fila, unidade e tipo.

| Regra | Marco | Atraso padrão | O que pergunta | Condição extra |
|---|---|---|---|---|
| R1 Checagem de atendimento | lead distribuído e aceito pelo corretor | D+1 | O corretor falou com você? Foi rápido? | lead ainda aberto (não vendido, não perdido) |
| R2 Acompanhamento | mesmo marco | D+5 | Recebeu cotação? Como está a decisão? Nota de 1 a 5 | sem pesquisa R1 respondida nos últimos 4 dias |
| R3 Pós-venda da venda | venda registrada | D+3 | Como foi a contratação? Ficou alguma dúvida? Nota | só leads convertidos |
| R4 Motivo da perda | lead marcado como perdido | D+2 | O que pesou na decisão? (confere o motivo dado pelo corretor) | não pergunta se o motivo for "número errado" ou "pediu para não contatar" |
| R5 Satisfação de 30 dias (depois) | venda registrada | D+30 | Tudo certo com o plano? Indicaria? | ligada só depois do piloto |

Regras de proteção, valendo para manual e automático:
- No máximo 1 conversa de pós-venda por lead a cada 30 dias (manual e automática somadas); R1 e R2 respeitam uma à outra.
- Não envia se houve conversa humana nas últimas 24h, se o lead pediu para parar (opt-out) ou se o número é inválido.
- Sempre pelo número por onde o lead entrou. Número oficial Meta: primeira mensagem é o template aprovado; depois que o cliente responde, segue em texto livre.
- Limite por dia por empresa (padrão 60) e por número, mais o ritmo do guard (8 s + variação, 40/h).
- Modo piloto: lista de filas ou corretores liberados e limite baixo (20/dia) até a direção liberar geral.

## Conversa (igual para manual e automático, roteiro por regra)

- Apresentação primeiro ("Oi, {nome}! Aqui é a {assistente}, da equipe de qualidade da {empresa}…"), uma pergunta por vez, tom calmo, sem cara de robô, usando o primeiro nome do cliente e do corretor.
- A IA lê cada resposta e extrai: falou com o corretor, rapidez, nota 1 a 5, recebeu cotação, fechou, quer ajuda agora, motivo, comentário, pediu para parar. Se a IA falhar, regra de palavras-chave.
- Respostas fora do roteiro: acolhe em 1 frase e volta ao ponto. Pedido de preço ou ajuda vira alerta de recontato (a IA nunca informa valor).
- Sem resposta: 1 lembrete gentil depois de 24h úteis; depois, "sem resposta".
- Ao terminar: grava as respostas no lead (linha do tempo) e no survey.

## O que a direção vê

- **Alertas** (notificação e item no painel do diretor e do gestor da unidade): cliente diz que não foi atendido, nota até 2, quer ajuda agora, motivo de perda diferente do registrado. Ações: repassar o lead, cobrar o corretor.
- **Página Pós-venda** (área Equipe): abas Campanhas (criar com público e prévia de exclusões, acompanhar), Régua automática (ligar regras, atrasos, filtros, prévia "amanhã sairiam N mensagens"), Respostas (feed filtrável) e Relatório por corretor (% atendidos, nota média, % fechou, sem contato, alertas).
- **No perfil do corretor**: cartão "Avaliação dos clientes".
- **Na lista de leads**: ação em massa "Enviar pós-venda".
- **Na ficha do lead**: cartão com as respostas.

## Dados novos (SQL que o Vinicios roda)

- `post_sale_campaigns`: colunas `kind` (`manual` | `auto`) e `rule_key` (null no manual).
- Tabela `post_sale_rules`: `tenant_id`, `key` (R1 a R5), `enabled`, `delay_business_days`, `filters` jsonb, `daily_limit`, `pilot` jsonb (filas/corretores liberados), `updated_by`, `updated_at`. Único por (tenant, key).
- `post_sale_surveys`: coluna `rule_key` e índice por (tenant, lead, created_at) para a regra de 30 dias.

## Regra R0: cliente que volta a escrever depois de distribuído (pedido de 06/11)

Caso real (06/11): lead empresarial já distribuído e "Em Atendimento" com a corretora; ela mandou "O que achou?", depois "Encerrando o atendimento". No dia seguinte o cliente escreve de novo pedindo cotação e a conversa fica parada em "Aguardando Humano", sem resposta.

Gatilho: mensagem nova do cliente em lead que já tem corretor (aceito ou em atendimento, não vendido) e que fica sem resposta humana por X minutos em horário comercial (padrão 10 min), ou que chega depois de o corretor encerrar o atendimento. Diferente da R1 a R5, não depende de atraso em dias: é reativa à mensagem do cliente.

Fluxo da IA (mesmo motor de pesquisa, roteiro próprio `rule_key = R0`, uma pergunta por vez):
1. Acolhe e situa: "Oi, {nome}! Vi que você já conversou com {corretor} sobre o plano {tipo}. Me conta o que rolou: você chegou a ser atendido e receber a cotação?"
2. Lê a resposta e classifica: (a) não foi atendido ou não recebeu cotação; (b) foi atendido e quer cotação nova, ajuste ou tirar dúvida; (c) já fechou ou desistiu; (d) outro assunto.
3. Destino:
   - (a) alerta "Cliente diz que não foi atendido" para a direção e o gestor da unidade; sem resposta de alguém da empresa em 15 min úteis, escalada para a direção.
   - (b) registra o pedido e confirma ao cliente que a equipe vai retomar; sem resposta no prazo, mesma escalada de (a).
   - (c) registra no lead (vendido por fora, desistiu, motivo) e encerra com cordialidade.
   - (d) responde em 1 frase, sem prometer um corretor específico; sem resposta no prazo, mesma escalada.
   - Mudança do Vinicios (09/11): "Só remova o aviso ao corretor." A R0 não avisa o corretor por nenhum caminho (nada no app, nada no WhatsApp).
4. Grava tudo no lead (linha do tempo) e no survey; conta no relatório por corretor como "cliente voltou sem resposta".

Proteções: no máximo 1 conversa R0 por lead a cada 7 dias; não dispara se o corretor respondeu nas últimas 2 horas ou se há pesquisa ativa; respeita opt-out; a IA nunca informa preço. Usa o canal por onde o cliente escreveu (no Meta já dentro da janela de 24h aberta pelo cliente, então texto livre).

Relação com o "cliente aguardando corretor" (`da7b7668`, reprovado pelo Vigia em 05/11): a R0 substitui o lembrete passivo ao corretor por uma conversa com o cliente; o alerta ao corretor e a escalada reaproveitam aquele trabalho depois de corrigidos os bloqueios (corrida com o timeout de 15 min, job que pode duplicar, envio falho contando como respondido).

Entrega: Fase 4a, antes da R1, porque o problema acontece hoje com leads quentes. Piloto em uma fila, com a direção recebendo os alertas.

### Implementação da R0 (09/11/2026, branch `feat/pos-venda-r0`)

- **Chave e piloto:** Equipe > Pós-venda, cartão "Cliente voltou a escrever". O diretor liga ou desliga e marca as filas do piloto; gestor só vê. Fica em `system_settings`, chave `post_sale_r0_<tenantId>` com `{"enabled":true,"queueIds":[...]}`. Ausente = desligada. Ligada sem fila não dispara. Também exige a flag global `feature_post_sale_audit_enabled`. Sem tabela nova e sem migration.
- **Onde roda:** dentro do job existente `/api/internal/jobs/customer-waiting` (a cada 5 min), depois da varredura do "cliente aguardando", com lease próprio (`post-sale-r0`). Falha da R0 não derruba o job. Nenhum job novo para cadastrar.
- **Gatilho** (`r0-rules.ts`, `decideR0Trigger`): reaproveita `loadCustomerWaitingLeads` (ciclo aberto, minutos úteis de espera). Dispara com 10 min úteis sem resposta humana, ou na hora quando a última mensagem humana foi de encerramento ("Encerrando o atendimento", "vou encerrar", "atendimento finalizado"). Lead em `distributed`, `in_contact`, `quote_sent`, `negotiation` ou `awaiting_reply`, com `distribution_status = assigned`, numa fila do piloto. Não dispara: dono diretor, corretor respondeu nas últimas 2 h (a mensagem de encerramento não conta), pesquisa ativa (queued, sent, answering), opt-out (pós-venda ou conversa), R0 nos últimos 7 dias, fora do horário comercial, mensagem do cliente com mais de 23 h (janela do Meta) ou canal indisponível.
- **Canal:** o mesmo da última mensagem do cliente. Número oficial Meta compartilhado da empresa (texto livre, `enqueueMetaTextMessage`) ou WAHA da empresa permitido para a unidade do lead. WhatsApp pessoal do corretor fica de fora (`source_unavailable`).
- **Idempotência:** uma campanha automática por empresa e dia (`kind = auto`, `rule_key = R0`, id derivado de empresa + dia). Survey com id derivado de empresa + lead + mensagem que disparou, `rule_key = R0`, inserido antes do envio; conflito = já iniciado. Chave do outbox `post-sale:<campanha>:<lead>`, a mesma que o retorno de entrega usa para marcar `sent`.
- **Conversa:** a resposta do cliente chega pelo roteamento existente (`handlePostSaleInbound`). Survey R0 vai para `processR0Answer`: IA (`interpreter`, `sensitive`) classifica em (a) `not_attended`, (b) `wants_more`, (c) `closed_or_gave_up` (fechou por fora ou desistiu), (d) `other_subject`; se falhar, `classifyR0AnswerByKeywords`. Uma resposta só: grava `answers.r0`, `outcome` (`r0_not_attended`, `r0_wants_more`, `r0_closed_elsewhere`, `r0_gave_up`, `r0_other`) e responde com texto fixo, sem preço e sem citar corretor. Opt-out explícito usa a mesma transação de opt-out da pesquisa.
- **Alertas e escalada:** (a) gera na hora o alerta "Cliente diz que não foi atendido" para diretores e gestor da unidade (notificação in-app pelo `ensurePostSaleSurveyAlerts`). Em (a), (b) e (d) a varredura confere, a cada 5 min, se alguém da empresa respondeu depois da resposta do cliente: respondeu = `resolvedAt`; 15 min úteis sem resposta = `escalatedAt`, alerta "Cliente voltou a escrever e ficou 15 min sem resposta da equipe" para a direção e o gestor, e nota no lead.
- **Redistribuição: não feita automaticamente.** A distribuição nunca tira um lead já aceito do corretor (mesma regra do SLA em `leads/sla.ts`; `processQueuedLead` não roda para lead aceito ou em atendimento). Mudar isso mexe no núcleo da distribuição, então a escalada só alerta a direção, que repassa pelo fluxo de transferência existente a partir do alerta ("Abrir lead").
- **Registro:** nota na linha do tempo ao iniciar, ao concluir (resumo com destino, pedido e motivo) e ao escalar; auditoria `post_sale.r0.started` e `post_sale.r0.escalated`. "Desistiu" fica registrado com o motivo na nota e no survey; o lead não é marcado como perdido automaticamente.
- **Relatório:** coluna "Voltou sem resposta" no relatório por corretor (conversas R0 no período). Survey R0 fica fora de enviadas, respondidas, atendimento, nota e fechou; alertas abertos da R0 contam em "Alertas abertos". Respostas mostram os chips "Voltou a escrever" e o destino.
- **Lembrete:** R0 não recebe o lembrete de 24 h da pesquisa (no Meta seria o template); sem resposta em 24 h úteis, encerra como `no_reply`.
- **Soma com o manual:** uma R0 conta como pesquisa recente para a campanha manual (proteção de 60 dias já existente).
- Validação: Vitest de pós-venda, cliente aguardando, canais e inbound WAHA; `tsc --noEmit` limpo; ESLint sem erros nos arquivos tocados. Nenhum banco acessado e nada enviado.

## Motor automático

Job a cada 15 min (rota interna de jobs existente). Para cada regra ligada: busca leads que bateram o marco + atraso no dia útil, aplica proteções e filtros, cria ou reaproveita a campanha automática do dia (`kind = auto`, `rule_key`) e enfileira com a chave `post-sale:<rule>:<lead>:<marco>`. Rodar duas vezes não duplica envio. Fora do horário comercial só agenda.

## Ordem de entrega

1. **Fase 1 (pronta, `0c770b13`):** revisão do Vigia, push, SQL `0217` e envio do template `pos_venda_apresentacao` para aprovação da Meta.
2. **Fase 2 (conversa + tela mínima manual):** roteamento das respostas (Meta e WAHA) antes da qualificação, roteiro com IA, opt-out, lembrete, gravação no lead, e uma tela simples: criar campanha manual por corretor, fila ou período, ver a prévia, disparar e ver as respostas. **Aqui já dá para começar com o grupo de leads de um corretor** (piloto de 10 a 20 leads).
3. **Fase 3 (relatórios e alertas):** relatório por corretor, alertas, cartões no perfil do corretor e no lead, ação em massa na lista de leads.
4. **Fase 4a (R0, cliente que volta a escrever):** gatilho reativo, roteiro "o que rolou?", alertas e escalada para o corretor e a direção.
5. **Fase 4 (régua automática):** `post_sale_rules`, motor de 15 min, aba Régua automática com prévia; piloto com R1 em uma fila e 20 por dia.
6. **Fase 5 (ajuste):** depois de uma semana de respostas, ajustar textos, atrasos e ligar R2 a R4; R5 por último.

## Implementação da Fase 2 (06/11/2026)

- Respostas recebidas pelo Meta e WAHA passam primeiro pela pesquisa ativa do mesmo lead e canal, somente nos estados `sent` ou `answering` e dentro de cinco dias. Sem pesquisa correspondente, o fluxo anterior de qualificação continua.
- Premissa do canal Meta: a resposta da pesquisa chega como texto livre dentro da janela de 24 horas aberta pela mensagem do cliente. Fora dessa janela, uma nova conversa exige o template aprovado.
- Opt-out é persistido por tenant e lead sem prazo e também bloqueia a audiência quando a pesquisa antiga já está em `opted_out`. O processamento após a resposta guarda a saída pendente e a chave da mensagem para retomar com uma nova tentativa idempotente.
- Áudio ou imagem durante uma pesquisa ativa recebem um único pedido gentil para responder por texto; a pesquisa permanece aberta e a mensagem não segue para a qualificação.
- A conversa começa pela apresentação já aprovada da Fase 1, faz uma pergunta por vez e usa o interpretador `interpreter` com `sensitive: true`; palavras-chave contextualizadas pela pergunta cobrem falhas da IA. Opt-out encerra a pesquisa, grava a preferência existente de não contato e registra o resultado no lead e no survey.
- O job interno do WhatsApp envia um lembrete após 24 horas úteis sem resposta. Depois de mais 24 horas úteis sem resposta ao lembrete, conclui como `no_reply`. O lembrete usa o mesmo canal de origem e é idempotente.
- A área Equipe ganhou a tela manual Lite para diretor e gestor com unidade: público por corretor, fila ou período, prévia com exclusões e três exemplos, disparo e respostas recentes por lead. Gestores recebem filtros e dados restritos à unidade efetiva.
- O texto editável de abertura só se aplica a WAHA; no Meta, o canal usa o template aprovado `pos_venda_apresentacao`.
- Schema atualizado para `kind` (`manual` ou `auto`) e `rule_key` em campanhas, `rule_key` em surveys, mais `reminder_sent_at` para controlar o único lembrete.
- Migrations criadas em `drizzle/0218_post_sale_manual_conversation.sql` e `drizzle/0220_post_sale_opt_out_retry.sql`; não foram executadas.
- Validação focada, sem banco: Vitest nas áreas de pós-venda, canais, inbound WAHA, navegação e acesso a áreas; TypeScript e ESLint registrados em `reports/agent/verification/2026-11-06-pos-venda-fase2.md`.

## Correções da revisão da Fase 2 (06/11/2026)

- Erro transitório ao procurar pesquisa ativa é registrado e devolve `handled = false`, deixando o fluxo normal de qualificação continuar. Só uma pesquisa ativa confirmada segura a mensagem na rota de pós-venda.
- Opt-out fica em `post_sale_opt_outs`, único por tenant e lead, e não expira. Pesquisas antigas com status `opted_out` também excluem o lead indefinidamente, além do estado legado em `ai_conversations`.
- Estado da mensagem recebida e resposta pendente ficam no survey antes da finalização. Uma tentativa idempotente retoma esse estado, reaproveita a chave do outbox e usa ID determinístico para evitar resposta ou nota duplicada.
- Opt-out e mudança para `opted_out` são escritos na mesma transação. Se a persistência do opt-out falha, o status continua ativo e pode ser reprocessado.
- Com survey ativa, áudio ou imagem gera no máximo um pedido de resposta por texto em cada etapa, sem alterar a etapa e sem passar o conteúdo para qualificação.
- A resposta no Meta é texto livre dentro da janela de 24 horas aberta pela mensagem do cliente; essa premissa foi registrada para orientar o canal.
- Migration `drizzle/0220_post_sale_opt_out_retry.sql` criada e não executada; inclui o marcador da solicitação de texto por etapa. Validação da revisão em `reports/agent/verification/2026-11-06-pos-venda-fase2-review-fixes.md` e `reports/agent/verification/2026-11-06-pos-venda-optout-atomico.md`.

## Origem do envio (06/11, pedido do Vinicios)

- A pesquisa sai pelo número por onde o lead entrou. Número WAHA de unidade vale só para leads da mesma unidade (lead ou fila), tanto na prévia quanto no enfileiramento.
- Conversa feita pelo WhatsApp pessoal do corretor (`whatsapp_connections`) ou lead sem número registrado: a pesquisa sai pelo WAHA da unidade do lead ou, sem ele, pelo WAHA da empresa. Nunca pelo celular do corretor.
- Fila ou unidade com mais de um canal possível (ambíguo) não troca de número: o lead fica fora como `source_unavailable`.
- Premissa: o cliente recebe a pesquisa de um número da empresa diferente do celular do corretor; a conversa com o corretor continua no celular dele, fora do pós-venda. A apresentação já diz que é a equipe de qualidade, para não confundir com o corretor.
- Medido em 06/11 (só leitura): 1 número WAHA da empresa ativo e nenhum de unidade.

## Implementação da Fase 3 (06/11/2026)

- A página Equipe > Pós-venda mostra relatório por corretor com períodos de 7, 30 ou 90 dias; o padrão é 30 dias. Enviadas usa `sent_at`, respondidas usa `last_reply_at`, atendimento e fechamento usam somente respostas válidas, nota é média das notas de 1 a 5, e alertas abertos contam pesquisas ainda não tratadas. Gestores ficam limitados à unidade efetiva do lead (`coalesce(leads.branch_id, lead_queues.branch_id)`).
- Alertas são criados ao processar cada resposta que gera `no_contact`, `bad_service`, nota até 2 ou pedido de ajuda. As notificações são separadas por destinatário e chave idempotente de pesquisa+motivo; chegam a diretores do tenant e gestores da unidade efetiva. A lista permite abrir o lead e marcar o alerta como tratado, atualizando survey, notificações e auditoria na mesma transação.
- A migration `drizzle/0221_post_sale_alerts.sql` adiciona `post_sale_surveys.alerts_handled_at timestamptz`; não foi executada.
- A ficha do lead e o perfil de corretor mostram os cartões de respostas e avaliação somente a diretor/gestor com a flag `feature_post_sale_audit_enabled` ligada. A lista de leads permite selecionar até 300 leads e abrir a campanha manual já existente com público pré-preenchido; a prévia e a autorização de escopo continuam no servidor.
- A régua automática, regras R0 a R5 e disparo automático seguem fora desta fase.
- Validação focada: Vitest, TypeScript e ESLint registrados em `reports/agent/verification/2026-11-06-pos-venda-fase3.md`; nenhum banco foi acessado para escrita e a migration não foi executada.

## Histórico canônico em /conversas (09/11/2026)

- A página `/conversas` e seu agrupamento de conversas leem `whatsapp_messages`; os envios da pesquisa eram persistidos somente em `whatsapp_outbound_messages`, por isso o status `read` na campanha não criava uma mensagem visível no chat.
- Envios aceitos e recibos da Meta agora espelham a mensagem na tabela canônica com tenant, lead, canal, telefone, corpo e horário. O espelhamento é idempotente, preserva o recibo mais avançado e publica invalidação da conversa; falhas ficam best-effort e não repetem o envio.
- O template Meta de abertura usa o corpo aprovado e variáveis persistidas. Falhas de entrega de pós-venda não entram no recovery da mensagem inicial de qualificação.
- `drizzle/0223_post_sale_conversation_history.sql` preenche envios anteriores aceitos, incluindo status `read`. O SQL não foi executado; após aplicar a migration e publicar o servidor, as mensagens históricas passam a aparecer.
- O backfill considera somente mensagens com `sent_at`, lead do mesmo tenant e corpo conhecido. Não inclui linhas pendentes ou mensagens de template desconhecido.

## Implementação da Fase 4 (09/11/2026, branch `feat/pos-venda-regua`)

- **Tabela e chaves:** `post_sale_rules` (uma linha por empresa e regra R1 a R5: `enabled`, `delay_business_days`, `filters` {queueIds, branchIds, leadTypes}, `daily_limit`, `pilot` {queueIds, brokerIds}, `updated_by`, `updated_at`; único por empresa e regra; RLS ligado). SQL em `drizzle/0224_post_sale_rules.sql`, **não executado**. Sem a tabela, a tela mostra tudo desligado com aviso e o motor não envia (`auto-rules-store.ts` trata a tabela ausente). Tudo desligado por padrão; continua exigindo a flag `feature_post_sale_audit_enabled`.
- **Correção da R0 junto no SQL:** a restrição `post_sale_surveys_outcome_check` (criada na 0217, conferida em produção só leitura em 09/11) não aceita os destinos `r0_*`; a resposta do cliente à R0 falharia ao gravar. A 0224 recria a restrição com a lista antiga mais os cinco destinos da R0. Nenhuma R0 tinha rodado em produção até a conferência.
- **Marcos:** R1 e R2 usam `leads.assigned_at` com o lead em `distribution_status = assigned`, corretor definido, etapa aberta (de Em atendimento até Em análise ou Aguardando retorno) e oferta já aceita (fora `automatic_offer`, `manual_offer` e `manual_unassignment`). R3 e R5 usam `stage_entered_at` com o lead em `converted`; R4 usa `stage_entered_at` com o lead em `lost`. O `lead_stage_history` em produção ainda tem poucas linhas (1 perda em 09/11), então serve só para ler o motivo de perda em texto livre.
- **Atraso em dias úteis** (`auto-rules.ts`): seg a sex no calendário de São Paulo; o lead entra no dia "marco + atraso" e ainda sai até 2 dias úteis depois (motor parado, fim de semana); mais velho que isso não sai, então ligar uma regra não dispara para o histórico. Feriados passaram a contar em 09/11 (ver "Ajustes de 09/11").
- **Proteções:** as mesmas da campanha manual pelo `resolvePostSaleAudience` (telefone inválido, opt-out, número errado, conversa humana nas últimas 24 h, sem corretor, canal de origem e template aprovado), com intervalo de **30 dias** entre conversas para a régua (manual, R0 e régua somadas; a manual segue com 60). Além disso: dono do lead diretor não entra; R4 não pergunta quando o motivo registrado é número errado ou pediu para não contatar (não existem códigos próprios no catálogo de motivos, então a regra lê `motivo_perda`, `loss_category` e o texto do histórico); R2 não sai com R1 respondida nos últimos 4 dias. Interpretação: com os 30 dias, R1 e R2 se excluem na prática (a R2 só pega quem a R1 não alcançou, por exemplo regra desligada, filtro ou conversa humana no D+1).
- **Limites:** por regra (`daily_limit`, padrão e teto 60), por empresa (60 por dia somando as regras) e, em modo piloto (qualquer fila ou corretor marcado no piloto), até 20 por regra. O dia é o dia de envio em São Paulo.
- **Canal:** mesma escolha da campanha manual (número por onde o lead entrou, WAHA da unidade ou da empresa como reserva, Meta padrão, ambíguo fica fora). Meta envia o template `pos_venda_apresentacao` só quando aprovado naquela WABA; WAHA envia o texto de abertura padrão.
- **Roteiros** (`auto-rule-scripts.ts`): a abertura pede licença; depois uma pergunta por vez. R1: falou com o corretor? foi rápido? (sem contato: quer ajuda?). R2: recebeu cotação? como está a decisão, com nota (sem cotação: quer ajuda?). R3: como foi a contratação, com nota; ficou dúvida? R4: o que pesou na decisão? (o motivo do cliente fica em `answers.reason`, ao lado do motivo do corretor no lead). R5: tudo certo com o plano? indicaria? (com problema: quer ajuda?). IA extrai os fatos (`interpreter`, `sensitive`); se falhar, palavras-chave da regra. Destinos usam só os valores aceitos pela restrição (`ok`, `no_contact`, `bad_service`, `closed`, `waiting`, `other`), então os alertas existentes funcionam (sem contato, nota até 2, experiência ruim, pediu ajuda). Nenhuma nota na linha do tempo do lead para R0 e R1 a R5 (o corretor não vê); o rastro fica na auditoria (`post_sale.auto.started`).
- **Motor** (`auto-sweep.ts`): roda dentro do job existente `/api/internal/jobs/customer-waiting` (a cada 5 min), mas só nos minutos 0 a 4 de cada quarto de hora, então a cada 15 min. **Nenhuma tarefa nova no Coolify.** Lease próprio `post-sale-auto` (100 s) e orçamento de 40 s por rodada. Dentro do horário comercial envia; fora dele só agenda para a próxima abertura (seg a sex, 08h) e conta no limite desse dia. Idempotente: campanha automática por empresa, regra e dia (`kind = auto`, `rule_key`), survey com id derivado de empresa + lead + regra + marco (rodar duas vezes ou em dias seguidos não cria outro) e chave do outbox `post-sale:<campanha>:<lead>`, a mesma que o retorno de entrega usa. Recuperação igual à R0: survey `queued` sem mensagem na fila há mais de 2 min é reenviado com a mesma chave e o mesmo texto ou variáveis guardados em `answers.auto`; com mais de 2 dias ou sem canal, vira `failed` e libera o lead.
- **Tela** (Equipe > Pós-venda, cartão "Régua automática"): por regra, chave liga/desliga, atraso em dias úteis, limite por dia, filtros por fila, unidade e tipo (PF/PJ), filas e corretores do piloto, botão "Ver prévia de amanhã" ("Amanhã sairiam N mensagens", com as exclusões por motivo; roda o seletor com a configuração em edição, sem gravar) e Salvar. Só o diretor edita e vê a prévia; o gestor vê as regras sem poder mudar.
- **Relatório:** "Quem respondeu" mostra a origem de cada resposta (Manual, R0, R1 a R5 com o nome) e filtra por origem; o relatório por corretor ganhou o filtro "Origem" (Todas, Manual, R0, R1 a R5); as campanhas recentes mostram a regra. Novo chip "Indicaria" ou "Não indicaria" (R5).
- **Piloto sugerido:** R1 ligada só com uma fila no piloto (20 por dia). Medido em 09/11 (só leitura): cerca de 100 a 170 leads aceitos e abertos por dia útil, a maioria em FILA TATIANA, FILA PF - RENAN e FILA PME - RENAN.
- **Fora desta fase:** texto de abertura WAHA próprio por regra (todas usam a abertura padrão, igual ao template Meta). O alerta de motivo de perda diferente e os feriados entraram em 09/11 (ver "Ajustes de 09/11").
- Validação: Vitest de pós-venda, cliente aguardando, canais, Equipe e jobs; `tsc --noEmit` limpo; ESLint sem erros nos arquivos tocados. Banco de produção só lido (restrições e volumes); nada enviado e nenhum SQL executado.

## Ajustes de 09/11 (branch `feat/pos-venda-ajustes`)

- **Alerta "Motivo de perda diferente do registrado" (R4):** ao concluir a R4, `loss-reason-check.ts` classifica os dois motivos em preço, já tem plano ou fechou com outro, desistiu ou sem interesse, não foi atendido ou sem contato, documentação/carência/rede e outro. Cliente: categoria da IA (`lossCategory`, pedida ao interpretador só na pergunta do motivo) ou, sem IA, palavras-chave sobre `answers.reason`. Corretor: código do catálogo em `leads.motivo_perda` (rótulo de `MOTIVO_PERDA_LABELS`), `loss_category` do sistema e o texto do último `lead_stage_history` para perdido; "encontrou mais barato" vale como preço e como fechou com outro. Diverge quando a categoria do cliente não está entre as do corretor e nenhum lado é "outro". O resultado fica em `answers.lossCheck`; divergente gera o alerta para diretores e gestor da unidade pelo `ensurePostSaleSurveyAlerts` (idempotente por pesquisa, motivo e destinatário). A notificação, a lista de alertas e "Quem respondeu" mostram "Corretor: ... Cliente: ..."; chip "Motivo diferente". Falha ao ler o motivo do corretor não trava a resposta ao cliente (só não compara). Sem SQL.
- **Auditoria sem ruído:** as leituras (painel, resumo do corretor, cartão do lead e mensagens da pesquisa) gravam no máximo uma linha por usuário, entidade e ação a cada hora cheia: id determinístico (`view-audit.ts`) com `onConflictDoNothing`, sem consulta extra. O rastro de quem viu as mensagens (dado pessoal) continua, por pesquisa e por hora.
- **Feriados:** lista fixa em `src/shared/time/holidays.ts` (nacionais de 2026 e 2027 com Sexta-feira Santa, mais 20/01 São Sebastião e 23/04 São Jorge do Rio; Carnaval e Corpus Christi ficam de fora). O horário comercial compartilhado ganhou a opção `skipHolidays`, desligada por padrão, então "cliente aguardando", avisos e demais áreas não mudam. O pós-venda usa `business-calendar.ts`: dias úteis da régua (atraso, tolerância e janela de busca), envio da régua (feriado só agenda para o próximo dia útil), horário, minutos de espera e escalada da R0 (o relógio do "cliente aguardando" é recalculado com feriados a partir do mesmo início) e as horas úteis do lembrete e do "sem resposta". A campanha manual segue com o horário de antes. Ano sem lista (2028 em diante) conta todo dia de semana como útil: acrescentar as datas no arquivo.
- Validação: Vitest de pós-venda, cliente aguardando, Equipe, avisos e horário comercial; `tsc --noEmit` limpo; ESLint sem erros nos arquivos tocados. Nenhum banco acessado e nada enviado.

## Conversa inteligente (09/11, branch `feat/pos-venda-inteligente`)

Pedido da direção: "faça o recomendado para abranger mais situações e se tornar um sistema super inteligente". A pesquisa passa a entender a resposta real do cliente, não só a resposta do roteiro.

- **Uma leitura por mensagem** (`intents.ts`, `postSaleReadingInstructions`): a mesma chamada ao interpretador (`interpreter`, `sensitive: true`) devolve a resposta da pergunta da vez e as intenções da mensagem toda: pediu preço ou cotação (`price_request`), quer falar com alguém agora (`wants_human`), dia ou horário para contato (`scheduling`, com o texto em `scheduleText`), reclamação do atendimento (`complaint`, com o tipo: grosseria, demora, sumiu, informação errada), elogio, já fechou (com quem), fechou por fora, desistiu (por quê), número errado, opt-out, pergunta sobre cobertura, carência, rede ou documentos (`question`) e urgência de saúde. A R0 usa o mesmo conjunto junto com a classificação dela. Sem IA, `detectPostSaleIntents` cobre as mesmas intenções por palavras-chave, priorizando precisão.
- **Política antes do roteiro** (`turn-policy.ts`, `decidePostSaleTurn` e `decideR0Turn`), em qualquer etapa e nesta ordem: opt-out encerra na hora (mesma transação de antes); número errado encerra, entra na lista de bloqueio do pós-venda (`post_sale_opt_outs`, mesma transação) e preenche `ai_conversations.wrong_number_at`, o sinal que a audiência e a reativação já respeitam; urgência de saúde orienta o 192 (SAMU), encerra e alerta a direção; preço, falar com alguém ou horário encerram com "a equipe vai retomar seu atendimento por aqui" (nunca um valor, nunca promete ligação nem corretor específico) e geram o alerta "Quer retomar o atendimento", com o horário pedido e a fala do cliente; fechou por fora ou desistiu registram e encerram com cordialidade (fora R3, R4 e R5, em que o roteiro segue: na R4 o motivo é a própria resposta); reclamação gera o alerta "Reclamação do atendimento" com a fala e a conversa segue; pergunta fora do roteiro sem resposta é acolhida em uma frase e a pergunta pendente volta (guardada em `answers.lastQuestion`).
- **Não repete pergunta já respondida:** manual e régua pulam etapas cujo dado já veio nesta ou em outra mensagem. "Falei com o Alan e já fechei" grava falou com o corretor e fechou, e a próxima pergunta é só a do atendimento. "Fechei com o Alan" só vale como contato quando o nome é o do corretor da pesquisa; "fechei com outra corretora" fica como não fechou, com o motivo, para não contar como venda do corretor.
- **"Pode perguntar" na abertura** continua sem virar fato (caso Dayana), agora por `isBarePermission`: só autorização e cumprimento descartam a leitura; fatos ditos de verdade na abertura valem.
- **Textos:** 2 ou 3 jeitos de dizer cada etapa (`reply-variants.ts`), escolhidos pelo id da pesquisa (a mesma pesquisa sempre usa o mesmo texto, então a retentativa idempotente não muda a mensagem). Sem semente, o texto de sempre. Primeiro nome do cliente e do corretor, frases curtas, sem travessão. O lembrete repete a pergunta guardada, sem a saudação do turno anterior.
- **Alertas:** `wants_resume` ("Quer retomar o atendimento"), `broker_complaint` ("Reclamação do atendimento") e `health_urgency` ("Cliente relatou urgência de saúde") em `POST_SALE_ALERT_REASON_LABELS`; para diretores e gestor da unidade, nunca para o corretor; idempotentes por pesquisa, motivo e destinatário (chave existente). Para não duplicar: "Quer retomar" substitui "Pediu ajuda"; reclamação substitui "experiência ruim"; reclamação de sumiço junto com "não foi atendido" não gera o segundo alerta. Nota 4 ou 5 vence um sentimento negativo solto (caso real "foi 5, o problema é que agora não está dando"). A lista de alertas mostra o detalhe de cada motivo (horário, fala do cliente, divergência de perda).
- **Quem respondeu:** chips "Pediu valores", "Quer falar com alguém", "Contato: amanhã às 10h", "Reclamou do atendimento", "Fechou por fora", "Desistiu", "Dúvida: carência", "Número errado", "Urgência de saúde", "Elogiou"; filtros "Quer retomar", "Reclamação", "Fechou por fora", "Desistiu", "Dúvida", "Número errado" e "Urgência de saúde"; a resposta aberta mostra o horário pedido, a fala da reclamação, a dúvida e com quem fechou. Nota do lead (só pesquisa manual) ganha as mesmas linhas.
- **Dados:** tudo em `answers` (`answers.intents` com a lista e os detalhes, `answers.lastQuestion`). Nenhum valor novo de `outcome` (a restrição continua com ok, no_contact, bad_service, closed, waiting, other e r0_*): retomar usa `waiting` (ou `no_contact` quando não houve contato), e número errado, urgência, fechou por fora e desistiu usam `other`. Sem SQL e sem migration.
- **Avaliação** (`intents.test.ts`, `turn-policy.test.ts`): 24 respostas reais lidas em produção (só leitura, desde 06/11, sem nome e sem telefone) e 16 sintéticas, com o que cada uma deve e não pode disparar, mais as decisões da política com a IA simulada.
- **Precisão corrigida nas palavras-chave** (achados nas respostas reais): "Valor 3.500,00" virava nota 3; "Bom dia" virava elogio; "quero uma cotação" virava "recebeu cotação"; "não" em qualquer pergunta virava "não quer ajuda" e pulava a pergunta de ajuda; "não quero mais o plano" virava opt-out; "Já fiz o plano" não contava como fechou.
- Validação: Vitest de pós-venda e Equipe, `tsc --noEmit` limpo, ESLint sem erros nos arquivos tocados. Produção só lida; nada enviado e nenhum SQL executado.

## Riscos

- Mensagem automática demais irrita o cliente: limite de 1 conversa a cada 30 dias e opt-out imediato.
- Meta: conversa iniciada por template tem custo (Utility); o volume do piloto é baixo.
- Corretor que atende pelo celular pessoal: a pesquisa com o cliente é justamente o que mostra se ele foi atendido; o alerta "não foi atendido" deve ser lido junto com o botão "Já respondi por fora" do cliente aguardando.

### Cooldown da R0 (decisão de 09/11)
A R0 não respeita os 30 dias da régua nem os 60 dias da campanha manual: ela só dispara quando o próprio cliente volta a escrever e fica sem resposta, então é recuperação de atendimento e não contato ativo. Mantém as próprias travas: uma R0 por lead a cada 7 dias e nenhuma com pesquisa ativa. Régua e manual continuam respeitando qualquer pesquisa (inclusive R0) dentro dos seus prazos.

### Número errado fora do pós-venda (decisão de 09/11)
Quando o cliente diz na pesquisa que o número é errado, além de bloquear o pós-venda do lead (post_sale_opt_outs), o sistema marca `ai_conversations.wrong_number_at`. Isso também tira o número da qualificação por IA, da reativação e da requalificação de frios. Decisão: manter, porque é o mesmo número e qualquer mensagem automática chegaria a uma pessoa que não pediu contato. Se o lead tiver outro telefone, o corretor atualiza o cadastro.
