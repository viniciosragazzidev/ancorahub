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

- Ao abrir a conversa de um lead pelo atalho de WhatsApp, a aplicação usa
  `?leadId=<id>&draft=broker_intro`. A rota valida no servidor que o lead pertence
  ao corretor autenticado e preenche uma mensagem editável; ela nunca é enviada
  automaticamente.
- O texto inicial vem de `broker_lite_opening_draft` quando configurado, aceita
  somente `{nome}` e usa uma saudação segura como fallback. O texto não é colocado
  na URL nem confiado ao navegador.
- `/conversas/broker` segue o blueprint `CHAT_PAGE`: lista pesquisável de conversas,
  conversa ativa, ação para abrir o lead e retorno responsivo para a lista em telas
  estreitas.
- A seleção fica em `?leadId=`, de forma que o corretor pode retornar à conversa
  correta sem usar estado implícito do navegador.
- O diálogo de conexão do WhatsApp disponibiliza a ação explícita de **Desconectar** para a
  própria sessão autenticada do corretor; não há ação para sessões de terceiros.
- Eventos de conexões de corretor não dependem de `feature_waha_cadence_enabled`.
  A cadência continua sob seu kill switch; a conversa humana respeita apenas o
  kill switch de conexões WAHA. Após persistir mensagem ou estado da sessão, o CRM
  publica uma invalidação `conversations` dirigida somente ao corretor dono da sessão.
  O sinal não contém telefone, nome ou mensagem.
- A barra inferior exclusiva do corretor Lite inclui **Conversas**, com destino direto
  a `/conversas/broker`; a barra não é montada para Diretor, Gestor ou modo normal.
- A desconexão de uma sessão WAHA faz `POST` sem corpo; o cliente VPS omite
  `Content-Type: application/json` nesse caso para o Fastify não rejeitar a requisição
  com `FST_ERR_CTP_EMPTY_JSON_BODY` antes de alcançar o WAHA.
- O provedor não aparece em rótulos, botões ou erros voltados ao usuário: a
  superfície usa somente “WhatsApp”. Identificadores técnicos, logs e contratos
  internos foram preservados para não alterar a integração.
- O contato oficial ativo do tenant, inclusive quando gerido pelo canal Meta, é
  incluído na carteira Lite sem criar um lead sintético. Suas mensagens são lidas e
  respondidas exclusivamente pela sessão autenticada do corretor; a ação valida
  tenant, canal ativo e conexão pronta no servidor e registra auditoria sem corpo.
- A tela Lite reage ao sinal de invalidação `conversations` e reconcilia a cada 30
  segundos enquanto estiver visível. Assim, uma mensagem persistida aparece sem
  recarregamento manual mesmo se o sinal em tempo real for perdido.
- A consulta de mensagens não depende de existir lead na carteira: conversas do
  número oficial continuam sendo carregadas para um corretor que ainda não recebeu
  nenhum lead.

## Validações

- `npx eslint src/app/(dashboard)/conversas/page.tsx src/app/(dashboard)/conversas/broker/page.tsx` — executado no recorte.
- `npm run type-check` — aprovado.
- `npx vitest run src/features/broker-workspace/experience-mode.test.ts --reporter=verbose` — 1 teste aprovado.
- `npx vitest run src/features/broker-workspace/official-tenant-conversations.test.ts --reporter=verbose` — mensagem do canal oficial Meta aparece como conversa autorizada.
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
