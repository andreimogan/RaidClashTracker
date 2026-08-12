-- Raid Clash Tracker — Supabase Postgres schema. Migration 0001 (initial).
--
-- Forward-only: migrations are numbered SQL files applied in filename order by
-- `npm run db:migrate`. Never edit a migration that has already been applied —
-- add 0002_*.sql instead.
--
-- Every statement is IF NOT EXISTS / OR REPLACE, so the whole file is safe to
-- re-run. There is no PRAGMA: Postgres enforces foreign keys unconditionally.
--
-- IDs stay `text`. Ingestion derives stable ids from member name + week number
-- (m-<slug>, w25, w25-m-<slug>-hydra), and the archived JSON backups carry them.
--
-- Types are the ported *intent*, corrected for Postgres:
--   total_damage  INTEGER -> bigint            real max is 58_280_000_000, 27x int4's ceiling
--   keys_used     REAL    -> double precision  keeps today's tolerance for a fractional value
--   progress      REAL    -> double precision
--   is_active     INTEGER -> boolean
--   created_at    TEXT DEFAULT (datetime('now')) -> timestamptz DEFAULT now()
--   level / hero_level / week_number -> integer (small values; read back as JS numbers)
--
-- No `numeric` column anywhere, including in the view: the client returns numeric
-- (like bigint) as a JS *string*, which is the class of bug this port exists to
-- fix. bigint is unavoidable for total_damage and is coerced in exactly one
-- place — lib/data.ts's row mappers.

create table if not exists members (
  id           text        primary key,
  in_game_name text        not null,
  level        integer     not null default 0,
  hero_level   integer     not null default 0,
  avatar_url   text,
  is_active    boolean     not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists weeks (
  id          text    primary key,
  week_number integer not null,
  start_date  text    not null,
  end_date    text    not null,
  constraint weeks_week_number_key unique (week_number)
);

create table if not exists clash_results (
  id           text             primary key,
  week_id      text             not null references weeks(id)   on delete cascade,
  member_id    text             not null references members(id) on delete cascade,
  clash_type   text             not null,
  keys_used    double precision not null default 0,
  total_damage bigint           not null default 0,
  constraint clash_results_clash_type_check check (clash_type in ('hydra', 'chimera')),
  constraint clash_results_week_member_clash_key unique (week_id, member_id, clash_type)
);

create table if not exists clash_meta (
  week_id    text             not null references weeks(id) on delete cascade,
  clash_type text             not null,
  progress   double precision not null default 0,
  constraint clash_meta_clash_type_check check (clash_type in ('hydra', 'chimera')),
  primary key (week_id, clash_type)
);

create index if not exists idx_clash_results_week   on clash_results (week_id);
create index if not exists idx_clash_results_member on clash_results (member_id);

-- Convenience view for ad-hoc inspection of damage-per-key. Referenced by no
-- application code. avg()/sum() over a bigint yield `numeric` in Postgres, so the
-- damage aggregates are cast to double precision — that matches the old
-- AVG()/CAST(... AS REAL) behaviour and keeps every column of this view out of
-- the string-returning numeric type.
create or replace view member_clash_averages as
select
  cr.member_id,
  m.in_game_name,
  cr.clash_type,
  avg(cr.keys_used)                                                     as avg_keys,
  avg(cr.total_damage)::double precision                                as avg_damage,
  sum(cr.total_damage)::double precision / nullif(sum(cr.keys_used), 0) as avg_damage_per_key
from clash_results cr
join members m on m.id = cr.member_id
where cr.keys_used > 0
group by cr.member_id, m.in_game_name, cr.clash_type;
