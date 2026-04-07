import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { type ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Browser client for client components (login form, etc.) */
export function createBrowserAuthClient() {
  return createBrowserClient(url, anonKey);
}

/** Server client for server components and route handlers */
export function createServerAuthClient(cookieStore: ReadonlyRequestCookies) {
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          try {
            cookieStore.set(name, value, options);
          } catch {
            // Server Components can't set cookies — middleware handles refresh
          }
        });
      },
    },
  });
}

/** Middleware client for token refresh */
export function createMiddlewareAuthClient(
  request: NextRequest,
  response: NextResponse
) {
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });
}
