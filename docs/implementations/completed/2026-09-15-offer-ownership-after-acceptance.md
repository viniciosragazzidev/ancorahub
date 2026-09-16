# Atribuição de lead somente após aceite da oferta

> **Supersedida em 16/09/2026 pela DEC-104.** O comportamento atual restaura o
> owner provisório para que a oferta apareça na carteira do corretor; este registro
> é mantido apenas como histórico da implementação anterior.

## Resultado

Ofertas automáticas enviadas pelo canal oficial Meta não atribuem `leads.corretorId`
nem mudam o lead para `assigned` antes da resposta do corretor. A linha de
`lead_offers` continua pendente e exclusiva; unidade e fila podem ser resolvidas
antes do aceite. A transação de aceite continua sendo a única que grava o owner e
dispara os efeitos pós-atribuição.

## Causa corrigida

O commit `2691ff38` gravava uma titularidade provisória na criação da oferta. Isso
fazia o lead aparecer na carteira e em `/conversas` antes de o corretor aceitar.

## Alterações

- `src/features/lead-distribution/domain.ts`: helper determinístico para o patch de
  uma oferta pendente, sem campos de owner.
- `src/features/lead-distribution/offers.ts`: criação de oferta mantém o lead em
  fila, registra evento auditável com `newOwnerId` nulo e só atribui no aceite.
- `src/features/lead-distribution/domain.test.ts`: regressão garante que o patch
  pendente não contenha `corretorId` nem `assignedAt`.
- Documentação de regras e estado da distribuição alinhada à DEC-096/BR-029Q;
  compatibilidade de registros legados permanece no worker.

## Critério de aceite

Para um lead novo com oferta `PENDING`, `leads.corretorId` permanece nulo e o lead
não aparece como carteira confirmada do corretor. Depois do aceite válido, o mesmo
lead passa a ter o corretor vencedor, a oferta vira `ACCEPTED` e as demais ofertas
ativas viram `LOST`, tudo na transação com row lock.

## Validação

Executar testes focados de distribuição, type-check, build de produção e o harness
`agent:verify` antes do commit. O comportamento de produção requer um teste sintético
com tenant isolado e template Meta aprovado.
