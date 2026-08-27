# Performance e operação contínua na VPS

## Objetivo

Preparar o CRM auto-hospedado para responder com menor custo de atualização,
medir regressões sem guardar dados pessoais e ter uma substituição reversível
para os cron jobs da Vercel.

## Escopo entregue

- A telemetria de Web Vitals passa a aceitar somente métricas e rotas limitadas;
  a rota é reduzida ao primeiro segmento, sem IDs de lead, telefones ou query
  strings.
- O navegador envia cada métrica uma única vez por rota. O LCP é consolidado ao
  sair da página, evitando múltiplos `sendBeacon` para o mesmo carregamento.
- O shell não faz um segundo `router.refresh()` quando um workspace de
  conversas já trata o evento opaco de atualização. A sincronização em outras
  abas, o fallback de reconciliação e o isolamento por tenant continuam iguais.
- O health público passa a expor apenas agregados de métricas de frontend.
- O liveness do container fica separado da prontidão do banco em
  `/api/health/live`; o endpoint completo `/api/health` continua destinado a
  diagnóstico e alertas.
- O shell passa a buscar em paralelo a preferência de experiência, o pathname e
  a marca do tenant após autenticar a sessão. A rota `/conversas/broker` também
  executa em paralelo somente as leituras já autorizadas pelo tenant e corretor;
  o novo `loading.tsx` próprio mantém a estrutura da conversa visível durante a
  transição de rota.
- A infraestrutura recebe o serviço `scheduler`, desativado por padrão, que
  dispara os endpoints cron autenticados do CRM nos intervalos atuais.
- A lista operacional de Leads deixa de executar uma rotina de reparo com
  escrita no banco a cada abertura. A integridade continua validada no comando
  de mudança de etapa; a reconciliação em lote deve ser executada pelo fluxo
  operacional agendado, não pelo request do usuário. A rota também passa a
  consultar somente a página solicitada e consolida as configurações usadas
  nela em uma única leitura.
- A navegação agora reaproveita o contexto autenticado e de tenant dentro do
  mesmo render do React, sem compartilhar sessão, permissão ou dados entre
  requests. O layout também inicia as leituras independentes em paralelo.
- Dashboard passa a separar o shell autenticado da carga do conteúdo em uma
  fronteira de streaming; o modo leve e os checks independentes do workspace
  são executados em paralelo. A paginação de leads deixa de solicitar um
  `router.refresh()` adicional depois da navegação e pré-carrega as páginas
  adjacentes ao foco do usuário.
- A telemetria passa a registrar `route_navigation`, medindo do clique no link
  interno até a troca de rota, sempre reduzindo o caminho ao primeiro segmento
  e sem registrar query string ou identificadores. O refresh por revisão de
  leads na montagem foi removido: a resposta Server Component já é atual e a
  revisão continua sendo consumida para não reaplicar eventos antigos.
- A imagem Docker define `DB_POOL_MAX=2` para o processo Next persistente da
  VPS. O Coolify pode reduzir ou elevar esse valor explicitamente; aumentos
  acima de dois exigem medir a capacidade disponível no pooler do Supabase.
- As operações em lote de Leads agora retornam um contrato de conclusão com
  `mutationId`, IDs já autorizados e o campo alterado. A lista aplica o patch
  local imediatamente, limpa a seleção e fecha o diálogo; o estado persistido
  continua sendo reconciliado pela próxima leitura Server Component.
- O diálogo de exclusão deixa de depender de uma exceção de redirecionamento da
  Server Action. Ele recebe uma conclusão explícita, volta de `Excluindo...`,
  fecha e só então navega para a lista.
- A invalidação de `leads` é emitida após o commit para os papéis elegíveis da
  unidade e corretor responsável. O sinal é opaco e não contém PII.
- A criação manual, reatribuição e assunção de Leads agora devolvem um resultado
  identificável, encerram cada estado de ação uma única vez e atualizam a
  superfície de origem sem esperar um `router.refresh()`. A criação navega para
  o recurso confirmado; o drawer encerra após o commit e o painel de supervisão
  preserva o refresh apenas para reconciliar o detalhe já aberto.

## Decisão operacional

Há sempre um único agendador ativo por ambiente. Enquanto a Vercel Cron estiver
ativa, `SCHEDULER_ENABLED` deve ficar em `false`. O corte é: validar o container
desativado, desligar todos os cron jobs da Vercel, ativar o scheduler e observar
uma janela completa. O rollback faz a ordem inversa.

O scheduler não processa WhatsApp, Meta, banco ou filas diretamente. Ele usa os
endpoints já idempotentes do CRM com `CRON_SECRET`; logs incluem apenas nome do
job, status HTTP e duração.

