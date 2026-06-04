// Architect-owned: auth boundary enforcement.
// Protects /dashboard routes and redirects logged-in users away from auth pages.
// Must stay at the project root — Next.js middleware only runs from root-level file.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
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
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() validates the session with Supabase Auth — never trust getSession() alone.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Unauthenticated access to any /dashboard route → redirect to login.
  if (pathname.startsWith("/dashboard") && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Authenticated users hitting auth pages → redirect to dashboard.
  if ((pathname === "/login" || pathname === "/signup") && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  // Run on dashboard routes and the two auth pages; skip static assets and API routes.
  matcher: ["/dashboard/:path*", "/login", "/signup"],
};
