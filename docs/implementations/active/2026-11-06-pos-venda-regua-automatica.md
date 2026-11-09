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

## Riscos

- Mensagem automática demais irrita o cliente: limite de 1 conversa a cada 30 dias e opt-out imediato.
- Meta: conversa iniciada por template tem custo (Utility); o volume do piloto é baixo.
- Corretor que atende pelo celular pessoal: a pesquisa com o cliente é justamente o que mostra se ele foi atendido; o alerta "não foi atendido" deve ser lido junto com o botão "Já respondi por fora" do cliente aguardando.
