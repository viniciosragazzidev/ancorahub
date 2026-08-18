# Runbook — CorreTop CRM Incident Response

**Versão:** 1.0
**Data:** 2026-08-18
**Última atualização:** Onda 5

---

## DIAGNÓSTICO RÁPIDO

### Fluxo de Decisão

```
Problema reportado
    ↓
Todas as rotas lentas?
    ├── SIM → Auth / Tenant / DB Pool / Middleware
    └── NÃO → Uma rota lenta?
                ├── SIM → Query local / Payload / Dependência externa
                └── NÃO → Só frontend lento?
                            ├── SIM → Bundle / Hidratação / Realtime
                            └── NÃO → Verificar error boundaries
```

### Verificar Health Matrix

```bash
curl -s https://crm.ancorasaude.cloud/api/health | jq .
```

Resposta esperada:
```json
{
  "status": "HEALTHY",
  "dependencies": [
    {"name": "database", "status": "HEALTHY", "avgDurationMs": 45}
  ],
  "performance": {
    "api": {"p95": 800, "errorRate": 0.3},
    "db": {"p95": 120, "errors": 0}
  }
}
```

### Verificar Logs de Performance

Procure no log do Vercel por:
- `{"type":"request_timing",...}` — requests lentos
- `{"type":"slow_request",...}` — requests acima do threshold
- `{"type":"middleware_timing",...}` — middleware lento
- `{"type":"auth_timeout",...}` — auth travando
- `{"type":"tenant_timeout",...}` — tenant query travando
- `{"type":"db_config",...}` — configuração do pool (1x por instância)

---

## CENÁRIO 1: TODAS AS ROTAS LENTAS

### Causas Prováveis
1. DB connection pool saturado
2. Auth ou tenant query travando
3. Middleware fazendo query lenta

### Passos
1. Verificar health matrix: `GET /api/health`
2. Olhar `db_acquire` nos logs — se elevado, pool está saturado
3. Olhar `auth_ms` nos logs — se > 3s, auth está lento
4. Olhar `tenant_ms` nos logs — se > 3s, tenant query está lenta

### Soluções
- **Pool saturado:** Considerar aumentar `DB_POOL_MAX` de 3 para 5
- **Auth lento:** Verificar Better Auth / banco de dados do auth
- **Tenant query lenta:** Verificar índices em `tenant_memberships`, `user_onboarding`

---

## CENÁRIO 2: UMA ROTA LENTA

### Causas Prováveis
1. Query sem índice na tabela correspondente
2. Payload muito grande (SELECT *)
3. N+1 queries
4. Dependência externa bloqueando

### Passos
1. Identificar a rota nos logs `request_timing`
2. Verificar `db_ms` — se alto, query precisa de otimização
3. Verificar `auth_ms` e `tenant_ms` — se normais, problema é na query local
4. Verificar se a rota usa Promise.all com dependência externa

### Soluções
- **Query lenta:** Adicionar índice ou usar SELECT explícito
- **Payload grande:** Reduzir campos selecionados
- **N+1:** Substituir por query agregada ou batch

---

## CENÁRIO 3: LOADING INFINITO EM UMA PÁGINA

### Causas Prováveis
1. Server Component travada em await
2. Error boundary não existe
3. Suspense boundary muito amplo
4. useActionState com estado preso

### Passos
1. Verificar se a rota tem `error.tsx`
2. Verificar se o LoadingWatchdog está ativo
3. Verificar console do browser por erros
4. Verificar Network tab por requests pendentes

### Soluções
- **Server Component travada:** Implementar timeout (Onda 1)
- **Sem error boundary:** Criar `error.tsx` na rota
- **Suspense global:** Dividir em boundaries menores
- **Estado preso:** Usar `key={open ? "open" : "closed"}` no dialog

---

## CENÁRIO 4: META / OPENROUTER / WHATSAPP DOWN

### Efeito Esperado (pós-Onda 4)
- Apenas a área dependente fica DEGRADED
- CRM continua navegável
- Mensagem "Dados temporariamente indisponíveis" aparece no card afetado

