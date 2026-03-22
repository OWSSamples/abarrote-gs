import { auth } from '@/lib/auth/server';

const handler = auth.middleware({ loginUrl: '/auth/login' });

export async function proxy(request: Parameters<typeof handler>[0]) {
  return handler(request);
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|auth|login-brand\\.svg|backgrounds).*)',
  ],
};
