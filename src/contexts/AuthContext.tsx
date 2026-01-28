import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  User,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase/firebaseConfig';
import { getUserPreferences } from '../firebase/saveReceipt';

// Dev mode check - only enabled in development
const isDev = import.meta.env.DEV;

// Mock user for development
const DEV_USER = {
  uid: 'dev-user-123',
  email: 'dev@freshli.app',
  displayName: 'Dev User',
  photoURL: null,
} as User;

interface AuthContextType {
  user: User | null;
  loading: boolean;
  onboardingCompleted: boolean | null; // null = not yet checked
  signInWithGoogle: () => Promise<void>;
  signInAsDev: () => Promise<void>; // Dev mode login
  logout: () => Promise<void>;
  checkOnboardingStatus: (forceUserId?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [isDevMode, setIsDevMode] = useState(false);

  const checkOnboardingStatus = async (forceUserId?: string) => {
    const userId = forceUserId || user?.uid;
    if (!userId) {
      setOnboardingCompleted(null);
      return;
    }
    
    try {
      const prefs = await getUserPreferences(userId);
      console.log('Checking onboarding status for user:', userId, 'prefs:', prefs);
      setOnboardingCompleted(prefs?.onboardingCompleted ?? false);
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      setOnboardingCompleted(false);
    }
  };

  useEffect(() => {
    // Check for redirect result (for mobile browsers)
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          setUser(result.user);
        }
      })
      .catch((error) => {
        console.error('Redirect sign-in error:', error);
      });

    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      console.log('Auth state changed:', authUser?.uid);
      setUser(authUser);
      
      if (authUser) {
        // Check onboarding status when user logs in
        try {
          const prefs = await getUserPreferences(authUser.uid);
          console.log('User preferences loaded:', prefs);
          const isCompleted = prefs?.onboardingCompleted ?? false;
          setOnboardingCompleted(isCompleted);
          console.log('Onboarding completed:', isCompleted);
        } catch (error) {
          console.error('Error checking onboarding status:', error);
          setOnboardingCompleted(false);
        }
      } else {
        setOnboardingCompleted(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      // Try popup first (works on desktop)
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      // If popup is blocked or fails, try redirect (better for mobile)
      if (error.code === 'auth/popup-blocked' || 
          error.code === 'auth/popup-closed-by-user' ||
          error.code === 'auth/cancelled-popup-request') {
        await signInWithRedirect(auth, googleProvider);
      } else {
        console.error('Google sign-in error:', error);
        throw error;
      }
    }
  };

  const logout = async () => {
    try {
      if (isDevMode) {
        setUser(null);
        setOnboardingCompleted(null);
        setIsDevMode(false);
        return;
      }
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  // Dev mode login - only works in development
  const signInAsDev = async () => {
    if (!isDev) {
      console.warn('Dev login is only available in development mode');
      return;
    }
    console.log('🔧 Dev mode login activated');
    setIsDevMode(true);
    setUser(DEV_USER);
    
    // Check onboarding status for dev user
    try {
      const prefs = await getUserPreferences(DEV_USER.uid);
      setOnboardingCompleted(prefs?.onboardingCompleted ?? false);
    } catch (error) {
      console.error('Error checking dev user onboarding:', error);
      setOnboardingCompleted(false);
    }
    setLoading(false);
  };

  const value = {
    user,
    loading,
    onboardingCompleted,
    signInWithGoogle,
    signInAsDev,
    logout,
    checkOnboardingStatus,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
