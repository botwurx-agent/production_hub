import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and media files so the
     * auth session is refreshed on every real navigation.
     *
     * IMPORTANT: every static file extension the public site serves has to be
     * listed here. Anything missing is redirected to /login for a logged-out
     * visitor, which is silent: the marketing page renders and the file is
     * simply absent. The pdf.worker bug was this, and the demo clips on the
     * feature pages are why mp4/webm are here.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|mp4|webm|mjs|js|css|woff|woff2)$).*)",
  ],
};
