import { auth } from '@/lib/auth/server';

export default auth.middleware({ loginUrl: '/auth/login' });

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|auth).*)',
  ],
};
