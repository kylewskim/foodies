import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import type { Item } from '../types';
import { getDaysUntilExpiration, formatDateForDisplay } from '../utils/dateHelpers';

export function ItemDetailPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (itemId) {
      loadItem();
    }
  }, [itemId]);

  const loadItem = async () => {
    try {
      if (!itemId) return;
      
      const itemDoc = await getDoc(doc(db, 'items', itemId));
      if (itemDoc.exists()) {
        const data = itemDoc.data();
        setItem({
          itemId: itemDoc.id,
          location: data.location || 'fridge', // Default location for old data
          ...data,
        } as Item);
      } else {
        alert('Item not found');
        navigate('/inventory');
      }
    } catch (error) {
      console.error('Error loading item:', error);
      alert('Failed to load item');
      navigate('/inventory');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!item || !confirm('Are you sure you want to delete this item?')) return;

    try {
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'items', item.itemId));
      alert('Item deleted successfully');
      navigate('/inventory');
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Failed to delete item');
    }
  };

  const handleUseItem = async () => {
    if (!item || !confirm('Mark this item as used?')) return;

    try {
      handleDelete(); // For now, just delete when used
    } catch (error) {
      console.error('Error using item:', error);
    }
  };

  if (loading || !item) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#f5f5f5'
      }}>
        <div style={{ fontSize: '18px', color: '#666' }}>Loading...</div>
      </div>
    );
  }

  const expirationDate = item.manualExpirationDate || item.autoExpirationDate;
  const daysUntil = getDaysUntilExpiration(expirationDate);
  const isExpired = daysUntil < 0;

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      'Produce': '🍎',
      'Protein': '🥩',
      'Grains': '🍞',
      'Dairy': '🥛',
      'Snacks': '🍪',
      'Condiments': '🧂',
      'Beverages': '🥤',
      'Prepared': '🍱',
    };
    return icons[category] || '📦';
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            padding: '8px',
            backgroundColor: 'transparent',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
          }}
        >
          ←
        </button>
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>Item Details</h1>
        <div style={{ width: '36px' }}></div>
      </div>

      {/* Item Info */}
      <div style={{ padding: '30px 20px' }}>
        <div style={{
          textAlign: 'center',
          marginBottom: '30px'
        }}>
          <div style={{ fontSize: '80px', marginBottom: '15px' }}>
            {getCategoryIcon(item.category)}
          </div>
          <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 'bold' }}>
            {item.name}
          </h2>
        </div>

        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px'
        }}>
          <div style={{ marginBottom: '15px' }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Category</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{item.category}</div>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Location</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', textTransform: 'capitalize' }}>
              {item.location}
            </div>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Quantity</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
              {item.quantity || '1'}
            </div>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Purchase Date</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
              {formatDateForDisplay(item.purchaseDate)}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Expiration Date</div>
            <div style={{
              fontSize: '16px',
              fontWeight: 'bold',
              color: isExpired ? '#dc3545' : daysUntil <= 2 ? '#fd7e14' : '#28a745'
            }}>
              {formatDateForDisplay(expirationDate)}
              {isExpired && <span style={{ marginLeft: '10px' }}>(Expired)</span>}
            </div>
            <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
              {isExpired
                ? `Expired ${Math.abs(daysUntil)} days ago`
                : daysUntil === 0
                ? 'Expires today'
                : daysUntil === 1
                ? 'Expires tomorrow'
                : `Expires in ${daysUntil} days`}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Link
            to="/edit-item"
            state={{ item }}
            style={{
              padding: '15px',
              backgroundColor: '#007bff',
              color: 'white',
              textAlign: 'center',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: 'bold',
            }}
          >
            Edit Item
          </Link>

          <button
            onClick={handleUseItem}
            style={{
              padding: '15px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            Use Item
          </button>

          <button
            onClick={handleDelete}
            style={{
              padding: '15px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            Delete Item
          </button>
        </div>
      </div>
    </div>
  );
}
