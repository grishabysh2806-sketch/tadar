-- ════════════════════════════════════════════════════════════════════
--  Тадар: схема Supabase
--  Профили, синхронизация прогресса, недельные лиги, классы и задания,
--  «Голоса старших» с модерацией. Все таблицы защищены RLS.
--  Рассчитано на бесплатный тариф: строки маленькие, размеры ограничены
--  проверками, аудио хранится в Storage сжатым (≈25–40 КБ на запись).
--  Применение: SQL Editor → вставить файл целиком → Run (можно повторно).
-- ════════════════════════════════════════════════════════════════════

-- ── Профили ──────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 24),
  avatar smallint not null default 0 check (avatar between 0 and 5),
  role text not null default 'user' check (role in ('user', 'moderator')),
  xp_total integer not null default 0 check (xp_total >= 0),
  streak integer not null default 0 check (streak >= 0),
  lessons_done smallint not null default 0 check (lessons_done >= 0),
  league_tier smallint not null default 0 check (league_tier between 0 and 5),
  last_active timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles: читают все вошедшие" on public.profiles;
create policy "profiles: читают все вошедшие" on public.profiles
  for select to authenticated using (true);

drop policy if exists "profiles: создаёт владелец" on public.profiles;
create policy "profiles: создаёт владелец" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));

drop policy if exists "profiles: меняет владелец" on public.profiles;
create policy "profiles: меняет владелец" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Роль модератора назначается только в панели Supabase (Table Editor / SQL),
-- из приложения поменять её нельзя.
create or replace function public.profiles_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      new.role := 'user';
    elsif new.role is distinct from old.role then
      new.role := old.role;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before insert or update on public.profiles
  for each row execute function public.profiles_guard();

-- Профиль появляется сразу при создании пользователя (в том числе анонимного)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_moderator() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'moderator');
$$;

-- ── Прогресс (всё состояние приложения для синхронизации устройств) ──
create table if not exists public.progress (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  state jsonb not null,
  xp integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint progress_state_size check (pg_column_size(state) < 150000)
);

alter table public.progress enable row level security;

drop policy if exists "progress: только владелец" on public.progress;
create policy "progress: только владелец" on public.progress
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ── Лиги: неделя → лига (tier) → группа до 30 человек ───────────────
create table if not exists public.league_members (
  week date not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  tier smallint not null check (tier between 0 and 5),
  cohort integer not null,
  room text not null,
  xp integer not null default 0 check (xp between 0 and 100000),
  updated_at timestamptz not null default now(),
  primary key (week, user_id)
);

create index if not exists league_members_room_idx on public.league_members (room, xp desc);

alter table public.league_members enable row level security;

drop policy if exists "league: читают все вошедшие" on public.league_members;
create policy "league: читают все вошедшие" on public.league_members
  for select to authenticated using (true);

drop policy if exists "league: свой опыт" on public.league_members;
create policy "league: свой опыт" on public.league_members
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Из приложения меняется только опыт; группа и лига — неизменны
create or replace function public.league_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user = 'authenticated' then
    new.week := old.week;
    new.user_id := old.user_id;
    new.tier := old.tier;
    new.cohort := old.cohort;
    new.room := old.room;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists league_guard on public.league_members;
create trigger league_guard before update on public.league_members
  for each row execute function public.league_guard();

-- Вступление в группу своей лиги на неделю: первая группа, где меньше 30 человек
create or replace function public.league_join(p_week date, p_tier smallint) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_room text;
  v_cohort integer;
  v_tier smallint := greatest(0, least(5, p_tier));
