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

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    // Show splash-like loading while auth is checking
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

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Auth Route wrapper - redirects to home if already logged in
function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return null; // Splash will handle this
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      <Route path="/splash" element={<SplashPage />} />
      <Route path="/login" element={<AuthRoute><LoginPage /></AuthRoute>} />
      <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute><InventoryPage /></ProtectedRoute>} />
      <Route path="/add-item" element={<ProtectedRoute><AddItemPage /></ProtectedRoute>} />
      <Route path="/recipes" element={<ProtectedRoute><RecipesPage /></ProtectedRoute>} />
      <Route path="/item/:itemId" element={<ProtectedRoute><ItemDetailPage /></ProtectedRoute>} />
      <Route path="/edit-item" element={<ProtectedRoute><EditItemPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/splash" replace />} />
    </Routes>
  );
}

export default App;
