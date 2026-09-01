# Diagnóstico temporário de performance em produção

**Data:** 2026-08-28
**Estado:** em validação operacional

## Objetivo

Medir, sem alterar o comportamento do CRM, onde o tempo de `/leads` e
`/api/internal/unread-count` é gasto na VPS antes de qualquer otimização de
pool, cache, Redis, índices ou infraestrutura.

## Cobertura instrumentada

- `middleware.total` no proxy, com o mesmo `x-request-id` propagado pelo proxy.
- `auth.session` (Better Auth), `tenant.resolve`, `access_context.resolve` e
  `rbac.resolve` quando o contexto é carregado.
- `/leads`: autorização, bootstrap, elegibilidade de campanha, contagem,
  lista, planos, filiais, SLA, corretores, qualificações, filas e lead urgente.
- `/api/internal/unread-count`: contexto autenticado, lista recente e cada
  contagem usada pela interface.
- Ações de gestão de lead que retornam `POST /leads`: reatribuição, assumir
  investigação e assumir atendimento recebem `server_action.total` com o nome
  lógico da ação.
- O cliente `postgres.js` contabiliza statements emitidos e formas únicas por
  request. Ele descarta o SQL após criar um hash local; não há logs de texto,
  parâmetros ou dados pessoais.

## Ativação e volume

Definir temporariamente no ambiente de produção:

```text
PERF_DIAGNOSTICS=true
PERF_DIAGNOSTICS_SAMPLE_RATE=1
```

Para reduzir volume após a primeira coleta, usar uma fração entre `0` e `1`,
por exemplo `0.2`. Ao remover ou definir `PERF_DIAGNOSTICS=false`, os spans não
emitirão logs e as funções somente executam o callback original.

## Leitura de um trace

Todos os eventos seguem o contrato:

```json
{"type":"perf_span","requestId":"...","route":"/leads","span":"leads.list","durationMs":123}
```

Agrupar por `requestId`. `parallel: true` indica que o bloco iniciou enquanto
outro bloco daquela request ainda estava pendente. O `request.total` traz
`dbQueryCount` e `dbQueryShapes`; eles servem para detectar fan-out e possíveis
duplicações, não identificam pessoas, tenant ou conteúdo de consultas.

## Auditoria de configuração atual

O evento único `db_config` passou a registrar, sem URL ou credenciais: driver,
hostname, pool max efetivo, prepare, connect timeout, idle timeout, lifetime e
statement timeout. A configuração continua singleton por processo,
`postgres.js`, `prepare: false`, `DB_POOL_MAX=2` quando configurado e SSL
derivado da URL Supabase. Este trabalho não altera nenhum desses parâmetros.

## Limitação conhecida e próximo gate

O hook `debug` do `postgres.js` informa o momento de emissão, não o término de
cada statement; por isso tempos de SQL são medidos nos blocos lógicos acima e
o hook central fornece apenas quantidade/formas. Depois de capturar pelo menos
uma navegação e uma Server Action reais, decidir com evidência se o próximo
passo é query/índice, repetição de auth/RBAC, serialização no pool, proxy ou
rede. Não aplicar otimização antes desse trace.

## Rollback

Definir `PERF_DIAGNOSTICS=false` ou remover as duas variáveis. Não há migração,
mudança de regra de negócio, cache, pool, Redis ou alteração de dados.