begin
  if (select auth.uid()) is null then
    raise exception 'not signed in';
  end if;
  if p_week > current_date + 1 or p_week < current_date - 8 then
    raise exception 'bad week';
  end if;
  select room into v_room from public.league_members
    where week = p_week and user_id = (select auth.uid());
  if v_room is not null then
    return v_room;
  end if;
  perform pg_advisory_xact_lock(hashtext('league:' || p_week::text || ':' || v_tier::text));
  select cohort into v_cohort from public.league_members
    where week = p_week and tier = v_tier
    group by cohort having count(*) < 30
    order by cohort limit 1;
  if v_cohort is null then
    select coalesce(max(cohort), -1) + 1 into v_cohort from public.league_members
      where week = p_week and tier = v_tier;
  end if;
  v_room := p_week::text || ':' || v_tier::text || ':' || v_cohort::text;
  insert into public.league_members (week, user_id, tier, cohort, room, xp)
    values (p_week, (select auth.uid()), v_tier, v_cohort, v_room, 0);
  return v_room;
end $$;

revoke all on function public.league_join(date, smallint) from public;
grant execute on function public.league_join(date, smallint) to authenticated;

-- Таблица лиги с именами (права — как у исходных таблиц)
create or replace view public.league_board with (security_invoker = true) as
  select m.room, m.week, m.tier, m.user_id, m.xp, m.updated_at, p.name, p.avatar
  from public.league_members m
  join public.profiles p on p.id = m.user_id;

-- ── Классы, ученики, задания ────────────────────────────────────────
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[А-ЯЁA-Z0-9]{6}$'),
  name text not null check (char_length(name) between 1 and 40),
  school text not null default '' check (char_length(school) <= 80),
  teacher_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.class_members (
  class_id uuid not null references public.classes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (class_id, user_id)
);

create index if not exists class_members_user_idx on public.class_members (user_id);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  lesson_id text not null check (char_length(lesson_id) <= 16),
  due date not null,
  created_at timestamptz not null default now()
);

create index if not exists assignments_class_idx on public.assignments (class_id);

create table if not exists public.lesson_results (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  lesson_id text not null check (char_length(lesson_id) <= 16),
  best smallint not null default 0 check (best between 0 and 100),
  times integer not null default 1 check (times >= 0),
  first_done_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create or replace function public.is_class_teacher(p_class uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.classes where id = p_class and teacher_id = (select auth.uid()));
$$;

create or replace function public.is_class_member(p_class uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.class_members where class_id = p_class and user_id = (select auth.uid()));
$$;

-- Учитель видит результаты только своих учеников
create or replace function public.teaches_user(p_user uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.class_members m
    join public.classes c on c.id = m.class_id
    where m.user_id = p_user and c.teacher_id = (select auth.uid())
  );
$$;

alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.assignments enable row level security;
alter table public.lesson_results enable row level security;

drop policy if exists "classes: учитель и ученики" on public.classes;
create policy "classes: учитель и ученики" on public.classes
  for select to authenticated
  using (teacher_id = (select auth.uid()) or public.is_class_member(id));

drop policy if exists "classes: создаёт учитель" on public.classes;
create policy "classes: создаёт учитель" on public.classes
  for insert to authenticated with check (teacher_id = (select auth.uid()));

drop policy if exists "classes: меняет учитель" on public.classes;
create policy "classes: меняет учитель" on public.classes
  for update to authenticated
  using (teacher_id = (select auth.uid())) with check (teacher_id = (select auth.uid()));

drop policy if exists "classes: удаляет учитель" on public.classes;
create policy "classes: удаляет учитель" on public.classes
  for delete to authenticated using (teacher_id = (select auth.uid()));

drop policy if exists "members: ученик и учитель" on public.class_members;
create policy "members: ученик и учитель" on public.class_members
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_class_teacher(class_id));

drop policy if exists "members: выход и исключение" on public.class_members;
create policy "members: выход и исключение" on public.class_members
  for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_class_teacher(class_id));

drop policy if exists "assignments: класс читает" on public.assignments;
create policy "assignments: класс читает" on public.assignments
  for select to authenticated
  using (public.is_class_teacher(class_id) or public.is_class_member(class_id));

