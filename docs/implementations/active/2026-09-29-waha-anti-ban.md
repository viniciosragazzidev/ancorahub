# Proteções anti-banimento do número da empresa (WAHA)

## Escopo

Antes de conectar o número que a equipe já usa com os corretores, três
proteções a mais para os avisos da equipe enviados pelo WhatsApp da empresa
(DEC-125). Espaçamento, limites, horário e disjuntor já existiam em
`src/features/team-notices/guard.ts`.

Decisão do usuário: os avisos críticos (novo lead, lead atribuído) continuam
sem teto por hora; o ritmo da distribuição (cerca de 1 lead a cada 40 min por
corretor) já os limita. A ativação começa só com "Lead atribuído".

## Implementação

1. **"Digitando…" antes de enviar.** O relay (`services/whatsapp-api`) aceita
   `humanize` em `POST /internal/waha/messages/text` e mostra "digitando" por
   2–6s conforme o texto (+ até 1s de variação) antes do `sendText`. Só os
   envios do número da empresa pedem; os envios manuais do corretor não. Sem
   "visto" automático: marcaria como lidas as conversas no celular da equipe.
2. **Aquecimento pela data de pareamento.** `waha_numbers.connected_at`
   (migração 0169) passa a ser gravado quando um celular pareia; recomeça
   quando outro celular pareia no mesmo registro. O guard usa essa data (antes
   usava a criação do registro, que é reaproveitado ao gerar novo QR).
3. **Rotação de textos.** `src/features/team-notices/variants.ts` tem 4 versões
   de cada aviso (a versão 1 é o texto original, idêntico ao anterior). Cada
   aviso também aceita até 5 mensagens da biblioteca
   (`team_notice_settings.free_message_ids`, migração 0170); com elas, só elas
   rodam. A escolha é estável por chave de idempotência e nunca repete a
   versão que a mesma pessoa recebeu por último
   (`whatsapp_outbound_messages.text_variant`). Na tela, "Textos" abre um
   painel lateral com busca + "+" e a prévia das versões padrão.

## Implantação

- Rodar as migrações 0169 e 0170 antes de publicar o CRM.
- Publicar o relay (`services/whatsapp-api`); a ordem não importa (o relay
  antigo ignora `humanize`).

## Validação

- Relay: `tsc` e 51 testes (inclui "digitando" e o cálculo do tempo).
- CRM: `tsc` sem erros nos arquivos alterados; testes de team-notices,
  waha-cadence, outbound e biblioteca de mensagens; paridade do texto antigo
  com a versão 1 conferida em 156 combinações.
- Pendente: revisão visual da tela (precisa das migrações no banco usado pelo
  servidor local).
