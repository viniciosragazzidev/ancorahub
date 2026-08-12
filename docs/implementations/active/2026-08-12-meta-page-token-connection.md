# Correção de token de Página no Lead Ads

## Entrega

O fluxo de Marketing em `/integrations/meta` agora resolve o token da Página
explicitamente selecionada pelo Diretor antes de assinar o evento `leadgen`.
O token é cifrado em `meta_pages` e nunca retorna para o navegador.

## Segurança e escopo

- O tenant e o Diretor continuam derivados da sessão no servidor.
- A resolução consulta somente os ativos autorizados pelo token do próprio usuário
  Meta e seleciona estritamente o `pageId` confirmado.
- Não há fallback para token de outra Página.
- Assinatura, sincronização de formulários e leitura de leads usam o token cifrado
  da Página ativa correspondente.

## Validações

- Testes focados do Graph client, OAuth URL e ingestão de Lead Ads: 14 testes.
- `npm run agent:verify -- --level fast`: 322 testes e type-check aprovados.
- `npm run build`: aprovado.

## Rollback

Reverter o commit desta entrega restaura o fluxo anterior. Uma conexão já criada
sem token de Página deve ser desconectada e conectada novamente para receber a
credencial por Página.
