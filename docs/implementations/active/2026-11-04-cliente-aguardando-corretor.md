# Cliente aguardando o corretor: IA acolhe, corretor é cobrado, atendimento é redistribuído

Status: aprovado com as recomendações (04/11/2026). F0 concluída; F1 é a próxima.

## Decisões (04/11/2026, Vinicios: "pode seguir com os recomendados")

1. A BR-023 ganha uma exceção: o lead aceito pode sair do corretor quando ele não dá retorno ao cliente nem responde à cobrança dentro do prazo de troca. Fora desse caso, a BR-023 continua valendo.
2. Os prazos são 15 min, 45 min e 2 h, contados em horário comercial e configuráveis por empresa.
3. A IA nunca informa valor.
4. Quando não há outro corretor elegível, o lead fica com o corretor atual e vai para a Central como P0.

## F0. Diagnóstico (04/11/2026, `scripts/inspect-customer-waiting.mjs`, somente leitura)

**Caso Vera** (lead `b3901386`):
- 12:31: a oferta foi enviada a Luiz Marques.
- 12:36:50: o Luiz aceitou pelo botão do WhatsApp (`whatsapp_offer_accepted`). Nesse mesmo instante o sistema gravou `first_contact_at` e `service_started_at` e registrou a auditoria `iniciou_atendimento_ao_aceitar_oferta`.
- Por isso o lead ficou "Em Atendimento" sem nenhuma mensagem do corretor. Para o sistema, aceitar a oferta já conta como "primeiro contato", e o SLA de primeiro contato e o de retorno param de valer.
- Nenhuma mensagem de humano antes da atendente, em 04/11.

**Como as mensagens ficam gravadas** (`whatsapp_messages`, últimos 30 dias):

| Quem mandou | `direction` | `sender_role` | Volume |
| --- | --- | --- | --- |
| Cliente | `incoming` | (qualquer) | 27,5 mil (meta_cloud e waha) |
| IA | `outbound` | `assistant` | 16,3 mil |
| Humano pelo WAHA (o próprio número do corretor) | `outgoing` | `user` | 14,9 mil |
| Humano pelo número oficial | `outgoing` | `user` ou `agent` | 36 |

A resposta humana é qualquer `outgoing`, de qualquer canal. Quase todos os corretores respondem pelo WAHA, e não pelo número oficial, então olhar só a conversa oficial daria um falso "sem resposta".

**Tamanho do problema hoje:** 502 leads ativos com a última mensagem do cliente sem resposta humana há mais de 2h (mensagens dos últimos 30 dias).

- Por status:
  - Em Atendimento: 398, dos quais 289 sem nenhuma mensagem do corretor depois da atribuição
  - Cotação enviada: 53
  - Negociação: 44
  - Em análise: 4
  - Documentação: 2
  - Distribuído: 1
- 37 desses leads ainda estão com a janela de 24h da Meta aberta. A maioria esperava havia mais de 24h.
- **206 leads (63 corretores)** são de corretores que não mandaram nenhuma mensagem pelo CRM em 30 dias. Esses corretores provavelmente atendem por um celular que o CRM não vê, então não dá para saber se o cliente foi respondido.
- **296 leads (49 corretores)** são de corretores que usam o canal do CRM. Esses são sinal confiável, e 124 deles são dos últimos 7 dias.
- 2.287 leads "Em Atendimento" atribuídos nos últimos 30 dias não têm nenhuma mensagem humana registrada. Quase todos (2.268) vieram de aceite pelo WhatsApp.

## Ajustes ao plano que saíram da F0

1. **O relógio não depende do status.** "Em Atendimento" só quer dizer "aceitou a oferta". O ciclo de espera nasce da mensagem do cliente sem resposta, qualquer que seja o status ativo.
2. **Contam como resposta humana todas as mensagens `outgoing`**, do número oficial ou do WAHA do corretor. A IA (`outbound`/`assistant`) nunca encerra o ciclo.
3. **A cobrança traz o botão "Já respondi por fora".**
   - Quem atende pelo celular pessoal confirma pelo botão, e isso encerra o ciclo com registro, contando no desempenho como "respondido fora do CRM".
   - A troca só acontece quando não há mensagem nem confirmação até o prazo. Assim os 63 corretores que não usam o canal do CRM não perdem leads por falta de dado.
4. **Nem toda mensagem do cliente pede resposta.** "Ok", "obrigado", figurinhas e o texto pronto do anúncio não abrem ciclo. A F1 mede quanto isso pesa antes de qualquer envio.
5. **Sem disparo em massa ao ligar.** Só valem ciclos que começarem depois de a flag ser ligada. Os 502 leads de hoje viram uma lista para a gestão tratar à mão, e não 502 mensagens da IA de uma vez.