## Arquivos

- `src/components/providers/performance-monitor.tsx`
- `src/app/api/internal/performance/route.ts`
- `src/shared/observability/metrics.ts`
- `src/components/providers/realtime-sync-provider.tsx`
- `src/app/(dashboard)/layout.tsx`
- `src/app/(dashboard)/conversas/broker/page.tsx`
- `src/app/(dashboard)/conversas/broker/loading.tsx`
- `src/app/(dashboard)/leads/page.tsx`
- `src/app/(dashboard)/leads/leads-workspace.tsx`
- `src/app/(dashboard)/leads/status-actions.ts`
- `src/app/(dashboard)/leads/actions.ts`
- `src/app/(dashboard)/leads/[id]/delete-lead-control.tsx`
- `src/app/(dashboard)/leads/[id]/supervision-panel.tsx`
- `src/app/(dashboard)/leads/_components/lead-drawer-management-actions.tsx`
- `src/app/(dashboard)/leads/_components/manual-lead-form.tsx`
- `src/components/ui/bulk-reassign-dialog.tsx`
- `src/components/ui/bulk-status-dialog.tsx`
- `src/hooks/use-action-dialog-lifecycle.ts`
- `src/features/leads/publish-lead-invalidation.ts`
- `src/features/leads/manual-create.ts`
- `src/features/leads/management-actions.ts`
- `src/app/(dashboard)/leads/leads-data-table.tsx`
- `src/app/(dashboard)/leads/_components/leads-pagination.tsx`
- `src/app/(dashboard)/leads/_components/leads-live-sync.tsx`
- `src/app/(dashboard)/dashboard/page.tsx`
- `src/shared/auth/session.ts`
- `src/shared/auth/tenant-context.ts`
- `src/shared/db/client.ts`
- `Dockerfile`
- `corretop-infra/scheduler/*`
- `corretop-infra/infra/docker-compose.coolify.yml`

## Configuração pendente no Coolify

No recurso da CRM no Coolify, configurar o healthcheck como
`GET http://localhost:3000/api/health/live`. No recurso da infraestrutura, criar `CRM_CRON_URL`, `CRON_SECRET` e
`SCHEDULER_ENABLED=true`. O valor de `CRON_SECRET` deve ser o mesmo do CRM.
Com a saída da Vercel concluída, o scheduler da VPS é responsável por recuperar
jobs e efeitos que não forem executados pelo `after()`.

## Validações

- `node --test scheduler/scheduler.test.js` — aprovado.
- `docker compose -f infra/docker-compose.coolify.yml config --quiet` —
  aprovado; apenas avisos esperados para segredos ausentes no ambiente local.
- A compilação do CRM deve ser confirmada pelo deploy do Coolify, pois o Docker
  local não está em execução neste computador. A regressão de exclusão cobre o
  contrato que mantém o diálogo tratável antes da navegação.

## Risco e rollback

As mudanças de telemetria são observacionais e podem ser revertidas sem tocar em
dados. Para realtime, reverter restaura somente o refresh duplicado. Para o
scheduler, manter a variável em `false` remove qualquer efeito; rollback do
corte reativa primeiro a Vercel e mantém o serviço VPS desativado.

## Continuação — 27/08/2026

- A reatribuição e a assunção no drawer de Leads atualizam a linha e o painel
  localmente no envio. Se o servidor recusar a transação, o snapshot anterior
  é restaurado e o diálogo volta a ficar utilizável.
- A confirmação da reatribuição grava o evento e o efeito de notificação na
  mesma transação do lead. A tentativa de entrega ocorre por `after()` depois
  da resposta; a outbox e o scheduler continuam responsáveis por retry.
- O roteamento manual para unidade não executa a distribuição nem a entrega do
  WhatsApp na requisição do usuário: ele confirma a mudança de unidade, enfileira
  o job e atualiza a origem localmente.
- A inbox de distribuição também mantém sua própria cópia otimista: ações por
  linha e em lote atualizam/removem o lead elegível antes do refresh de
  reconciliação. Atribuição, roteamento e distribuição automática compartilham
  a mesma resposta com `mutationId`, invalidação privada e execução posterior
  do processador/outbox.
- Convites de equipe, reenvio de convite, ofertas e o botão manual de aviso de
  lead deixam de aguardar o provedor Meta. A interface informa que o envio foi
  preparado/enfileirado; o status definitivo vem da outbox e do webhook.
- A regra não altera exclusões, permissões, dados sensíveis ou a autoridade do
  servidor. Toda mutação continua validando tenant e gravando a auditoria já
  prevista pelo domínio.
