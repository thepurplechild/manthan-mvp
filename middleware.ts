import { updateSession } from "./lib/supabase/middleware";
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  // Update the session first
  const response = await updateSession(request);
  
  // Create a Supabase client to check auth and role
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Protect creator routes (/dashboard, /projects)
  if (request.nextUrl.pathname.startsWith('/dashboard') || 
      request.nextUrl.pathname.startsWith('/projects')) {
    if (!user) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }
  }

  // Protect founder routes (/founder)
  if (request.nextUrl.pathname.startsWith('/founder')) {
    if (!user) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }
    
    // Check if user has founder role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    
    if (!profile || profile.role !== 'founder') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // Redirect authenticated users away from auth pages
  if ((request.nextUrl.pathname.startsWith('/auth/login') || 
       request.nextUrl.pathname.startsWith('/auth/signup')) && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}