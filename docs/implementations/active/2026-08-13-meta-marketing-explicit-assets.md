# Escopo explícito e permissão de leitura do Marketing Meta

## Objetivo

Diretores passam a escolher explicitamente as páginas e contas de anúncios do tenant antes de ativar a conexão Marketing Meta. A sincronização confirma as permissões concedidas, limita a leitura aos ativos ativos do próprio tenant e apresenta orientação recuperável quando a Meta não concede `ads_read`.

## Escopo e arquivos

- `src/features/meta-ads/meta-marketing-oauth-url.ts` e callback OAuth: pede nova concessão e registra apenas os escopos concedidos.
- `src/features/meta-ads/components/meta-marketing-wizard.tsx`: seleção começa vazia e a confirmação envia somente ativos marcados.
- `src/features/meta-ads/actions.ts`: revalida a seleção contra o snapshot autorizado, inativa espelhos antigos e filtra o estado exibido.
- `src/features/meta-ads/meta-sync-service.ts` e `meta-graph-client.ts`: sincronização parcial e sem segredos em logs quando a permissão de anúncios não existe.
- Testes focados do fluxo OAuth, seleção explícita, erro parcial e interpretação da Graph API.

## Decisões

- DEC-074 permanece a decisão aplicável: uma conexão canônica por corretora e confirmação explícita de ativos.
- Não houve nova decisão de produto. `ads_read` é mantida como permissão mínima; `ads_management` não é solicitada pois o CRM apenas lê campanhas.

## Validações

- `npx vitest run src/features/meta-ads/meta-marketing-oauth-url.test.ts src/features/meta-ads/meta-graph-client.test.ts src/features/meta-ads/components/meta-marketing-wizard.test.tsx src/features/meta-ads/components/meta-integration-view.test.tsx` — 11 testes aprovados.
- `npm run agent:verify -- --level fast` — documentação, tipos e 374 cenários aprovados.
- `npm run type-check` — aprovado.
- Lint focado dos arquivos Meta alterados — aprovado sem avisos.
- `npm run build` — build de produção do Next 16 aprovado.
- A verificação `agent:verify --level full` excedeu cinco minutos e registrou falha de lint/build por concorrência. O lint global também excedeu o limite do ambiente sem emitir erro; a validação focada e o build limpo acima são a evidência desta entrega.

## Riscos e rollback

- A troca de seleção apenas inativa espelhos de páginas, contas, pixels e datasets; leads, filas, rotas e histórico não são apagados.
- Para reverter a experiência, restaure os arquivos do domínio Meta deste commit. A nova conexão pode ser refeita pelo Diretor a qualquer momento; os tokens continuam cifrados e nunca retornam ao browser.
