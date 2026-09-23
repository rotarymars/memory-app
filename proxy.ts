import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";

// Optimistic check only: it just looks for the cookie, it doesn't validate it.
// Pages, actions and route handlers verify the session via getUserId().
export default function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (pathname === "/sign-in" || req.cookies.has(SESSION_COOKIE)) {
    return NextResponse.next();
  }
  const url = new URL("/sign-in", req.url);
  if (pathname !== "/") url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  // API routes authenticate themselves (bearer token or session) and must
  // answer 401 rather than redirect.
  matcher: [
    "/((?!api/|_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
