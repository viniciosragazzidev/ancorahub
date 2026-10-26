# Quedas em todas as rotas: EMAXCONNSESSION (26/10/2026)

## Sintoma

Rotas do CRM (`/leads`, `/distribuicao` e outras) caíam do nada com "An error occurred in the Server
Components render". Log do Coolify: `(EMAXCONNSESSION) max clients reached in session mode - max clients
are limited to pool_size: 30`.

## Diagnóstico

- Supabase (`pg_stat_activity`): o Supavisor segurava 31 conexões, todas `idle`, com o pool de sessão cheio.
- VPS (`/proc/net/tcp` por container): o container do CRM tinha **18** conexões na 5432; WAHA e demais
  serviços, 0. O esperado era no máximo 7 (4 de páginas + 3 de jobs).
- Causa: o build de produção inclui `src/shared/db/client.ts` em mais de um bundle (o build local com
  webpack tem 3 cópias: dois chunks do servidor e o middleware). Os pools ficavam em `let` no módulo,
  então cada cópia abria o próprio pool. Cada push no `feat/diretor-visual-lite` dispara deploy no Coolify,
  e o container novo subia ao lado do antigo: 2 x 18 passa de 30 e o pooler recusa todo mundo.

## Correção

- `client.ts`: pools de páginas e de jobs guardados em `globalThis[Symbol.for("ancorahub.db.pools")]`,
  um par por processo, qualquer que seja a cópia do módulo.
- `background-pool.ts`: o `AsyncLocalStorage` do escopo de jobs também é um por processo, para a rota que
  abre o escopo valer no `getDatabase()` de outra cópia.
- `process-pools.test.ts`: carrega o módulo duas vezes (`vi.resetModules`) e exige o mesmo pool; falha no
  código antigo e passa no novo.

## Validação

- `npx tsc --noEmit -p .`, ESLint de `src/shared/db` e Vitest (22 arquivos, 106 testes) sem erro.
- Depois do deploy: conferir no terminal da VPS que o container do CRM fica em até 7 conexões na 5432.

## Pendente fora do código

- Supabase: Egress em 141% da cota (351 de 250 GB) no ciclo 12/10 a 12/11; carência até 24/11, depois disso
  o projeto pode responder 402. Precisa de investigação própria.
