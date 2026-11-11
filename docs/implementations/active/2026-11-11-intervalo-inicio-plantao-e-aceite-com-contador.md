# Intervalo de 8 min no início do plantão e aceite com contador para o WhatsApp

Status: plano para revisão (11/11/2026). Nada foi implementado.

Pedido do Vinicios em 11/11/2026: "todo início de plantão se tiver corretores pendentes ainda para aceitar o plantão, o corretor que está aceito (1 a 3) deve entrar um timeout entre ofertas de 8 minutos automaticamente só nesses casos para evitar que muitas indicações vá para um só corretor sem que os outros tenham tempo de aceitar; Ao clicar em aceitar lead e abrir no whatsapp deve mostrar as informações do lead, iniciar um botão com um contador de 30 segundos em um botão flutuante centralizado no bottom da tela, contador esse que mostra o tempo para que o whatsapp abra automaticamente, e ao clicar no botão abre imediatamente".

São duas mudanças independentes: cada uma pode ir num lote (branch) próprio.

---

# Mudança 1 — Intervalo de 8 min entre ofertas no começo do plantão

## Resumo

No começo de um plantão, enquanto ainda houver escalados que não confirmaram presença, quem já confirmou (se forem de 1 a 3 corretores) recebe no máximo **um lead a cada 8 minutos**. Assim os primeiros a chegar não levam quase toda a fila acumulada antes de os colegas confirmarem.

O intervalo termina sozinho no que vier primeiro:

- todos os escalados confirmaram (ou foram marcados ausentes);
- 4 ou mais corretores já confirmaram;
- acabou a janela de confirmação (1 h depois do início, BR-086).

Lead quente (alta aptidão) não espera. O lead que não pode sair fica na fila e vai para o próximo corretor livre do rodízio. Se todos estiverem no intervalo, ele espera o primeiro liberar ou um colega novo confirmar.

**Isso abre uma exceção à DEC-151** (26/10/2026: "o lead qualificado deve estar com um corretor em no máximo um minuto", e o intervalo entre ofertas deixou de existir). A exceção é estreita: só na primeira hora do plantão, só com 1 a 3 confirmados e alguém pendente. Precisa de uma DEC nova (ver pergunta 1).

## Mapa do que existe hoje

