# Backoff da sincronização Meta

## Causa confirmada

Os registros de produção do tenant `d47a4d41…` mostram várias sincronizações completas com `User request limit reached`, apesar da conexão estar ativa e ter permissões `ads_read` e `leads_retrieval`. A tarefa do Coolify estava configurada para executar a cada 10 minutos, repetindo chamadas enquanto a Meta mantinha o limite ativo.

## Correção

- A sincronização automática passa a respeitar intervalo mínimo de uma hora após sucesso ou conclusão parcial.
- Após limite de chamadas da Meta, tentativas manuais e automáticas aguardam backoff progressivo de 1 a 6 horas conforme falhas consecutivas; nenhuma chamada Graph adicional é feita durante a espera.
- O feedback de sincronização informa quando a próxima tentativa será liberada, em horário de Brasília.
- O runbook recomenda cron horário; a proteção no serviço permanece efetiva enquanto a configuração externa do Coolify é atualizada.

## Arquivos

- `src/features/meta-ads/meta-sync-service.ts`
- `src/app/api/internal/jobs/meta-sync/route.ts`
- `docs/runbooks/coolify-scheduled-tasks.md`
- `src/features/roadmap/roadmap-data.ts`

## Verificação e operação

Os logs reais confirmaram a causa. `npm run type-check`, `npm run build` e `git diff --check` passaram. Não disparei nova chamada Graph durante o limite ativo. Evidência: `reports/agent/verification/2026-10-07-meta-sync-rate-limit-backoff.md`. A alteração do cron no Coolify é externa ao repositório; mesmo antes dela, o serviço evita novas chamadas dentro do intervalo e do backoff.

## Rollback

Reverter o backoff no serviço e a opção `scheduled` no job. Restaurar a frequência documentada caso a tarefa do Coolify também seja revertida.
