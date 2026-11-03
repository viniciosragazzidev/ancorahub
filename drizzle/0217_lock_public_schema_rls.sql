-- Alerta crítico da Supabase (03/11): 190 de 201 tabelas do schema public sem RLS, com os papéis
-- anon e authenticated podendo ler, inserir, alterar e apagar tudo pela API da Supabase. A chave
-- pública vai para o navegador (tempo real), então qualquer um com ela acessava user, session,
-- account, leads, whatsapp_messages etc.
--
-- O CRM conecta como postgres (dono das tabelas, BYPASSRLS) e não usa a API de dados da Supabase;
-- o tempo real usa só canais de broadcast. Nada no app depende de anon/authenticated no public.
--
-- Aplicar manualmente, somente com autorização do usuário. Idempotente: pode rodar de novo.

-- 1. RLS em toda tabela do public, sem policy: anon e authenticated não veem nenhuma linha.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
  END LOOP;
END $$;

-- 2. Sem permissão nenhuma para os papéis da API. As funções do pg_trgm são da Supabase
-- (supabase_admin) e ficam como estão; só as do CRM perdem o acesso, também o padrão PUBLIC.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
DO $$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proowner = 'postgres'::regrole
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.signature);
  END LOOP;
END $$;

-- 3. Tabela, sequência ou função nova no public não nasce aberta para eles.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
