import { createContext } from 'preact';
import { useContext, useState, useEffect } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { onAuthChange, signInWithGoogle, signOutUser, getIdToken } from '../services/firebase';
import { verifyAuth } from '../services/api';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ComponentChildren }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const setupAuth = async () => {
      unsubscribe = await onAuthChange(async (firebaseUser: any) => {
        if (firebaseUser) {
          try {
            const token = await firebaseUser.getIdToken();
            const result = await verifyAuth(token);
            if (result.success && result.data) {
              setUser(result.data);
            } else {
              setUser(null);
            }
          } catch (error) {
            console.error('Auth verification error:', error);
            setUser(null);
          }
        } else {
          setUser(null);
        }
        setLoading(false);
      });
    };

    setupAuth();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const signIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await signOutUser();
      setUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  const refreshUser = async () => {
    const token = await getIdToken();
    if (token) {
      const result = await verifyAuth(token);
      if (result.success && result.data) {
        setUser(result.data);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
