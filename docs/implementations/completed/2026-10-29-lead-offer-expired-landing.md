# Tela de oferta de lead expirada

## Resultado

Ao abrir novamente o link da oferta, o corretor vê uma confirmação genérica de que
o prazo terminou e o lead foi redistribuído. A tela não inclui nome, telefone nem
outros dados do cliente. O contador vai de 10 a 0, com botão imediato para
`/minha-fila`.

## Regra e entrada

- O template oficial `new_lead_broker` envia o ID no parâmetro do botão de URL,
  que abre `/lead/<id>`; essa rota segue para `/leads/<id>`. `/l/<id>` também
  converge para `/leads/<id>`.
- Na rota de detalhe, uma consulta mínima e limitada ao tenant identifica o
  responsável atual. Para corretor sem titularidade, só a oferta mais recente
  dele para o lead pode liberar a tela, quando está `EXPIRED` e sem `acceptedAt`.
- `REPLACED` não é aceito: o status não guarda o motivo e não prova expiração por
  demora. Os demais casos preservam o `notFound` atual para o corretor sem acesso.
- A decisão está isolada em `shouldShowExpiredOfferLanding` e coberta por teste
  unitário sem banco.

## Arquivos

- `src/features/lead-distribution/expired-offer-landing.ts`
- `src/features/lead-distribution/expired-offer-landing.test.ts`
- `src/features/lead-distribution/components/expired-offer-landing-screen.tsx`
- `src/app/lead/[id]/page.tsx`
- `src/app/(dashboard)/leads/[id]/page.tsx`

## Validação

- `npx vitest run src/features/lead-distribution/expired-offer-landing.test.ts --maxWorkers=1`: 4 testes passaram.
- `npx tsc --noEmit`: passou.
- ESLint dos arquivos alterados: passou sem erros; o detalhe de lead mantém 8 avisos `no-explicit-any` em linhas preexistentes.
- `node scripts/check-lite-skin.mjs`: executou em 1.109 arquivos. O scanner isolado da nova tela reportou zero desvios.
- Sem testes de banco, migrações ou alterações em `.env.local`.