| Peça | Onde | Como funciona |
| --- | --- | --- |
| Rodízio por chegada | `duty-rotation.ts`, `duty-turn-core.ts`, `duty-queue-order.ts` (`chooseManualQueuePick`) | Fila do plantão na ordem em que cada um confirmou presença (`rotationArrivalOrder`). Quem confirma depois entra no fim e não é reposto. Toda oferta gasta a vez. Quem está bloqueado (pausado, com oferta pendente) **mantém o lugar** (`rotateManualQueueKeepingBlockedSlots`). A escolha é serializada por trava de banco em `createLeadOffersForBrokers` (`offers.ts:317`). Flag `feature_duty_rotation_enabled` (padrão ligada). |
| Pulos e pausa | `duty-rotation.ts` (`DUTY_SKIP_PAUSE_LIMIT = 3`), `duty-skips.ts` | Oferta expirada ou recusada é pulo. No 3º pulo do dia o corretor é pausado e o supervisor avisado. |
| Ritmo de ofertas | `offer-pacing.ts` | Duas regras na mesma função `evaluateBrokerOfferPacing`: **intervalo** (desde a última oferta ou atribuição) e **ofertas pendentes** (no máximo M por corretor por fila; padrão 1). O intervalo foi aposentado pela DEC-151: `normalizeOfferPacing` força `intervalMinutes: 0`, mas o código que calcula o intervalo continua lá e tem teste. |
| Onde o ritmo é aplicado | `service.ts:1473-1517` (`processQueuedLead`), `offers.ts:418-425` (recheck sob trava por corretor), `control-service.ts:731` (simulador), `duty-schedule-profile-queries.ts:155/474` e `duty-roster-live-status.ts` (status ao vivo) | Corretor barrado pelo ritmo sai da lista de candidatos; se só sobram barrados, o lead volta com `status: "queued"` e `retryAt` = primeira liberação (`earliestPacingRetryAt`), motivo "Aguardando intervalo entre ofertas…". |
| Teto de leads no plantão | `duty-lead-cap.ts`, aplicado em `getRosterBrokerIds` (`service.ts:175-189`) | `maxLeadsPerBroker` do plantão: quem bateu o teto sai dos elegíveis na ocorrência. |
| Presença | `duty-presence.ts` (`getPresenceEligibleAssignments`), `duty-presence-domain.ts` | Por ocorrência ativa: elegível só quem confirmou (online, com a flag de presença) ou teve a foto aprovada (presencial). Devolve `eligibleAssignmentIds`, `confirmedPresenceAssignmentIds` e `arrivedAtByAssignment`. **Não devolve quem está pendente.** |
| Janela de confirmação (BR-086) | `duty-presence-domain.ts:8-29` | Abre 30 min antes do início (`SELF_CONFIRM_OPENS_MINUTES`) e vai até 1 h depois (`SELF_CONFIRM_TOLERANCE_MINUTES`), contada do início ou da entrada do corretor no plantão, se entrou depois (`selfConfirmToleranceStartsAt`). Depois disso, só a gestão libera. |
| Confirmação acorda a fila | `duty-presence.ts:346`, `duty-actions.ts:872/922/965` → `jobs.ts:160` (`wakeLeadsAwaitingEligibleBroker`) | Confirmar, liberar, despausar ou mudar para online acorda os leads esperando corretor. |
| Segurar frios | `service.ts:846/895` (`shouldHoldColdLead`), política `holdColdLeads` por fila | Frio fica parado na fila (não chega à escolha de corretor). Não interage com o ritmo. |
| Lead quente na hora | `qualification-hold.ts` (DEC-153, `feature_hot_lead_early_distribution_enabled`) e a via rápida `/api/internal/jobs/distribution-priority` (a cada 1 min) | "Quente" = alta aptidão (`qualificationStatus = "hot"`). Sai assim que a IA marca, sem esperar o fim da qualificação. Usa o mesmo `processQueuedLead`. |
| Status ao vivo para o diretor | `duty-roster-live-status.ts` → `broker-occurrence-card.tsx:227` (`BrokerLiveStatus`) | Status por corretor: `paused`, `blocked`, `capacity_full`, `offer_pending`, **`cooldown`** ("Intervalo entre ofertas", com contagem regressiva por `nextEventAt`), `ready`. O `cooldown` existe mas hoje nunca aparece, porque o intervalo é 0. |
| Presença no Lite | `src/components/chat/presence-callout.tsx` | Cartão de confirmação no chat do corretor; estado `done` depois de confirmar. |

## Proposta

### Regra (pura, testável)

Arquivo novo `src/features/lead-distribution/duty-start-interval.ts`, sem banco:

```ts
export const DUTY_START_INTERVAL_MINUTES = 8;
export const DUTY_START_INTERVAL_MAX_CONFIRMED = 3;

resolveDutyStartInterval({
  occurrenceStartsAt, now,
  confirmedCount,   // escalados da ocorrência que já podem receber
  pendingCount,     // escalados que ainda podem confirmar (ver abaixo)
}): { active: true; endsAt: Date; reason: "awaiting_presence" } | { active: false }
```

- Ativo quando: `now < occurrenceStartsAt + 60 min` **e** `pendingCount > 0` **e** `1 <= confirmedCount <= 3`.
- `endsAt` = fim da janela de 1 h (a regra é reavaliada a cada escolha; termina antes se alguém confirmar e zerar os pendentes ou se o 4º confirmar).
- **Pendente** = escalado da ocorrência, não pausado, não marcado ausente, sem confirmação e ainda dentro da própria janela de confirmação (`getSelfDutyConfirmationWindowState` = `available`, respeitando `joinedAt`). Presencial com foto enviada aguardando aprovação conta como **pendente** (ainda não recebe; o intervalo continua protegendo a vez dele).

### Onde entra

