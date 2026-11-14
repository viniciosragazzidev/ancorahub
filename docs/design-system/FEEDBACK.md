# Feedback e movimento · padrão geral do app

Status: **ATIVO, padrão geral** desde 14/11/2026. A adoção começa pelo modo Lite (corretor, supervisor, gestor e Diretor com a chave Lite) e depois chega ao modo normal.
Dono: Vinicios. Base: pesquisa sobre o Duolingo e protótipo do aceite de lead (relatório em `reports/design/feedback-duolingo-2026-11-14/`). Plano de adoção por rota: `docs/implementations/active/2026-11-14-feedback-padrao.md`.

Este documento diz **como o app responde ao que o usuário faz e ao que acontece com ele**: imagem, texto, som, vibração e mascote. Ele complementa os tokens de `src/components/arc/motion-tokens.ts`, o §3 do Lite (`lite/LITE_CHAT_DESIGN_SYSTEM.md`), `MOTION.md` e `docs/ux/motion-frequencia.md`. Em conflito, vale este documento. A única exceção é o visual base de cada modo (cor, raio, tipografia), que continua nos documentos de cada modo.

---

## 1. Princípios

1. **Resposta em camadas.** Toda resposta tem até cinco camadas: visual, texto, som, vibração e mascote. Visual e texto sempre existem. Som, vibração e mascote só entram quando o nível do evento pede (§3).
2. **Ritmo fixo.** As camadas chegam sempre na mesma ordem e no mesmo intervalo (`beat`, §5). O usuário aprende o ritmo e passa a ler o resultado sem olhar.
3. **Sucesso só depois de confirmado.** Ao tocar, a resposta é imediata (pressão e "Enviando…"). O "pronto" só aparece depois que o servidor confirma. Ação otimista mostra "Atualizando…" e desfaz se falhar.
4. **Proporcional à frequência.** Quanto mais vezes por dia algo acontece, menos ele anima e soa (regra de `motion-frequencia.md`). Ação de centenas de vezes por dia não tem som nem celebração.
5. **Celebração rara e verificada.** Só comemora fato confirmado e pouco frequente: venda persistida, meta batida, nível, marco de plantão. Nunca por volume (mensagens, cliques, leads aceitos).
6. **O mascote reage.** O mascote do assistente muda de estado conforme o que aconteceu (atento, pensando, comemorando, repouso), uma passada por evento. Ele não fica em loop chamando atenção.
7. **A espera parece intencional.** Enquanto o servidor ou a IA trabalha, há estado de espera com texto ("Aceitando…", "Pensando…") e mascote pensando. Nunca um spinner sem explicação.
8. **Erro diz o que fazer.** O erro mostra a causa, o que continua valendo e a ação ("Tentar de novo"). Fica no objeto que falhou e não tira o foco do usuário.
9. **O usuário controla.** Som, vibração, animações e celebrações têm interruptores próprios (§7). Nada depende só de cor, som ou animação.
10. **Nunca culpa.** Sem mascote triste, sem "você vai perder", sem pânico de prazo, sem punição por erro. O SLA aparece como informação ("responda em 4:56"), não como ameaça.

---

## 2. Camadas e ordem

| Camada | O que é | Quando aparece | Desliga com |
|---|---|---|---|
| Visual | pressão, check, X, shake, anel, número que rola, barra que enche | sempre | "Animações" desligado ou `prefers-reduced-motion`: vira troca direta ou fade de até 120ms |
| Texto | resultado nomeando o objeto, causa do erro, estado ("Aceitando…") | sempre | nunca desliga |
| Som | receitas sintetizadas em `src/lib/sounds` | nível 2 e 3, lead novo, erro de ação; confirmação discreta só no nível 1 de ação rara | "Som" |
| Vibração | `navigator.vibrate` (Android; o iPhone ignora) | toque em ação de nível 1 ou mais, eventos e erros | "Vibração" |
| Mascote | estado do mascote do assistente da área | eventos, espera, nível 2 e 3 | "Animações" (o mascote fica parado no estado final) |

Movimento reduzido não silencia: som e vibração seguem só os próprios interruptores.

---

## 3. Níveis de resposta

