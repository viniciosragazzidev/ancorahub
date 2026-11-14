# Feedback padrão em todo o app · plano de adoção

Data: 14/11/2026 · Dono: Vinicios · Padrão: `docs/design-system/FEEDBACK.md`
Relatórios e protótipo: `reports/design/feedback-duolingo-2026-11-14/`. O protótipo `aceitar-lead-exemplo.html` é a referência visual e de tempo do botão de ação e do aceite.
Status: **padrão registrado; código ainda não alterado.** Cada fase abaixo é uma branch própria, com revisão visual antes do merge.

Frequência: estimada pelo papel de cada tela, não por métrica. N0 a N3 = níveis do §3 do padrão.

---

## Estado atual (levantado em 14/11/2026)

- **Lite:** o feedback das ações do chat é texto do assistente + status do cabeçalho (`chat-screen.tsx:246-262`). `LiteSuccess` aparece em 4 lugares, e `useSuccessOverlay` no aceite, na venda e na supervisão. As fichas e configurações usam toast.
- **Som:** só no lead novo (`realtime-sync-provider.tsx:409`, `incoming-lead-card.tsx:38`). As receitas `tapSound`, `errorSound` e `warningSound` não são usadas.
- **Vibração:** só em `presence-callout.tsx:139` (30ms), `camera-capture.tsx:70` (20ms) e `presence-guide.tsx:283` (20ms). Nada nas ações.
- **Shake:** existe (`shared/animations/variants.ts:270`), mas nenhuma tela do Lite usa.
- **Mascote:** `AssistantAvatar` aparece no cabeçalho do chat, no `DynamicNotice` e no `PausedHero`, mas não reage a resultados.
- **Jornada:** celebrações (pontos, missão, conquista, nível, resumo do dia) só com visual, sem som. A arte usa mola de damping 14 e confete.
- **Modo normal:** cerca de 215 arquivos e 970 chamadas de toast. São 514 `toast.error`, dos quais cerca de 157 repassam o erro cru do servidor e só 7 dizem "Tente novamente". O ERP usa feedback inline (`FieldSuccess`/`FieldError`). `StatefulButton` tem 1 uso. Sem som, sem vibração.
- **Retorno das actions:** três formatos convivem: `{ ok:false, reason }` (cerca de 131), `{ error }` (cerca de 98) e `{ message }` (cerca de 97).

---

## Fase 0 · Fundação (antes de qualquer tela)

| Peça | Arquivo | Entrega |
|---|---|---|
| Tokens de movimento | `src/components/arc/motion-tokens.ts`, `src/components/lite/motion/motion-tokens.css` | `beat`, `shake`, `celebration`, `duration.celebrate`, `spring.celebrate`, `--chat-action-base` (§5 do padrão) |
| Tokens de feedback | `src/lib/feedback/tokens.ts` (novo) | volumes por som, padrões de vibração, lista de preferências |
| Som de marco | `src/lib/sounds/recipes.ts` | `milestoneSound`; as cinco receitas passam pela aprovação do dono, ouvindo |
| Preferências | Configurações do Lite (`settings/_components/light-settings.tsx`), coluna de preferência por usuário, `InterfaceMotionProvider` | interruptores Som, Vibração, Animações e Celebrações; hierarquia do §7 |
| Hook | `src/lib/feedback/use-feedback.ts` (novo) | `fire(evento, resultado)`: som, vibração e flags de movimento conforme o nível e as preferências |
| Botão de ação | `src/components/lite/controls/action-button.tsx` (novo, `LiteActionButton`) | estados repouso, pressionado, enviando, confirmado e falhou, largura fixa, base sólida; testes de cada estado e de movimento reduzido |
| Erro de ação | `src/lib/feedback/action-error.ts` (novo) | normaliza `reason`/`error`/`message` num formato só: causa, o que continua valendo e se dá para repetir |
| Mascote | `chat/assistant-avatar.tsx` | prop `mood` (`idle`, `alert`, `thinking`, `cheer`), uma passada por troca |
| Migração | 3 `navigator.vibrate` e 2 `playSound` atuais | passam a chamar `useFeedback` |

---

## Fase 1 · Lite do corretor: aceite e eventos

