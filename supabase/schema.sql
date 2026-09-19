-- =====================================================================
-- EJECT · Trilha de Conhecimento — schema Supabase (PostgreSQL)
--
-- Execute inteiro no SQL Editor de um projeto Supabase vazio.
-- É idempotente: pode ser executado novamente sem erro.
--
-- Ordem: extensões → enums → tabelas → índices → funções → triggers →
--        RPCs → RLS/policies → grants → Realtime → seed
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Extensões
-- ---------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 2. Enums
-- ---------------------------------------------------------------------
do $$ begin
  create type public.track_id as enum ('uxui', 'frontend', 'backend');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.level_id as enum ('level1', 'level2', 'level3');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.content_category as enum ('videos', 'artigos', 'links', 'cursos');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.submission_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 3. Tabelas
-- ---------------------------------------------------------------------

-- Times da gamificação (Firebase: gamification/teams)
create table if not exists public.teams (
  id          uuid primary key default gen_random_uuid(),
  firebase_key text unique,
  name        text not null check (length(btrim(name)) > 0),
  score       integer not null default 0 check (score >= 0),
  created_at  timestamptz not null default now(),
  created_by  uuid,
  updated_at  timestamptz,
  updated_by  uuid
);

-- Perfil do usuário. Unifica Firebase `users` + `profiles`
-- (a pontuação individual passa a existir em um único lugar).
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  firebase_uid  text unique,
  name          text not null default '',
  email         text not null default '',
  team_id       uuid references public.teams (id) on delete set null,
  score         integer not null default 0 check (score >= 0),
  last_activity jsonb,
  gamification_updated_at timestamptz,
  gamification_updated_by uuid,
  created_at    timestamptz not null default now(),
  last_login    timestamptz
);

-- Administradores (Firebase: admins/{uid}, users/{uid}.isAdmin e e-mail fixo)
create table if not exists public.admins (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  is_super   boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid
);

-- Trilhas paralelas (fonte única de POINTS_CONFIG / ALL_TRAILS)
create table if not exists public.trails (
  id                text primary key,
  name              text not null,
  total_topics      integer not null check (total_topics > 0),
  points_multiplier numeric(3, 1) not null default 1.0 check (points_multiplier > 0)
);

-- Progresso nas trilhas paralelas (Firebase: users/{uid}/progress/{trilha}/{topico})
create table if not exists public.trail_progress (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  trail_id   text not null references public.trails (id) on update cascade,
  topic_key  text not null,
  completed  boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, trail_id, topic_key)
);

-- Conteúdos dos níveis de nivelamento (Firebase: contents/{track}/{level}/{cat}/{id})
create table if not exists public.contents (
  id           uuid primary key default gen_random_uuid(),
  firebase_key text unique,
  track        public.track_id not null,
  level        public.level_id not null,
  category     public.content_category not null,
  title        text not null check (length(btrim(title)) > 0),
  url          text not null check (url ~* '^https?://'),
  description  text not null default '',
  -- [{ "question": "...", "options": ["a","b","c"], "correctIndex": 0 }] ou null
  quiz         jsonb check (quiz is null or jsonb_typeof(quiz) = 'array'),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz
);

-- Itens de conteúdo concluídos (Firebase: users/{uid}/progress/{track}/{level}/tasks/{id})
create table if not exists public.task_progress (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  content_id uuid not null references public.contents (id) on delete cascade,
  completed  boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, content_id)
);

-- Níveis liberados (Firebase: progress/{track}/level2_unlocked | level3_unlocked)
create table if not exists public.level_unlocks (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  track       public.track_id not null,
  level       public.level_id not null check (level in ('level2', 'level3')),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, track, level)
);

-- Desafios finais enviados (Firebase: submissions/{id})
create table if not exists public.submissions (
  id          uuid primary key default gen_random_uuid(),
  firebase_key text unique,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  user_name   text not null default '',
  track       public.track_id not null,
  level       public.level_id not null,
  repo_link   text not null check (repo_link ~* '^https?://'),
  notes       text not null default '',
  status      public.submission_status not null default 'pending',
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);

-- Insígnias (Firebase: users/{uid}/badges/{badgeId})
create table if not exists public.badges (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  badge_id   text not null,
  name       text not null,
  image      text not null,
  awarded_at timestamptz not null default now(),
  is_new     boolean not null default true,
  primary key (user_id, badge_id)
);

