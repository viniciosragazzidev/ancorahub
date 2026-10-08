# Janela de 3 dias na qualidade dos leads

## Regra

A análise de qualidade oferece uma janela de 3 dias, disponível na página e na exportação. Nas segundas-feiras, a janela começa na sexta-feira anterior às 19h no fuso `America/Sao_Paulo`, incluindo os leads recebidos após o início do período operacional do fim de semana. Nos demais dias, usa o início do dia de calendário conforme o padrão existente para períodos.

## Implementação

- `src/features/reports/metrics/lead-quality-period.ts` valida o período e calcula a janela.
- `src/components/period-select.tsx` permite habilitar a opção de 3 dias sem alterar outros seletores.
- A central, exportação e abas do dashboard preservam e aplicam o período.

## Verificação

- `npm.cmd exec vitest run -- src/features/reports/metrics/lead-quality-period.test.ts` — 4 testes passaram.
- `npm.cmd exec tsc -- --noEmit` — passou.
- ESLint nos seis arquivos alterados — passou.
