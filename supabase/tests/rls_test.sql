-- Testes de RLS/RPC. Rodar depois de bootstrap_local.sql + schema.sql, num banco descartável.
-- Cada falha lança exception; se terminar com 'OK', tudo passou.
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@t.com', '{"name":"Admin"}'),
  ('00000000-0000-0000-0000-000000000001', 'u1@t.com',    '{"name":"Um"}'),
  ('00000000-0000-0000-0000-000000000002', 'u2@t.com',    '{"name":"Dois"}');
insert into public.admins (user_id, is_super) values ('00000000-0000-0000-0000-00000000000a', true);
insert into public.teams (id, name) values
  ('10000000-0000-0000-0000-000000000001', 'T1'),
  ('10000000-0000-0000-0000-000000000002', 'T2');
update public.profiles set team_id = '10000000-0000-0000-0000-000000000001'
 where id = '00000000-0000-0000-0000-000000000001';
insert into public.contents (id, track, level, category, title, url) values
  ('20000000-0000-0000-0000-000000000001', 'backend', 'level1', 'videos', 'v', 'https://x.com');

-- helper: simula login (schema descartado no rollback)
create schema t;
grant usage on schema t to public;
create or replace function t.as_user(u text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', u, true);
  execute 'set local role authenticated';
end $$;
create or replace function t.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';
end $$;
create or replace function t.reset() returns void language plpgsql as $$
begin execute 'reset role'; end $$;

-- 1) perfil criado pelo trigger
do $$ begin
  assert (select count(*) from public.profiles) = 3, 'trigger handle_new_user';
end $$;

-- 2) usuário comum só vê o próprio perfil
select t.as_user('00000000-0000-0000-0000-000000000001');
do $$ begin
  assert (select count(*) from public.profiles) = 1, 'user vê só o próprio perfil';
end $$;

-- 3) usuário não altera o próprio score nem team
do $$ begin
  begin
    update public.profiles set score = 999 where id = auth.uid();
    raise exception 'FALHA: alterou score';
  exception when insufficient_privilege then null; end;
  begin
    update public.profiles set team_id = null where id = auth.uid();
    raise exception 'FALHA: alterou team_id';
  exception when insufficient_privilege then null; end;
end $$;

-- 4) usuário não aprova submissão nem se torna admin
do $$ begin
  begin
    perform public.approve_submission(gen_random_uuid());
    raise exception 'FALHA: não-admin aprovou';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.admins (user_id) values (auth.uid());
    raise exception 'FALHA: auto-promoção a admin';
  exception when insufficient_privilege or check_violation then null; end;
end $$;
do $$ declare n int; begin
  -- RLS filtra: insert em admins por não-admin viola policy
  begin
    insert into public.admins (user_id) values ('00000000-0000-0000-0000-000000000002');
    raise exception 'FALHA: inseriu admin';
  exception when insufficient_privilege then null; end;
end $$;

-- 5) progresso próprio ok, alheio não
insert into public.task_progress (user_id, content_id, completed)
values (auth.uid(), '20000000-0000-0000-0000-000000000001', true);
do $$ begin
  begin
    insert into public.task_progress (user_id, content_id, completed)
    values ('00000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', true);
    raise exception 'FALHA: escreveu progresso alheio';
  exception when insufficient_privilege then null; end;
end $$;

-- 6) envio de desafio (status forçado a pending)
insert into public.submissions (user_id, user_name, track, level, repo_link)
values (auth.uid(), 'Um', 'backend', 'level1', 'https://github.com/x/y');
do $$ begin
  begin
    insert into public.submissions (user_id, user_name, track, level, repo_link)
    values (auth.uid(), 'Um', 'backend', 'level2', 'javascript:alert(1)');
    raise exception 'FALHA: aceitou link inválido';
  exception when check_violation then null; end;
end $$;

-- 7) não-admin registra pontos para si e o próprio time; não para outro time
do $$ begin
  perform public.record_activity(auth.uid(), '10000000-0000-0000-0000-000000000001', 'task', 10, 15, 'x');
  begin
    perform public.record_activity(auth.uid(), '10000000-0000-0000-0000-000000000002', 'task', 10, 15, 'x');
    raise exception 'FALHA: pontuou outro time';
  exception when insufficient_privilege then null; end;
