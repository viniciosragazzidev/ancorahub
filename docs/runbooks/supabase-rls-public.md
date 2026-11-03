# Fechar o schema public para a API da Supabase

## Gatilho
E-mail ou painel **Advisors** da Supabase com `rls_disabled_in_public` ou
`sensitive_columns_exposed`. Em 03/11 eram 190 de 201 tabelas sem RLS, com `anon` e
`authenticated` podendo ler, alterar e apagar tudo pela API. A chave pública vai para o
navegador (tempo real), então qualquer pessoa com ela tinha acesso.

## Por que é seguro
- O CRM conecta como `postgres`, dono das tabelas e com BYPASSRLS: o RLS não o afeta.
- O código não usa a API de dados da Supabase (`supabase.from`, `rpc`).
- O tempo real usa só broadcast, enviado do servidor com a service role.

## Passos
1. Autorização do usuário: a migration grava em produção.
2. Aplicar `drizzle/0217_lock_public_schema_rls.sql` no SQL Editor da Supabase (ou `psql`
   com a `DATABASE_URL`). É idempotente.
3. Tabela nova nasce sem permissão para `anon`/`authenticated`, mas sem RLS: depois de
   criar tabelas, rode de novo o bloco 1 da migration (ou a migration inteira) para o
   Advisors não voltar a alertar.

## Validação
```sql
select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity; -- 0

select count(*) from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated');     -- 0
```
Depois, abrir o CRM (leads, conversas, notificações em tempo real) e o painel Advisors.

## Rollback
Só se algo do app depender da API com a chave pública (não deveria):
`grant select, insert, update, delete on all tables in schema public to anon, authenticated;`
e `alter table public.<tabela> disable row level security;` na tabela afetada.
