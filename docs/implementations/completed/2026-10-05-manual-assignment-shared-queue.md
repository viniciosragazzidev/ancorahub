# Atribuicao manual em fila compartilhada

## Escopo

Remover a recusa de rota de campanha em atribuicoes diretas e ofertas manuais de corretor quando a operacao preserva a fila do lead. Regras de campanha continuam sendo verificadas quando o lead e movido entre filas e durante a distribuicao automatica.

## Arquivos

- `src/features/lead-distribution/service.ts`
- `docs/business-rules.md`
- `src/features/roadmap/roadmap-data.ts`

## Validacao

- `node node_modules/typescript/bin/tsc --noEmit` — passou.
- ESLint nos arquivos alterados — passou.
- Vitest: `management-actions.test.ts`, `duty-roster-matching.test.ts` e `meta-campaign-eligibility.test.ts` — 25 testes passaram.
- O harness `agent:verify` nao rodou: `tsx` falhou em `uv_os_get_passwd` no Windows; executar o script com Node nativo tambem falhou porque imports internos nao incluem extensoes.
- Build nao executado.
