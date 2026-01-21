import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getOrCreateSessionId } from '../utils/session';
import { getItemsByLocation, getItemsBySession } from '../firebase/saveReceipt';
import type { Item, StorageLocation } from '../types';
import { getDaysUntilExpiration, formatDateForDisplay } from '../utils/dateHelpers';

export function InventoryPage() {
  const [searchParams] = useSearchParams();
  const locationFilter = (searchParams.get('location') as StorageLocation | 'all') || 'all';
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadItems();
  }, [locationFilter]);

  const loadItems = async () => {
    try {
      const sessionId = getOrCreateSessionId();
      let allItems: Item[];

      if (locationFilter === 'all') {
        allItems = await getItemsBySession(sessionId);
      } else {
        allItems = await getItemsByLocation(sessionId, locationFilter);
      }

      // Sort by expiration date
      allItems.sort((a, b) => {
        const expA = new Date(a.manualExpirationDate || a.autoExpirationDate);
        const expB = new Date(b.manualExpirationDate || b.autoExpirationDate);
        return expA.getTime() - expB.getTime();
      });

      setItems(allItems);
    } catch (error) {
      console.error('Error loading items:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const getExpirationColor = (item: Item) => {
    const expirationDate = item.manualExpirationDate || item.autoExpirationDate;
    const daysUntil = getDaysUntilExpiration(expirationDate);
    if (daysUntil < 0) return '#dc3545'; // Expired
    if (daysUntil <= 2) return '#fd7e14'; // Expiring soon
    if (daysUntil <= 5) return '#ffc107'; // Warning
    return '#28a745'; // Good
  };

  const getExpirationText = (item: Item) => {
    const expirationDate = item.manualExpirationDate || item.autoExpirationDate;
    const daysUntil = getDaysUntilExpiration(expirationDate);
    if (daysUntil < 0) return `Expired ${Math.abs(daysUntil)} days ago`;
    if (daysUntil === 0) return 'Expires today';
    if (daysUntil === 1) return 'Expires tomorrow';
    return `${daysUntil} days left`;
  };

  if (loading) {
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

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f5f5f5',
      paddingBottom: '80px'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>Inventory</h1>
        <Link to="/add-item" style={{ fontSize: '24px', textDecoration: 'none' }}>➕</Link>
      </div>

      {/* Date */}
      <div style={{
        backgroundColor: 'white',
        padding: '15px 20px',
        borderBottom: '1px solid #e0e0e0',
        fontSize: '14px',
        color: '#666'
      }}>
        {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
      </div>

      {/* Tabs */}
      <div style={{
        backgroundColor: 'white',
        display: 'flex',
        borderBottom: '1px solid #e0e0e0',
        overflowX: 'auto'
      }}>
        {(['all', 'fridge', 'freezer', 'pantry'] as const).map(loc => (
          <Link
            key={loc}
            to={`/inventory${loc === 'all' ? '' : `?location=${loc}`}`}
            style={{
              padding: '15px 20px',
              textDecoration: 'none',
              color: locationFilter === loc ? '#007bff' : '#666',
              borderBottom: locationFilter === loc ? '2px solid #007bff' : '2px solid transparent',
              fontWeight: locationFilter === loc ? 'bold' : 'normal',
              whiteSpace: 'nowrap',
              textTransform: 'capitalize'
            }}
          >
            {loc === 'all' ? 'All' : loc}
          </Link>
        ))}
      </div>

      {/* Items List */}
      <div style={{ padding: '20px' }}>
        {items.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: '#999'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '15px' }}>📦</div>
            <div style={{ fontSize: '18px', marginBottom: '5px' }}>No items found</div>
            <div style={{ fontSize: '14px' }}>Add items to get started</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {items.map(item => (
              <Link
                key={item.itemId}
                to={`/item/${item.itemId}`}
                style={{
                  textDecoration: 'none',
                  color: 'inherit',
                  backgroundColor: 'white',
                  padding: '15px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '15px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                <div style={{ fontSize: '32px' }}>{getCategoryIcon(item.category)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '5px' }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    {item.quantity || '1'} {item.quantity ? 'pcs' : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: getExpirationColor(item),
                    marginBottom: '3px'
                  }}>
                    {getExpirationText(item)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#999' }}>
                    {formatDateForDisplay(item.manualExpirationDate || item.autoExpirationDate)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Floating Add Button */}
      <Link
        to="/add-item"
        style={{
          position: 'fixed',
          bottom: '100px',
          right: '20px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: '#007bff',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '32px',
          textDecoration: 'none',
          boxShadow: '0 4px 12px rgba(0,123,255,0.4)',
          zIndex: 10
        }}
      >
        +
      </Link>

      {/* Bottom Navigation */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'white',
        borderTop: '1px solid #e0e0e0',
        display: 'flex',
        justifyContent: 'space-around',
        padding: '15px 0',
        boxShadow: '0 -2px 10px rgba(0,0,0,0.1)'
      }}>
        <Link to="/" style={{ textDecoration: 'none', color: '#666', textAlign: 'center' }}>
          <div style={{ fontSize: '24px' }}>🏠</div>
          <div style={{ fontSize: '12px', marginTop: '5px' }}>Home</div>
        </Link>
        <Link to="/recipes" style={{ textDecoration: 'none', color: '#666', textAlign: 'center' }}>
          <div style={{ fontSize: '24px' }}>🍳</div>
          <div style={{ fontSize: '12px', marginTop: '5px' }}>Recipes</div>
        </Link>
        <Link to="/add-item" style={{ textDecoration: 'none', color: '#666', textAlign: 'center' }}>
          <div style={{ fontSize: '24px' }}>➕</div>
          <div style={{ fontSize: '12px', marginTop: '5px' }}>Add</div>
        </Link>
      </div>
    </div>
  );
}
