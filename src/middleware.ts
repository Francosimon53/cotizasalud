import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareAuthClient } from "@/lib/supabase-auth";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const supabase = createMiddlewareAuthClient(request, response);

  // Refresh session token (this is the source of truth, not getSession)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Protect dashboard — redirect to login if not authenticated
  if (pathname.startsWith("/agentes/dashboard") && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/agentes/login";
    return NextResponse.redirect(loginUrl);
  }

  // If already logged in, redirect away from login page
  if (pathname === "/agentes/login" && user) {
    const dashUrl = request.nextUrl.clone();
    dashUrl.pathname = "/agentes/dashboard";
    return NextResponse.redirect(dashUrl);
  }

  return response;
}

export const config = {
  matcher: ["/agentes/dashboard/:path*", "/agentes/login"],
};
