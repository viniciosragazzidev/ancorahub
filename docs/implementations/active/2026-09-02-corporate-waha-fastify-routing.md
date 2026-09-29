# Conexão do número corporativo WAHA pelo Fastify

## Objetivo

Corrigir somente o conector do número corporativo configurado por Diretor/Gestor.
Quando a VPS já está configurada para a conexão Lite dos corretores, esse conector usa
as mesmas rotas internas Fastify, sem alterar o código, a sessão ou o ciclo de vida da
conexão Lite.

## Decisão de compatibilidade

`VPS_API_URL` (e aliases compatíveis) tem precedência sobre o relay legado. Com esse
transporte, criação, leitura de status, QR e desconexão chamam diretamente
`/internal/waha/*`; a API Fastify não recebe mais uma tentativa especulativa em `/v1`.
`WAHA_RELAY_URL` permanece suportado somente quando não houver endpoint Fastify.

## Validação prevista

- teste unitário da seleção de transporte;
- testes da feature WAHA e type-check;
- build de produção;
- verificação de engenharia completa;
- homologação manual pelo Diretor sem interferir na conexão Lite de um corretor.

## Rollback

Reverter somente o commit deste registro restaura a seleção anterior. As sessões WAHA e
os registros de `wahaNumbers` não são modificados pela alteração de roteamento.
