const cognitoEnv = {
  userPoolId: process.env.COGNITO_USER_POOL_ID || process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
  clientId: process.env.COGNITO_CLIENT_ID || process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
  region: process.env.COGNITO_REGION || process.env.NEXT_PUBLIC_COGNITO_REGION,
  domain: process.env.COGNITO_DOMAIN || process.env.NEXT_PUBLIC_COGNITO_DOMAIN,
  redirectSignIn: process.env.COGNITO_REDIRECT_SIGN_IN || process.env.NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_IN,
  redirectSignOut: process.env.COGNITO_REDIRECT_SIGN_OUT || process.env.NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_OUT,
  oauthProviders: process.env.COGNITO_OAUTH_PROVIDERS || process.env.NEXT_PUBLIC_COGNITO_OAUTH_PROVIDERS,
  oauthScopes: process.env.COGNITO_OAUTH_SCOPES || process.env.NEXT_PUBLIC_COGNITO_OAUTH_SCOPES,
};

const required = [
  ['DATABASE_URL', process.env.DATABASE_URL],
  ['COGNITO_USER_POOL_ID', cognitoEnv.userPoolId],
  ['COGNITO_CLIENT_ID', cognitoEnv.clientId],
  ['COGNITO_REGION', cognitoEnv.region],
] as const;

function status(label: string, ok: boolean, detail?: string) {
  const marker = ok ? 'ok' : 'fail';
  console.log(`${marker}: ${label}${detail ? ` - ${detail}` : ''}`);
}

function splitList(value: string | undefined): string[] {
  return value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

async function main() {
  const missing = required.filter(([, value]) => !value).map(([key]) => key);
  status('required environment variables', missing.length === 0, missing.length ? `missing ${missing.join(', ')}` : undefined);

  const region = cognitoEnv.region;
  const userPoolId = cognitoEnv.userPoolId;
  const clientId = cognitoEnv.clientId;
  const domain = cognitoEnv.domain;

  if (!region || !userPoolId || !clientId) return;

  const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
  const oidcResponse = await fetch(`${issuer}/.well-known/openid-configuration`);
  status('cognito oidc discovery', oidcResponse.ok, `http ${oidcResponse.status}`);
  if (!oidcResponse.ok) return;

  const oidc = (await oidcResponse.json()) as { issuer?: string; jwks_uri?: string };
  status('cognito issuer match', oidc.issuer === issuer);

  if (oidc.jwks_uri) {
    const jwksResponse = await fetch(oidc.jwks_uri);
    const jwks = jwksResponse.ok ? ((await jwksResponse.json()) as { keys?: unknown[] }) : null;
    status('cognito jwks', jwksResponse.ok && Array.isArray(jwks?.keys) && jwks.keys.length > 0, `http ${jwksResponse.status}`);
  }

  const signUpProbeResponse = await fetch(`https://cognito-idp.${region}.amazonaws.com/`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-amz-json-1.1',
      'x-amz-target': 'AWSCognitoIdentityProviderService.SignUp',
    },
    body: JSON.stringify({
      ClientId: clientId,
      Username: crypto.randomUUID().replaceAll('-', ''),
      Password: 'Opendex-Healthcheck-Password-9!',
      UserAttributes: [
        { Name: 'email', Value: 'invalid-email-address' },
        { Name: 'name', Value: 'Opendex Healthcheck' },
      ],
    }),
  });

  const data = (await signUpProbeResponse.json().catch(() => ({}))) as { __type?: string; message?: string };
  const type = data.__type ?? 'unknown';
  const probeMessage = data.message?.toLowerCase() ?? '';
  const hasClientSecret = probeMessage.includes('secret_hash');
  const rejectedInvalidEmail =
    type.includes('InvalidParameterException') &&
    probeMessage.includes('email');

  status(
    'cognito sign-up reaches email schema validation',
    !hasClientSecret && rejectedInvalidEmail,
    hasClientSecret ? 'client is configured with secret' : `${type}: ${data.message ?? 'unexpected response'}`,
  );

  const opaqueUsername = crypto.randomUUID().replaceAll('-', '');
  const signUpPolicyProbeResponse = await fetch(`https://cognito-idp.${region}.amazonaws.com/`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-amz-json-1.1',
      'x-amz-target': 'AWSCognitoIdentityProviderService.SignUp',
    },
    body: JSON.stringify({
      ClientId: clientId,
      Username: opaqueUsername,
      Password: 'aa',
      UserAttributes: [
        { Name: 'email', Value: `${opaqueUsername}@example.invalid` },
        { Name: 'name', Value: 'Opendex Healthcheck' },
      ],
    }),
  });
  const policyProbe = (await signUpPolicyProbeResponse.json().catch(() => ({}))) as {
    __type?: string;
    message?: string;
  };
  const reachedPasswordPolicy = policyProbe.__type?.includes('InvalidPasswordException') === true;
  status(
    'cognito self sign-up accepts opaque usernames',
    reachedPasswordPolicy,
    `${policyProbe.__type ?? 'unknown'}: ${policyProbe.message ?? 'unexpected response'}`,
  );

  if (domain) {
    const configuredRedirects = splitList(cognitoEnv.redirectSignIn);
    const redirectUri =
      configuredRedirects[0] ??
      (process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '')}/auth/callback`
        : 'http://localhost:3000/auth/callback');
    const domainOrigin = domain.startsWith('http') ? domain : `https://${domain}`;
    const hostedUrl = new URL('/oauth2/authorize', domainOrigin);
    hostedUrl.searchParams.set('client_id', clientId);
    hostedUrl.searchParams.set('response_type', 'code');
    hostedUrl.searchParams.set('scope', splitList(cognitoEnv.oauthScopes).join(' ') || 'openid email phone');
    hostedUrl.searchParams.set('redirect_uri', redirectUri);
    hostedUrl.searchParams.set('state', 'opendex-healthcheck');
    const hostedResponse = await fetch(hostedUrl, { redirect: 'manual' });
    status(
      'cognito authorization endpoint reachable',
      hostedResponse.status >= 200 && hostedResponse.status < 400,
      `http ${hostedResponse.status}`,
    );
  } else {
    status('cognito hosted ui configured', false, 'COGNITO_DOMAIN is empty');
  }

  const providers = splitList(cognitoEnv.oauthProviders);
  const extraSignIn = splitList(cognitoEnv.redirectSignIn);
  const extraSignOut = splitList(cognitoEnv.redirectSignOut);
  status('cognito oauth providers env', providers.length > 0, providers.length ? providers.join(', ') : 'not configured');
  status('cognito extra redirect sign-in env', true, `${extraSignIn.length} configured`);
  status('cognito extra redirect sign-out env', true, `${extraSignOut.length} configured`);
}

main().catch((error) => {
  status('environment check', false, error instanceof Error ? error.message : 'unknown error');
  process.exitCode = 1;
});
