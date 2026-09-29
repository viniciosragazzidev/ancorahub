# 2026-09-15 — Pareamento WAHA: falhas transitórias e diagnóstico de autenticação

## Sintoma

Durante a leitura do QR, o modal podia exibir repetidamente “servidor WhatsApp
temporariamente inacessível”, mesmo enquanto a sessão ainda estava em transição
para conectada. Quando o WAHA rejeitava a chave de API, o mesmo texto genérico
escondia a causa real.

## Correção

- O polling do modal mantém o estado de pareamento e contabiliza falhas
  transitórias sem disparar um toast a cada ciclo de 500 ms. Após falhas
  persistentes, mostra apenas um aviso espaçado e continua tentando.
- O Fastify preserva `WAHA_UNAUTHORIZED` e demais códigos normalizados nas rotas
  de status e QR, permitindo diferenciar credencial inválida de indisponibilidade
  de rede.
- As mensagens de configuração deixam de mencionar Vercel e apontam para o
  serviço de frontend no Coolify/VPS.

## Validação

- `services/whatsapp-api`: 78 testes aprovados.
- `npm run type-check`: aprovado.
- `npm run build`: aprovado (79 rotas).
- `npm run agent:verify -- --level full`: documentação, escopo e segurança
  aprovados; o harness registrou apenas achados preexistentes de arquitetura,
  desempenho e um teste Lite já falho fora deste escopo.

## Operação necessária

O serviço `services/whatsapp-api` precisa ser redeployado no Coolify para que as
rotas Fastify atualizadas estejam ativas. Depois, validar um pareamento real e
consultar o log estruturado `waha.connection.status`/`waha.connection.qr` sem
expor QR, telefone ou token.
