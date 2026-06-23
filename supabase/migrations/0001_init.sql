-- Clan Clash Tracker — initial schema.
-- Run in the Supabase SQL editor (or via `supabase db push`).
-- IDs are text so the bundled seed (m1, w20, ...) keeps referential integrity;
-- real ingestion can use any stable string (game member id, slug, etc.).

create table if not exists members (
  id           text primary key,
  in_game_name text not null,
  level        int  not null default 0,
  hero_level   int  not null default 0,
  avatar_url   text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists weeks (
  id          text primary key,
  week_number int  not null unique,
  start_date  date not null,
  end_date    date not null
);

create table if not exists clash_results (
  id           text primary key,
  week_id      text not null references weeks(id) on delete cascade,
  member_id    text not null references members(id) on delete cascade,
  clash_type   text not null check (clash_type in ('hydra', 'chimera')),
  keys_used    numeric not null default 0,
  total_damage bigint  not null default 0,
  unique (week_id, member_id, clash_type)
);

create table if not exists clash_meta (
  week_id    text not null references weeks(id) on delete cascade,
  clash_type text not null check (clash_type in ('hydra', 'chimera')),
  progress   numeric not null default 0,
  primary key (week_id, clash_type)
);

create index if not exists idx_clash_results_week on clash_results(week_id);
create index if not exists idx_clash_results_member on clash_results(member_id);

-- Convenience view for quick SQL inspection of damage-per-key.
create or replace view member_clash_averages as
select
  cr.member_id,
  m.in_game_name,
  cr.clash_type,
  avg(cr.keys_used)                                          as avg_keys,
  avg(cr.total_damage)                                       as avg_damage,
  sum(cr.total_damage)::numeric / nullif(sum(cr.keys_used), 0) as avg_damage_per_key
from clash_results cr
join members m on m.id = cr.member_id
where cr.keys_used > 0
group by cr.member_id, m.in_game_name, cr.clash_type;

-- ---- Row Level Security: public read-only ----
alter table members       enable row level security;
alter table weeks         enable row level security;
alter table clash_results enable row level security;
alter table clash_meta    enable row level security;

-- Anyone (anon key) may read; writes are performed with the service-role key,
-- which bypasses RLS, so no insert/update/delete policies are defined.
create policy "public read members"       on members       for select using (true);
create policy "public read weeks"          on weeks         for select using (true);
create policy "public read clash_results"  on clash_results for select using (true);
create policy "public read clash_meta"     on clash_meta    for select using (true);
