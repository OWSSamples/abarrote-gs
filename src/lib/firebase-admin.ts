import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function formatPrivateKey(key?: string) {
    if (!key) return undefined;
    return key.replace(/\\n/g, '\n');
}

export function getFirebaseAdminApp() {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'consola-shop';
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY);

    // Force the project ID in the environment for verifyIdToken to pick up
    if (!process.env.GOOGLE_CLOUD_PROJECT) {
        process.env.GOOGLE_CLOUD_PROJECT = projectId;
    }

    const apps = getApps();
    if (apps.length > 0) {
        // If an app exists but has no projectId set, it's a corrupted singleton from an early pre-render
        if (!apps[0].options.projectId) {
            console.warn('[FIREBASE ADMIN] Existing app has no projectId, this usually occurs when HMR caught an empty env context. Restart the server!');
        }
        return apps[0];
    }

    if (!clientEmail || !privateKey) {
        console.warn(
            '🔥 FIREBASE ADMIN WARN: Missing FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY environment variables. ' +
            'Cannot initialize secure backend auth. Validating users will fail at runtime.'
        );
        return null;
    }

    console.log('[FIREBASE ADMIN] Initializing new app instance for', projectId);
    return initializeApp({
        credential: cert({
            projectId,
            clientEmail,
            privateKey,
        }),
        projectId,
    });
}

const adminApp = getFirebaseAdminApp();

export const adminAuth = adminApp 
  ? getAuth(adminApp) 
  : new Proxy({} as any, {
      get: (_, prop) => {
        return () => {
           throw new Error(`🔥 FIREBASE ADMIN NO INICIALIZADO. Falló al ejecutar auth.${String(prop)}. Falta FIREBASE_PRIVATE_KEY o FIREBASE_CLIENT_EMAIL en Vercel.`);
        };
      }
    });
