# Situações da conversa: não transferir cliente sem interesse

Pedido do Vinicios (18/10), caso Vanessa Soares: respondeu "Já consegui" e "Não quero não", a IA disse
"o atendimento automático será interrompido" e mesmo assim o lead foi para o corretor (Alan Chile), como Frio.

## Como funciona hoje

- **Regra rápida** `parseOptOut` (`src/features/ai-agent/quick-reply.ts:128`): "não quero", "sem interesse",
  "já tenho", "já contratei", "não solicitei"... vira intenção `OPT_OUT`.
- **O problema:** em `OPT_OUT`, `NO_LONGER_INTERESTED` e `WRONG_NUMBER` o lead vira `cold` + `QUALIFIED` e
  **entra na distribuição** (`conversation-state-machine.ts:1429-1444`, `shouldQueueLeadAfterTerminalReply`).
  A trava de distribuição (`lead-distribution/domain.ts:137-151`) só segura frio `PARTIAL`, então passa.
- **Não pega:** "Já consegui", "só pesquisando", "fechei com outro", "era só curiosidade". A IA não tem um campo
  "sem interesse" na resposta (`ai-response-schema.ts:16-26`); "só pesquis" só aparece numa regex sobre o texto livre.
- **Conversa encerrada/pausada** durante a qualificação: vira frio `COLD` e `unassigned`, também sem trava.
- **Já existe e dá para reaproveitar:** catálogo de situações (`ai-qualification/situations-catalog.ts`, hoje só molda
  a resposta), requalificação de frios (P2, `cold-lead-requalification.ts`), análise da conversa
  (`conversation-intelligence`, roda só depois da distribuição).

## Situações e o que fazer com cada uma

| Situação | Exemplos | Destino |
|---|---|---|
| Sem interesse | "não quero", "sem interesse", "não pedi" | Não distribui. Encerra com mensagem educada. Fica em "Sem interesse" (gestão vê) |
| Já resolveu | "já consegui", "já fechei", "já tenho plano", "contratei com outro" | Não distribui. Entra na requalificação longa (P2) em 60 a 90 dias: renovação e reajuste |
| Só pesquisando / depois | "só pesquisando", "mês que vem", "agora não" | Não distribui agora. Requalificação na data que o cliente disse (ou 15 dias) |
| Número errado | "número errado", "não sou eu" | Não distribui. Encerra e marca o telefone como inválido |
| Já é cliente | "já sou cliente da Âncora", "minha carteirinha" | Vai para Pós-venda, não para venda |
| Outro produto | odonto, seguro de vida, auto | Fila do produto, se existir; senão, gestão decide |
| Empresa / CNPJ | (já existe: PME 16/10) | Fila PME |
| Pede humano | "quero falar com corretor" | Distribui (como hoje) |
| Interesse real, dados faltando | respondeu parte e parou | Como hoje: morno distribui, frio fica na requalificação (eb7a2a78) |

Regra de ouro: **na dúvida entre "sem interesse" e "não entendi", a IA pergunta uma vez** ("Só para confirmar: você
não quer mais receber opções de plano?") antes de encerrar. Mensagem ambígua nunca encerra sozinha.

## Plano (em ordem)

1. **Parar a distribuição de quem disse não (P, 1 dia).** `OPT_OUT`, `NO_LONGER_INTERESTED` e `WRONG_NUMBER`
   viram `disqualified` + `manual_hold`, sem entrar na fila. A trava de `domain.ts` passa a segurar também
   conversa `CLOSED` sem dado válido. Teste: o caso Vanessa não distribui.
2. **Ampliar a regra rápida (P).** Novas intenções: `ALREADY_SOLVED` ("já consegui", "já fechei", "contratei com
   outro"), `JUST_RESEARCHING` ("só pesquisando", "mês que vem"), `ALREADY_CLIENT`. Com testes de frases reais
   tiradas das conversas (pedir ao Vinicios 20 exemplos ou puxar do banco).
3. **A IA também classifica (M).** Campo `situation` no schema da resposta da IA (mesma lista acima + `UNCLEAR`),
   com confiança. Regra rápida decide os casos óbvios; a IA decide o resto; confiança baixa = pergunta de confirmação.
4. **Destinos (M).** Cada situação com seu destino: lista "Sem interesse" na tela do diretor (com "Devolver para a
   distribuição", um toque), requalificação agendada (liga na P2), Pós-venda, fila do produto.
5. **Painel e calibragem (P).** Contagem por situação por dia e por fila, e "corrigir" quando a IA errar
   (o diretor marca "tinha interesse" e o lead volta). Os erros viram exemplos para a regra.

Fora do escopo: mudar a IA depois que o lead está com o corretor (a análise da conversa continua igual).

## Decisões (Vinicios, 18/10)

- **"Não quero":** por enquanto recebe a mensagem de encerramento (a que já existe). Depois vem um processo de
  **quebra de objeções para tentar recuperar** esses leads (plano próprio, a fazer).
- **"Já consegui":** mesmo tratamento do "não quero" (encerra e fica retido); a recuperação entra no mesmo processo
  de quebra de objeções, não numa requalificação com prazo fixo.
- **Lista "Sem interesse":** só o diretor vê.

## Feito

- **Passo 1 (18/10, worktree ancorahub-lite-listas):** `terminalReplyLeadDisposition` (quick-reply.ts) deixa
  "não quero", "sem interesse", "número errado" como `disqualified` + `manual_hold`, sem distribuir; lead que já
  tem corretor não é mexido. `parseOptOut` passou a pegar "já consegui", "já fechei", "já resolvi" (só como a
  resposta inteira) e "fechei/contratei com outro". - **Passo 1b (18/10):** em `transitionConversationState` (CLOSED/PAUSED), lead ainda em qualificação e sem
  corretor vira `cold` + `PARTIAL` + `manual_hold` (vai para o Requalificar, não para corretor). Corrigido junto:
  o encerramento punha TODO lead em `distributed/unassigned` (desfazia a retenção do prazo estourado e voltava
  lead em atendimento para "distribuído") e preenchia `qualificationCompletedAt`, o que tirava o frio retido
  do painel Requalificar. Falta: passos 2 a 5.
