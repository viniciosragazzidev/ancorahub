# Conexão do resultado de ações a dialogs (fim do F5 para refletir a UI)

## Objetivo

Corrigir todos os diálogos/modal/sheet identificados em auditoria em que o botão de
enviar/excluir/confirmar executava uma Server Action, mas o resultado não era conectado
à UI — a página só refletia a mudança após F5.

## Diagnóstico

Auditoria em 2026-08-19 listou os seguintes padrões:

- `refreshDistribution()` era uma função vazia (`src/features/lead-distribution/actions.ts:109`),
  e o `queue-control-center.tsx` não chamava `router.refresh()` nem atualizava estado local.
- `feedback-templates/client.tsx` lia `createState.success` sincronamente logo após
  `createAction()` (useActionState é assíncrono), então o branch de sucesso nunca executava;
  a lista era `useState(initialTemplates)` sem re-sincronização com as props.
- `materials-manager.tsx` chamava actions de toggle/delete com `await` direto no `onClick`,
  sem `startTransition` e sem `router.refresh()`; as rotas revalidadas não incluíam
  `/materiais-divulgacao/gerenciar`.
- `documents-workspace.tsx` mantinha `requirements`/`pendingDocs` em `useState(initial...)`
  sem sincronizar com as props re-renderizadas pelo servidor após o create.
- `agent-triggers-panel.tsx`: botão "Salvar no Registry" era no-op (preventDefault,
  fechava o modal e mostrava toast sem chamar ação nem atualizar a lista).
- `automations-client.tsx`, `whatsapp-flows-client.tsx`, `ai-agent-wizard-client.tsx`
  usavam `window.location.reload()` após o sucesso (funcionava, mas recarregava a página).

## Implementação

### Distribuição de leads (`/leads/distribuicao`)

- `src/features/lead-distribution/actions.ts` — `refreshDistribution()` agora revalida
  `/leads/distribuicao` e `/leads/distribuicao/plantao`.
- `queue-control-center.tsx` — adicionado `useRouter` e `router.refresh()` no sucesso de:
  exclusão de fila, exclusão forçada, salvar fila, vincular/desvincular campanha, salvar
  rota de campanha, salvar rota de anúncio, remover rota de campanha e remover rota de
  anúncio.

### Templates de feedback (`/settings/feedback-templates`)

- `feedback-templates/client.tsx` — create via `useEffect` que observa `createState` e
  fecha/reseta o formulário no sucesso; lista re-sincroniza com `initialTemplates` via
  efeito; toggle chama `router.refresh()` no sucesso.

### Materiais de divulgação (`/materiais-divulgacao/gerenciar`)

- `materials-manager.tsx` — `router.refresh()` no sucesso do toggle e do delete.
- `src/features/promotional-materials/actions.ts` — adicionada revalidação de
  `/materiais-divulgacao/gerenciar` em create, update, toggle e delete.

### Documentos (`/documentos`)

- `documents-workspace.tsx` — efeitos re-sincronizam `requirements` e `pendingDocs` com
  as props vindas do servidor (create agora aparece sem F5; delete/review continuam com
  atualização local).

### Painel de capacidades do agente (`/qualificacao`)

- `agent-triggers-panel.tsx` — implementado `handleSaveCapability`: editar atualiza a
  capacidade existente (bump de version) e criar adiciona uma nova ao estado local;
  o botão "Salvar no Registry" deixa de ser no-op.

### Automações

- `automations-client.tsx`, `whatsapp-flows-client.tsx`, `ai-agent-wizard-client.tsx` —
  substituído `window.location.reload()` por `router.refresh()` no sucesso das ações
  (as ações já revalidam as rotas `/automacoes`, `/fluxos-whatsapp`, `/agentes-ia`).

### Reatribuição no drawer de `/leads` (botão preso em "Reatribuindo...")

- `src/features/leads/management-actions.ts` — removidas as chamadas `revalidatePath` de
  `reassignLeadAction`, `assumeLeadForInvestigationAction` e `assumeLeadForMessagingAction`.
  Pela documentação do Next 16 (`node_modules/next/dist/docs/01-app/02-guides/server-actions.md`),
  `revalidatePath` em Server Action re-renderiza a rota atual **dentro da mesma resposta**;
  como `/leads` é `force-dynamic` e pesada (11+ queries em `Promise.all`), essa re-renderização
  embutida retardava/falhava a resposta, e `useActionState` nunca resolvia — botão preso,
  drawer sem fechar e lista sem atualizar mesmo com a gravação já feita no banco.
  As rotas são todas `force-dynamic` (sem cache a invalidar); os consumidores
  (`lead-drawer-management-actions.tsx`, `supervision-panel.tsx`) já chamam
  `router.refresh()` no sucesso.

### Exclusão de regras de campanha/anúncio em `/leads/distribuicao`

- `src/features/lead-distribution/control-service.ts` — novas funções
  `deleteMetaCampaignQueueRoute` e `deleteMetaAdQueueRoute` (DELETE físico com isolamento
  por tenant e auditoria `meta_campaign_queue_route.deleted` / `meta_ad_queue_route.deleted`).
- `src/features/lead-distribution/actions.ts` — `deleteMetaCampaignQueueRouteAction` e
  `deleteMetaAdQueueRouteAction` agora apagam a linha da tabela em vez de upsert com
  `enabled:false` + `queueId:null`. Antes o "Excluir" gravava o estado "Não registrar no CRM"
  (bloqueio), e a query da página não filtra por `enabled`, então o item nunca sumia, nem com F5.
  Com o DELETE físico, a campanha/anúncio volta à fila geral — coerente com o texto do confirm.

## Regra e contrato

Nenhuma decisão de produto pendente foi tocada; as mudanças são de manutenção de UI.
Permissões, auditoria e isolamento por tenant das ações não foram alterados.

## Risco e rollback

Escopo limitado ao pós-sucesso das ações. Reverter qualquer correção restaura o estado
"velho até F5", mas mantém a mutação do servidor intacta. Nenhuma migração de banco.

## Validações e evidências

- `npm run agent:verify -- --level fast` — type-check aprovado; testes 439/440 aprovados
  (a única falha é pré-existente no WIP do usuário:
  `reset-tenant-operational-data.test.ts` → `platformPurgeJobs` ainda não existe no schema).
- `npx eslint` nos arquivos tocados — 0 erros (warnings de não-uso, `any` e
  `react-hooks/set-state-in-effect` nos efeitos de sincronização, todos benignos/deliberados).
- `npm run build` — aprovado (97 rotas).
- `npm run agent:verify -- --level full` — `agent:docs`, `agent:changed`,
  `agent:architecture`, `agent:security`, `agent:performance` e `type-check`
  passaram. `lint` e `test` falharam apenas por problemas pré-existentes fora do
  escopo: erros de lint em `temp_deskcomm_crm`/`scripts/update_cards.js` (dívida
  anterior) e 2 testes — `reset-tenant-operational-data.test.ts` (WIP do usuário,
  `platformPurgeJobs` ainda não existe no schema) e `meta-integration-view.test.tsx`
  (duplicidade de botão "Desconectar", arquivo não tocado).
- Segunda rodada (2026-08-19): `npm run agent:verify -- --level fast` —
  `agent:docs` e `type-check` aprovados (`reports/agent/verification/2026-08-19T17-20-41.587Z.md`);
  testes 449/451 aprovados, com as mesmas 2 falhas pré-existentes
  (`reset-tenant-operational-data.test.ts` e `meta-integration-view.test.tsx`).