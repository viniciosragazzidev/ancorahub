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
- A infraestrutura recebe o serviço `scheduler`, desativado por padrão, que
  dispara os endpoints cron autenticados do CRM nos intervalos atuais.

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
- `corretop-infra/scheduler/*`
- `corretop-infra/infra/docker-compose.coolify.yml`

## Configuração pendente no Coolify

No recurso da infraestrutura, criar `CRM_CRON_URL`, `CRON_SECRET` e
`SCHEDULER_ENABLED=false`. O valor de `CRON_SECRET` deve ser o mesmo do CRM.
Não ativar o scheduler até a remoção explícita dos cron jobs na Vercel.

## Validações

- `node --test scheduler/scheduler.test.js` — aprovado.
- `docker compose -f infra/docker-compose.coolify.yml config --quiet` —
  aprovado; apenas avisos esperados para segredos ausentes no ambiente local.
- A compilação do CRM deve ser confirmada pelo deploy do Coolify, pois o Docker
  local não está em execução neste computador.

## Risco e rollback

As mudanças de telemetria são observacionais e podem ser revertidas sem tocar em
dados. Para realtime, reverter restaura somente o refresh duplicado. Para o
scheduler, manter a variável em `false` remove qualquer efeito; rollback do
corte reativa primeiro a Vercel e mantém o serviço VPS desativado.
