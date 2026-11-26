import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

const PROTECTED_PAGES = ["/dashboard", "/machines", "/actions", "/settings"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  const requestHeaders = new Headers(request.headers);
  if (session) {
    requestHeaders.set("x-wattwise-user", session.username);
    requestHeaders.set("x-wattwise-role", session.role);
    requestHeaders.set("x-wattwise-workshop", session.workshopId);
  }

  const enforceAuth = process.env.WATTWISE_ENFORCE_AUTH === "true";
  const isProtectedPage = PROTECTED_PAGES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (enforceAuth && isProtectedPage && !session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/machines/:path*",
    "/actions/:path*",
    "/settings/:path*",
  ],
};
