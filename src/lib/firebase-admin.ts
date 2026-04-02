import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

interface ServiceAccountCredential {
    projectId: string;
    clientEmail: string;
    privateKey: string;
}

/**
 * Resolves Firebase Admin credentials.
 * Priority:
 *   1. FIREBASE_SERVICE_ACCOUNT_KEY — full JSON service account (most reliable)
 *   2. FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY — individual fields (fallback)
 */
function resolveCredentials(): ServiceAccountCredential | null {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'consola-shop';

    // ── Strategy 1: full service account JSON ──
    const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountRaw) {
        try {
            // The value may be base64-encoded or a raw JSON string
            const json = serviceAccountRaw.startsWith('{')
                ? serviceAccountRaw
                : Buffer.from(serviceAccountRaw, 'base64').toString('utf-8');
            const parsed = JSON.parse(json) as {
                project_id?: string;
                client_email?: string;
                private_key?: string;
            };
            if (parsed.client_email && parsed.private_key) {
                return {
                    projectId: parsed.project_id ?? projectId,
                    clientEmail: parsed.client_email,
                    privateKey: parsed.private_key,
                };
            }
        } catch {
            console.warn('[FIREBASE ADMIN] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY as JSON, falling back to individual env vars.');
        }
    }

    // ── Strategy 2: individual env vars ──
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const rawKey = process.env.FIREBASE_PRIVATE_KEY;
    if (clientEmail && rawKey) {
        // Normalize: strip surrounding quotes, then replace \n literals with real newlines
        const privateKey = rawKey
            .trim()
            .replace(/^["']|["']$/g, '')
            .replace(/\\n/g, '\n');
        return { projectId, clientEmail, privateKey };
    }

    return null;
}

export function getFirebaseAdminApp() {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'consola-shop';

    if (!process.env.GOOGLE_CLOUD_PROJECT) {
        process.env.GOOGLE_CLOUD_PROJECT = projectId;
    }

    const apps = getApps();
    if (apps.length > 0) {
        if (!apps[0].options.projectId) {
            console.warn('[FIREBASE ADMIN] Existing app has no projectId — this usually means HMR caught an empty env context. Restart the dev server.');
        }
        return apps[0];
    }

    const credentials = resolveCredentials();
    if (!credentials) {
        console.warn('[FIREBASE ADMIN] Missing credentials. Set FIREBASE_SERVICE_ACCOUNT_KEY or both FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.');
        return null;
    }

    console.log('[FIREBASE ADMIN] Initializing app for project:', credentials.projectId);
    return initializeApp({
        credential: cert({
            projectId: credentials.projectId,
            clientEmail: credentials.clientEmail,
            privateKey: credentials.privateKey,
        }),
        projectId: credentials.projectId,
    });
}

const adminApp = getFirebaseAdminApp();

export const adminAuth = adminApp
    ? getAuth(adminApp)
    : new Proxy({} as ReturnType<typeof getAuth>, {
          get: (_, prop) => {
              return () => {
                  throw new Error(
                      `🔥 Firebase Admin no inicializado. Falla en auth.${String(prop)}(). ` +
                      'Verifica FIREBASE_SERVICE_ACCOUNT_KEY (o FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY) en tus variables de entorno.'
                  );
              };
          },
      });

