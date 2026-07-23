import { auth0 } from "./lib/auth0";
import { NextRequest, NextResponse } from "next/server";
import { getServerIdentity, hasAdminAccess } from "./lib/serverAuth";

export async function middleware(request: NextRequest) {
  const authResponse = await auth0.middleware(request);
  const pathname = request.nextUrl.pathname;
  const isAdminPage = pathname === "/admin" || pathname.startsWith("/admin/");

  if (!isAdminPage) {
    return authResponse;
  }

  const identity = await getServerIdentity(request);
  if (!identity) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (!hasAdminAccess(identity)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  return authResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
