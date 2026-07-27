# Infraestrutura de escala do CorreTop

## Objetivo

Preparar o sistema para a entrada concentrada de cinco unidades e crescimento
para milhares de corretores, mantendo isolamento entre tenants, respostas
previsiveis, processamento assincrono e diagnostico rapido de incidentes.

## O que foi implementado nesta etapa

### 1. Checkpoint de seguranca

- O estado anterior foi salvo no branch `agent/infra-foundation`.
- Commit de checkpoint: `8aecaf8`.
- O branch foi enviado para `origin/agent/infra-foundation` antes das alteracoes.

### 2. Preparacao para Supabase

- `SUPABASE_DB_URL` agora tem prioridade sobre `DATABASE_URL`.
- A conexao atual continua usando o cliente Drizzle existente, evitando uma
  troca abrupta de driver e preservando as rotas que ja funcionam.
- O pooler do Supabase pode ser configurado como a URL server-only sem expor
  credenciais no navegador.

### 3. Contexto RLS multi-tenant

- `withTenantTransaction()` define `app.current_tenant_id` e
  `app.current_user_id` com `set_config(..., true)` dentro da transacao.
- A migration `drizzle/0001_scale_rls_foundation.sql` habilita e forca RLS
  nas tabelas que carregam `tenant_id`, com politica fail-closed.
- A politica nunca aceita `tenant_id` vindo do cliente; o contexto precisa vir
  da sessao confiavel do servidor.

Aplicacao segura: a migration RLS continua versionada, mas nao foi ativada com
`FORCE ROW LEVEL SECURITY`, porque o codigo legado ainda possui leituras diretas
com `getDatabase()`. Ativa-la antes de migrar todas as leituras para o helper
transacional poderia bloquear o runtime.

### 4. Request-id e logs estruturados

- O proxy gera ou preserva `x-request-id` por requisicao e devolve o valor na
  resposta.
- `request-context.ts` oferece contexto async para request, tenant e usuario.
- `logger.ts` grava JSON com timestamp, nivel, mensagem e contexto, pronto para
  ingestao em Sentry, Axiom ou outro agregador sem trocar chamadas de dominio.

### 5. Contrato de jobs

- `src/shared/infra/jobs.ts` centraliza nomes e envelope dos jobs de SLA,
  WhatsApp, PDF, integridade e reengajamento.
- O contrato exige id, momento do evento e escopo de tenant/usuario quando
  aplicavel. Isso prepara o adaptador Inngest sem espalhar strings e payloads
  inconsistentes pelo dominio.

### 6. Configuracao documentada de servicos

`.env.example` agora reserva variaveis server-only para Inngest, Sentry, Axiom e
Upstash. Nenhum segredo foi criado, exposto ou adicionado ao repositorio.

## Beneficios

- Uma falha de filtro de aplicacao nao deve abrir dados de outro tenant quando a
  camada RLS estiver aplicada.
- O tenant e o usuario ficam disponiveis no mesmo contexto transacional usado
  pelas politicas PostgreSQL.
- Logs podem responder qual tenant, usuario, requisicao e rota foram afetados.
- Jobs futuros terao idempotencia e observabilidade com um contrato unico.
- A migracao para Supabase pode ocorrer por configuracao, sem reescrever cada
  consulta ou trocar o driver durante a primeira etapa.

## Plano de implementacao por fases

### Fase 0 - concluida

- Checkpoint Git e branch remoto.
- Compatibilidade de conexao Supabase.
- Request-id, logger, contrato de jobs e helper transacional.
- Migration RLS versionada.

### Fase 1 - parcialmente concluida

- Configurar `SUPABASE_DB_URL` localmente apontando para o pooler Supabase.
- Resetar o schema vazio/parcial do projeto Supabase e reconstruir o schema atual
  com `drizzle-kit push` (22 tabelas publicas).
- Registrar baseline das 23 migrations historicas para manter `db:migrate`
  idempotente apesar do historico antigo nao conter a tabela `leads`.
- O `DATABASE_URL` da Vercel ainda precisa ser cadastrado manualmente como
  segredo; o ambiente Codex bloqueou o envio automatico dessa credencial.
- Migrar leituras e mutacoes tenant-sensitive para `withTenantTransaction()`.
- Executar a migration em staging e validar isolamento com dois tenants.
- Criar testes automatizados que tentem ler e gravar dados cruzados.

### Fase 2 - processamento e protecao

- Adicionar o adaptador oficial do Inngest, apos autorizacao para instalar a
  dependencia, e mover SLA/WhatsApp/PDF para jobs idempotentes.
- Ativar rate limiting distribuido no webhook com Upstash.
- Criar tabela de feature flags por tenant e resolver flags no servidor.

### Fase 3 - confiabilidade

- Integrar Sentry e destino de logs estruturados.
- Criar dashboards de latencia, erros, jobs e volume por tenant.
- Executar teste k6 em staging com perfil de 100-300 usuarios simultaneos,
  burst de webhook e concorrencia de status.

## Operacao segura

- Nunca colocar `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, tokens de Inngest,
  Axiom, Sentry ou Upstash em `NEXT_PUBLIC_*`.
- Nunca executar a migration RLS em producao sem validar o fluxo transacional em
  staging; `FORCE ROW LEVEL SECURITY` pode bloquear consultas legadas.
- Toda rotina em background precisa transportar tenant, idempotency key e
  request-id quando houver uma requisicao de origem.
- Toda alteracao de schema deve vir com migration reversivel ou plano de rollback.

## Integracao Supabase adicionada

- Dependencias instaladas: `@supabase/supabase-js` e `@supabase/ssr`.
- `src/utils/supabase/server.ts` cria o client SSR usando cookies do Next.
- `src/utils/supabase/client.ts` cria o client para componentes/browser.
- `src/utils/supabase/middleware.ts` atualiza a sessao Supabase no proxy quando
  houver cookies Supabase validos.
- `src/proxy.ts` preserva os cookies renovados e continua usando BetterAuth para
  autenticar e redirecionar usuarios do CorreTop.

Essa separacao permite adotar Realtime, Storage e Auth do Supabase gradualmente
sem trocar a autoridade de acesso atual ou quebrar as rotas existentes.
