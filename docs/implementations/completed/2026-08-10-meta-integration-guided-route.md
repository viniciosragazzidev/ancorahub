# Integração Meta guiada em Integrações

## Entrega

- A configuração Meta foi movida para `/integrations/meta`.
- `/settings/meta` continua disponível apenas como redirecionamento, preservando links antigos e favoritos.
- O catálogo de Integrações aponta Meta Business, Lead Ads e WhatsApp Oficial para a nova rota.
- Lead Ads fica em `/integrations/meta`; o WhatsApp Oficial e WAHA ficam em `/integrations/whatsapp`, com a rota antiga também redirecionando.
- Os dois fluxos mostram objetivo, links oficiais, dados necessários e o que o Diretor deve aguardar da Ancora Hub.

## Segurança

- A autorização segue derivada do contexto de sessão e da capability `acessar_integracao_meta`.
- Tokens e demais credenciais privadas continuam sendo inseridos apenas no formulário protegido e não aparecem no guia, nos links ou em logs de interface.
- Lead Ads continua dependente do kill switch e do piloto individual liberado pelo Super-admin.
- A validação de Lead Ads recebe somente o ID de uma Página. O tenant continua derivado da sessão e a credencial central não lista mais a carteira inteira de ativos visíveis na Meta.

## Validação

- `npx vitest run src/features/communication-channels/meta-cloud-client.test.ts src/features/communication-channels/manual-meta-input.test.ts --reporter=dot` — 9 testes aprovados, incluindo a regressão que bloqueia `me/accounts` na descoberta.
- `npx tsc --noEmit --pretty false` — aprovado.
