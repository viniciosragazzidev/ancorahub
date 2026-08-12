# Correção do callback OAuth Meta e transição de domínio

## Objetivo

Permitir login no domínio canônico `https://crm.ancorasaude.cloud` e tornar o resultado da autorização de Marketing da Meta rastreável e recuperável.

## Escopo entregue

- Better Auth passa a confiar explicitamente no domínio canônico e mantém o domínio legado durante a transição.
- O callback OAuth informa ao browser apenas códigos seguros de etapa e registra no servidor a etapa da falha, sem token ou estado OAuth.
- O cliente traduz esses códigos em orientação acionável.
- A confirmação dos ativos revalida `/integrations/meta` e atualiza a interface imediatamente.
- A Graph API usa `META_GRAPH_API_VERSION`, com fallback `v25.0`.

## Contrato operacional

`Autorizada` não significa `conectada`: a autorização cria uma tentativa verificada, e a conexão é persistida somente após o Diretor confirmar Business, páginas e contas autorizadas. Essa separação mantém os ativos escolhidos sob controle explícito do tenant.

## Arquivos principais

- `src/shared/auth/index.ts`
- `src/app/api/integrations/meta/lead-ads/callback/route.ts`
- `src/features/meta-ads/components/meta-integration-view.tsx`
- `src/features/meta-ads/components/meta-assets-modal.tsx`
- `src/features/meta-ads/actions.ts`
- `src/features/meta-ads/meta-graph-client.ts`

## Validações

- Testes focados do callback, origem OAuth e autenticação.
- `npm run agent:verify -- --level fast`.
- Build de produção pendente de nova execução isolada: a execução combinada anterior excedeu o tempo do ambiente.

## Rollback

Reverter o commit desta implementação restaura a configuração de origem anterior. O domínio legado continua confiável durante a transição, sem alteração de dados ou tokens persistidos.
