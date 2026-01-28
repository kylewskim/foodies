import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { HomePage } from './pages/HomePage';
import { InventoryPage } from './pages/InventoryPage';
import { AddItemPage } from './pages/AddItemPage';
import { RecipesPage } from './pages/RecipesPage';
import { ItemDetailPage } from './pages/ItemDetailPage';
import { EditItemPage } from './pages/EditItemPage';
import { LoginPage } from './pages/LoginPage';
import { SplashPage } from './pages/SplashPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { SettingsPage } from './pages/SettingsPage';

// Loading screen component
function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#073d35',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <h1 style={{
        fontFamily: '"Playfair Display", Georgia, serif',
        fontSize: '56px',
        fontWeight: '500',
        color: '#e3fd5c',
        letterSpacing: '0.2px',
        margin: 0,
      }}>
        Freshli
      </h1>
    </div>
  );
}

// Protected Route wrapper - redirects to login if not authenticated, to onboarding if not completed
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, onboardingCompleted } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If onboarding status is still being checked, show loading
  if (onboardingCompleted === null) {
    return <LoadingScreen />;
  }

  // Redirect to onboarding if not completed
  if (!onboardingCompleted) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

// Auth Route wrapper - redirects to home if already logged in
function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, onboardingCompleted } = useAuth();

  if (loading) {
    return null; // Splash will handle this
  }

  if (user) {
    // If logged in but onboarding not completed, go to onboarding
    if (onboardingCompleted === false) {
      return <Navigate to="/onboarding" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// Onboarding Route wrapper - only accessible if logged in and onboarding not completed
function OnboardingRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, onboardingCompleted } = useAuth();

  if (loading || onboardingCompleted === null) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If onboarding is already completed, go to home
  if (onboardingCompleted) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      <Route path="/splash" element={<SplashPage />} />
      <Route path="/login" element={<AuthRoute><LoginPage /></AuthRoute>} />
      <Route path="/onboarding" element={<OnboardingRoute><OnboardingPage /></OnboardingRoute>} />
      <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute><InventoryPage /></ProtectedRoute>} />
      <Route path="/add-item" element={<ProtectedRoute><AddItemPage /></ProtectedRoute>} />
      <Route path="/recipes" element={<ProtectedRoute><RecipesPage /></ProtectedRoute>} />
      <Route path="/item/:itemId" element={<ProtectedRoute><ItemDetailPage /></ProtectedRoute>} />
      <Route path="/edit-item" element={<ProtectedRoute><EditItemPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/splash" replace />} />
    </Routes>
  );
}

export default App;
