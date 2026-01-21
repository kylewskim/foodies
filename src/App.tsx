import { Routes, Route, Navigate } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { InventoryPage } from './pages/InventoryPage';
import { AddItemPage } from './pages/AddItemPage';
import { RecipesPage } from './pages/RecipesPage';
import { ItemDetailPage } from './pages/ItemDetailPage';
import { EditItemPage } from './pages/EditItemPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/inventory" element={<InventoryPage />} />
      <Route path="/add-item" element={<AddItemPage />} />
      <Route path="/recipes" element={<RecipesPage />} />
      <Route path="/item/:itemId" element={<ItemDetailPage />} />
      <Route path="/edit-item" element={<EditItemPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
