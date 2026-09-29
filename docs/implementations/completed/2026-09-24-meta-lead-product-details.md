# Detalhes dinâmicos de produto em leads Meta

## Objetivo

Capturar, preservar e exibir as respostas allowlisted `Tipo de Plano/Produto`,
`Tipo de CNPJ` e `Operadora` recebidas por Meta Lead Ads e evitar apresentar o PF
padrão do banco como se fosse uma resposta do formulário.

## Decisões e limites

- `Tipo de CNPJ` continua separado da classificação comercial PF/PJ/PME, conforme BR-069.
- Só respostas reconhecidas de `Tipo de Plano` alteram `leads.tipo`; respostas
  desconhecidas ficam armazenadas como texto e não são inferidas a partir do Tipo de CNPJ.
- Campo ausente em nova entrada Meta aparece como “Não informado”. Em leads existentes,
  respostas ausentes não apagam classificação nem metadados prévios.
- Apenas campos explicitamente allowlisted são persistidos; respostas desconhecidas
  do formulário e PII não são adicionadas a logs.
- Outros canais mantêm seu contrato de ingestão e valores padrão.

## Escopo técnico

- Normalização segura dos nomes/valores de campos Meta com suporte a acentos e aliases.
- Persistência das respostas estruturadas em `source_metadata` e atualização de
  classificação somente quando houver resposta canônica reconhecida.
- Exibição em `/leads` e no drawer/detalhe do lead, incluindo e-mail já recebido pelo
  intake e Operadora/Tipo de CNPJ quando existentes.
- Testes sintéticos para respostas Meta, campos ausentes, valores não reconhecidos,
  duplicados, preservação de metadados e isolamento de canais não Meta.

## Validação

- Testes focados: `npx vitest run src/features/communication-channels/meta-lead-ads.test.ts src/features/leads/webhooks/tests/webhook-intake-sync.test.ts src/features/leads/meta-lead-display.test.ts` — 3 arquivos, 31 testes aprovados.
- `npm run agent:verify -- --level fast`: type-check passou; suíte geral encontrou 1 falha preexistente no contrato Corretor Lite (`broker-lite-experience.test.tsx`, expectativa de `reportingLookup`).
- `npm run agent:verify -- --level full`: lint concluiu sem erros (avisos existentes), type-check passou, 942/947 testes passaram. As 5 falhas estão fora do escopo: uma expectativa do Corretor Lite e quatro casos de `duty-presence-domain.test.ts` que recebem `now` indefinido. Relatório: `reports/agent/verification/2026-09-24T13-30-43.126Z.md`.
- `npm run build`: passou, incluindo compilação otimizada, TypeScript e geração de páginas.
- `git diff --check`: passou; apenas avisos de conversão LF/CRLF do Git.

As respostas e a classificação dependem da homologação dos rótulos reais de cada
formulário Meta. Valores de produto não reconhecidos são exibidos como recebidos,
mas não alteram `leads.tipo` por inferência.

## Riscos e reversão

- Sem novo campo de banco/migration; respostas residem no JSONB de metadados já
  existente. Reverter o código remove a leitura/exibição nova, sem apagar metadados.
- A classificação padrão legada permanece para regras internas quando não existe
  resposta reconhecida; a UI de leads não a apresenta como resposta Meta.
