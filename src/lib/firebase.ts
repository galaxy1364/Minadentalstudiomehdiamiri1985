import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const WORKSPACE_SCOPES = ['https://www.googleapis.com/auth/drive.file'] as const;

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedProvider: GoogleAuthProvider | null = null;

export function getFirebaseClient(): {
  app: FirebaseApp;
  auth: Auth;
  googleAuthProvider: GoogleAuthProvider;
} | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!cachedApp) {
      cachedApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    }
    if (!cachedAuth) {
      cachedAuth = getAuth(cachedApp);
    }
    if (!cachedProvider) {
      cachedProvider = new GoogleAuthProvider();
      for (const scope of WORKSPACE_SCOPES) {
        cachedProvider.addScope(scope);
      }
      cachedProvider.setCustomParameters({ prompt: 'select_account' });
    }
    return {
      app: cachedApp,
      auth: cachedAuth,
      googleAuthProvider: cachedProvider,
    };
  } catch {
    return null;
  }
}

export async function getCurrentFirebaseIdToken(): Promise<string | null> {
  const client = getFirebaseClient();
  if (!client?.auth.currentUser) return null;
  try {
    return await client.auth.currentUser.getIdToken();
  } catch {
    return null;
  }
}