-- Atividades pontuadas (Firebase: gamification/activities)
create table if not exists public.activities (
  id                uuid primary key default gen_random_uuid(),
  firebase_key      text unique,
  user_id           uuid references public.profiles (id) on delete set null,
  team_id           uuid references public.teams (id) on delete set null,
  type              text not null default 'task',
  points_individual integer not null default 0 check (points_individual >= 0),
  points_team       integer not null default 0 check (points_team >= 0),
  description       text not null default '',
  -- campos do formato antigo
  activity          text,
  evidence          text,
  color             text,
  status            text,
  registered_by     uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz,
  updated_by        uuid
);

-- ---------------------------------------------------------------------
-- 4. Índices
-- ---------------------------------------------------------------------
create index if not exists idx_profiles_team          on public.profiles (team_id);
create index if not exists idx_trail_progress_user    on public.trail_progress (user_id);
create index if not exists idx_contents_track_level   on public.contents (track, level);
create index if not exists idx_task_progress_user     on public.task_progress (user_id);
create index if not exists idx_submissions_user       on public.submissions (user_id);
create index if not exists idx_submissions_status     on public.submissions (status);
create index if not exists idx_activities_user        on public.activities (user_id);
create index if not exists idx_activities_team        on public.activities (team_id);
create index if not exists idx_activities_created_at  on public.activities (created_at desc);

-- ---------------------------------------------------------------------
-- 5. Funções auxiliares
-- ---------------------------------------------------------------------

-- SECURITY DEFINER: lê `admins` sem passar pelo RLS (evita recursão de policies).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins where user_id = (select auth.uid()) and is_super
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Cria o perfil quando um usuário se cadastra no Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Mantém profiles.email sincronizado quando o e-mail é alterado (após confirmação).
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

-- Um time com membros não pode ser excluído.
create or replace function public.prevent_team_delete_with_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.profiles where team_id = old.id) then
    raise exception 'Não é possível excluir um time que ainda possui membros.'
      using errcode = 'P0001';
  end if;
  return old;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Triggers
-- ---------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

drop trigger if exists trg_contents_updated_at on public.contents;
create trigger trg_contents_updated_at
  before update on public.contents
  for each row execute function public.set_updated_at();

drop trigger if exists trg_teams_updated_at on public.teams;
create trigger trg_teams_updated_at
  before update on public.teams
  for each row execute function public.set_updated_at();

drop trigger if exists trg_trail_progress_updated_at on public.trail_progress;
create trigger trg_trail_progress_updated_at
  before update on public.trail_progress
  for each row execute function public.set_updated_at();

drop trigger if exists trg_task_progress_updated_at on public.task_progress;
create trigger trg_task_progress_updated_at
  before update on public.task_progress
  for each row execute function public.set_updated_at();

drop trigger if exists trg_teams_prevent_delete on public.teams;
create trigger trg_teams_prevent_delete
  before delete on public.teams
  for each row execute function public.prevent_team_delete_with_members();

-- ---------------------------------------------------------------------
-- 7. RPCs (regras de negócio com escrita)
--    Nenhuma pontuação é escrita direto pelo cliente.
-- ---------------------------------------------------------------------

-- Registra uma atividade e soma os pontos (individual e do time) de forma atômica.
-- Admin: qualquer usuário/time. Não-admin: somente para si mesmo e para o próprio time.
create or replace function public.record_activity(
  p_user_id           uuid,
  p_team_id           uuid,
  p_type              text,
  p_points_individual integer,
  p_points_team       integer,
  p_description       text default ''
)
returns public.activities
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me       uuid := auth.uid();
  v_my_team  uuid;
  v_row      public.activities;
