import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

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

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
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

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export async function signInWithGooglePopup() {
  const result = await signInWithPopup(auth, googleProvider);
  const fbUser = result.user;
  const userPath = `users/${fbUser.uid}`;
  try {
    await setDoc(
      doc(db, 'users', fbUser.uid),
      {
        uid: fbUser.uid,
        fullName: (fbUser.displayName || 'Ajo Member').slice(0, 120),
        email: (fbUser.email || 'member@ajo.ng').slice(0, 160),
        phone: (fbUser.phoneNumber || '08030000000').slice(0, 30),
        role:
          fbUser.email === 'ceejegzig83@gmail.com' ? 'SUPER_ADMIN' : 'MEMBER',
        status: 'ACTIVE',
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    // Non-blocking if user document already exists with immutable createdAt
    if (
      err instanceof Error &&
      err.message.includes('Missing or insufficient permissions')
    ) {
      // Only log if unexpected
    }
  }
  return fbUser;
}
