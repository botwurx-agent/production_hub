import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";

const PUBLIC_PATHS = [
  // The marketing home. Safe as an exact match only: the prefix test below
  // compares against `${p}/`, which for "/" is "//" and matches nothing, so
  // this does not open the rest of the app.
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/terms",
  "/privacy",
  "/auth",
  "/r",
  "/rb",
  "/b",
  // The client project binder. Its own prefix because /b is the shared board.
  "/bd",
  "/c",
  "/p",
  "/h",
  "/invite",
  "/project-invite",
  "/api/cron",
];

/**
 * Refreshes the Supabase auth session on every request and gates the app.
 * Unauthenticated users hitting a protected path are sent to /login;
 * authenticated users hitting an auth page are sent to the app home.
 */
export async function updateSession(request: NextRequest) {
  // Forward the current path to server components (the app layout uses it to
  // gate project collaborators to their project pages).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/projects";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
