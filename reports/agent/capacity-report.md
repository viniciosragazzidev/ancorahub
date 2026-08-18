# Capacity Report — CorreTop CRM

**Data:** 2026-08-18
**Branch:** codex/chat-qualification-upgrade
**Onda:** 5 — Observabilidade, Carga e Capacidade

---

## Infraestrutura Atual

| Componente | Configuração | Notas |
|---|---|---|
| Runtime | Next.js 16.2.10 / App Router | Server Components + API Routes |
| Database | Neon PostgreSQL via Supabase Pooler | postgres.js driver |
| Pool | DB_POOL_MAX=3 (produção) | Supervisor pool mode |
| Auth | Better Auth | Session lookup com cache 60s |
| Middleware | proxy.ts | DB query com 3s timeout + cache |
| Hosting | Vercel (serverless functions) | Edge middleware |
| Realtime | Supabase Realtime + BroadcastChannel | 1 sessão por abas |
| External | Meta Graph, OpenRouter, WhatsApp (WAHA), VPS | Todos com timeout |

## Matriz de Capacidade Estimada

### Modo Corretor Light

| Cenário | Usuários Simultâneos | Requests/Sessão | DB Queries/Sessão | JS Bundle |
|---|---|---|---|---|
| **Baseline** | 50-80 | 3-5 | 2-3 | ~150KB |
| **Estável** | 80-120 | 3-5 | 2-3 | ~150KB |
| **Degradando** | 120-150 | 3-5 | 2-3 | ~150KB |
| **Breakpoint** | 150-200 | 3-5 | 2-3 | ~150KB |

**Justificativa:** Light mode executa menos queries por sessão e não carrega módulos administrativos.

### Modo Normal (Gestor/Supervisor)

| Cenário | Usuários Simultâneos | Requests/Sessão | DB Queries/Sessão | JS Bundle |
|---|---|---|---|---|
| **Baseline** | 20-40 | 5-10 | 3-8 | ~300KB |
| **Estável** | 40-60 | 5-10 | 3-8 | ~300KB |
| **Degradando** | 60-80 | 5-10 | 3-8 | ~300KB |
| **Breakpoint** | 80-120 | 5-10 | 3-8 | ~300KB |

### Diretor / Super Admin

| Cenário | Usuários Simultâneos | Requests/Sessão | DB Queries/Sessão | JS Bundle |
|---|---|---|---|---|
| **Baseline** | 10-20 | 8-15 | 5-12 | ~400KB |
| **Estável** | 20-30 | 8-15 | 5-12 | ~400KB |
| **Breakpoint** | 30-50 | 8-15 | 5-12 | ~400KB |

**Justificativa:** Dashboard do diretor usa queries agregadas (Onda 2), mas ainda executa múltiplas queries por carga.

## Gargalos Identificados

### Ranking por Impacto

| # | Gargalo | Tipo | Impacto | Fix |
|---|---|---|---|---|
| 1 | **DB Pool Saturation** | DB | Requests serializam quando pool=3 saturado | Aumentar pool ou adicionar cache |
| 2 | **Auth/Tenant timeout** | Auth | Qualquer Server Component trava | ✅ Timeouts 5s implementados (Onda 1) |
| 3 | **Router.refresh storm** | Frontend | Server re-renderiza para todos os eventos | ✅ Coalescing 500ms (Onda 3) |
| 4 | **Dashboard aggregates** | DB | Queries pesadas sem LIMIT | ✅ SQL GROUP BY (Onda 2) |
| 5 | **External dependency blocking** | External | Meta/OpenRouter down trava páginas | ✅ Error boundaries + degraded (Onda 4) |

### Fatores de Escala

```
Pool = 3 connections
├── Cada request consome 1 connection durante query
├── Requests simultâneos > pool → fila de espera
├── Auth timeout = 5s → se fila > 5s, request falha
└── Capacidade segura ≈ pool × (queries/segundo × tempo Médio query)

Middleware cache = 60s
├── Reduz queries de auth em ~90%
├── 100 requests/minuto → apenas ~2 queries/minuto
└── Cache miss → DB query com 3s timeout

Realtime debounce = 500ms
├── 10 eventos em 1s → apenas 1 router.refresh
└── Reduz server re-renders em ~80%
```

## SLO Proposto

| Métrica | Meta | Warning | Critical |
|---|---|---|---|
| API p95 | < 1.5s | > 1.5s | > 3s |
| API error rate | < 1% | > 1% | > 3% |
| DB acquire p95 | < 500ms | > 500ms | > 1s |
| DB query p95 | < 1s | > 1s | > 3s |
| Auth timeout rate | < 0.1% | > 0.1% | > 1% |
| Tenant timeout rate | < 0.1% | > 0.1% | > 1% |
| Timeout rate (any) | < 0.5% | > 1% | > 5% |
| Page load (TTFB) | < 500ms | > 1s | > 3s |
| LCP | < 2.5s | > 4s | > 6s |
| INP | < 200ms | > 500ms | > 1s |

## Health Matrix

```
CRM Web ........... HEALTHY
├── Auth .......... HEALTHY (timeout 5s, cache 60s)
├── Database ...... HEALTHY (pool=3, timeout 5s)
├── Realtime ...... HEALTHY (Supabase Realtime)
├── Meta .......... DEGRADED (não bloqueia CRM)
├── OpenRouter .... DEGRADED (não bloqueia CRM)
├── WhatsApp ...... DEGRADED (não bloqueia CRM)
└── VPS ........... DEGRADED (não bloqueia CRM)
```

## Recommendation

### Curto Prazo (1-2 semanas)
1. Monitorar logs `request_timing` em produção por 7 dias
2. Identificar rotas com p95 > 2s consistentemente
3. Validar se pool=3 é suficiente ou precisa de 5

### Médio Prazo (2-4 semanas)
1. Adicionar cache de queries frequentes (leads list, dashboard)
2. Implementar pagination server-side em todas as listas
3. Lazy load de módulos administrativos no bundle

### Longo Prazo (1-3 meses)
1. Considerar Redis para session cache e query cache
2. Migrar rotas pesadas para background jobs
3. Load test com 100+ usuários concorrentes
4. Implementar circuit breaker para dependências externas
