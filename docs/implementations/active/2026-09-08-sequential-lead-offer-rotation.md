# Rotação sequencial de ofertas de lead até aceite

## Objetivo

Eliminar o estado operacional em que um lead aguarda redistribuição manual antes de
esgotar os corretores elegíveis. O fluxo canônico passa a manter o lead em circulação
automática até um corretor aceitar ou até o conjunto elegível ser completamente
tentado.

## Comportamento entregue

- `corretorId` permanece nulo durante a oferta; ownership nasce somente no aceite.
- Existe no máximo uma oferta ativa por lead, serializada com row lock no próprio
  lead antes da inserção da oferta.
- Recusa, expiração e estouro de SLA retornam ao mesmo processador e excluem
  corretores já tentados.
- Corretor sem canal corporativo utilizável e falha ao enfileirar a mensagem ficam
  registrados como tentativa cancelada e o motor avança imediatamente.
- O job de distribuição espera exatamente até `expiresAt` sem consumir a contagem de
  tentativas enquanto aguarda resposta.
- Somente após esgotar os elegíveis, ou quando não existir caminho automático
  utilizável, o lead passa para intervenção manual.
- O aceite continua atômico com `SELECT FOR UPDATE`, completa jobs pendentes e só
  então dispara os efeitos pós-atribuição.
- Consultas e mutações de oferta/canal foram reforçadas com escopo explícito de
  tenant.

## Arquivos principais

- `src/features/lead-distribution/service.ts`
- `src/features/lead-distribution/offers.ts`
- `src/features/lead-distribution/jobs.ts`
- `src/features/lead-distribution/domain.ts`
- `src/features/leads/sla.ts`
- `src/features/leads/webhooks/services/lead-effect-outbox.ts`
- `src/features/notifications/send-push-helper.ts`

## Validação

- Testes focados de distribuição: aprovados.
- Type-check: aprovado.
- `git diff --check`: aprovado, apenas avisos de normalização LF/CRLF.
- Harness fast: 149 arquivos, 674 testes aprovados.
- Harness full e build de produção: pendentes antes da conclusão deste registro.

