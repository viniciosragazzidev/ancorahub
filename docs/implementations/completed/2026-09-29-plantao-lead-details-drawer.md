# Drawer de detalhes de lead no plantão

## Escopo

Ao selecionar o lead na tabela de um plantão, a operação abre o mesmo drawer de
detalhes usado em `/leads`, preservando opções e funções conforme o papel,
feature flags e contexto do tenant.

## Implementação

- `src/features/leads/components/lead-details-drawer.tsx` concentra o drawer
  compartilhado entre `/leads` e o detalhe do plantão.
- `src/app/(dashboard)/leads/distribuicao/plantao/_components/duty-lead-details-trigger.tsx`
  abre o drawer a partir do nome do lead e mantém atualizações otimistas de
  reatribuição/atendimento antes do refresh do plantão.
- `duty-schedule-profile-queries.ts` fornece os campos completos do lead e a
  página do plantão injeta branches, brokers, SLA e configurações de gestão.
- O escopo de tenant, permissões, auditoria e ações server-side existentes não
  foi alterado.

## Validação

- Teste focado: `operational-dashboard.test.tsx` — 2 testes aprovados.
- Type-check: aprovado com `node node_modules/typescript/bin/tsc --noEmit`.
- ESLint dirigido: aprovado nos arquivos alterados, sem erros.
- `npm run build`: bloqueado pelo npm global do ambiente, que não encontra
  `AppData/Roaming/npm/node_modules/npm/bin/npm-cli.js`.
