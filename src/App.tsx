import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { HomePage } from './pages/HomePage';
import { InventoryPage } from './pages/InventoryPage';
import { AddItemPage } from './pages/AddItemPage';
import { RecipesPage } from './pages/RecipesPage';
import { ItemDetailPage } from './pages/ItemDetailPage';
import { EditItemPage } from './pages/EditItemPage';
import { LoginPage } from './pages/LoginPage';

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🥗</div>
          <p style={{ color: '#666' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute><InventoryPage /></ProtectedRoute>} />
      <Route path="/add-item" element={<ProtectedRoute><AddItemPage /></ProtectedRoute>} />
      <Route path="/recipes" element={<ProtectedRoute><RecipesPage /></ProtectedRoute>} />
      <Route path="/item/:itemId" element={<ProtectedRoute><ItemDetailPage /></ProtectedRoute>} />
      <Route path="/edit-item" element={<ProtectedRoute><EditItemPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