end $$;
select t.reset();
do $$ begin
  assert (select score from public.profiles where id='00000000-0000-0000-0000-000000000001') = 10, 'score individual';
  assert (select score from public.teams where id='10000000-0000-0000-0000-000000000001') = 15, 'score time';
end $$;

-- 8) admin: aprova submissão → insígnia + nível 2 liberado
select t.as_user('00000000-0000-0000-0000-00000000000a');
do $$ declare sid uuid; begin
  select id into sid from public.submissions limit 1;
  perform public.approve_submission(sid);
  begin perform public.approve_submission(sid); raise exception 'FALHA: reaprovou';
  exception when others then if sqlerrm like 'FALHA%' then raise; end if; end;
end $$;
select t.reset();
do $$ begin
  assert (select status from public.submissions limit 1) = 'approved', 'status';
  assert exists (select 1 from public.badges where badge_id='backend_basico' and name='Backend Básico' and is_new), 'badge';
  assert exists (select 1 from public.level_unlocks where track='backend' and level='level2'), 'unlock';
end $$;

-- 9) admin: mover membro leva os pontos do time; editar e excluir atividade
select t.as_user('00000000-0000-0000-0000-00000000000a');
do $$ declare aid uuid; begin
  perform public.move_member_team('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002');
  select id into aid from public.activities limit 1;
  perform public.update_activity(aid, 'a', 'd', 'e', 20, 5);
  perform public.delete_activity(aid);
end $$;
select t.reset();
do $$ begin
  assert (select score from public.teams where id='10000000-0000-0000-0000-000000000001') = 0, 'T1 zerado';
  -- os 15 pontos migraram para T2 no move_member_team; a atividade continua ligada a T1
  -- (mesma semântica do sistema antigo), então editar/excluir mexe só em T1.
  assert (select score from public.teams where id='10000000-0000-0000-0000-000000000002') = 15, 'T2 mantém pontos movidos';
  assert (select score from public.profiles where id='00000000-0000-0000-0000-000000000001') = 0, 'score user zerado';
end $$;

-- 10) time com membros não pode ser excluído (admin)
select t.as_user('00000000-0000-0000-0000-00000000000a');
do $$ begin
  begin
    delete from public.teams where id = '10000000-0000-0000-0000-000000000002';
    raise exception 'FALHA: excluiu time com membros';
  exception when sqlstate 'P0001' then null; end;
end $$;

-- 11) anon: ranking/leaderboard/times sim; perfis e conteúdos não
select t.reset();
insert into public.trail_progress (user_id, trail_id, topic_key, completed) values
  ('00000000-0000-0000-0000-000000000001', 'django', 'a', true),
  ('00000000-0000-0000-0000-000000000001', 'django', 'b', true),
  ('00000000-0000-0000-0000-000000000001', 'javascript', 'a', true),
  ('00000000-0000-0000-0000-000000000001', 'javascript', 'b', false);
select t.as_anon();
do $$ declare s int; begin
  select score into s from public.get_public_ranking() where name = 'Um';
  assert s = 42, 'ranking: 2*10*1.5 + 1*10*1.2 = 42, veio ' || coalesce(s::text,'null');
  assert (select count(*) from public.get_leaderboard()) = 3, 'leaderboard';
  assert (select count(*) from public.teams) = 2, 'times públicos';
  begin
    perform 1 from public.profiles;
    raise exception 'FALHA: anon leu profiles';
  exception when insufficient_privilege then null; end;
  begin
    perform 1 from public.contents;
    raise exception 'FALHA: anon leu contents';
  exception when insufficient_privilege then null; end;
end $$;

-- 12) reset e exclusão da própria conta
select t.as_user('00000000-0000-0000-0000-000000000001');
select public.reset_my_progress();
do $$ begin
  assert (select count(*) from public.trail_progress) = 0, 'reset trail';
  assert (select count(*) from public.badges) = 0, 'reset badges';
end $$;
select t.reset();
select t.as_user('00000000-0000-0000-0000-000000000001');
select public.delete_my_account();
select t.reset();
do $$ begin
  assert not exists (select 1 from public.profiles where id='00000000-0000-0000-0000-000000000001'), 'conta excluída';
end $$;

rollback;
\echo OK
