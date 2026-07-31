import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  MARKETING_ROOT,
  isMarketingHost,
  isMarketingPath,
} from "@/lib/marketing/hosts";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isMarketingHost(request.headers.get("host")) && isMarketingPath(pathname)) {
    // Marketing pages are public and stateless, so they deliberately skip
    // updateSession: refreshing a Supabase session on the most-visited pages of
    // the site would add an auth round trip to every visit and buy nothing.
    const url = request.nextUrl.clone();
    url.pathname = `${MARKETING_ROOT}${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
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
