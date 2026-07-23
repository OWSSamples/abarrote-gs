import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || process.env.COGNITO_USER_POOL_ID || null;
  const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || process.env.COGNITO_CLIENT_ID || null;
  const region = process.env.NEXT_PUBLIC_COGNITO_REGION || process.env.COGNITO_REGION || 'us-east-1';

  return NextResponse.json({
    success: true,
    data: {
      userPoolId,
      clientIdPrefix: (clientId || '').slice(0, 6),
      region,
      hasUserPoolId: !!userPoolId,
      hasClientId: !!clientId,
      source: {
        userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID
          ? 'NEXT_PUBLIC_COGNITO_USER_POOL_ID'
          : process.env.COGNITO_USER_POOL_ID
            ? 'COGNITO_USER_POOL_ID'
            : null,
        clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID
          ? 'NEXT_PUBLIC_COGNITO_CLIENT_ID'
          : process.env.COGNITO_CLIENT_ID
            ? 'COGNITO_CLIENT_ID'
            : null,
      },
    },
  });
}
