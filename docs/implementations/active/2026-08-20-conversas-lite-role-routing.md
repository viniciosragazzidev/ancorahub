# Isolamento da central de conversas e modo Lite

**Data:** 2026-08-20
**Estado:** implementado; validação final pendente

## Objetivo

Manter a central operacional completa em `/conversas` para Diretor e Gestor. O
atendimento Lite conectado ao WAHA fica disponível somente ao Corretor cujo modo de
experiência resolvido no servidor é `LIGHT`, em `/conversas/broker`.

## Escopo

- `src/app/(dashboard)/conversas/page.tsx`: redireciona apenas o Corretor Lite para
  a rota Lite, preservando `leadId` e mantendo os demais papéis na central existente.
- `src/app/(dashboard)/conversas/broker/page.tsx`: rejeita no servidor Diretor,
  Gestor e Corretor em modo normal, redirecionando-os para `/conversas`.

## Decisões e contrato

- Confirmação do solicitante: Diretor e Gestor usam a experiência antiga; somente
  Corretor Lite usa WAHA em `/conversas/broker`.
- A decisão usa `getExperienceMode(context)`, que deriva papel e preferência de um
  contexto autenticado no servidor; nenhum modo ou papel do navegador é autoridade.
- Não há mudança de dados, schema, integração externa ou regra de negócio nova.

## Evolução do atendimento Lite

- `/conversas/broker` segue o blueprint `CHAT_PAGE`: lista pesquisável de conversas,
  conversa ativa, ação para abrir o lead e retorno responsivo para a lista em telas
  estreitas.
- A seleção fica em `?leadId=`, de forma que o corretor pode retornar à conversa
  correta sem usar estado implícito do navegador.
- O diálogo `Conexão WAHA` disponibiliza a ação explícita de **Desconectar** para a
  própria sessão autenticada do corretor; não há ação para sessões de terceiros.
- Eventos de conexões de corretor não dependem de `feature_waha_cadence_enabled`.
  A cadência continua sob seu kill switch; a conversa humana respeita apenas o
  kill switch de conexões WAHA. Após persistir mensagem ou estado da sessão, o CRM
  publica uma invalidação `conversations` dirigida somente ao corretor dono da sessão.
  O sinal não contém telefone, nome ou mensagem.

## Validações

- `npx eslint src/app/(dashboard)/conversas/page.tsx src/app/(dashboard)/conversas/broker/page.tsx` — executado no recorte.
- `npm run type-check` — aprovado.
- `npx vitest run src/features/broker-workspace/experience-mode.test.ts --reporter=verbose` — 1 teste aprovado.
- `npm run agent:verify -- --level full` — documentação, arquivos alterados,
  arquitetura, segurança, performance e type-check aprovados; evidência em
  `reports/agent/verification/2026-08-20T17-47-26.694Z.md`.
- A verificação global mantém falhas fora do recorte: mojibake em
  `src/features/platform-admin/purge-job.ts` e o teste de desconexão Meta Ads em
  `src/features/meta-ads/components/meta-integration-view.test.tsx`.
- `npm run build` — iniciado, completou o empacotamento da extensão e chegou a
  `Creating an optimized production build`; o processo local encerrou antes do
  artefato final do Next, portanto não é evidência de build aprovado.

## Risco e rollback

O risco está limitado ao redirecionamento de rota. O rollback é reverter os dois
guards de modo, sem dados persistidos ou mensagens reenviadas.
