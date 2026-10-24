# Animação imperativa em src (requestAnimationFrame e animate())

Lista gerada com `grep -rl` sobre `src` (.ts e .tsx) em 2026-10-24, e revisada na F1b (item 5 da correção do Cinzel). Cada linha diz se o arquivo respeita movimento reduzido e em qual linha.

Total: 29 arquivos (14 com requestAnimationFrame, 17 com animate(), 2 com os dois). Resultado: nenhum arquivo anima sem respeitar movimento reduzido. Os 6 que não têm a checagem literal não animam com o rAF: ele só dá foco, zera a rolagem ou fecha um menu. O contador passa pelo provedor, e o crossfade do `app-shell` usa `useInterfaceMotionEnabled`.

Correções desta revisão: nenhuma. Não há arquivo do diretor, nem compartilhado, que anime sem respeitar movimento reduzido, então nada precisou ser alterado. Arquivos que mudam o Lite do corretor, gestor e supervisor (chat, tour, celebração, chips e upload do arc) ficam fora desta etapa e já respeitam o movimento reduzido.

## Arquivos

| Arquivo | JS imperativo | Respeita movimento reduzido? |
|---|---|---|
| `src/app/(dashboard)/atendimento/mensagens/_components/message-drawer.tsx` | rAF | Não se aplica: rAF só devolve o foco ao campo (linha 116). |
| `src/app/(dashboard)/atendimento/situacoes/_components/situation-drawer.tsx` | rAF | Não se aplica: rAF só devolve o foco ao campo (linha 80). |
| `src/components/app-shell.tsx` | rAF | Sim, linha 7 |
| `src/components/arc/action-button/action-button.tsx` | animate() | Sim, linha 5 |
| `src/components/arc/animated-counter/animated-counter.tsx` | animate() | Sim, linha 4 |
| `src/components/arc/badge/badge.tsx` | animate() | Sim, linha 5 |
| `src/components/arc/bottom-sheet/bottom-sheet.tsx` | animate() | Sim, linha 6 |
| `src/components/arc/button/button.tsx` | animate() | Sim, linha 5 |
| `src/components/arc/calendar/calendar.tsx` | animate() | Sim, linha 6 |
| `src/components/arc/chip-group/chip-group.tsx` | rAF + animate() | Sim, linha 5 |
| `src/components/arc/empty-state/empty-state.tsx` | animate() | Sim, linha 4 |
| `src/components/arc/expandable-card/expandable-card.tsx` | animate() | Sim, linha 5 |
| `src/components/arc/file-dropzone/file-dropzone.tsx` | rAF + animate() | Sim, linha 6 |
| `src/components/arc/metric-card/metric-card.tsx` | animate() | Sim, linha 4 |
| `src/components/arc/radio-cards/radio-cards.tsx` | animate() | Sim, linha 5 |
| `src/components/arc/skeleton/skeleton.tsx` | animate() | Sim, linha 4 |
| `src/components/arc/slider/slider.tsx` | animate() | Sim, linha 4 |
| `src/components/arc/stepper/stepper.tsx` | animate() | Sim, linha 5 |
| `src/components/arc/switch/switch.tsx` | animate() | Sim, linha 6 |
| `src/components/chat/live-blocks.tsx` | rAF | Sim, linha 5 |
| `src/components/chat/tour/lite-tour.qa.test.tsx` | rAF | Sim, linha 26 |
| `src/components/chat/tour/lite-tour.tsx` | rAF | Sim, linha 7 |
| `src/components/global-search.tsx` | rAF | Não se aplica: rAF só foca o campo (linha 68). |
| `src/components/lite/motion/number.tsx` | animate() | Sim, linha 4 |
| `src/components/motion/count-up.tsx` | rAF | Sim, linha 4 |
| `src/components/pwa-install-prompt.tsx` | rAF | Sim, linha 32 |
| `src/components/splash-screen.tsx` | rAF | Sim, linha 26 |
| `src/components/ui/faceted.tsx` | rAF | Não se aplica: rAF só fecha o menu depois da escolha (linha 98). |
| `src/features/journey/components/celebration-layer.tsx` | rAF | Sim, linha 4 |

## Notas

- `src/components/lite/motion/number.tsx` (novo nesta branch) aparece na lista porque anima com `animate()`; a checagem está no `Digit`.
- `count-up.tsx` não tem a palavra "reduced" no arquivo, mas usa `useInterfaceMotionEnabled`, que lê `useReducedMotionPreference`.
- As referências de linha são de `feat/diretor-lite-f1b` (base `origin/feat/diretor-visual-lite`).