drop policy if exists "assignments: учитель задаёт" on public.assignments;
create policy "assignments: учитель задаёт" on public.assignments
  for insert to authenticated with check (public.is_class_teacher(class_id));

drop policy if exists "assignments: учитель удаляет" on public.assignments;
create policy "assignments: учитель удаляет" on public.assignments
  for delete to authenticated using (public.is_class_teacher(class_id));

drop policy if exists "results: свои и учителя" on public.lesson_results;
create policy "results: свои и учителя" on public.lesson_results
  for select to authenticated
  using (user_id = (select auth.uid()) or public.teaches_user(user_id));

drop policy if exists "results: пишет ученик" on public.lesson_results;
create policy "results: пишет ученик" on public.lesson_results
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "results: обновляет ученик" on public.lesson_results;
create policy "results: обновляет ученик" on public.lesson_results
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Вступление в класс по коду (код — единственное, что знает ученик)
create or replace function public.class_join(p_code text) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_class public.classes%rowtype;
  v_code text := upper(trim(p_code));
begin
  if (select auth.uid()) is null then
    raise exception 'not signed in';
  end if;
  v_code := translate(v_code, 'ABEKMHOPCTX', 'АВЕКМНОРСТХ');
  select * into v_class from public.classes where code = v_code;
  if not found then
    return null;
  end if;
  insert into public.class_members (class_id, user_id)
    values (v_class.id, (select auth.uid())) on conflict do nothing;
  return json_build_object('id', v_class.id, 'name', v_class.name, 'school', v_class.school, 'code', v_class.code, 'teacher_id', v_class.teacher_id);
end $$;

revoke all on function public.class_join(text) from public;
grant execute on function public.class_join(text) to authenticated;

-- Панель учителя одним запросом: ученики, опыт за неделю, точность, пройденные уроки
create or replace function public.class_dashboard(p_class uuid, p_week date) returns json
language plpgsql security definer set search_path = public stable as $$
begin
  if not public.is_class_teacher(p_class) then
    return null;
  end if;
  return coalesce((
    select json_agg(row_to_json(t) order by t.week_xp desc, t.name)
    from (
      select p.id as user_id, p.name, p.avatar, p.xp_total, p.streak, p.lessons_done, p.last_active, m.joined_at,
             coalesce(l.xp, 0) as week_xp,
             (select round(avg(r.best)) from public.lesson_results r where r.user_id = p.id) as accuracy,
             coalesce((select json_agg(r.lesson_id) from public.lesson_results r where r.user_id = p.id), '[]'::json) as done
      from public.class_members m
      join public.profiles p on p.id = m.user_id
      left join public.league_members l on l.user_id = p.id and l.week = p_week
      where m.class_id = p_class
    ) t
  ), '[]'::json);
end $$;

revoke all on function public.class_dashboard(uuid, date) from public;
grant execute on function public.class_dashboard(uuid, date) to authenticated;

-- Рейтинг класса за неделю — для учеников и учителя
create or replace function public.class_board(p_class uuid, p_week date) returns json
language plpgsql security definer set search_path = public stable as $$
begin
  if not (public.is_class_member(p_class) or public.is_class_teacher(p_class)) then
    return null;
  end if;
  return coalesce((
    select json_agg(row_to_json(t) order by t.week_xp desc, t.name)
    from (
      select p.id as user_id, p.name, p.avatar, coalesce(l.xp, 0) as week_xp
      from public.class_members m
      join public.profiles p on p.id = m.user_id
      left join public.league_members l on l.user_id = p.id and l.week = p_week
      where m.class_id = p_class
    ) t
  ), '[]'::json);
end $$;

revoke all on function public.class_board(uuid, date) from public;
grant execute on function public.class_board(uuid, date) to authenticated;