### Passos
1. Verificar health matrix — qual dependência está DOWN?
2. Verificar se o CRM continua funcionando para outras áreas
3. Monitorar se a dependência recupera

### Soluções
- **Meta down:** Não há o que fazer no CRM — esperar恢复
- **OpenRouter down:** Qualificação manual continua funcionando
- **WhatsApp down:** Envio fica pendente, CRM funciona

---

## CENÁRIO 5: MEMÓRIA CRESCENDO (MEMORY LEAK)

### Causas Prováveis
1. setInterval sem clearInterval
2. Realtime subscription sem cleanup
3. Event listeners não removidos
4. Providers recriando valor a cada render

### Passos
1. Verificar se há setInterval/setTimeout sem cleanup
2. Verificar subscriptions Realtime no component
3. Verificar se provider value é memoizado

### Soluções
- **Timer:** Adicionar cleanup no useEffect return
- **Subscription:** Adicionar unsubscribe no cleanup
- **Provider:** Usar useMemo no value

---

## CENÁRIO 6: RETRY STORM

### Sintomas
- Logs mostram dezenas de requests para o mesmo endpoint
- DB queries aumentando exponencialmente
- Serviço externo com 429

### Passos
1. Verificar taxa de erro no health matrix
2. Verificar se há retry automático sem limite
3. Verificar se há polling + refetch + retry ao mesmo tempo

### Soluções
- **Retry infinito:** Limitar a 3 tentativas com backoff exponencial
- **Polling + retry:** Aumentar staleTime ou reduzir polling
- **Fetch duplicado:** Verificar se componente está montando/desmontando

---

## ALERTAS INICIAIS

| Métrica | Warning | Critical | Ação |
|---|---|---|---|
| API p95 | > 1.5s | > 3s | Investigar rota mais lenta |
| API error rate | > 1% | > 3% | Verificar logs de erro |
| DB acquire p95 | > 500ms | > 1s | Pool saturado |
| DB query p95 | > 1s | > 3s | Query precisa de índice |
| Auth timeout | > 0.1% | > 1% | Better Auth lento |
| Timeout total | > 0.5% | > 5% | Dependência bloqueando |
| TTFB | > 1s | > 3s | Backend lento |
| LCP | > 4s | > 6s | Bundle ou render lento |

---

## CHECKLIST DE INCIDENTE

Quando um incidente é reportado:

- [ ] 1. Verificar health matrix (`/api/health`)
- [ ] 2. Verificar se é global (todas rotas) ou local (uma rota)
- [ ] 3. Identificar componente afetado (auth/DB/external/frontend)
- [ ] 4. Verificar logs de `request_timing` e `slow_request`
- [ ] 5. Classificar: P0 (global down) / P1 (rota crítica) / P2 (rota secundária) / P3 (cosmético)
- [ ] 6. Aplicar fix do cenário correspondente
- [ ] 7. Verificar se problema persiste
- [ ] 8. Documentar: causa, fix, antes/depois
- [ ] 9. Atualizar este runbook se necessário

---

## DEFINIÇÃO DE CAPACIDADE

| Modo | Capacidade Segura | Breakpoint |
|---|---|---|
| Corretor Light | 80-120 usuários | 150-200 |
| Gestor | 40-60 usuários | 80-120 |
| Diretor | 20-30 usuários | 30-50 |

**Nota:** Estas são estimativas baseadas na configuração atual (pool=3, timeouts 5s, debounce 500ms). Devem ser validadas com load tests reais.

---

## TELEMETRIA DISPONÍVEL

| Dado | Fonte | Retenção |
|---|---|---|
| Request timing | `request_timing` log | Últimos 500 |
| Slow requests | `slow_requests` ring buffer | Últimos 200 |
| API metrics | `api_metrics` ring buffer | Últimos 500 |
| DB metrics | `db_metrics` ring buffer | Últimos 500 |
| Health status | `/api/health` endpoint | Real-time |
| Frontend vitals | `/api/internal/performance` | Últimos 500 |
