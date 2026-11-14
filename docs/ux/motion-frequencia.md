# Movimento por frequência de uso (Lite)

Regra: quanto mais vezes o corretor vê uma tela, menos ela anima. Base: Emil Kowalski, "You don't need animations". Tokens em `src/components/arc/motion-tokens.ts` (120/160/240/320/480ms).

| Frequência | Animação | Limite |
|---|---|---|
| Centenas de vezes por dia | Nenhuma | 0ms (só a resposta ao toque) |
| Dezenas de vezes por dia | Mínima, só opacidade ou cor | até 160ms (`fast`) |
| Ocasional | Padrão | até 240ms (`standard`); avisos e celebrações até 320ms (`draw`) |
| Rara ou primeira vez | Pode encantar | até 480ms (`considered`), atraso máximo de 120ms |

Valem sempre: `prefers-reduced-motion` e o kill-switch `html[data-interface-motion="off"]` desligam tudo (via `useInterfaceMotionEnabled` no React e `src/styles/interface-motion.css` no CSS). Loop infinito decorativo não entra em tela de uso diário; spinner e barra de carregamento ficam.

## Primeira vez hoje

`useFirstTimeToday(key, enabled)` (`src/components/motion/first-time-today/`) responde `true` só na primeira montagem do dia em America/Sao_Paulo e grava a marca em `localStorage` (`lite:primeira-vez-hoje:<key>`). No SSR, na hidratação, com storage quebrado ou com movimento desligado responde `false` (na dúvida, não anima). Lógica pura e testes em `first-time-today-core.ts`.

## Onde cada animação do Lite está

| Animação | Arquivo | Frequência | Agora |
|---|---|---|---|
| Barra da meta do dia | `chat/chat-home.tsx` (`GoalFill`) | Dezenas | Enche só na 1ª abertura do dia (480ms, atraso 120ms); depois aparece pronta |
| Folha "Sua semana": destaque, posições, barras, números | `chat/week-ranking.tsx` (`WeekSheet`) | Dezenas | Só na 1ª abertura do dia (240ms; barras 480ms; atraso até 120ms); depois estática |
| Barra da missão de etapas | `chat/week-ranking.tsx` (`MissionBar`) | Dezenas | Só na 1ª montagem do dia (mola `snappy`) |
| Aviso de presença (foto, confirmado, check) | `chat/presence-callout.tsx` | Ocasional | Até 320ms |
| Guia de presença (barra, mascote, check) | `chat/presence-guide/*` | Ocasional | Até 320ms, atraso até 120ms. Ilustrações de demonstração em loop (toque, espera) mantidas por serem instrução |
| Convite de notificações (check) | `chat/push-nudge.tsx` | Ocasional | Check em 320ms. Sino e toast de exemplo ainda em loop (demonstração) |
| Tour (+XP, time, selo) | `chat/tour/lite-tour.tsx` | Rara | Até 320ms; balanço do time em uma passada |
| Confete do fim do tour | `chat/tour/lite-tour.tsx` | Rara (1 vez) | Uma passada de 2,4 a 3,4s (queda até o fim da tela). Exceção consciente: só no fim do tour, desligado com movimento reduzido ou kill-switch |
| Anel do tour | `chat/tour/lite-tour.module.css` | Rara | Pulso em loop só enquanto o tour está aberto |
| Ícone do consentimento de IA | `chat/chat.module.css` (`.consentGlow`) | Diária | Gradiente estático (loop de 4s removido) |
| Indicador de digitação (400 a 900ms) | `chat/chat-screen.tsx` | Centenas | Mantido: simula a digitação, não é decoração |
| Linhas de conversa (stagger 35ms, 180ms) | `chat/thread-row.tsx` | Centenas | Pendente: deveria cair para nenhuma animação ou só opacidade |
| Entrada do Início (fade e y 8px, 240ms; listas 160 a 200ms) | `chat/chat-home.tsx` | Dezenas | Pendente: deveria ficar só em opacidade até 160ms |
| Pulsos de lead esperando (`pillPulse`, `rowPulse`, 1,8s) | `chat/chat.module.css` | Diária | Mantidos: sinal de estado (lead esperando aceite), não decoração |
| Aurora e "z" do assistente pausado | `chat/chat.module.css`, `chat/paused-hero.tsx` | Ocasional | Não mexido nesta fase |

## Polimento (Fase 6): antecipação, follow-through, arco e profundidade

Só em ações raras e em elementos que chegam. Ação frequente, lista e texto continuam parados. Tudo desligado com `prefers-reduced-motion` e com o kill-switch.

| Item | Onde | Frequência | Como |
|---|---|---|---|
| Antecipação no hover (`ct-anticipate`) | `src/styles/anticipation.css`; "Confirmar registro da venda" (`register-sale-wizard.tsx`) e aceitar do "Seu próximo passo" (`chat/broker-home-overview.tsx`) | Rara | Sobe 1px e sombra `raised` em 160ms (`fast`). Só com mouse (`hover: hover` e `pointer: fine`); usa `translate`, nunca `::after` (é do `ct-touch`). O "Registrar venda" que abre o wizard (`light-lead-detail/sale-section.tsx`) ainda não leva a classe |
| Follow-through da folha | `arc/bottom-sheet` (`followThrough`), ligado em "O que você quer fazer?" (`chat/chat-home.tsx`) | Ocasional | Só a primeira abertura usa a mola `morph` (passa uns px, escondidos pela extensão, e assenta). Detentes, arrasto e fechamento seguem na `smooth`, sem balanço |
| Follow-through do check | `lite/motion/success.tsx` (`LiteSuccess`) | Ocasional | Check entra em 0.6 e assenta com `spring.snappy`; o texto não balança |
| Cartão que chega em "Agora" | `light-leads-list.tsx` (`NowBlock`) com `useArrivedKeys` (`lite/motion/arrivals.ts`) | Ocasional | Só o cartão que entra depois da tela abrir: sobe 8px com `spring.snappy`. A abertura da tela e o layout da lista ficam como estavam |
| Arco do aceite | `lite/motion/lead-arc.ts`, chamado pelo `AcceptLeadButton` com `arcToLeads` (só o destaque do Início); alvo `data-lite-arc-target="leads"` (contagem da aba Leads e aba Fila da barra de baixo) | Rara por lead, frequente no dia | Ponto em arco em 360ms, só depois do aceite confirmado, só com a contagem visível na tela, no máximo 1 vez a cada 10 min (marca em memória da sessão) |
| Coluna erguida no kanban | `lite/data/kanban.module.css` | Ocasional | Sombra `floating` e scale 1.02 enquanto arrasta, sem rotação. Movimento reduzido e kill-switch mantêm só a sombra |
