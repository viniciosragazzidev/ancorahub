# Migração do banco: Supabase para o Postgres da VPS

Virada marcada para **25/11/2026 às 22h**. Parada prevista: 10 a 15 minutos.

Nunca cole senhas, `DATABASE_URL` ou chaves em chat, print ou documento.

## O que já está pronto

| Item | Situação |
|---|---|
| App sem dependência do Supabase além do banco (avisos por canal próprio, proxy limpo, driver) | Em produção, commit `7d1d3e01` |
| Bucket `ancorahub-backups` no Cloudflare R2 e storage `R2 backups` no Coolify | Validado |
| Banco `ancorahub-db` no Coolify (imagem `pgvector/pgvector:pg17`, acesso privado) | Rodando |
| Backup agendado `0 6 * * *` (3h de Brasília), 14 cópias no R2 e 3 locais | Testado |
| Ensaio de cópia no banco `ancorahub_ensaio` | Passou: 235 tabelas, 361 migrations, cópia em cerca de 5 min |
| App enxerga o banco novo pela rede interna | Testado ("conectou") |

## Antes das 22h

1. **Backup do banco certo.** No `ancorahub-db`, em **Backups**, no campo **"Databases to backup"**, coloque `ancorahub`. Sem isso o backup salva só o banco vazio `postgres`.
2. **Guardar os endereços antigos**, para a volta atrás. Em **Environment Variables** do app do CRM:
   - crie `DATABASE_URL_SUPABASE_ANTIGO` com o valor atual de `DATABASE_URL`;
   - se existir `SUPABASE_DB_URL`, crie `SUPABASE_DB_URL_ANTIGO` com o valor atual dela.

   O app ignora essas duas variáveis: elas só guardam os valores antigos.
3. **Avisar a equipe:** o CRM fica fora do ar das 22h às 22h15. Mensagens de WhatsApp que chegarem nesse intervalo podem não aparecer no CRM, mas continuam no celular.

## Virada

### 1. Parar o app

No Coolify, abra o app do CRM e clique em **Stop**.

### 2. Copiar o banco

Rode no terminal do `ancorahub-db` (Coolify, `ancorahub-db`, **Terminal**, conectar no container).

Defina a origem. Cole o valor de `DATABASE_URL_SUPABASE_ANTIGO` entre as aspas simples. Se a porta for `6543`, troque para `5432`.

```bash
export SRC='COLE_AQUI_O_ENDERECO_DO_SUPABASE'
```

Para conferir sem mostrar a senha:

```bash
echo "$SRC" | sed 's#:[^:@]*@#:***@#'
```

Dump do Supabase. Leva uns 2 a 3 minutos e deve gerar cerca de 600 MB:

```bash
pg_dump "$SRC" -n public -n drizzle --no-owner --no-privileges --no-publications --no-subscriptions -Fc -f /tmp/final.dump && ls -lh /tmp/final.dump
```

Criar o banco definitivo:

```bash
psql -U postgres -c "create database ancorahub"
```

```bash
psql -U postgres -d ancorahub -c 'create schema extensions; create extension vector schema extensions; create extension pgcrypto schema extensions; create extension "uuid-ossp" schema extensions; create extension pg_trgm schema public; alter database ancorahub set search_path = "$user", public, extensions;'
```

Restaurar. O único erro esperado é `schema "public" already exists`; qualquer outro, pare e me mostre:

```bash
pg_restore -U postgres -d ancorahub --no-owner --no-privileges -j 4 /tmp/final.dump 2> /tmp/final-erros.txt; cat /tmp/final-erros.txt
```

Atualizar as estatísticas, para as telas ficarem rápidas já no primeiro minuto:

```bash
vacuumdb -U postgres -d ancorahub --analyze-only -j 4
```

Conferir. Deve dar 235 tabelas e 361 migrations; leads e mensagens ficam iguais ou maiores que no ensaio (18.987 e 152.005):

```bash
psql -U postgres -d ancorahub -c "select (select count(*) from information_schema.tables where table_schema='public') tabelas, (select count(*) from leads) leads, (select count(*) from whatsapp_messages) msgs, (select count(*) from tenant_memberships) membros, (select count(*) from drizzle.__drizzle_migrations) migrations"
```

### 3. Apontar o app para o banco novo

1. No `ancorahub-db`, em **General**, depois **Access**, copie a **"Postgres URL (internal)"** pelo ícone de copiar (sem clicar no olho).
2. Em **Environment Variables** do app do CRM:
   - `DATABASE_URL`: cole o valor copiado e troque o `/postgres` do final por `/ancorahub`.
     Formato: `postgres://postgres:SENHA@w4bm4urc5d0bfemnwys1qqp1:5432/ancorahub`
   - `SUPABASE_DB_URL`, se existir: o mesmo valor do `DATABASE_URL`. O app lê essa variável antes do `DATABASE_URL`.
   - Adicione `DB_POOL_MAX` = `12`.
   - Salve.

### 4. Subir o app

Clique em **Restart** no app, não em Redeploy, e espere ficar verde.

### 5. Conferir

1. Entrar no CRM e abrir **Leads** e **Plantão**.
2. Mandar uma mensagem de teste pelo WhatsApp e ver se ela aparece.
3. Confirmar que o app grava no banco novo:

   ```bash
   psql -U postgres -d ancorahub -c "select max(created_at) from audit_logs"
   ```

   O horário tem que ser de depois da virada.

## Se algo der errado (volta atrás)

1. Em **Environment Variables** do app:
   - copie o valor de `DATABASE_URL_SUPABASE_ANTIGO` de volta para `DATABASE_URL`;
   - se existir, copie `SUPABASE_DB_URL_ANTIGO` de volta para `SUPABASE_DB_URL`;
   - remova `DB_POOL_MAX`.
2. Clique em **Restart**.

O sistema volta ao Supabase como estava. O que foi gravado no banco novo nesses minutos fica só lá.

## Depois

| Quando | O quê |
|---|---|
| Dia seguinte | Conferir no R2 se o backup das 3h saiu com o banco `ancorahub`. |
| Depois de 1 a 2 dias estável | No terminal do `ancorahub-db`: `psql -U postgres -c "drop database ancorahub_ensaio"` e `rm -f /tmp/ancorahub.dump /tmp/final.dump`. |
| Depois de 1 a 2 dias estável | Tirar do código o envio paralelo pelo Supabase Realtime e as variáveis `NEXT_PUBLIC_SUPABASE_*` e `SUPABASE_SERVICE_ROLE_KEY`. |
| Depois de 1 a 2 semanas | Desligar o projeto pago do Supabase e apagar as variáveis `*_ANTIGO`. Antes disso, trocar a senha do banco no Supabase. |
| Quando quiser | Limpeza automática de `waha_webhook_events` (4,2 milhões de linhas, 1,5 GB). |

## Referência

- **Do Supabase, o app usava só o Postgres.** O login é Better Auth, e Storage não é usado. Os avisos em tempo real já usam `pg_notify` com SSE (`/api/realtime/stream`).
- **O que fica no Supabase.** Os schemas `auth`, `storage`, `realtime` e `vault` e as publicações do Realtime não são copiados: o app não usa nenhum deles.
- **Extensões no banco novo.** `vector`, `pgcrypto` e `uuid-ossp` ficam no schema `extensions`, como no Supabase. `pg_trgm` fica em `public`. O `search_path` inclui `extensions`.
- **RLS.** 231 tabelas têm RLS ligado e sem nenhuma regra. O app conecta como dono do banco, então isso não muda nada.
