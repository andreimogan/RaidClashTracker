-- Raid Clash Tracker — Supabase Postgres. Migration 0002: close the anonymous
-- PostgREST hole on schema `public`.
--
-- Forward-only, applied in filename order by `npm run db:migrate`, which keeps NO
-- applied-migrations table and re-applies every file on every run. So this file is
-- written to be re-runnable: `enable row level security` is a no-op when RLS is
-- already on, `revoke` is a no-op when the privilege is already absent, `alter view
-- … set (…)` is unconditional, and `alter default privileges … revoke` is a no-op
-- when the default ACL already withholds the privilege. None of them error on a
-- second pass. Never edit this file once applied — add 0003_*.sql instead.
-- (Exception taken once, deliberately: the SCOPE WARNING under lever 4 and the
-- service_role note below were added after review, while this file was still
-- untracked and uncommitted, so no environment had applied a different version.
-- They are comment-only and change no statement. That rule guards applied
-- SEMANTICS from drifting; it was not waived for the SQL itself.)
--
-- WHY THIS EXISTS (measured against the live project on 2026-08-12, before this
-- file, using the browser-visible `sb_publishable_*` key as apikey + Bearer):
--
--   GET  /rest/v1/members|weeks|clash_results|clash_meta|member_clash_averages -> 200
--   POST /rest/v1/members                                                      -> 201, row created
--
-- Catalog at that moment: relrowsecurity = false on all five objects, zero rows in
-- pg_policies for `public`, and `anon` AND `authenticated` each holding
-- SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on all five.
-- Supabase grants that by default on `public` and expects RLS to be the gate;
-- migration 0001's plain `create table` statements inherited it. The threat model
-- is not this app -- it is anyone holding a key that is meant to be public.
--
-- THE APP IS UNAFFECTED, and that was measured too, not reasoned:
-- `DATABASE_URL` connects as `postgres`, which (a) OWNS all four tables and the
-- view and (b) has `rolbypassrls = true`. RLS therefore does not apply to it. A
-- rehearsal in a throwaway schema confirmed the owner still SELECTs, INSERTs and
-- UPDATEs with RLS enabled and zero policies present.
--
-- FOUR LEVERS, deliberately overlapping, because they fail in opposite directions.
-- Each row below was measured in a throwaway schema shaped like this one:
--
--   1. RLS + ZERO POLICIES on the four tables.
--      Buys: anon SELECT returns 0 rows; anon INSERT fails 42501 ("new row
--      violates row-level security policy"). Also clears the dashboard's "RLS
--      disabled in public" warning, which is how the owner would notice a
--      regression here. BUT the dashboard replaces it with a NEW advisory --
--      "RLS enabled, no policies" on all four tables. THAT IS THE INTENDED END
--      STATE. Do not resolve it the way the dashboard suggests: adding a policy
--      to silence the advisory is precisely this lever's failure mode below.
--      Fails if: someone later adds a permissive policy (`for select using
--      (true)`) for a "public leaderboard". Lever 2 still holds if they do.
--
--   2. REVOKE ALL … FROM anon, authenticated on all four tables AND the view.
--      Buys: 42501 "permission denied for table" BEFORE any row filtering, so not
--      even column names leak (verified: `select dmg from t` is refused
--      identically). Survives a stray permissive policy.
--      Fails if: someone runs `grant select on all tables in schema public to
--      anon` -- a common copy-paste. Lever 1 still holds if they do.
--
--   3. security_invoker = on for the view.
--      RLS DOES NOT EXIST ON VIEWS: `alter view … enable row level security` is
--      invalid syntax, and a view runs with its OWNER's rights by default. This is
--      not theoretical -- it was reproduced: with RLS on the base table and the
--      view left alone, anon selecting the view got the FULL row count (2) while
--      the base table correctly reported 0. Setting security_invoker = on dropped
--      it to 0. Without this lever, lever 1 is bypassable through the view.
--
--   4. ALTER DEFAULT PRIVILEGES … REVOKE ALL ON TABLES FROM anon, authenticated.
--      Buys: the next `create table` in `public` (Phase 4/5) cannot silently
--      reopen the hole. `alter default privileges` is scoped to the GRANTING role,
--      so it only works when run as the role that will create those tables --
--      here `postgres`, which is both the migrate role and the owner of every
--      existing object, so the scoping lines up.
--      SCOPE WARNING -- this lever is ON TABLES ONLY, and the other two object
--      classes are DELIBERATELY still open. Measured: pg_default_acl for granting
--      role `postgres` in `public` is now {postgres,service_role} for tables (fixed),
--      but still grants anon + authenticated EXECUTE on future FUNCTIONS and rwU on
--      future SEQUENCES. Harmless today -- this schema has zero of each -- but the
--      day a migration adds, say, `public.member_totals()` as an aggregation helper,
--      anon inherits EXECUTE and PostgREST exposes it at /rest/v1/rpc/member_totals
--      to the publishable key. If that helper is `security definer` (the natural
--      reflex for something reading RLS-protected tables) it runs as `postgres` and
--      bypasses ALL FOUR LEVERS at once. So: A MIGRATION THAT ADDS A FUNCTION TO
--      `public` MUST REVOKE EXECUTE ON IT EXPLICITLY -- and note one
--      `alter default privileges … on functions` line is not sufficient either,
--      because Postgres additionally grants EXECUTE on new functions to PUBLIC.
--
-- DELIBERATELY ABSENT -- do not "harden" these in later:
--
--   * `force row level security` -- excluded, but NOT for the usual reason, which
--     was tested and turns out to be false here: because `postgres` has
--     `rolbypassrls = true`, BYPASSRLS wins over FORCE, and a forced table still
--     let the owner SELECT and INSERT normally in rehearsal. It is excluded
--     because it buys nothing (anon/authenticated are already refused at the
--     grant layer, with zero policies to satisfy) while arming a landmine: the
--     day the app connects as any role WITHOUT bypassrls, forced RLS plus zero
--     policies silently returns zero rows and rejects every write.
--
--   * `revoke usage on schema public` -- PostgREST's schema introspection,
--     Realtime, and the dashboard's API-docs generator may depend on it. That
--     dependency is unverified, so the schema grant is left alone. Note the
--     consequence: schema USAGE is what makes lever 2's error "permission denied
--     for table" rather than "for schema".
--
--   * Any `create policy` statement. ZERO POLICIES IS THE DESIGN -- nothing should
--     reach these tables except the server, as owner, over DATABASE_URL.
--
--   * Dropping the view or the indexes; anything in the `auth` schema. Auth lives
--     at /auth/v1 and in the `auth` schema, and holds NO grants for anon or
--     authenticated at all -- nothing below can affect it.
--
--   * `service_role`'s privileges. It KEEPS full DML on all five objects and has
--     `rolbypassrls = true`, so `public` is closed to the two PUBLIC-FACING roles,
--     NOT to every non-owner role. Left alone on purpose: Supabase's own tooling
--     depends on it. It is reached only by the SECRET key (`sb_secret_*`), which
--     must never appear in a browser bundle, a NEXT_PUBLIC_* env var, or this repo.
--     Read this before concluding from the four levers that `public` is sealed.
--
-- ORDERING IS LOAD-BEARING, and it is why lever 2 is not redundant. Measured: a
-- bare `create or replace view` RESETS reloptions, so 0001 wipes lever 3's
-- security_invoker every single time it re-applies. Filename order puts 0002
-- after 0001, so a full `npm run db:migrate` always ends correct -- but applying
-- 0001 alone (pasting it into the Supabase SQL editor, say) reopens the view to
-- owner-rights execution while leaving the revoked grants intact. Lever 2 is what
-- keeps that from being an exposure. `create or replace view` does NOT reset
-- relacl, so the revokes survive it.

-- Lever 1 — RLS on, with no policies, so nothing but the owner/bypassrls role passes.
alter table public.members       enable row level security;
alter table public.weeks         enable row level security;
alter table public.clash_results enable row level security;
alter table public.clash_meta    enable row level security;

-- Lever 2 — take the default Supabase grants away from both public-facing roles.
-- `on table` covers the view too: Postgres treats a view as a table for privileges.
revoke all on table
  public.members,
  public.weeks,
  public.clash_results,
  public.clash_meta,
  public.member_clash_averages
from anon, authenticated;

-- Lever 3 — make the view execute as its caller, so it cannot launder past lever 1.
alter view public.member_clash_averages set (security_invoker = on);

-- Lever 4 — stop future tables in `public` from inheriting the same open grants.
alter default privileges in schema public revoke all on tables from anon, authenticated;