| Fluxo | Onde | Nível | Mudança |
|---|---|---|---|
| Lead novo | `chat/dynamic-notice.tsx`, `notifications/incoming-lead-card.tsx`, `providers/realtime-sync-provider.tsx` | evento | som `notify` (já existe) + vibração `notify` + mascote `alert`; textos que variam sem repetir o último |
| Aceitar lead (aviso, pílula, card, lista) | `broker-workspace/components/accept-lead-button.tsx` (+ `accept-lead-style.tsx`), `chat-home.tsx:106,394,454`, `broker-home-overview.tsx:44`, `light-leads-list.tsx:208,276` | N1 + N2 se bater a meta | `LiteActionButton` no lugar do botão atual; tira o toast duplicado (o resultado fica no botão e na conversa); falha com X, shake, causa e "Tentar de novo" |
| Aceitar na ficha | `light-lead-detail/action-bar.tsx:53` → `use-lead-detail.ts:173-211` | N1 | mesmo botão; o overlay sai, porque o aceite é dezenas por dia |
| Aceitar pelo chat | `chat-actions.ts:54` (`lead.accept`), `assistant-chat.tsx:41-63` | N1 | o mascote do Leads fica `thinking` durante a espera e `cheer` não entra (N1); a mensagem do assistente nomeia o lead |
| SLA em risco | `assistant-scripts.ts:430`, `chat-home.tsx:359` | evento | só texto e cor de status; sem som, sem pânico |
| Celebrações da jornada | `journey/components/celebration-layer.tsx`, `celebration-host.tsx`, `confetti.tsx` | N2 (pontos, missão, resumo) e N3 (conquista, nível) | aplicar `celebration.maxPerDay`; som `milestone` e vibração `success`; mola `celebrate` no lugar do damping 14; confete só no N3 |

## Fase 2 · Ações do chat (todas as rotas de conversa)

Todas passam por `features/broker-workspace/chat/chat-actions.ts` → `runChatServerAction`. A mudança fica num ponto só: o resultado da ação chama `useFeedback` com o nível abaixo, e a opção escolhida do `ChoiceList` (`chat-blocks.tsx:78`) mostra o estado enviando e o de falha.

| Ação | Nível | Som e vibração |
|---|---|---|
| `lead.addNote` (centenas) | N0 | nenhum; o envio otimista "sending/failed" (`user-send-core.ts`) mantém o "Tentar de novo" com shake |
| `lead.registerContact`, `lead.changeStep`, `lead.scheduleReturn`, `lead.completeReturn` | N1 | vibração `confirm` no celular; sem som (dezenas por dia) |
| `lead.cancelReturn`, `lead.reopenReturn`, `lead.decline`, `lead.markLost` | N1 | vibração `tap`; o "Desfazer" continua |
| `duty.pause`, `duty.resume` | N1 | vibração `confirm`; som `confirm` (ocasional) |
| `notifications.markRead`, `relationship.ack`, `team.addBroker` | N0 | nenhum |
| Falha de qualquer ação | erro | som `error`, vibração `error`, mensagem do assistente com causa e "Tentar de novo" |

## Fase 3 · Lite do corretor: ficha, venda, agenda, clientes, plantão, cotação

| Rota | Ação e arquivo | Nível | Mudança |
|---|---|---|---|
| `/leads/[id]?ficha=1` | mudar etapa (`action-bar.tsx:89,93` → `use-lead-detail.ts:300-329`) | N1 | troca `toast.success/warning/error` pelo estado no próprio objeto |
| | recusar (`decline-sheet`, `:225`) | N1 | tira o `toast.info`; confirmação na folha |
| | segurar fechamento (`closing-outcome-card.tsx:51`) | N1 | `LiteActionButton` |
| | primeira mensagem (`first-message-dialog.tsx:124`) | N1 | estados de envio; hoje só tem `role=alert` no erro |
| Registrar venda | `sale-section.tsx:57-106`, `register-sale-wizard.tsx:273`, `register-sale-panel.tsx:325`, `chat-home.tsx:335,342` (`quick-register-sale.tsx`) | **N3** | depois de persistir: overlay com resumo (valor, vidas), número que conta, mascote do Desempenho `cheer`, som `milestone`, vibração `success`; o wizard no Lite passa a mostrar a celebração |
| Upload de documento da venda | `register-sale-wizard.tsx:226` | N1 | progresso real e estado por arquivo |
| `/agenda` | concluir, cancelar ou reagendar (`light-dashboard/agenda.tsx:37`, `connected-agenda.tsx:62`) | N1 | mantém "Desfazer"; check no item |
| `/clientes/[id]` | nota e tarefa (`profile-quick-actions.tsx:65,93`), retorno (`light-client-next-action.tsx:61,82`) | N1 | `LiteSuccess` já existe; padronizar o erro |
| `/plantoes/agora` | presença por foto (`presence-callout.tsx:115-145`), pausar e retomar (`duty-now-view.tsx:68`) | N1; marco de plantão N3 | vibração via hook; ao fechar o plantão sem SLA estourado, o número da sequência sobe uma vez; marcos 5, 10, 25 e 50 em N3 |
| Sequência de plantão | `engagement/levels.ts` (`evaluateStreak`) | regra | folga, feriado e plantão não escalado não quebram a contagem (conferir o dado antes) |
| Meta do dia | `chat-home.tsx` (`GoalFill`), `week-ranking.tsx` (`MissionBar`) | N2 | ao bater: anel único, número que rola, som `milestone`, uma vez por dia |
| `/cotacao` | gerar proposta (`catalog-quote-guide.tsx:171`, `plan-cards.tsx:234`) | N1 | o bloco "celebrate" vira N1 (dezenas por dia), sem festa |
| Pausar recebimento | `broker-home-overview.tsx:173` → `light-top-nav.tsx:21` | N1 | hoje não confirma o sucesso; passa a confirmar |
| `/notificacoes` | marcar lida (`light-notifications.tsx:169,175`) | N0 | |
| `/settings` | horários, push, toggles (`light-availability-section.tsx:50`, `push-notification-manager.tsx`, `light-lead-toast-toggle.tsx:29`, `light-ai-consent-toggle.tsx:23`) | N1 | confirmação no controle; nova seção "Som e vibração" com as quatro preferências |
| `/primeiro-acesso` | concluir onboarding (`onboarding-wizard.tsx:128,157`) | N3 (uma vez) | celebração única de boas-vindas |