| Nível | Nome | Exemplos | Visual | Som | Vibração | Limite |
|---|---|---|---|---|---|---|
| 0 | Silencioso | filtrar, abrir ficha, trocar aba, salvar nota, mudar etapa | pressão (`scale.press*`, 100 a 160ms) e o novo estado no próprio objeto | não | não | até 160ms |
| 1 | Confirmação | aceitar lead, agendar retorno, enviar cotação, marcar presença, salvar configuração | botão com estados (§4), check desenhado e texto no ritmo | só `confirm`, em ação ocasional | `tap` no toque, `confirm` na confirmação | até 320ms |
| 2 | Marco no contexto | meta do dia batida, missão concluída, primeira venda do mês | anel único (`LiteAttention`), número que rola, mascote comemora uma vez | `milestone` | `success` | até 600ms; no máximo 1 por dia por tipo |
| 3 | Celebração | venda registrada, subir de nível, marco de plantão (5, 10, 25, 50) | overlay sem bloquear (`CelebrationLayer`), mascote, confete curto só no Lite | `milestone` | `success` | até 1,4s; espera a oferta de lead sair; no máximo 3 por dia |

Eventos que chegam sem ação do usuário:

| Evento | Resposta |
|---|---|
| Lead novo | DynamicNotice, som `notify` e vibração `notify` uma vez por lead, mascote do Leads atento |
| SLA perto de estourar | contador visível no item; nenhum som extra além do aviso já existente |
| Mensagem recebida | entra na conversa com a animação de mensagem (180ms); som só se a conversa não está aberta e o usuário ativou |
| Celebração da jornada | nível 2 ou 3, conforme o tipo (`JourneyCelebrationPayload.kind`) |

Modo normal (diretor e gestor fora do Lite): usa os níveis 0 a 2. O nível 3 vira nível 2, sem confete, e o bounce segue proibido (`MOTION.md`).

---

## 4. Botão de ação (padrão)

O botão primário passa por estados com **largura e altura fixas**, para nada pular:

| Estado | Lite (pílula de ação) | Modo normal (CTA Deep Sapphire) | Tempo |
|---|---|---|---|
| Repouso | `--chat-action`, altura 50px (46 no link-botão), **base sólida `0 3px 0 var(--chat-action-base)`** | `#1e40af`, raio 8px, sem base | |
| Pressionado | desce 2px, `scale(.98)`, base vai a 1px | `scale(.97)` | 100ms `ease-standard` |
| Enviando | spinner no lugar do ícone, texto "Verbo…" ("Aceitando…"), `aria-busy="true"` | igual | troca de rótulo 160ms `ease-enter` |
| Confirmado | fundo `--success`, check desenhado, rótulo com o resultado ("Lead é seu") | igual, sem trocar o fundo | check 320ms, mola `snappy`; rótulo +80ms |
| Falhou | fundo `--danger`, X desenhado, "Não deu certo", shake; a causa entra logo abaixo +80ms; após 1,4s volta ao repouso como "Tentar de novo", com foco nele | igual | shake 2 ciclos, 4px, 250ms |
| Desabilitado | `--chat-action-soft`, sem base | tokens do modo normal | |

`--chat-action-base` = `oklch(46% .19 260)` (claro) e `oklch(58% .17 258)` (escuro). A base só existe no botão primário do Lite, um por tela. Botões secundários, opções do chat e ícones não têm base.

O componente será um só para o Lite (`LiteActionButton` em `src/components/lite/controls`), que recebe a ação e o nível e chama `useFeedback`. Nenhuma página recria esses estados por conta própria.

---

## 5. Tokens

Os valores atuais de `motion-tokens.ts` continuam iguais. Entram apenas acréscimos.

```ts
// src/components/arc/motion-tokens.ts (acréscimos)
duration: { /* existentes */ celebrate: 1.4 },
spring: { /* existentes */ celebrate: { type: "spring", visualDuration: 0.5, bounce: 0.24 } }, // só nível 3 e mascote
beat: { visual: 0, text: 0.08, number: 0.16, after: 0.32 },   // ritmo das camadas, em segundos
shake: { distance: 4, cycles: 2, duration: 0.25 },
celebration: { maxPerDay: { 2: 1, 3: 3 }, holdDuringLeadOffer: true, revertAfter: 1.4 },

// src/lib/feedback/tokens.ts (novo)
sound:  { notify: 0.8, confirm: 0.35, milestone: 0.6, error: 0.5, warning: 0.5 }, // volume por receita
haptic: { tap: [10], confirm: [15], notify: [20, 60, 20], success: [12, 40, 24], error: [30, 50, 30] }, // ms
preference: ["sound", "haptic", "motion", "celebration"],
```

