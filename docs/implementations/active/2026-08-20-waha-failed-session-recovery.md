# Recuperação de sessão WAHA em FAILED

**Data:** 2026-08-20
**Estado:** CRM publicado na Vercel; aguardando publicação do Fastify na VPS

## Objetivo

Recuperar de forma idempotente uma sessão WAHA de corretor que o provedor reporta
como `FAILED`, sem manter o CRM preso em erro ou criar múltiplas sessões.

## Escopo

- O Fastify centraliza `recoverFailedSession`, classifica `400` e `404` apenas nas
  operações de cleanup esperadas, confirma a ausência e recria/inicia a sessão.
- O endpoint autenticado `POST /internal/waha/connections/:id/recover` coalesce
  chamadas concorrentes pelo `sessionName` e registra operação, status e erro
  normalizado sem QR, token ou mensagem.
- A action e o diálogo do CRM usam a recuperação para `ERROR`, mantendo o nome de
  sessão determinístico e atualizando para QR novo ou conexão pronta.
- Uma desconexão explícita não limpa mais o vínculo local quando a VPS não
  confirma o cleanup; `204 No Content` do provedor é tratado como sucesso válido.

## Evidência

- A sessão real `waha_9a3bc8213a85c811` foi consultada via Fastify e retornou
  `ERROR`, correspondente ao `FAILED` do WAHA. Nenhuma mutação foi executada.
- `npm --prefix services/whatsapp-api run build` — aprovado.
- `npm --prefix services/whatsapp-api test` — 61 testes aprovados, incluindo
  `FAILED + stop 400`, `delete 404`, `204 No Content`, indisponibilidade de rede
  e dois cliques concorrentes com uma única recriação.
- `npm run type-check` — aprovado.
- `npm run agent:verify -- --level full` — documentação, escopo, arquitetura,
  segurança, desempenho e tipos aprovados. O lint global falha por mojibake
  preexistente em `src/features/platform-admin/purge-job.ts`; a suíte global tem
  uma falha preexistente em `meta-integration-view.test.tsx` por dois botões com o
  rótulo "Desconectar". Ambos estão fora deste escopo.

## Risco e rollback

O recovery só é acionado para a sessão autenticada do corretor e preserva o nome
determinístico. Rollback: retirar a action/endpoint de recovery; não há migration
nem alteração de inbound, outbound, webhook, Caddy ou credenciais.

Os diagnósticos de arquitetura e desempenho apontam o tamanho preexistente de
`services/whatsapp-api/src/app.ts` e do diálogo de conexão. A extração é trabalho
separado: esta correção foi mantida focalizada para não alterar o contrato de
mensagens nem o tratamento binário do QR.

## Publicação

- Commit: `362ea9b fix(waha): recuperar sessoes falhadas`.
- Vercel produção: `dpl_2mLq3heiD2h9jiJKgfshmZzqqxaa`, disponível em
  `https://crm.ancorasaude.cloud` (build Ready).
- A nova action do CRM depende do endpoint Fastify `/internal/waha/connections/:id/recover`;
  ele será utilizável somente depois de reconstruir e reiniciar o container
  `corretop-api` na VPS com este commit.
