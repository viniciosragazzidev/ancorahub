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
