import { withAuth } from 'next-auth/middleware';

export default withAuth({
  callbacks: {
    authorized: ({ token }) => !!token,
  },
});

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/employees/:path*',
    '/availability/:path*',
    '/planning/:path*',
    '/admin/:path*',
    '/settings/:path*',
    '/open-shifts/:path*',
    '/api/employees/:path*',
    '/api/availability/:path*',
    '/api/availability-exceptions/:path*',
    '/api/recurring-availability/:path*',
    '/api/shifts/:path*',
    '/api/shift-requests/:path*',
    '/api/reports/:path*',
    '/api/employee-status/:path*',
    '/api/profile/:path*',
    '/api/dashboard/:path*',
    '/api/auth/change-password',
  ],
};
