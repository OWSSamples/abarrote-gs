import { NextRequest, NextResponse } from 'next/server';

export const auth = {
  middleware: (config: { loginUrl: string }) => {
    return async (request: NextRequest) => {
      const sessionCookie = request.cookies.get('__session')?.value;

      // No session cookie → redirect to login
      if (!sessionCookie) {
        const loginUrl = new URL(config.loginUrl, request.url);
        loginUrl.searchParams.set('from', request.nextUrl.pathname);
        return NextResponse.redirect(loginUrl);
      }

      // Basic JWT structure check (3 dot-separated base64 segments)
      const parts = sessionCookie.split('.');
      if (parts.length !== 3) {
        // Malformed token — clear cookie and redirect
        const loginUrl = new URL(config.loginUrl, request.url);
        const response = NextResponse.redirect(loginUrl);
        response.cookies.delete('__session');
        return response;
      }

      // Token exists and looks structurally valid — allow through.
      // Deep verification (Cognito JWT verification via aws-jwt-verify) happens in
      // server actions via guard.ts requireAuth().
      return NextResponse.next();
    };
  },
};
