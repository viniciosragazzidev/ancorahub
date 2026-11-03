-- Avisos do Security Advisor da Supabase (03/11, depois da 0217): "Function Search Path Mutable".
-- Fixar o search_path impede que outro schema troque as tabelas ou funções que elas usam.
-- ancora_fold só usa funções do pg_catalog; o gatilho usa broker_availability_windows (public).
-- Aplicar manualmente, somente com autorização do usuário. Idempotente.
ALTER FUNCTION public.ancora_fold(text) SET search_path = '';
ALTER FUNCTION public.seed_default_broker_availability() SET search_path = public;