Pares CSS em `src/components/lite/motion/motion-tokens.css`: `--motion-duration-celebrate`, `--motion-beat-text`, `--motion-beat-number`, `--chat-action-base`.
Receita nova em `src/lib/sounds/recipes.ts`: `milestoneSound` (três notas subindo, cerca de 0,5s). As receitas `tapSound`, `errorSound` e `warningSound` já existem e passam a ser usadas.

---

## 6. API

- Implementado em 14/11/2026 (fase 0): `src/lib/feedback/` (`tokens.ts`, `core.ts`, `use-feedback.ts`, `action-error.ts`), `LiteActionButton` em `src/components/lite/controls/action-button.tsx`, `mood` no `AssistantAvatar` e `milestoneSound`.
- `useFeedback()` devolve `fire(tipo, opções)`, com tipo `tap`, `confirm`, `milestone`, `celebrate`, `notify`, `error` ou `warning`. Fora do React, use `fireFeedback`. O limite diário de celebrações fica no aparelho (`ancora:feedback-budget`). Ele toca som e vibração conforme o nível, respeita as preferências, o `prefers-reduced-motion` e o kill-switch, e devolve as flags para o componente visual (`motion`, `celebrate`). Nenhum código chama `playSound` ou `navigator.vibrate` direto, exceto o próprio hook.
- `LiteActionButton` (§4) cobre o caso comum de ação com servidor.
- `CelebrationLayer` e `useSuccessOverlay` passam a receber o nível e a respeitar `celebration.maxPerDay`.
- Mascote: `AssistantAvatar` ganha a prop `mood` (`idle`, `alert`, `thinking`, `cheer`), com uma passada por troca. Com animações desligadas, mostra a pose final parada. Rive fica para depois de uma prova com um mascote só, medindo o peso no celular.

---

## 7. Preferências e hierarquia

1. Super Admin (kill-switch `html[data-interface-motion="off"]`) desliga o movimento para todos.
2. A empresa pode desligar celebrações (a chave da jornada já existe).
3. O usuário, em Configurações > Acessibilidade, tem "Menos animação" (o inverso de Animações) e a seção "Som e vibração" com Sons, Vibração e Comemorações, todos ligados por padrão. As preferências ficam neste aparelho (`ancora:a11y`, `src/features/assist/a11y-prefs.tsx`), como as outras de acessibilidade. No computador a vibração não tem efeito. Levar ao servidor por usuário fica para depois, se o uso pedir.
4. `prefers-reduced-motion` do sistema equivale a "Animações" desligado.

---

## 8. Texto

- Sucesso nomeia o objeto e o resultado: "Lead é seu", "Cotação enviada para Maria", "Retorno marcado para amanhã, 10:00".
- Espera usa verbo no gerúndio com reticências: "Aceitando…", "Enviando…".
- Erro tem causa, o que continua valendo e ação: "O aceite não foi registrado. O lead continua esperando você." + "Tentar de novo". Nunca "Erro desconhecido".
- Celebração é curta e de colega: "Meta do dia batida.", "Quinta venda do mês." Sem exclamação dupla, sem "Parabéns!!!".
- Variações: um mesmo evento pode ter 3 a 5 textos, sem repetir o último mostrado.
- Português do Brasil, sem travessão.

---

## 9. Nunca

- Celebrar ação frequente ou volume.
- Som ou vibração em nível 0.
- Confete fora do nível 3 do Lite, e qualquer confete no modo normal.
- Mascote triste, culpa, contagem regressiva vermelha piscando, punição por erro.
- Declarar sucesso antes da confirmação do servidor.
- Toast duplicando o que já aparece no objeto.
- Loop infinito decorativo em tela de uso diário.
- Celebração por cima de uma oferta de lead ou de um formulário em uso.
- Chamar `playSound` ou `navigator.vibrate` fora de `useFeedback`.

---

## 10. Checklist de PR

- [ ] Cada ação nova tem nível definido (§3) e está na tabela do plano de adoção.
- [ ] O botão de ação usa `LiteActionButton` (Lite) ou os estados do §4 (modo normal).
- [ ] O sucesso só aparece depois da confirmação; o erro tem causa, o que vale e "Tentar de novo".
- [ ] Testado com Som, Vibração, Animações e Celebrações desligados, e com `prefers-reduced-motion`.
- [ ] Nada de bounce, confete ou som em nível 0 ou 1 de ação frequente.
- [ ] Textos sem travessão, nomeando o objeto.