## O caso que originou o plano (conversa da Vera, 20/10 a 04/11)

- 20/10, 12:28 a 12:30: a IA qualificou (individual, 67 anos, Rio de Janeiro) e disse que um corretor "continua a conversa por aqui em instantes".
- 12:36: o lead foi para o corretor Luiz Marques e ficou "Em Atendimento".
- 12:32 a 14:37: a cliente mandou 6 mensagens, a última foi "Esqueceram de me dar os valores". Ninguém respondeu.
- 04/11, 15:29: a cliente voltou 15 dias depois: "QUAL O VALOR PARA A IDADE DE 67 ANOS SEM NPJ".
- 15:31: a primeira resposta humana foi de uma atendente, perguntando se o corretor tinha entrado em contato.

## Por que o sistema deixou isso acontecer

1. **A IA se cala depois da passagem.** A conversa fecha na passagem para o corretor. A única exceção é o lead que foi distribuído com a qualificação incompleta (`src/features/ai-agent/distributed-resume.ts`).
2. **Nenhuma regra olha "cliente esperando o corretor" depois do primeiro contato.**
   - O SLA de primeiro contato e o de retorno obrigatório (`src/features/leads/feedback-sla.ts`) só valem enquanto o lead está `distributed`, sem `firstContactAt` e sem `serviceStartedAt`.
   - Quando o lead vira "Em Atendimento", essas regras param de valer.
3. **O lead aceito nunca sai do corretor automaticamente (BR-023).** O SLA só alerta.
4. **Os alertas que existem não falam da conversa.** A estagnação (`lead_stalled`, dias na etapa) e os lembretes de retorno (`feedback-reminders.ts`) olham o status do CRM, não a mensagem que o cliente mandou e ninguém respondeu.
5. **A Negociações já calcula "Aguardando resposta"** (`customerWaiting`, limite de 4h), mas isso só aparece na tela. Não dispara nenhuma ação.

Resolvido na F0: o lead ficou "Em Atendimento" pelo aceite da oferta no WhatsApp (ver F0 acima).

## Regra proposta

**Um ciclo de espera** começa na primeira mensagem do cliente que o corretor ainda não respondeu. O ciclo termina quando um humano da empresa (corretor, supervisor ou gestor) manda mensagem na conversa.

Os prazos contam só no horário comercial do tenant (`isWithinBusinessHours`). Os tempos abaixo são o padrão sugerido e ficam configuráveis por empresa.

| Tempo de espera | Para o cliente (IA) | Para o corretor | Para a gestão |
| --- | --- | --- | --- |
| 0 | nada | nada | nada |
| 15 min | **Acolhimento**: a IA responde uma vez por ciclo (texto abaixo) | **1ª cobrança**: push e WhatsApp "Vera espera resposta há 15 min", com o resumo e o botão "Responder agora" | nada |
| 45 min | nada (não repete a mensagem) | **2ª cobrança**, em tom de urgência e com o horário da redistribuição | Supervisor e gestor da unidade recebem o aviso |
| 2 h | **Aviso de troca**: a IA diz quem vai continuar o atendimento | O lead sai do corretor. A troca fica registrada no histórico e entra no desempenho dele | Evento na timeline e aviso ao gestor |
| Sem substituto elegível | A IA diz que o atendimento está com a equipe e dá um prazo | O corretor continua com o lead e segue sendo cobrado | O lead vai para a Central/gestão como P0 |

Fora do horário comercial, a IA responde na hora com o horário em que a equipe volta. As cobranças e o relógio começam na abertura do expediente.

### O que a IA diz (tranquilizar sem prometer o que não sabe)

- **Acolhimento**, com os dados que já tem e sem repetir perguntas:
  > "Vera, recebi sua mensagem. Seu pedido (plano individual, 67 anos, Rio de Janeiro) já está com o corretor Luiz, que vai te passar os valores por aqui. Já avisei que você está aguardando."
- **Troca**:
  > "Vera, para você não ficar esperando, a corretora Ana assumiu seu atendimento e já está com todas as suas informações."
- **Regras:**
  - Não inventa preço nem prazo de retorno.
  - Usa o primeiro nome do corretor (`brokerFirstName`), sem supor gênero.
  - Manda no máximo uma mensagem por etapa do ciclo.
  - Usa o mesmo canal da conversa (Meta ou WAHA, conforme a escolha explícita de canal).
  - No canal oficial, só manda texto livre dentro da janela de 24h. A mensagem do cliente abre essa janela, então o caso normal está coberto.