begin
  if v_me is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;
  if p_user_id is null or p_team_id is null then
    raise exception 'Usuário e time são obrigatórios.';
  end if;
  if coalesce(p_points_individual, 0) < 0 or coalesce(p_points_team, 0) < 0
     or (coalesce(p_points_individual, 0) = 0 and coalesce(p_points_team, 0) = 0) then
    raise exception 'Informe pontos maiores que zero.';
  end if;

  if not public.is_admin() then
    select team_id into v_my_team from public.profiles where id = v_me;
    if p_user_id <> v_me or v_my_team is distinct from p_team_id then
      raise exception 'Você só pode registrar pontos para você e para o seu time.'
        using errcode = '42501';
    end if;
  end if;

  insert into public.activities
    (user_id, team_id, type, points_individual, points_team, description, registered_by)
  values
    (p_user_id, p_team_id, coalesce(nullif(p_type, ''), 'task'),
     coalesce(p_points_individual, 0), coalesce(p_points_team, 0),
     coalesce(p_description, ''), v_me)
  returning * into v_row;

  update public.profiles
     set score = score + v_row.points_individual,
         last_activity = jsonb_build_object(
           'pointsIndividual', v_row.points_individual,
           'pointsTeam', v_row.points_team,
           'type', v_row.type,
           'timestamp', (extract(epoch from v_row.created_at) * 1000)::bigint),
         gamification_updated_at = now(),
         gamification_updated_by = v_me
   where id = p_user_id;

  update public.teams set score = score + v_row.points_team where id = p_team_id;

  return v_row;
end;
$$;

-- Edita uma atividade e ajusta as pontuações pela diferença (mínimo 0). Somente admin.
create or replace function public.update_activity(
  p_id                uuid,
  p_activity          text,
  p_description       text,
  p_evidence          text,
  p_points_individual integer,
  p_points_team       integer
)
returns public.activities
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.activities;
  v_row public.activities;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores.' using errcode = '42501';
  end if;
  if coalesce(p_points_individual, 0) < 0 or coalesce(p_points_team, 0) < 0 then
    raise exception 'Pontos não podem ser negativos.';
  end if;

  select * into v_old from public.activities where id = p_id for update;
  if not found then
    raise exception 'Atividade não encontrada.';
  end if;

  update public.activities
     set activity = p_activity,
         description = coalesce(p_description, description),
         evidence = p_evidence,
         points_individual = coalesce(p_points_individual, 0),
         points_team = coalesce(p_points_team, 0),
         updated_at = now(),
         updated_by = auth.uid()
   where id = p_id
   returning * into v_row;

  if v_old.user_id is not null then
    update public.profiles
       set score = greatest(0, score + (v_row.points_individual - v_old.points_individual))
     where id = v_old.user_id;
  end if;
  if v_old.team_id is not null then
    update public.teams
       set score = greatest(0, score + (v_row.points_team - v_old.points_team))
     where id = v_old.team_id;
  end if;

  return v_row;
end;
$$;

