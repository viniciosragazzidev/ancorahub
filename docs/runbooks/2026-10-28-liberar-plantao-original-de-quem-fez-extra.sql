-- Libera no plantão original quem confirmou o plantão extra da noite de hoje (28/10).
-- A tela do plantão misturava o extra com o plantão normal (corrigido em fix/plantao-presenca-extra):
-- quem confirmou o extra ficou pendente no plantão normal sem ninguém ver.
--
-- Faz o mesmo que o botão "Liberar" do gestor: pendente, ou confirmado só pelo corretor (presencial
-- sem validação), vira confirmado e liberado pelo diretor,
-- com nota e auditoria. Não mexe em quem tem falta marcada, em quem o gestor já liberou,
-- em convite vencido nem em plantão que já terminou.
-- O extra é reconhecido como no sistema: a confirmação que termina no horário de início da escala.

-- PASSO 1 (só leitura): quem será liberado e quem libera. Confira antes do passo 2.
with diretor as (select id, name from "user" where email = 'crm@ancorasaude.com.br'),
extra as (
  select c.assignment_id, c.duty_date
  from duty_presence_confirmations c
  join duty_roster_assignments a on a.id = c.assignment_id
  where c.duty_date = (now() at time zone 'America/Sao_Paulo')::date
    and c.status = 'confirmed'
    and to_char(c.shift_ends_at at time zone 'America/Sao_Paulo', 'HH24:MI') = a.starts_at
)
select (select name from diretor) as liberado_por, u.name as corretor, s.name as plantao,
       to_char(c.shift_starts_at at time zone 'America/Sao_Paulo', 'HH24:MI') || '–' ||
       to_char(c.shift_ends_at at time zone 'America/Sao_Paulo', 'HH24:MI') as janela,
       c.status, c.confirmed_by is null as sem_liberacao_do_gestor
from duty_presence_confirmations c
join extra e on e.assignment_id = c.assignment_id and e.duty_date = c.duty_date
join duty_roster_assignments a on a.id = c.assignment_id
join "user" u on u.id = c.broker_id
join unit_duty_schedules s on s.id = c.schedule_id
where (c.status = 'pending' or (c.status = 'confirmed' and c.confirmed_by is null))
  and c.shift_ends_at > now()
  and to_char(c.shift_ends_at at time zone 'America/Sao_Paulo', 'HH24:MI') <> a.starts_at
order by s.name, u.name;

-- PASSO 2: libera. Tudo ou nada; devolve um registro de auditoria por corretor liberado.
begin;

with diretor as (select id from "user" where email = 'crm@ancorasaude.com.br'),
extra as (
  select c.assignment_id, c.duty_date
  from duty_presence_confirmations c
  join duty_roster_assignments a on a.id = c.assignment_id
  where c.duty_date = (now() at time zone 'America/Sao_Paulo')::date
    and c.status = 'confirmed'
    and to_char(c.shift_ends_at at time zone 'America/Sao_Paulo', 'HH24:MI') = a.starts_at
),
liberados as (
  update duty_presence_confirmations c
  set status = 'confirmed', confirmed_at = now(), confirmed_by = (select id from diretor),
      release_note = 'Liberado em lote: confirmou o plantão extra da noite.', updated_at = now()
  from extra e, duty_roster_assignments a
  where e.assignment_id = c.assignment_id and e.duty_date = c.duty_date
    and a.id = c.assignment_id
    and (c.status = 'pending' or (c.status = 'confirmed' and c.confirmed_by is null))
    and c.shift_ends_at > now()
    and to_char(c.shift_ends_at at time zone 'America/Sao_Paulo', 'HH24:MI') <> a.starts_at
    and exists (select 1 from diretor)
  returning c.assignment_id
)
insert into audit_logs (id, user_id, entidade, entidade_id, acao, created_at)
select gen_random_uuid()::text, (select id from diretor), 'duty_roster_assignment', l.assignment_id,
       'duty_presence.released_manually', now()
from liberados l
returning entidade_id;

commit;
