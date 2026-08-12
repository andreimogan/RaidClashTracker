import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Token refresh, and NOTHING else.
//
// THE FILE NAME IS LOAD-BEARING. In this Next version the convention is
// `proxy.ts`, not `middleware.ts`: "The `middleware` file convention is
// deprecated and has been renamed to `proxy`" (node_modules/next/dist/docs/
// 01-app/03-api-reference/03-file-conventions/proxy.md:11, and its version
// history at :774 for v16.0.0). A `middleware.ts` here would be SILENTLY
// IGNORED — no error, nothing in the build output, and sessions would simply
// expire without ever refreshing. The export must be named `proxy` or be the
// default export (same doc, :58).
//
// NO `runtime` EXPORT. Unlike every route file in app/api/, "The `runtime`
// config option is not available in Proxy files. Setting the `runtime` config
// option in Proxy will throw an error" (same doc, "## Runtime"). Proxy already
// defaults to the Node.js runtime.
//
// IT DOES NOT IMPORT lib/supabase/server.ts. That module reads cookies through
// `next/headers`, which is the wrong contract here — a proxy uses
// request.cookies / response.cookies — and the docs warn against it anyway:
// "Proxy is meant to be invoked separately of your render code ... you should
// not attempt relying on shared modules or globals" (same doc, :19). It also
// never touches lib/db.ts's pool, for the same reason.
//
// IT NEVER BLOCKS. Reads are public: no redirect, no rewrite, no 401 on any
// path. Authorization lives in lib/auth.ts's requireAdmin(), called first-line
// in each route handler — which is what Next prescribes, because a proxy cannot
// cover Server Functions reliably: "A matcher change or a refactor that moves a
// Server Function to a different route can silently remove Proxy coverage.
// Always verify authentication and authorization inside each Server Function
// rather than relying on Proxy alone."
//
// WHY IT MUST EXIST AT ALL: @supabase/ssr's server client is created with
// autoRefreshToken disabled, and this is the only place a refresh can be
// PERSISTED DURING A PAGE RENDER — `cookies().set` throws there, so
// lib/supabase/server.ts's setAll swallows it. (Precisely: route handlers and
// Server Actions do also refresh, and their writes succeed, because cookie
// writes are legal in those phases. Measured: a POST to /api/reset with a stale
// session returns a Set-Cookie even though the matcher excludes api/. So do not
// conclude from this file either that write routes need proxy coverage, or that
// all refreshing depends on it.) Without this file a visitor who only reads
// pages never has their session renewed. Delete
// this file and logins quietly stop lasting.

export async function proxy(request: NextRequest) {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();

  // Unconfigured: hand the request straight through. The dashboard is meant to
  // be readable with no Supabase setup at all (demo mode), so a missing env var
  // must not cost a page render.
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        // Write refreshed tokens twice: onto the request so this render sees
        // them, and onto a fresh response so the browser stores them.
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  try {
    // The call itself is the refresh: an expiring token is renewed and written
    // back through setAll above. The result is deliberately unused — this file
    // decides nothing.
    await supabase.auth.getClaims();
  } catch {
    // A Supabase outage must not take the public dashboard down with it.
  }

  return response;
}

export const config = {
  // Everything except static assets and app/api. Route handlers run their own
  // requireAdmin() guard and can refresh cookies themselves, so proxying them
  // would add a hop without adding safety.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
