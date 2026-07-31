import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  MARKETING_ROOT,
  isMarketingHost,
  isMarketingPath,
} from "@/lib/marketing/hosts";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Marketing pages are public and stateless, so they deliberately skip
  // updateSession: refreshing a Supabase session on the most-visited pages of
  // the site would add an auth round trip to every visit and buy nothing.
  //
  // Both branches below matter. The first serves the apex domain, where the
  // visitor sees "/" and never the internal prefix. The second serves /site
  // directly on ANY host, which is the only way the marketing site is
  // reachable on localhost and on Vercel preview URLs: without it the app's
  // auth gate treats /site as a protected path and redirects to /login, so
  // nothing could be previewed until the apex domain is live.
  if (isMarketingHost(request.headers.get("host")) && isMarketingPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = `${MARKETING_ROOT}${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }

  if (pathname === MARKETING_ROOT || pathname.startsWith(`${MARKETING_ROOT}/`)) {
    return NextResponse.next();
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and image files so the
     * auth session is refreshed on every real navigation.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