- **Mensagens repetidas** (por exemplo, o texto pronto do anúncio "Digite sua idade por favor.") não reabrem a qualificação nem geram uma nova resposta.
- **Prioridade:** quando a IA lê irritação ou cobrança na mensagem ("Esqueceram de me dar os valores", texto em caixa alta), o ciclo ganha prioridade alta. A cobrança do corretor cita a frase do cliente.

### Para o novo corretor

- A oferta chega com o resumo da IA: o que o cliente pediu, há quanto tempo espera e o que já foi dito a ele.
- A primeira tela da conversa mostra um aviso: "Cliente esperou 2h sem retorno; seja direto com os valores."

## Implementação por componente (depois da aprovação)

1. **Domínio (`src/features/customer-waiting/`)**
   - Função pura `assessWaitingCycle(mensagens, corretor, agora, política)`. Devolve: início do ciclo, minutos úteis de espera, a próxima etapa e quando ela vence.
   - Reaproveita a leitura de "quem deve a resposta" da Negociações (`negotiation-model`) para as duas telas concordarem.
   - Testes cobrem: corretor respondeu, mensagem fora do expediente, cliente mandou várias mensagens seguidas e mensagem repetida do anúncio.
2. **Sweep (`runCustomerWaitingSweep`)**
   - Roda a cada 5 min, numa rota de cron nova e protegida por `CRON_SECRET`, com reserva `job-lease` e heartbeat.
   - Cada etapa é idempotente por ciclo. Uma linha de auditoria (`lead.customer_waiting:<etapa>`) por ciclo evita o problema do lead Lucia, que recebeu 350 avisos.
3. **IA (`ai-agent`)**
   - Nova saída `customerWaitingReply`, com um prompt curto e as guardas acima.
   - Usa `fallback-response` quando o modelo falha: um texto fixo com o nome do corretor.
4. **Cobrança (`notifications` e `communication-channels`)**
   - Template Meta para o corretor, com o texto aprovado pela Meta, e push.
   - O aviso ao supervisor e ao gestor usa o canal de avisos que já existe.
5. **Redistribuição (`lead-distribution`)**
   - Nova saída `reassignForCustomerWaiting`, que segue a BR-028: escolhe outro corretor elegível, exclui o atual e faz a troca numa transição só.
   - Registra o evento `reassigned` com `reason: customer_waiting` e a métrica de desempenho.
   - Só vale para leads ativos, nunca vendidos ou perdidos, e respeita a isenção de Pós Venda.
6. **Telas**
   - Na Negociações, "Aguardando resposta" passa a mostrar em que etapa está cada ciclo ("Cobrado 2x · troca às 17:10").
   - O drawer ganha a linha "Espera do cliente". A timeline do lead mostra as cobranças e a troca.
   - O corretor vê um banner no lead.
   - Os prazos ficam na configuração de distribuição, junto do SLA.
7. **Liga e desliga**
   - Flag por empresa `feature_customer_waiting_guard`, desligada por padrão.
   - Os tempos ficam na tabela de tenants. Se a mudança precisar de migration, ela usa o maior número de qualquer branch de origin mais um.
8. **Operação**
   - Entra uma linha nova no `docs/runbooks/coolify-scheduled-tasks.md`.
   - A BR-023 ganha uma exceção, com sua DEC, no `business-rules.md` e no `decision-log.md`.

## Fases

- **F0. Diagnóstico.** Ver o que marcou o caso da Vera como "Em Atendimento" sem mensagem e listar quantos leads ativos estão hoje com o cliente esperando há mais de 2h.
- **F1. Domínio e sweep em modo observação.** Só registra o que faria, sem mandar nada. Mostra os números na Negociações.
- **F2. IA acolhe e o corretor é cobrado.**
- **F3. Redistribuição** por falta de retorno.
- **F4. Ajustes de texto e de prazos** com uma semana de dados.

## Decisões tomadas (ver o topo)

1. **Exceção à BR-023:** lead aceito pode sair do corretor quando o cliente espera mais que o prazo de troca sem nenhuma mensagem dele? Recomendado: sim, só nesse caso.
2. **Prazos:** 15 min (IA e 1ª cobrança), 45 min (2ª cobrança e gestão) e 2 h (troca), em horas úteis?
3. **Preço pela IA:** a IA nunca informa valor (recomendado) ou informa quando houver tabela validada no catálogo de operadoras?
4. **Corretor sem substituto:** fica com o lead e vai para a Central como P0 (recomendado) ou vai direto para o gestor da unidade?