1. `getPresenceEligibleAssignments` passa a devolver também `pendingAssignmentIds` (já tem as ocorrências e as confirmações na mão; não precisa de consulta nova). Precisa do `createdAt` do escalado para o `joinedAt`.
2. `getRosterBrokerIds` (`service.ts`) monta `startIntervalBySchedule: Map<scheduleId, { endsAt }>` com a regra acima e devolve na `RosterResolution`.
3. Em `processQueuedLead`, no bloco do ritmo (`service.ts:1473`): para corretores cujo plantão da escolha está com intervalo ativo e **lead não quente**, avalia com `intervalMinutes: 8` em vez de 0. `normalizeOfferPacing` continua forçando 0 (DEC-151 vale fora dessa exceção); o intervalo de início vem por fora, por corretor.
4. Âncora do intervalo: última oferta (qualquer status menos CANCELLED, como hoje) ou atribuição **do mesmo plantão** (`leadOffers.dutyScheduleId` / `leads.dutyScheduleId`), não só da mesma fila. Motivo: um plantão alimentado por várias filas (ex.: "FILA TATIANA" e "FILA PF - RENAN") não pode dar 2 leads em 8 min só porque vieram de filas diferentes.
5. Recheck sob a trava por corretor em `createLeadOffersForBrokers` (`offers.ts:418`): recebe `startIntervalBrokerIds` e repete a checagem, para dois processos não passarem dois leads juntos.
6. Motivo novo do lead parado: "Aguardando intervalo de início de plantão: os corretores confirmados receberam um lead há menos de 8 min e há colegas por confirmar." com `retryAt` = primeira liberação. A regra nova `rule: "duty_start"` em `OfferPacingDecision` separa este caso do `"pending"`.
7. Mesma regra no simulador (`control-service.ts`) e no status ao vivo (`duty-schedule-profile-queries.ts`), para a tela do diretor bater com o que a distribuição faz.
8. Evento de rastreio na distribuição (`distribution-trace.ts`): `duty_start_interval` com `confirmedCount`, `pendingCount`, `endsAt`, para auditar depois quanto tempo cada lead esperou.

### Interações com o que já existe

- **Rodízio:** corretor no intervalo não está entre os candidatos, então **mantém o lugar** (mesmo comportamento de quem tem oferta pendente). O lead vai ao próximo da vez que esteja livre. Quem confirma durante o intervalo entra no fim, como hoje, e já está livre: tende a receber o próximo lead.
- **Pulos:** o intervalo não gera pulo nem gasta a vez. Oferta expirada ou recusada continua contando como pulo **e** como âncora do intervalo (ela foi uma oferta).
- **Teto do plantão:** sem mudança; o teto continua filtrando antes.
- **Ofertas pendentes:** sem mudança; as duas regras valem juntas, prevalece a liberação mais tarde.
- **Segurar frios:** sem mudança; frio segurado nem chega à escolha.
- **Plantão extra da noite (DEC-152):** fora desta mudança na primeira versão (pergunta 4).
- **Corretor em dois plantões (DEC-132):** vale o plantão usado na escolha daquele lead.
- **Prioridade por tipo de plantão:** sem mudança; ela só reordena quem passou pelos filtros.

### O que cada um vê

**Diretor e gestor** (página do plantão, `broker-occurrence-card.tsx`):

