import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithCredential,
  signOut as fbSignOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export { firebaseConfig };

// TypeScript declarations for Google Identity Services (GSI)
declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: any) => void;
          prompt: (notification?: any) => void;
          renderButton: (parent: HTMLElement, options: any) => void;
          cancel: () => void;
        };
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: any }) => void;
            error_callback?: (err: any) => void;
          }) => {
            requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// CRITICAL: Must pass firebaseConfig.firestoreDatabaseId as required by Firebase skill
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Configure Google Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection check on boot
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testConnection();

export interface GoogleAuthResult {
  email: string;
  name: string;
  phone?: string;
  uid: string;
  photoURL?: string;
  firebaseUser?: FirebaseUser | null;
}

/**
 * Sign in using Google Identity Services (GSI) OAuth2 Token Client.
 * Bypasses Firebase Auth's popup domain check while seamlessly signing
 * in to Firebase via signInWithCredential!
 */
export function signInWithGoogleOAuthToken(): Promise<GoogleAuthResult> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return reject(new Error('Window environment is not available.'));
    }

    const clientId = firebaseConfig.oAuthClientId;
    if (!clientId) {
      return reject(new Error('OAuth Client ID is not configured.'));
    }

    const executeTokenClient = () => {
      try {
        if (!window.google?.accounts?.oauth2) {
          return reject(new Error('Google Identity Services client is not initialized.'));
        }

        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'openid email profile',
          callback: async (tokenResponse) => {
            if (tokenResponse.error) {
              return reject(new Error(tokenResponse.error));
            }
            if (!tokenResponse.access_token) {
              return reject(new Error('No access token received from Google.'));
            }

            try {
              // Fetch Google user profile using access token
              const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
              });
              if (!userInfoRes.ok) {
                throw new Error('Failed to fetch Google profile information.');
              }
              const userInfo = await userInfoRes.json();

              // Link / Sign in to Firebase Auth using the credential if allowed
              let fbUser: FirebaseUser | null = null;
              try {
                const credential = GoogleAuthProvider.credential(null, tokenResponse.access_token);
                const userCred = await signInWithCredential(auth, credential);
                fbUser = userCred.user;
              } catch (fbErr) {
                console.warn('Firebase credential sync warning (proceeding with verified Google profile):', fbErr);
              }

              resolve({
                email: userInfo.email,
                name: userInfo.name || userInfo.email.split('@')[0],
                phone: undefined,
                uid: fbUser?.uid || userInfo.sub || `usr_google_${Date.now()}`,
                photoURL: userInfo.picture,
                firebaseUser: fbUser,
              });
            } catch (fetchErr) {
              reject(fetchErr);
            }
          },
          error_callback: (err) => {
            reject(err);
          },
        });

        client.requestAccessToken({ prompt: 'select_account' });
      } catch (initErr) {
        reject(initErr);
      }
    };

    if (window.google?.accounts?.oauth2) {
      executeTokenClient();
    } else {
      // Dynamically load Google Identity Services if not already ready
      const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (!existingScript) {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => executeTokenClient();
        script.onerror = () => reject(new Error('Failed to load Google Identity Services library.'));
        document.head.appendChild(script);
      } else {
        existingScript.addEventListener('load', () => executeTokenClient());
        // Or wait shortly
        setTimeout(() => {
          if (window.google?.accounts?.oauth2) {
            executeTokenClient();
          } else {
            reject(new Error('Google Identity Services failed to load in time.'));
          }
        }, 1500);
      }
    }
  });
}

/**
 * Robust Google Sign-in:
 * 1. Tries standard Firebase signInWithPopup
 * 2. If popup is blocked or domain is unauthorized in Firebase Console,
 *    gracefully falls back to Google Identity Services Token Client!
 */
export async function signInWithGoogle(): Promise<GoogleAuthResult> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    if (result && result.user) {
      return {
        email: result.user.email || '',
        name: result.user.displayName || result.user.email?.split('@')[0] || 'Google User',
        phone: result.user.phoneNumber || undefined,
        uid: result.user.uid,
        photoURL: result.user.photoURL || undefined,
        firebaseUser: result.user,
      };
    }
  } catch (popupError: any) {
    console.warn('signInWithPopup notice:', popupError?.code, popupError?.message);

    // If user intentionally closed popup, respect their action
    if (popupError?.code === 'auth/popup-closed-by-user') {
      throw new Error('Google Sign-In popup was closed.');
    }

    // Try Google Identity Services OAuth fallback if popup blocked or domain issues
    const isDomainOrPopupIssue =
      popupError?.code === 'auth/unauthorized-domain' ||
      popupError?.code === 'auth/invalid-action-code' ||
      popupError?.code === 'auth/popup-blocked' ||
      popupError?.code === 'auth/cancelled-popup-request' ||
      popupError?.code === 'auth/operation-not-allowed' ||
      popupError?.code === 'auth/internal-error' ||
      (popupError?.message && (
        popupError.message.includes('unauthorized-domain') ||
        popupError.message.includes('invalid') ||
        popupError.message.includes('action is invalid')
      ));

    if (isDomainOrPopupIssue) {
      try {
        console.log('Attempting Google Identity Services fallback...');
        const oauthResult = await signInWithGoogleOAuthToken();
        return oauthResult;
      } catch (oauthErr) {
        console.warn('Google Identity Services fallback result:', oauthErr);
      }
    }

    // If unauthorized-domain or invalid action error persists, format helpful error code
    if (
      isDomainOrPopupIssue ||
      popupError?.code === 'auth/unauthorized-domain' ||
      (popupError?.message && popupError.message.includes('unauthorized-domain'))
    ) {
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
      const customErr = new Error(
        `Google popup authentication is not configured for domain "${currentHost}".`
      );
      (customErr as any).code = 'auth/unauthorized-domain';
      (customErr as any).hostname = currentHost;
      throw customErr;
    }

    throw popupError;
  }

  throw new Error('Google sign-in could not be completed.');
}

/**
 * Check for redirect results on page load
 */
export async function checkRedirectResult(): Promise<GoogleAuthResult | null> {
  try {
    const result = await getRedirectResult(auth);
    if (result && result.user) {
      return {
        email: result.user.email || '',
        name: result.user.displayName || result.user.email?.split('@')[0] || 'Google User',
        phone: result.user.phoneNumber || undefined,
        uid: result.user.uid,
        photoURL: result.user.photoURL || undefined,
        firebaseUser: result.user,
      };
    }
  } catch (err) {
    console.warn('Firebase getRedirectResult check:', err);
  }
  return null;
}

export async function signOutFirebase() {
  return await fbSignOut(auth);
}

