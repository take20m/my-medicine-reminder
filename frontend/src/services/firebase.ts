// Firebase の設定
// 注意: 本番環境では環境変数から読み込む
const FIREBASE_ENV_KEYS = {
  apiKey: 'VITE_FIREBASE_API_KEY',
  authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  storageBucket: 'VITE_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'VITE_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'VITE_FIREBASE_APP_ID'
} as const;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? ''
};

function assertFirebaseConfig(): void {
  const missing = (Object.keys(FIREBASE_ENV_KEYS) as Array<keyof typeof FIREBASE_ENV_KEYS>)
    .filter(key => !firebaseConfig[key])
    .map(key => FIREBASE_ENV_KEYS[key]);
  if (missing.length > 0) {
    throw new Error(
      `Firebase config is incomplete. Missing env vars: ${missing.join(', ')}`
    );
  }
}

// Firebase SDK を動的にロード
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let firebaseApp: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let firebaseAuth: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let firebaseModules: any = null;

export async function initializeFirebase() {
  if (firebaseApp && firebaseModules) {
    return { app: firebaseApp, auth: firebaseAuth, ...firebaseModules };
  }

  assertFirebaseConfig();

  const { initializeApp } = await import('firebase/app');
  const authModule = await import('firebase/auth');
  const { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } = authModule;

  firebaseApp = initializeApp(firebaseConfig);
  firebaseAuth = getAuth(firebaseApp);
  firebaseModules = {
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged
  };

  return {
    app: firebaseApp,
    auth: firebaseAuth,
    ...firebaseModules
  };
}

export async function signInWithGoogle() {
  const firebase = await initializeFirebase();
  const provider = new firebase.GoogleAuthProvider();
  return firebase.signInWithPopup(firebase.auth, provider);
}

export async function signOutUser() {
  const firebase = await initializeFirebase();
  return firebase.signOut(firebase.auth);
}

export async function getIdToken(): Promise<string | null> {
  const { auth } = await initializeFirebase();
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function onAuthChange(callback: (user: any) => void) {
  const firebase = await initializeFirebase();
  return firebase.onAuthStateChanged(firebase.auth, callback);
}
