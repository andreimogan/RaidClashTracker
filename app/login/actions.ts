"use server";

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

// The ONLY Server Actions in this app, and deliberately so.
//
// WHY A SERVER ACTION AT ALL: signing in has to write the session cookies, and
// "Setting cookies is not supported during Server Component rendering. To modify
// cookies, invoke a Server Function from the client or use a Route Handler"
// (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md,
// the "Understanding cookie behavior in Server Functions" section; the same file
// adds "HTTP does not allow setting cookies after streaming starts, so you must
// use `.set` in a Server Function or Route Handler"). A page render therefore
// cannot sign anyone in. @supabase/ssr's createServerClient writes the session
// cookies itself through the setAll callback in lib/supabase/server.ts, which
// only succeeds inside an action — which is exactly here.
//
// WHY NOTHING ELSE LIVES HERE: every data mutation stays on the existing
// app/api/**/route.ts handlers so that requireAdmin() remains the single
// authorization choke point. Server Actions are reachable by direct POST
// ("Server Functions are reachable via direct POST requests, not just through
// your application's UI" — 01-getting-started/07-mutating-data.md), so a second
// write surface would be a second thing to guard. These two touch auth cookies
// and no application data.

export type SignInState = { error: string | null };

// One message for every credential failure. Wrong password, unknown address,
// unconfirmed account and disabled signup all land here, so the response can
// never be used to discover whether an account exists.
const CREDENTIALS_REJECTED = "That email and password didn't match. Try again.";

// Names no service and no variable: /login is a public page, so nothing it can
// render should say which provider handles sign-in. .env.example carries the
// actual variable names, and only the person running the server reads that.
// A sign-in service that cannot be reached is NOT a wrong password, and it
// arrives wearing the same object shape. auth-js turns any failed fetch into an
// AuthRetryableFetchError with status **0** (node_modules/@supabase/auth-js/
// dist/main/lib/fetch.js — the catch around `fetcher(...)`, and handleError's
// `!looksLikeFetchResponse` branch), and does the same for every 500, 501, 502,
// 503, 504 and 520-530 in its NETWORK_ERROR_CODES list. A parse failure with no
// response arrives as AuthUnknownError with no status at all. Without this
// branch all of those read as "your password is wrong", which is exactly the
// wrong instruction: a free-tier project pauses after about a week idle — the
// normal state for a weekly-use dashboard — and the owner would retry into the
// real rate limit. Names no provider, per .claude/rules/ux.md's public-copy
// rule, and reveals nothing about the credentials or the account.
const SERVICE_UNREACHABLE =
  "Couldn't reach the sign-in service. Check your connection and try again in a moment.";

const NOT_CONFIGURED =
  "Sign-in isn't configured on this server, so there is nobody to sign in as. " +
  "Fill in the sign-in settings from .env.example and restart it.";

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Enter both an email address and a password." };
  }

  const supabase = await createServerSupabase();
  if (!supabase) return { error: NOT_CONFIGURED };

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Rate limiting is the one failure worth naming separately: it says nothing
    // about the credentials or the account, and without it a locked-out owner
    // would read "didn't match" and keep retrying into the limit.
    if (error.status === 429 || error.code === "over_request_rate_limit") {
      return { error: "Too many sign-in attempts. Wait a minute, then try again." };
    }
    // Before the credentials branch: transport and server failures are not a
    // rejected password. Missing/zero status covers a dead fetch and an
    // unparseable response; >= 500 covers the gateway and Cloudflare codes.
    if (!error.status || error.status >= 500) {
      return { error: SERVICE_UNREACHABLE };
    }
    return { error: CREDENTIALS_REJECTED };
  }

  // Outside any try/catch: "redirect throws an error so it should be called
  // outside the try block" (04-functions/redirect.md). The session cookies were
  // written by setAll during signInWithPassword and ride along on this response.
  //
  // No revalidatePath: both pages that read isAdmin() are dynamic, and
  // revalidatePath("/", "layout") would drag the statically prerendered /import
  // into runtime revalidation for nothing.
  redirect("/settings");
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabase();
  if (supabase) {
    // scope: "local" — auth-js's own recommendation for a sign-out button
    // ("Sign out only the current session (recommended for most apps)",
    // GoTrueClient.d.ts). It also clears the cookies even when the network call
    // to the auth server fails, because _signOut removes the local session for
    // every scope except "others" (GoTrueClient.js `_signOut`).
    await supabase.auth.signOut({ scope: "local" });
  }
  redirect("/settings");
}