## Fase 4 · Lite do supervisor e do gestor

| Rota | Ação e arquivo | Nível |
|---|---|---|
| `/leads/[id]` | etapa (`manager-lead-status-sheet.tsx:16`), repassar (`manager-lead-transfer-form.tsx:22`), reatribuir, assumir ou remover (`supervision-panel.tsx:90-145`) | N1; o overlay atual de "Lead reatribuído" cai para N1 |
| `/equipe/minha` | convidar, adicionar, remover, reenviar ou revogar (`my-team-page.tsx:44-75`) | N1; trocar o `window.location.reload()` por atualização do item |
| `/equipe/[id]` | nota, remover, reconhecer com pontos (`supervisor-broker-profile.tsx:208,218,407`, `recognize-sheet.tsx`) | N1; o reconhecimento gera N2 para o corretor que recebe |
| `/gestao/equipes/[id]` | salvar meta (`goal-sheet.tsx:42`) | N1 |
| `/relacionamento` | enviar comunicado (`relationship-center-lite.tsx:99,121`) | N1 |
| Gestor `/leads` | devolver em massa (`leads/leads-lite-bulk.tsx:60`), venda (`RegisterSaleButton`) | N1; a venda é N3 para o corretor dono |
| Gestor `/distribuicao`, plantão | `leads/distribuicao/plantao/_components/*` | N1; publicar a escala é N2 (uma vez por mês) |
| `/equipe/transferencia`, `/settings` (troca de unidade, `light-unit-section.tsx:34`) | | N1; a troca de unidade hoje não confirma |

## Fase 5 · Diretor Lite (`director-routes.ts`)

Os componentes `*-lite.tsx` usam só toast. A ordem segue a contagem de chamadas: qualificação (15), segurança (13), documentos (12), equipe (10), propostas (10), membros (9), integrações (7), fluxos WhatsApp (7), convites (6), comissão (6), turbo (6), cargos (5), importação (5), Meta (5), atendimento (4), venda (4), unidades (2), recuperações (2). A regra é N1 em toda ação de salvar ou configurar, com o resultado no próprio objeto. O toast fica só para trabalho assíncrono, e o erro passa pelo normalizador da fase 0.

## Fase 6 · Modo normal

- **Ponto único:** `src/components/ui/sonner.tsx` (renderização do `AnimatedToast`) passa a chamar `useFeedback` (som `error` e vibração só para erro de ação, nunca para sucesso comum). `src/lib/toast.ts` vira a entrada oficial com presets por nível.
- **Botão:** `src/components/ui/button.tsx` (prop `loading`) ganha os estados confirmado e falhou do §4, sem base sólida. `StatefulButton` é absorvido.
- **Erros:** trocar as cerca de 157 chamadas que repassam o erro cru e os "Erro ao…" pelo normalizador, rota por rota, com causa e "Tentar de novo".
- **Overlay:** "Venda registrada" continua N2 (sem confete); "Lead reatribuído" cai para N1.
- **ERP:** incentivos, importações, financeiro, implantações e indicações já usam feedback inline; só ganham os estados do botão e o normalizador.
- **Ordem:** leads e distribuição (39 arquivos), settings (15), features/leads (14), equipe (10), meta-ads (10), atendimento (9), vendas (8), filiais (7), e o restante depois.

## Fase 7 · Mascotes com estados e prova de Rive

Desenhar os quatro estados (`idle`, `alert`, `thinking`, `cheer`) para os seis mascotes (Leads 212, Plantão 28, Agenda 150, Cotação 268, Desempenho 330, Insights 200). Depois, fazer uma prova de Rive com o mascote do Leads, medindo o peso do runtime no celular, antes de decidir trocar o CSS.

---

## Portas de qualidade por fase

- Testes de cada estado do botão e do hook, incluindo as quatro preferências desligadas e `prefers-reduced-motion`.
- Nenhum toast duplicando o resultado que já aparece no objeto.
- Revisão visual do dono antes do merge, com o protótipo como referência.
- Medir, nos pilotos: contato dentro do SLA, aceite da oferta, vendas registradas no dia e quantas vezes o usuário desliga som ou celebração.
