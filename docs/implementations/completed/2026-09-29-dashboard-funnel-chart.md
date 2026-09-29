# Funnel visual no dashboard

## Escopo

Substituir as barras horizontais da área `Funil` do `/dashboard` pelo gráfico
ribbon funnel fornecido como referência, mantendo os dados canônicos do funil
server-side.

## Implementação

- `src/components/dashboard/funnel-chart.tsx` agora desenha uma faixa SVG
  contínua, proporcional ao volume alcançado em cada estágio, com legenda
  responsiva e estado vazio.
- `src/features/dashboard/components/dashboard-widgets.tsx` reutiliza o
  componente no `FunnelCard`.
- `Perdido` permanece como saída terminal na legenda, fora da faixa, porque não
  é subconjunto da etapa anterior.

## Validação

- Testes focados: 2 arquivos e 12 testes aprovados (`operational-dashboard` e
  `metrics-math`).
- Type-check: aprovado com `node node_modules/typescript/bin/tsc --noEmit`.
- ESLint dirigido: aprovado para os dois arquivos alterados.
- `npm run build`: não iniciou porque o npm global do ambiente não encontra
  `AppData/Roaming/npm/node_modules/npm/bin/npm-cli.js`.