-- ── «Голоса старших» ────────────────────────────────────────────────
create table if not exists public.recordings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  item_id text check (char_length(item_id) <= 32),
  text text not null check (char_length(text) between 1 and 60),
  ru text not null default '' check (char_length(ru) <= 80),
  speaker text not null default '' check (char_length(speaker) <= 60),
  relation text not null default '' check (char_length(relation) <= 30),
  place text not null default '' check (char_length(place) <= 60),
  path text not null unique check (char_length(path) <= 200),
  mime text not null default 'audio/webm' check (char_length(mime) <= 40),
  duration real not null default 0 check (duration between 0 and 30),
  size integer not null default 0 check (size between 0 and 400000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create index if not exists recordings_status_idx on public.recordings (status, created_at desc);
create index if not exists recordings_user_idx on public.recordings (user_id);

alter table public.recordings enable row level security;

drop policy if exists "recordings: принятые, свои, модератор" on public.recordings;
create policy "recordings: принятые, свои, модератор" on public.recordings
  for select to authenticated
  using (status = 'approved' or user_id = (select auth.uid()) or public.is_moderator());

drop policy if exists "recordings: добавляет автор" on public.recordings;
create policy "recordings: добавляет автор" on public.recordings
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending');

drop policy if exists "recordings: проверяет модератор" on public.recordings;
create policy "recordings: проверяет модератор" on public.recordings
  for update to authenticated using (public.is_moderator()) with check (public.is_moderator());

drop policy if exists "recordings: удаляет автор или модератор" on public.recordings;
create policy "recordings: удаляет автор или модератор" on public.recordings
  for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_moderator());

-- Не больше 300 записей на человека — защита бесплатного тарифа от переполнения
create or replace function public.recordings_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.recordings where user_id = new.user_id) >= 300 then
    raise exception 'recordings limit reached';
  end if;
  return new;
end $$;

drop trigger if exists recordings_limit on public.recordings;
create trigger recordings_limit before insert on public.recordings
  for each row execute function public.recordings_limit();

-- Счётчики для всех; объём — для модераторов
create or replace function public.voices_stats() returns json
language sql security definer set search_path = public stable as $$
  select json_build_object(
    'approved', count(*) filter (where status = 'approved'),
    'pending', count(*) filter (where status = 'pending'),
    'total', count(*) filter (where status <> 'rejected'),
    'bytes', case when public.is_moderator() then coalesce(sum(size), 0) else null end
  ) from public.recordings;
$$;

grant execute on function public.voices_stats() to anon, authenticated;

-- Хранилище аудио: публичное чтение (имена файлов — случайные UUID),
-- загрузка только в свою папку, лимит 400 КБ на файл
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voices', 'voices', true, 400000,
        array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/aac', 'audio/x-m4a'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "voices: загрузка в свою папку" on storage.objects;
create policy "voices: загрузка в свою папку" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'voices' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "voices: свои файлы" on storage.objects;
create policy "voices: свои файлы" on storage.objects
  for select to authenticated
  using (bucket_id = 'voices' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_moderator()));

drop policy if exists "voices: удаление своих" on storage.objects;
create policy "voices: удаление своих" on storage.objects
  for delete to authenticated
  using (bucket_id = 'voices' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_moderator()));

-- ── Realtime: таблица лиги обновляется у всех участников группы ─────
do $$
begin
  alter publication supabase_realtime add table public.league_members;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

-- ── Необязательно: еженедельная чистка (Database → Extensions → pg_cron) ──
-- Удаляет недели лиги старше 8 недель и гостевые аккаунты, которые не
-- заходили 120 дней (вместе с их прогрессом). Аккаунты с e-mail не трогает.
-- create extension if not exists pg_cron;
-- select cron.schedule('tadar-cleanup', '0 3 * * 1', $$
--   delete from public.league_members where week < current_date - 56;
--   delete from auth.users u using public.profiles p
--     where p.id = u.id and u.is_anonymous and p.last_active < now() - interval '120 days';
-- $$);