- Status novo no cartão do corretor: **"Intervalo de início · 6:12"** (reaproveita `BrokerLiveStatus` e a contagem regressiva que já existe para o `cooldown`; `liveStatus` ganha `start_interval`).
- Uma linha no cabeçalho da ocorrência, no padrão de aviso neutro existente: "Começo do plantão: 1 lead a cada 8 min por corretor até todos confirmarem (2 de 5 confirmados · até 10:00)". Some quando o intervalo acaba. Sem cor nova: texto secundário e ícone em azul de destaque (#2563eb), conforme `docs/design-system.md`.
- No log da distribuição, o motivo do lead parado (item 6).

**Corretor** (Lite, `presence-callout.tsx`, estado `done`):

- Logo abaixo de "Presença confirmada", uma linha só enquanto o intervalo estiver ativo: "Enquanto seus colegas confirmam, você recebe um lead a cada 8 min." Sem contador para o corretor (evita ansiedade e pedido de "por que ainda não chegou"). Segue o `LITE_CHAT_DESIGN_SYSTEM.md`: texto secundário dentro do cartão, sem badge novo.

### Flag

`feature_duty_start_offer_interval_enabled` em `src/shared/feature-flags/catalog.ts`, escopo global, **padrão desligado**, ligada pelo Super-admin › Operações (mesmo lugar do rodízio e do plantão extra). Os números (8 min, até 3 confirmados, 1 h) ficam como constantes no código; mudar exige deploy (pergunta 6).

### Estados de erro

- Falha ao calcular pendentes (erro de banco): **sem intervalo** (fail-open, distribuição igual à de hoje) e `console.error("[plantao] start_interval_failed")`. Nunca travar a fila por causa do intervalo.
- Flag ilegível: tratada como desligada.
- Rodízio desligado: o intervalo continua valendo (depende só da presença), porque o problema é o mesmo no nivelamento.
- Relógio: tudo em `America/Sao_Paulo`, com as funções de janela que já existem.

### Testes

- `duty-start-interval.test.ts`: 0, 1, 3 e 4 confirmados; sem pendentes; pendente que já passou da tolerância; entrada tardia (`joinedAt`); limite exato de 60 min.
- `offer-pacing.test.ts`: regra `duty_start` com âncora por plantão.
- Teste de banco no estilo de `duty-multi-queue.db.test.ts`: 2 confirmados, 3 pendentes, 6 leads mornos na fila → cada um recebe 1; o resto fica `queued` com `retryAt` +8 min; um quente sai na hora; o 3º confirma e recebe o próximo.
- Simulador e status ao vivo coerentes com a distribuição.

## Perguntas em aberto (mudança 1)

1. **DEC nova abrindo exceção à DEC-151?** Recomendado: **sim**, com o próximo número livre em `docs/decision-log.md` no momento do merge (nesta base o último é DEC-175; outras branches podem ter usado o 176): "Intervalo de 8 min no começo do plantão", citando o pedido. Também registra a regra em `docs/business-rules.md` ao lado da BR-086.
2. **Quando o intervalo termina?** Recomendado: **no que vier primeiro** entre todos confirmarem (ou serem marcados ausentes), o 4º confirmado e o fim da janela de 1 h. Alternativas: só quando todos confirmarem (pode durar a hora inteira por causa de um faltoso); só pelo relógio.
3. **Vale para presencial e online?** Recomendado: **os dois**, contando todos os escalados da ocorrência. O presencial com foto aguardando aprovação conta como pendente.
4. **Plantão extra da noite (07:00, DEC-152) entra?** Recomendado: **não na primeira versão**. O extra tem regra própria de confirmação (um toque, até 08:00) e é justamente uma descarga de fila; dá para estender depois com os mesmos números.
5. **Quais leads esperam?** Recomendado: **quente (alta aptidão) não espera**; morno e frio respeitam o intervalo. Custo: um morno pode esperar até 8 min no começo do plantão, contra o "1 minuto" da DEC-151. Alternativa: só frio espera (protege menos, porque a fila acumulada da manhã tem muito morno).
6. **Flag e números configuráveis?** Recomendado: **uma flag liga/desliga global (padrão desligado)** e números fixos no código. Alternativa: minutos e limite de confirmados por plantão na tela do plantão (mais tela, contra a regra de densidade).
7. **O lead que não sai vai para quem?** Recomendado: **fica na fila e vai ao próximo corretor livre do rodízio**; se todos estiverem no intervalo, espera a primeira liberação ou um colega confirmar (a confirmação já acorda a fila). Nada de mandar para fora do plantão.
8. **O corretor vê contador?** Recomendado: **não**, só a frase no cartão de presença. O diretor vê o contador por corretor.

---

# Mudança 2 — Aceitar o lead e abrir o WhatsApp com contador de 30 s

## Resumo

Hoje o corretor toca em "Aceitar e chamar no WhatsApp" e o WhatsApp abre na hora, antes de ele ler quem é o cliente. Com a mudança, o toque grava o aceite e leva para a tela do lead com um quadro **"Antes de chamar"** (nome, o que quer, plano, vidas e, quando existir, o plano anunciado). No rodapé fica a pílula flutuante, centralizada, **"Abrir WhatsApp · 30"**, com contagem regressiva. Ao chegar a zero, o WhatsApp abre sozinho. Se o corretor tocar na pílula antes, abre na hora. "Ficar aqui" cancela a abertura automática.

O aceite continua sendo gravado **antes** do contador. Os 30 s são de leitura, não de arrependimento: o lead já é do corretor.

## Mapa do que existe hoje

### Três caminhos de aceite, todos abrindo o WhatsApp na hora

| Caminho | Onde | Ação no servidor | Depois do aceite |
| --- | --- | --- | --- |
| A. `AcceptLeadButton` | `src/features/broker-workspace/components/accept-lead-button.tsx:19-66`. Aparece no card "Agora" (`chat-home.tsx:81`), no centro do computador (`chat-home.tsx:309`), na **pílula do Início no celular** (`chat-home.tsx:358-366`, rótulo "Aceitar e chamar no WhatsApp" de `features/assist/next-action.ts:38`) e em `light-leads-list.tsx:168/235` (`/minha-fila`, `/leads`) | `acceptLeadOfferAction` (`src/features/leads/accept-offer-action.ts:25-63`): aceite atômico (`handleLeadOfferWebhookResponse`), atendimento iniciado e `whatsappUrl` com a saudação (`loadBrokerGreetingSafe`) | `whatsapp.go(url)`, toast "Lead aceito. Abrindo o WhatsApp do cliente." com "Abrir de novo" e `router.push("/leads/{id}")` |
| B. Tela do lead | `light-lead-detail/action-bar.tsx:45-47` ("Aceitar e chamar no WhatsApp" + "Recusar"), handler `use-lead-detail.ts:139-176` | `startLeadServiceAction` (`src/app/(dashboard)/leads/[id]/service-action.ts`) | `celebrateSuccess("Lead aceito")`, `router.refresh()`, `whatsapp.go(url)` e o toast |
| C. Chat do assistente | `assistant-scripts.ts:374` (`lead.accept`) → `assistant-chat.tsx:38-54` → `chat-actions.ts:53-59` | `acceptLeadOfferAction` | `go(result.whatsapp)`, `router.push(href)` e mensagem "Aceito. Abrindo o WhatsApp do cliente." |

Fora do escopo: o "Aceitar e abrir" da extensão do navegador, e o `lead-script.ts:241`, que só aparece no preview de `/dev`.

### Abertura do WhatsApp (`src/lib/whatsapp-open.ts`, `src/lib/whatsapp-url.ts`)

- **Celular** (user agent mobile ou `pointer: coarse`): `window.location.href = "whatsapp://send?phone=…&text=…"`, que abre o app.
- **Computador:** `prepareWhatsAppWindow()` abre no clique uma aba vazia `whatsapp_web` ("Abrindo o WhatsApp Web…"), para escapar do bloqueador de pop-up. Depois do `await`, `go()` leva essa aba para `https://web.whatsapp.com/send?…`, e `cancel()` fecha a aba se o aceite falhar.
- O link não muda por canal (Meta ou WAHA): é sempre o WhatsApp do corretor chamando o telefone do cliente. Não há deep link do WhatsApp Business.

### Dados do lead

- `AcceptLeadButton` só conhece o `leadId`. O retorno da action é `{ success, error?, whatsappUrl? }`.
- A tela do lead (`src/app/(dashboard)/leads/[id]/page.tsx:426-487` → `LightLeadDetailData`) já tem tudo para o quadro: `planName`, `tipo`, `livesCount`, `city`, `summary` (resumo da IA), `clientInfo` ("Tipo de plano", "Plano de interesse", "Vidas", "Idades", "Cidade", "Interesse", vindo de `src/features/leads/client-info.ts:109`) e `brokerGreeting`. Telefone e `clientInfo` completo só aparecem depois do aceite (`lead-contact-privacy.ts`).
- Origem e campanha são apagadas para o corretor (`broker-visibility.ts`, DEC-150). O "plano anunciado" **ainda não existe**: está no plano `2026-11-10-corretor-ve-anuncio-do-lead.md` (branch `feat/corretor-anuncio-do-lead`), com `adContext` e o cartão "De onde veio".

### Peças de interface prontas

- Pílula flutuante: **não existe componente `FloatingPill`**. Há só as classes `.pillWrap`, `.pill` e `.pillPulse` em `src/components/chat/chat.module.css:226-246`, conforme `LITE_CHAT_DESIGN_SYSTEM.md` §5.8: fixa no pé (área segura + 20 px), centralizada, 50 px de altura, raio 9999, texto 16/500, `z-index` 20, pulsação desligada com movimento reduzido. Pelo design system, ela é **só do celular**.
- Contador: `useCountdown` e `useNowSeconds` (`src/components/lite/status/use-countdown.ts`, com relógio global de 1 s que pausa com a aba oculta) e `formatCountdown`.
- Movimento reduzido: `useReducedMotion` (motion/react), `MotionConfig` global e `@media (prefers-reduced-motion)` no `chat.module.css`.
- Testes: `accept-lead-button.test.tsx`, `accept-offer-action.test.ts`, `whatsapp-open.test.ts`, `light-leads-list.test.tsx`, `assistant-chat.test.tsx`. Nada cobre `handleAccept` (caminho B).
- O design system do Lite (§7) diz que a confirmação acontece na conversa, não em toast. Os três caminhos usam toast hoje.

## Proposta

### Fluxo

1. O corretor toca em "Aceitar e chamar no WhatsApp", em qualquer um dos três caminhos.
2. O aceite é gravado como hoje (`acceptLeadOfferAction` ou `startLeadServiceAction`). **No computador deixa de abrir a aba vazia**: ela roubaria o foco do quadro de informações.
3. Se der certo, todos os caminhos levam para `/leads/{id}?chamar=1`. O caminho B já está nessa tela e só liga o modo. Não aparece toast.
4. A tela do lead mostra no topo o quadro **"Antes de chamar"** e a pílula **"Abrir WhatsApp · 0:30"**.
5. A contagem desce de 30 a 0. Em 0, tenta abrir o WhatsApp com o mesmo `openWhatsApp` de hoje e o link montado no cliente (`buildWhatsAppUrl(telefone, brokerGreeting, device)`).
6. Tocar na pílula abre na hora. Esse toque é do usuário, então nunca é bloqueado.
7. Se a abertura automática falhar (detalhes abaixo), a pílula vira **"Toque para abrir o WhatsApp"** com a pulsação `.pillPulse` e fica assim.
8. Depois de abrir (sozinho ou pelo toque), a pílula volta a ser a de hoje, "Abrir WhatsApp", sem contador. O quadro "Antes de chamar" vira o resumo normal da tela.

Por que levar para a tela do lead, e não montar um painel em cada caminho: os dados do quadro já estão nessa tela (`LightLeadDetailData`), os três caminhos já terminam nela ou perto dela, e assim fica **um componente só**. O caminho A já faz `router.push("/leads/{id}")` hoje.

### Abertura automática sem toque recente

Os navegadores bloqueiam abrir app ou pop-up sem um toque recente: a "ativação do usuário" dura poucos segundos, e 30 s passam disso.

| Ambiente | Abertura sem toque | Tratamento |
| --- | --- | --- |
| Android Chrome (`whatsapp://`) | Costuma bloquear a navegação para esquema externo sem gesto | Tenta. Se em 1,5 s a página continuar visível (não houve `visibilitychange`/`pagehide`), considera falha e passa para "Toque para abrir" |
| iPhone Safari (`whatsapp://`) | Pode mostrar "Abrir no WhatsApp?" ou ignorar | Mesma detecção. A caixa do iOS conta como sucesso se o corretor confirmar (a página fica oculta) |
| Computador (`window.open` para `web.whatsapp.com`) | Bloqueador de pop-up barra | `window.open` devolve `null` → "Toque para abrir" na hora |
| App instalado (PWA, se houver) | Varia | Mesma detecção |

O plano aceita que, em alguns aparelhos, a abertura automática **nunca** funcione. Nesses casos o contador vira um lembrete visível, e o toque abre na hora. Antes de escrever a interface, um **teste de 1 dia em aparelhos reais** (Android Chrome, iPhone Safari, Chrome e Edge no computador) mede onde funciona. Se não funcionar em quase nenhum, ver a pergunta 2.

A aba vazia aberta no clique, no computador, não volta. Ela até faria a abertura funcionar 30 s depois, mas tiraria o corretor da tela que ele precisa ler.

### Cancelar e pausar

- **"Ficar aqui"**: link de texto abaixo do quadro (não é botão primário). Cancela a abertura automática. A pílula fica "Abrir WhatsApp", parada.
- **Pausa automática** quando a aba ou o app vai para o fundo. Ao voltar, retoma de onde parou. Isso evita abrir o WhatsApp "do nada" quando o corretor volta.
- **Pausa ao interagir**: rolar ou tocar no quadro **não** pausa (pergunta 3).
- Sair da tela cancela (o componente desmonta).
- O contador conta o tempo restante, e não uma hora-alvo: por isso o `useCountdown(atIso)` atual não serve sozinho. Proposta: hook novo `useHandoffCountdown(30)` que usa o `useNowSeconds` e congela com `document.hidden`.

### Movimento reduzido e acessibilidade

- Sem pulsação, sem anel animado e sem deslocamento. Só o número muda, e o surgimento é um fade de até 120 ms (`reducedFade`).
- A pílula é um `button` com `aria-label` "Abrir WhatsApp agora. Abre sozinho em 30 segundos" (atualizado a cada 10 s, não a cada segundo). O número usa `aria-live="off"` e `tabular-nums`.
- Um anúncio único, `role="status"`, ao aparecer: "Lead aceito. O WhatsApp abre em 30 segundos."
- Alvo de toque de pelo menos 44 px (a pílula tem 50 px).

### Componentes

| Componente | Onde | O que faz |
| --- | --- | --- |
| `FloatingPill` (novo, extraído) | `src/components/chat/floating-pill.tsx` | Tira as classes `.pillWrap`/`.pill`/`.pillPulse` para um componente com `label`, `trailing` (o contador) e `pulse`. O Início (`chat-home.tsx:358`) passa a usar ele também. Sem estilo novo. |
| `WhatsAppHandoff` (novo) | `src/features/broker-workspace/components/whatsapp-handoff/` | Quadro "Antes de chamar" + `FloatingPill` com contador + "Ficar aqui". Recebe `lead` (recorte de `LightLeadDetailData`), `whatsappUrl` e `adContext?`. |
| `useHandoffCountdown` (novo) | o mesmo diretório | Contagem com pausa por aba oculta e cancelamento. Devolve `{ remaining, state: "counting" \| "paused" \| "cancelled" \| "opened" \| "failed" }`. |
| `tryOpenWhatsAppWithoutGesture` (novo) | `src/lib/whatsapp-open.ts` | Tenta abrir e resolve `opened` ou `failed` (`window.open` nulo, ou página ainda visível depois de 1,5 s). |
| `AcceptLeadButton`, `use-lead-detail.ts`, `assistant-chat.tsx` | existentes | Deixam de chamar `prepareWhatsAppWindow`/`go` e o toast de sucesso. Depois do aceite fazem `router.push("/leads/{id}?chamar=1")`. Com a flag desligada, tudo fica como hoje. |
| `leads/[id]/page.tsx` | existente | Lê `chamar=1` (só se o lead estiver com o corretor e em atendimento) e passa para o `LightLeadDetail` montar o `WhatsAppHandoff`. Limpa o parâmetro com `router.replace` depois de montar, para o recarregar não repetir o contador. |

### Quadro "Antes de chamar"

O texto do quadro vem dos dados que a tela já tem:

- **Título:** o nome do cliente (16/500).
- **"Quer":** o `summary` da IA, ou o "Interesse" do `clientInfo`. Uma linha, 14 muted.
- **Linhas curtas no padrão de lista do Lite:** "Plano" (`planName` ou "Plano de interesse" · `tipo`), "Vidas" (`livesCount` e "Idades", se houver) e "Cidade".
- **"Anúncio":** o título do plano anunciado, se `adContext` existir. A linha só aparece quando a branch `feat/corretor-anuncio-do-lead` estiver na base. Sem esse dado, ela não aparece e não fica placeholder.
- Sem telefone na tela (ele já vai no link) e sem origem interna (DEC-150 continua valendo).

Tudo com os tokens do `LITE_CHAT_DESIGN_SYSTEM.md`: superfície de cartão do Lite, raio de cartão, pesos 400/500 e nenhuma cor nova.

### Estados de erro

| Situação | O que acontece |
| --- | --- |
| Aceite falha (oferta expirou, outro aceitou, sem permissão) | Não navega e não há contador. A mensagem de hoje aparece na conversa ("Esta oferta não está mais disponível."), e a lista se atualiza. |
| Lead sem telefone válido | O quadro aparece sem contador e sem pílula de WhatsApp. No lugar, a linha "Telefone do cliente inválido: confira na ficha." O lead continua aceito. |
| Navegação para a tela do lead falha ou demora | O aceite já foi gravado. A tela abre normalmente quando carregar; o contador só começa quando o quadro aparece. |
| Abertura automática bloqueada | "Toque para abrir o WhatsApp", pulsando (parado com movimento reduzido). |
| Corretor sem internet depois do aceite | O link é montado no cliente, então abre mesmo assim. |
| Toque duplo no aceite | O aceite já é idempotente. O segundo toque é ignorado enquanto o primeiro está pendente. |
| `?chamar=1` num lead que não é do corretor ou já tem contato | Ignorado: a tela abre normal. |

### Flag

`feature_lite_accept_handoff` em `catalog.ts`, **escopo por empresa**, padrão desligado, com piloto ligado pelo Super-admin (mesmo padrão de `LIVE_STATUS_STRIP` e `src/features/live-status/flag.ts`). Desligada, os três caminhos ficam exatamente como hoje.

### Testes

- `use-handoff-countdown.test.ts`: contagem, pausa com aba oculta, cancelamento, zero só uma vez.
- `whatsapp-open.test.ts`: `tryOpenWhatsAppWithoutGesture` com `window.open` nulo e com a página que continua visível.
- `whatsapp-handoff.test.tsx`: quadro com e sem `adContext`, sem telefone, "Ficar aqui", toque abre na hora, falha vira "Toque para abrir", movimento reduzido sem pulsação.
- Atualizar `accept-lead-button.test.tsx` e `assistant-chat.test.tsx` para os dois modos da flag, e criar o teste do `handleAccept`, que hoje não existe.
- O teste em aparelhos reais (acima) fica registrado no documento com os resultados.

## Perguntas em aberto (mudança 2)

1. **O aceite é gravado antes do contador?** Recomendado: **sim**, como hoje. Os 30 s são para ler, e "Ficar aqui" não desfaz o aceite. Alternativa: gravar só ao abrir. Ela tem um problema: um lead "segurado" 30 s sem dono pode expirar ou ir para outro.
2. **E se a abertura automática quase nunca funcionar nos aparelhos dos corretores?** Recomendado: **manter o contador como lembrete visível**, com o "Toque para abrir" pulsando ao zerar. Alternativa: trocar o contador por um botão parado, o que perde o pedido original.
3. **Interagir com o quadro pausa o contador?** Recomendado: **não**. Só pausa com a aba no fundo, e "Ficar aqui" cancela. Ter pausa e cancelamento ao mesmo tempo seria um controle a mais na tela.
4. **A pílula aparece também no computador?** O design system diz que a pílula é **só do celular** (§5.8), e o pedido fala em "botão flutuante centralizado no bottom da tela". Recomendado: **sim, nos dois**, centralizada na coluna do chat, registrando a exceção no §5.8 do `LITE_CHAT_DESIGN_SYSTEM.md`. Pela regra do CLAUDE.md, isso precisa do seu ok.
5. **Cor da pílula.** O design system reserva o verde do WhatsApp (`oklch(64% .17 150)`) ao botão "Abrir WhatsApp", e a pílula de hoje usa o azul de ação. Recomendado: **verde do WhatsApp**, porque a ação é abrir o WhatsApp. Continua sendo o único CTA da tela.
6. **O contador é de 30 s fixos?** Recomendado: **fixo no código**. Se o piloto mostrar que é muito ou pouco, ajusta-se num deploy.
7. **O toast "Lead aceito" sai?** Recomendado: **sim**. O quadro na tela já confirma o aceite, alinhado ao §7 do design system ("confirmação na conversa, não em toast").
8. **Flag por empresa ou global?** Recomendado: **por empresa**, com piloto.

---

## Ordem sugerida

1. Mudança 1 numa branch própria (`feat/intervalo-inicio-plantao`): DEC e regra de negócio, regra pura com testes, presença com pendentes, distribuição e recheck sob trava, status ao vivo do diretor e frase no Lite.
2. Mudança 2 em outra branch (`feat/lite-aceite-contador-whatsapp`): primeiro o teste em aparelhos reais; depois `FloatingPill` extraída, hook, `WhatsAppHandoff` e a troca nos três caminhos atrás da flag.
3. Nenhuma das duas precisa de migration.
