import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Supabase client for server-side code, used for AUTHENTICATION ONLY.
//
// Every database read and write in this app goes through lib/db.ts's postgres.js
// pool as the table owner. Nothing here ever calls `.from()` or touches
// /rest/v1 — migration 0002 revoked the `anon` and `authenticated` roles' grants
// on `public` precisely so that PostgREST is closed, and reopening a path to it
// would undo that.
//
// Returns `null` when the Supabase env vars are absent, rather than throwing.
// That is what lets lib/auth.ts's isAdmin() promise never to throw: a missing
// configuration is an ordinary "not an admin" answer, not a 500.

type ServerSupabase = ReturnType<typeof createServerClient>;

export async function createServerSupabase(): Promise<ServerSupabase | null> {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return null;

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        // Supabase's own docs are blunt about this pair: failing to implement
        // getAll AND setAll correctly causes "random logouts, early session
        // termination, JSON parsing errors" (node_modules/@supabase/ssr/dist/
        // main/createServerClient.d.ts:27-30).
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Expected, and safe to swallow: "Setting cookies is not supported
          // during Server Component rendering" (node_modules/next/dist/docs/
          // 01-app/03-api-reference/04-functions/cookies.md). A refresh that
          // lands mid-render therefore cannot write here — proxy.ts is the
          // component that does write refreshed tokens, on every request.
        }
      },
    },
  });
}