-- Exclui uma atividade e desconta os pontos (mínimo 0). Somente admin.
create or replace function public.delete_activity(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.activities;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores.' using errcode = '42501';
  end if;

  delete from public.activities where id = p_id returning * into v_old;
  if not found then
    raise exception 'Atividade não encontrada.';
  end if;

  if v_old.user_id is not null then
    update public.profiles set score = greatest(0, score - v_old.points_individual)
     where id = v_old.user_id;
  end if;
  if v_old.team_id is not null then
    update public.teams set score = greatest(0, score - v_old.points_team)
     where id = v_old.team_id;
  end if;
end;
$$;

-- Move um membro de time: os pontos de time das atividades dele acompanham. Somente admin.
-- p_new_team = null remove o membro do time.
create or replace function public.move_member_team(p_member uuid, p_new_team uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_team uuid;
  v_points   integer;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores.' using errcode = '42501';
  end if;

  select team_id into v_old_team from public.profiles where id = p_member for update;
  if not found then
    raise exception 'Membro não encontrado.';
  end if;
  if v_old_team is not distinct from p_new_team then
    return;
  end if;

  select coalesce(sum(points_team), 0) into v_points
    from public.activities where user_id = p_member;

  if v_old_team is not null then
    update public.teams set score = greatest(0, score - v_points) where id = v_old_team;
  end if;
  if p_new_team is not null then
    update public.teams set score = score + v_points where id = p_new_team;
  end if;

  update public.profiles
     set team_id = p_new_team,
         gamification_updated_at = now(),
         gamification_updated_by = auth.uid()
   where id = p_member;
end;
$$;

-- Aprova um desafio: status, insígnia e liberação do próximo nível numa transação. Somente admin.
create or replace function public.approve_submission(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub        public.submissions;
  v_level_name text;
  v_track_name text;
  v_badge_id   text;
  v_image      text;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores.' using errcode = '42501';
  end if;

  select * into v_sub from public.submissions where id = p_id for update;
  if not found then
    raise exception 'Envio não encontrado.';
  end if;
  if v_sub.status <> 'pending' then
    raise exception 'Este envio já foi avaliado.';
  end if;

  v_level_name := case v_sub.level
    when 'level1' then 'basico'
    when 'level2' then 'intermediario'
    else 'avancado' end;
  v_track_name := case v_sub.track
    when 'uxui' then 'UX/UI'
    when 'frontend' then 'Frontend'
    else 'Backend' end;
  v_badge_id := v_sub.track::text || '_' || v_level_name;

  v_image := case v_badge_id
    when 'uxui_basico' then '../img/insignias/basico_uxui.svg'
    when 'uxui_intermediario' then '../img/insignias/inter_uxui.png'
    when 'uxui_avancado' then '../img/insignias/avancado_uxui.png'
    when 'frontend_basico' then '../img/insignias/basico_front.png'
    when 'frontend_intermediario' then '../img/insignias/inter_front.png'
    when 'frontend_avancado' then '../img/insignias/avan_front.png'
    when 'backend_basico' then '../img/insignias/basico_back.svg'
    when 'backend_intermediario' then '../img/insignias/inter_back.svg'
    else '../img/insignias/avancado_back.svg' end;

  update public.submissions
     set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid()
   where id = p_id;

  insert into public.badges (user_id, badge_id, name, image, is_new)
  values (
    v_sub.user_id, v_badge_id,
    v_track_name || ' ' || case v_level_name
      when 'basico' then 'Básico'
      when 'intermediario' then 'Intermediário'
      else 'Avançado' end,
    v_image, true)
  on conflict (user_id, badge_id)
  do update set awarded_at = now(), is_new = true;

  if v_sub.level = 'level1' then
    insert into public.level_unlocks (user_id, track, level)
    values (v_sub.user_id, v_sub.track, 'level2') on conflict do nothing;
  elsif v_sub.level = 'level2' then
    insert into public.level_unlocks (user_id, track, level)
    values (v_sub.user_id, v_sub.track, 'level3') on conflict do nothing;
  end if;
end;
$$;

create or replace function public.reject_submission(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores.' using errcode = '42501';
  end if;

  update public.submissions
     set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid()
   where id = p_id and status = 'pending';
  if not found then
    raise exception 'Envio não encontrado ou já avaliado.';
  end if;
end;
$$;

-- Zera progresso, insígnias e envios do próprio usuário (tela de perfil).
create or replace function public.reset_my_progress()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;
  delete from public.trail_progress where user_id = v_me;
  delete from public.task_progress  where user_id = v_me;
  delete from public.level_unlocks  where user_id = v_me;
  delete from public.badges         where user_id = v_me;
  delete from public.submissions    where user_id = v_me;
end;
$$;

-- Admin zera apenas o progresso de um usuário (comportamento de "gerenciar usuários").
create or replace function public.admin_reset_user_progress(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores.' using errcode = '42501';
  end if;
  delete from public.trail_progress where user_id = p_user;
  delete from public.task_progress  where user_id = p_user;
  delete from public.level_unlocks  where user_id = p_user;
end;
$$;

-- Exclui a própria conta (perfil e dados ligados caem em cascata).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;
  delete from auth.users where id = v_me;
end;
$$;

-- Ranking público de trilhas: 10 pontos por tópico × multiplicador da trilha.
-- Substitui os nós public/ranking e public/stats (antes gravados pelo navegador).
create or replace function public.get_public_ranking()
returns table (user_id uuid, name text, score integer)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id,
         coalesce(nullif(btrim(p.name), ''), split_part(p.email, '@', 1)),
         sum(round(t.done * 10 * t.points_multiplier))::integer as score
    from (
      select tp.user_id, tp.trail_id, tr.points_multiplier, count(*) as done
        from public.trail_progress tp
        join public.trails tr on tr.id = tp.trail_id
       where tp.completed
       group by tp.user_id, tp.trail_id, tr.points_multiplier
    ) t
    join public.profiles p on p.id = t.user_id
   group by p.id, p.name, p.email
  having sum(round(t.done * 10 * t.points_multiplier)) > 0
   order by score desc, 2;
$$;

create or replace function public.get_public_stats()
returns table (total_users integer, last_update timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer, now() from public.get_public_ranking();
$$;

-- Placar da gamificação sem expor e-mails (leitura anônima, como antes).
create or replace function public.get_leaderboard()
returns table (id uuid, name text, score integer, team_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id,
         coalesce(nullif(btrim(p.name), ''), split_part(p.email, '@', 1)),
         p.score,
         p.team_id
    from public.profiles p
   order by p.score desc, 2;
$$;

-- ---------------------------------------------------------------------
-- 8. Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.admins         enable row level security;
alter table public.trails         enable row level security;
alter table public.trail_progress enable row level security;
alter table public.contents       enable row level security;
alter table public.task_progress  enable row level security;
alter table public.level_unlocks  enable row level security;
alter table public.submissions    enable row level security;
alter table public.badges         enable row level security;
alter table public.teams          enable row level security;
alter table public.activities     enable row level security;

-- profiles: cada um vê o próprio; admin vê todos. Escrita restrita por coluna (seção 9).
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or public.is_admin())
  with check (id = (select auth.uid()) or public.is_admin());

-- admins
drop policy if exists admins_select on public.admins;
create policy admins_select on public.admins
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists admins_insert on public.admins;
create policy admins_insert on public.admins
  for insert to authenticated
  with check (public.is_admin() and is_super = false);

drop policy if exists admins_delete on public.admins;
create policy admins_delete on public.admins
  for delete to authenticated
  using (public.is_admin() and is_super = false);

-- trails: leitura pública
drop policy if exists trails_select on public.trails;
create policy trails_select on public.trails
  for select to anon, authenticated using (true);

drop policy if exists trails_admin_write on public.trails;
create policy trails_admin_write on public.trails
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- trail_progress
drop policy if exists trail_progress_own on public.trail_progress;
create policy trail_progress_own on public.trail_progress
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists trail_progress_admin_select on public.trail_progress;
create policy trail_progress_admin_select on public.trail_progress
  for select to authenticated using (public.is_admin());

-- contents: leitura para logados; escrita somente admin
drop policy if exists contents_select on public.contents;
create policy contents_select on public.contents
  for select to authenticated using (true);

drop policy if exists contents_admin_write on public.contents;
create policy contents_admin_write on public.contents
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- task_progress
drop policy if exists task_progress_own on public.task_progress;
create policy task_progress_own on public.task_progress
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists task_progress_admin_select on public.task_progress;
create policy task_progress_admin_select on public.task_progress
  for select to authenticated using (public.is_admin());

-- level_unlocks: somente leitura pelo cliente (escrita via RPC approve_submission)
drop policy if exists level_unlocks_select on public.level_unlocks;
create policy level_unlocks_select on public.level_unlocks
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- submissions
drop policy if exists submissions_select on public.submissions;
create policy submissions_select on public.submissions
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists submissions_insert on public.submissions;
create policy submissions_insert on public.submissions
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending');

-- badges: leitura própria/admin; o usuário só marca is_new = false
drop policy if exists badges_select on public.badges;
create policy badges_select on public.badges
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists badges_update_own on public.badges;
create policy badges_update_own on public.badges
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- teams: leitura pública; escrita admin (score só via RPC)
drop policy if exists teams_select on public.teams;
create policy teams_select on public.teams
  for select to anon, authenticated using (true);

drop policy if exists teams_admin_write on public.teams;
create policy teams_admin_write on public.teams
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- activities: leitura para logados; escrita somente via RPC
drop policy if exists activities_select on public.activities;
create policy activities_select on public.activities
  for select to authenticated using (true);

-- ---------------------------------------------------------------------
-- 9. Grants
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;

grant usage on schema public to anon, authenticated;

-- leitura
grant select on public.trails, public.teams                    to anon, authenticated;
grant select on public.profiles, public.admins, public.trail_progress,
                public.contents, public.task_progress, public.level_unlocks,
                public.submissions, public.badges, public.activities
      to authenticated;

-- escrita direta (limitada por RLS e por coluna)
grant update (name, email, last_login) on public.profiles to authenticated;
grant insert (user_id, is_super, created_by) on public.admins to authenticated;
grant delete                           on public.admins   to authenticated;
grant insert, update, delete           on public.trails   to authenticated;
grant insert, update, delete           on public.trail_progress to authenticated;
grant insert, update, delete           on public.task_progress  to authenticated;
grant insert, update, delete           on public.contents to authenticated;
grant insert (user_id, user_name, track, level, repo_link, notes)
      on public.submissions to authenticated;
grant update (is_new)                  on public.badges to authenticated;
grant insert (name, created_by)        on public.teams to authenticated;
grant update (name, updated_by)        on public.teams to authenticated;
grant delete                           on public.teams to authenticated;

-- funções: nada é público por padrão
revoke all on function public.is_admin()                      from public;
revoke all on function public.is_super_admin()                from public;
revoke all on function public.record_activity(uuid, uuid, text, integer, integer, text) from public;
revoke all on function public.update_activity(uuid, text, text, text, integer, integer) from public;
revoke all on function public.delete_activity(uuid)           from public;
revoke all on function public.move_member_team(uuid, uuid)    from public;
revoke all on function public.approve_submission(uuid)        from public;
revoke all on function public.reject_submission(uuid)         from public;
revoke all on function public.reset_my_progress()             from public;
revoke all on function public.admin_reset_user_progress(uuid) from public;
revoke all on function public.delete_my_account()            from public;
revoke all on function public.get_public_ranking()            from public;
revoke all on function public.get_public_stats()              from public;
revoke all on function public.get_leaderboard()               from public;

grant execute on function public.is_admin()                      to authenticated;
grant execute on function public.is_super_admin()                to authenticated;
grant execute on function public.record_activity(uuid, uuid, text, integer, integer, text) to authenticated;
grant execute on function public.update_activity(uuid, text, text, text, integer, integer) to authenticated;
grant execute on function public.delete_activity(uuid)           to authenticated;
grant execute on function public.move_member_team(uuid, uuid)    to authenticated;
grant execute on function public.approve_submission(uuid)        to authenticated;
grant execute on function public.reject_submission(uuid)         to authenticated;
grant execute on function public.reset_my_progress()             to authenticated;
grant execute on function public.admin_reset_user_progress(uuid) to authenticated;
grant execute on function public.delete_my_account()            to authenticated;
grant execute on function public.get_public_ranking()            to anon, authenticated;
grant execute on function public.get_public_stats()              to anon, authenticated;
grant execute on function public.get_leaderboard()               to anon, authenticated;

-- ---------------------------------------------------------------------
-- 10. Realtime (telas de administração que antes usavam .on('value'))
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['profiles', 'admins', 'teams', 'activities', 'contents', 'task_progress', 'trail_progress']
    loop
      if not exists (
        select 1 from pg_publication_tables
         where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 11. Seed
-- ---------------------------------------------------------------------

-- Trilhas paralelas. Os ids são exatamente os gravados por cada página
-- (input #trilha-id); multiplicadores e totais vêm do antigo POINTS_CONFIG/ALL_TRAILS.
insert into public.trails (id, name, total_topics, points_multiplier) values
  ('html_e_css',             'HTML 5 e CSS 3',         12, 1.0),
  ('javascript',             'JavaScript Essencial',    5, 1.2),
  ('git_e_github',           'Git e GitHub',            8, 1.0),
  ('python_basico',          'Python Básico',          11, 1.1),
  ('django',                 'Django Framework',        8, 1.5),
  ('vue',                    'Vue.js',                  6, 1.3),
  ('typescript',             'TypeScript',              8, 1.4),
  ('ux_ui',                  'UX/UI Design',           15, 1.1),
  ('scrum',                  'Metodologia Scrum',       6, 1.0),
  ('metodologia_5s',         'Metodologia 5S',          5, 0.8),
  ('gestao_de_tempo',        'Gestão de Tempo',         7, 0.8),
  ('desenvolvimento_humano', 'Desenvolvimento Humano', 14, 0.8),
  ('financeiro',             'Financeiro',              9, 1.0),
  ('marketing_comercial',    'Marketing e Comercial',  11, 1.0),
  ('okrs_kpis_e_bpmn',       'OKRs, KPIs e BPMN',       7, 1.2),
  ('wordpress',              'WordPress',               8, 1.0),
  ('historia_eject',         'História da EJECT',       4, 0.5)
on conflict (id) do update
  set name = excluded.name,
      total_topics = excluded.total_topics,
      points_multiplier = excluded.points_multiplier;

-- Super administrador: depois de criar a sua conta pelo site (ou no painel
-- Authentication → Users), descomente, troque o e-mail e execute:
--
-- insert into public.admins (user_id, is_super)
-- select id, true from public.profiles where email = 'SEU_EMAIL@exemplo.com'
-- on conflict (user_id) do update set is_super = true;
