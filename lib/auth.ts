import "server-only";
import { cache } from "react";
import { NextResponse } from "next/server";
import { createServerSupabase } from "./supabase/server";

// Authorization for the one admin account. Reads are public; every write and
// every data-exfil route is gated on this.
//
// TWO EXPORTS, AND THAT IS A CONTRACT: app/api/**/route.ts calls requireAdmin(),
// the two pages that render write affordances call isAdmin(). Nothing else.
//
// WHY getClaims() AND NOT getSession(): with cookie storage the session's user
// object is attacker-controlled until the JWT is verified. auth-js says so
// outright — "If using an insecure storage medium, such as cookies or request
// headers, the user object returned by this function must not be trusted"
// (node_modules/@supabase/auth-js/dist/module/GoTrueClient.d.ts:1413).
// getClaims() verifies the signature. This project's Supabase issues asymmetric
// ES256 keys (its /auth/v1/.well-known/jwks.json publishes one EC key), so that
// verification happens LOCALLY — no network round-trip per check.
//
// The tradeoff that buys, stated so nobody has to rediscover it: a token stays
// valid until it expires. Deleting or banning the account in Supabase does not
// revoke an already-issued token. For a single-admin dashboard that is an
// acceptable window; if that ever stops being true, swap to getUser(), which
// asks the auth server and is authoritative at the cost of a network call.

const FORBIDDEN = "Sign in as the clan admin to do that.";

/**
 * True only for a verified, non-anonymous session whose email matches
 * ADMIN_EMAIL. NEVER THROWS — server pages call this to decide whether to
 * render a button, and a throw there would surface as a 500 instead of a
 * hidden control. Every uncertainty resolves to `false`.
 *
 * Wrapped in React's cache() so a page reading it twice in one render costs one
 * verification.
 */
export const isAdmin = cache(async (): Promise<boolean> => {
  try {
    const expected = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    if (!expected) return false; // unset or blank -> nobody is admin

    const supabase = await createServerSupabase();
    if (!supabase) return false; // Supabase not configured -> nobody is admin

    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims) return false; // no session, or signature failed

    const { email, role, is_anonymous: isAnonymous } = data.claims;
    if (role !== "authenticated") return false;
    if (isAnonymous === true) return false;
    if (typeof email !== "string") return false;

    return email.trim().toLowerCase() === expected;
  } catch {
    // Network failure, unroutable host, malformed cookie, missing JWKS — all of
    // it lands here and all of it means "not proven to be the admin".
    return false;
  }
});

/**
 * Guard for route handlers. Returns `null` when the caller is the admin, or the
 * 401 response to hand straight back when they are not:
 *
 *   const denied = await requireAdmin();
 *   if (denied) return denied;
 *
 * RETURNS RATHER THAN THROWS on purpose. A thrown error inside a route handler
 * becomes a 500 carrying a Next digest, not the JSON body the client components
 * already know how to render from `data.error`.
 *
 * A signed-in non-admin gets a byte-identical response to an anonymous caller,
 * so nothing here reveals whether an account exists.
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  if (await isAdmin()) return null;
  return NextResponse.json({ ok: false, error: FORBIDDEN }, { status: 401 });
}
