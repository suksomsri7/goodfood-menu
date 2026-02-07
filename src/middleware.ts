import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Cache version - change this on each deployment to bust LINE browser cache
// This forces a redirect to a new URL that has never been cached
const CACHE_VERSION = "4";

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Only apply cache busting to user-facing pages
  const userPages = ["/goal", "/menu", "/orders", "/cal"];
  const isUserPage =
    pathname === "/" ||
    userPages.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!isUserPage) return NextResponse.next();

  // If version matches, pass through
  if (searchParams.get("_cv") === CACHE_VERSION) {
    return NextResponse.next();
  }

  // Redirect with cache version to bust browser cache
  const url = request.nextUrl.clone();
  url.searchParams.set("_cv", CACHE_VERSION);
  return NextResponse.redirect(url, { status: 302 });
}

export const config = {
  matcher: [
    // Match user-facing pages only (not API, _next, backoffice, static files)
    "/((?!api|_next|backoffice|favicon.ico|manifest.json|.*\\..*).*)",
  ],
};
