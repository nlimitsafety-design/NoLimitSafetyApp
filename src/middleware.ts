import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default async function middleware(req: NextRequest) {
  // 1. Domain Check
  const host = req.headers.get('host') || '';
  // remove port if present
  const hostname = host.split(':')[0].toLowerCase();
  
  // Allowed domains: production, development, and Vercel previews
  const isAllowed = 
    hostname === 'nlsplanning.nl' ||
    hostname === 'www.nlsplanning.nl' ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.vercel.app');

  if (!isAllowed) {
    console.log(`Blocked request from hostname: ${hostname}`);
    return new NextResponse(
      JSON.stringify({ 
        error: 'Invalid domain',
        message: 'This application is only accessible from nlsplanning.nl',
        hostname 
      }),
      { 
        status: 403, 
        headers: { 
          'content-type': 'application/json' 
        } 
      }
    );
  }

  // 2. Auth Check - Manual delegation to withAuth for protected routes
  // We use a list of protected path prefixes
  const protectedPaths = [
    '/dashboard', 
    '/employees', 
    '/availability', 
    '/planning', 
    '/admin', 
    '/settings',
    '/open-shifts', 
    '/functies', 
    '/kwalificaties', 
    '/toeslagen', 
    '/notifications', 
    '/berichten',
    '/api/employees', 
    '/api/conversations', 
    '/api/availability', 
    '/api/recurring-availability', 
    '/api/shifts',
    '/api/shift-requests',
    '/api/reports',
    '/api/employee-status',
    '/api/profile',
    '/api/dashboard',
    '/api/functies',
    '/api/kwalificaties',
    '/api/toeslagen',
    '/api/notifications',
    '/api/push-subscription',
    '/api/push-test',
    '/push-debug',
    '/api/auth/change-password'
  ];

  const isProtected = protectedPaths.some(path => req.nextUrl.pathname.startsWith(path));

  if (isProtected) {
    // Create an auth middleware instance
    const authMiddleware = withAuth({
      callbacks: {
        authorized: ({ token }) => !!token,
      },
    });
    
    // Execute it
    // @ts-ignore - withAuth types are tricky
    return authMiddleware(req);
  }

  // Allow public paths (e.g. /login, /api/auth/signin)
  return NextResponse.next();
}

export const config = {
  // Match almost everything to enforce domain check
  // Exclude auth API internal routes that shouldn't be blocked? 
  // NextAuth routes are /api/auth/* -> We can inspect this inside.
  // We want to block /login if domain is wrong.
  // We want to block /api/auth/signin if domain is wrong.
  // So we match everything except static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
