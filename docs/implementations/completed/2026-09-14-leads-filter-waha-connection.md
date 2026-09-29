# Filtros de leads e pareamento WAHA — 2026-09-14

## Objetivo

Manter o filtro rápido de `/leads` coerente com a URL durante navegações lentas e
evitar que o pareamento WAHA seja recusado por nomes diferentes de variável ou
por estados equivalentes devolvidos pelo provedor.

## Escopo e decisões

- O clique em uma pílula de status usa estado otimista apenas para feedback visual;
  o parâmetro da URL e a resposta do servidor continuam sendo a fonte de verdade.
- A URL atual do navegador é usada para construir a próxima navegação, evitando
  sobrescrever filtros quando há cliques rápidos.
- Os tokens internos do serviço WAHA são resolvidos em uma única função, com
  `WHATSAPP_API_INTERNAL_TOKEN` como prioridade e aliases VPS compatíveis como
  fallback.
- Os estados WAHA são normalizados por um módulo compartilhado, incluindo
  `READY`, `OPEN`, `AUTHENTICATED` e estados em minúsculas.

## Arquivos

- `src/app/(dashboard)/leads/_components/leads-filters.tsx`
- `src/features/waha-cadence/status.ts`
- `src/features/waha-cadence/relay-client.ts`
- `src/app/(dashboard)/settings/whatsapp-actions.ts`
- `services/whatsapp-api/src/config.ts`
- `services/whatsapp-api/src/app.ts`
- `services/whatsapp-api/test/waha-health.test.ts`
- `src/features/waha-cadence/relay-client.test.ts`

## Validação

- `npm run type-check` — passou.
- `npx vitest run src/features/waha-cadence/relay-client.test.ts` — 7 testes passaram.
- `npm test` em `services/whatsapp-api` — 74 testes passaram.
- `npm run build` em `services/whatsapp-api` — passou.
- `npm run build` no projeto — compilação, TypeScript e 79 páginas passaram.
- `npm run agent:verify -- --level fast` — documentação e type-check passaram; a
  suíte completa mantém uma falha preexistente em
  `broker-lite-experience.test.tsx` (ordem esperada do marcador de relatórios),
  fora deste escopo.

## Risco e rollback

O risco é limitado às transições de filtro e autenticação interna WAHA. O rollback
é reverter este commit; não há migração de banco nem alteração de dados pessoais.
Após o deploy do serviço Fastify, confirmar `/internal/waha/health` com o mesmo
segredo interno usado pelo CRM antes de ler um novo QR.
