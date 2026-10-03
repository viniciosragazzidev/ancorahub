# Meta Marketing: abortar sync do tenant no rate limit

- Escopo: `meta-graph-client.ts` identifica códigos 4, 17, 32 e 613; `meta-sync-service.ts` propaga esses erros até o catch do tenant, grava `metaSyncLogs.status = error` e emite uma linha de log. O cron continua seu loop de tenants.
- Decisão: preservar a leitura de adSets por campanha; a equivalência do filtro na rota da conta não está validada.
- Validação: `vitest` focado (2 arquivos, 10 testes), `tsc --noEmit` e ESLint focado passaram. `agent:context` falhou com `uv_os_get_passwd ENOMEM`; build e harness completo não foram executados por causa do escopo de testes solicitado.
- Rollback: restaurar as alterações nos arquivos do módulo Meta desta correção.
