import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getItemsByLocation, getItemsByUser } from '../firebase/saveReceipt';
import type { Item, StorageLocation } from '../types';
import { getDaysUntilExpiration } from '../utils/dateHelpers';
import { BottomNavigation } from '../components/BottomNavigation';
import { AddFoodModal } from '../components/AddFoodModal';

export function InventoryPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const locationFilter = (searchParams.get('location') as StorageLocation | 'all') || 'all';
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddFoodModalOpen, setIsAddFoodModalOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  useEffect(() => {
    if (user) {
      loadItems();
    }
  }, [locationFilter, user]);

  const loadItems = async () => {
    if (!user) return;
    
    try {
      let allItems: Item[];

      if (locationFilter === 'all') {
        allItems = await getItemsByUser(user.uid);
      } else {
        allItems = await getItemsByLocation(user.uid, locationFilter);
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
      'Produce': '🍓',
      'Protein': '🥩',
      'Grains': '🌾',
      'Dairy': '🧀',
      'Snacks': '🍪',
      'Condiments': '🧂',
      'Beverages': '🥤',
      'Prepared': '🍱',
    };
    return icons[category] || '🍽️';
  };

  const getExpirationText = (item: Item) => {
    const expirationDate = item.manualExpirationDate || item.autoExpirationDate;
    const daysUntil = getDaysUntilExpiration(expirationDate);
    if (daysUntil < 0) return `Expired`;
    if (daysUntil === 0) return '1 day';
    if (daysUntil === 1) return '1 day';
    return `${daysUntil} days`;
  };

  const getExpirationColor = (item: Item) => {
    const expirationDate = item.manualExpirationDate || item.autoExpirationDate;
    const daysUntil = getDaysUntilExpiration(expirationDate);
    if (daysUntil < 0) return '#dc3545';
    if (daysUntil <= 2) return '#e65100';
    if (daysUntil <= 5) return '#ffc107';
    return '#999';
  };

  const locationTabs: { key: 'all' | StorageLocation; label: string }[] = [
    { key: 'fridge', label: 'Fridge' },
    { key: 'freezer', label: 'Freezer' },
    { key: 'pantry', label: 'Pantry' },
  ];

  const categoryTabs = ['All', 'Produce', 'Dairy', 'Protein'];

  const filteredItems = categoryFilter === 'All' 
    ? items 
    : items.filter(item => item.category === categoryFilter);

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#fafaf8'
      }}>
        <div style={{ fontSize: '18px', color: '#666' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#fafaf8',
      paddingBottom: '100px'
    }}>
      {/* Search Bar */}
      <div style={{ padding: '20px 20px 0 20px' }}>
        <div style={{
          backgroundColor: '#f0f0f0',
          borderRadius: '12px',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search..."
            style={{
              flex: 1,
              border: 'none',
              backgroundColor: 'transparent',
              fontSize: '16px',
              outline: 'none',
              color: '#333',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}
          />
        </div>
      </div>

      {/* Location Tabs */}
      <div style={{
        display: 'flex',
        padding: '20px 20px 0 20px',
        borderBottom: '1px solid #f0f0f0'
      }}>
        {locationTabs.map(tab => (
          <Link
            key={tab.key}
            to={`/inventory${tab.key === 'all' ? '' : `?location=${tab.key}`}`}
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '12px 0',
              textDecoration: 'none',
              color: (locationFilter === tab.key || (tab.key === 'fridge' && locationFilter === 'all')) ? '#000' : '#999',
              fontWeight: (locationFilter === tab.key || (tab.key === 'fridge' && locationFilter === 'all')) ? '600' : '400',
              borderBottom: (locationFilter === tab.key || (tab.key === 'fridge' && locationFilter === 'all')) ? '2px solid #000' : '2px solid transparent',
              fontSize: '16px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Category Filter */}
      <div style={{
        display: 'flex',
        gap: '8px',
        padding: '16px 20px',
        overflowX: 'auto'
      }}>
        {categoryTabs.map(cat => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            style={{
              padding: '8px 16px',
              borderRadius: '16px',
              border: 'none',
              backgroundColor: categoryFilter === cat ? '#1a1a1a' : '#f5f5f5',
              color: categoryFilter === cat ? '#fff' : '#666',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Items List */}
      <div style={{ padding: '0 20px' }}>
        {filteredItems.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: '#999'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📦</div>
            <div style={{ 
              fontSize: '18px', 
              marginBottom: '8px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
              No items found
            </div>
            <div style={{ 
              fontSize: '14px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
              Add items to get started
            </div>
          </div>
        ) : (
          <div>
            {filteredItems.map(item => (
              <Link
                key={item.itemId}
                to={`/item/${item.itemId}`}
                style={{
                  textDecoration: 'none',
                  color: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '16px 0',
                  borderBottom: '1px solid #f5f5f5'
                }}
              >
                {/* Icon */}
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: '#f5f5f5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  marginRight: '12px'
                }}>
                  {getCategoryIcon(item.category)}
                </div>

                {/* Item Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    fontSize: '16px', 
                    fontWeight: '500', 
                    color: '#1a1a1a', 
                    marginBottom: '4px',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                  }}>
                    {item.name}
                  </div>
                  <div style={{ 
                    fontSize: '14px', 
                    color: '#999',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                  }}>
                    {item.quantity || '1 item'}
                  </div>
                </div>

                {/* Expiration */}
                <div style={{
                  fontSize: '14px',
                  color: getExpirationColor(item),
                  fontWeight: '500',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                }}>
                  {getExpirationText(item)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Floating Add Button */}
      <button
        onClick={() => setIsAddFoodModalOpen(true)}
        style={{
          position: 'fixed',
          bottom: '92px', // 72px nav + 20px spacing
          right: '20px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: '#073d35',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          zIndex: 99,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f7f6ef" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* Bottom Navigation */}
      <BottomNavigation />

      {/* Add Food Modal */}
      <AddFoodModal
        isOpen={isAddFoodModalOpen}
        onClose={() => setIsAddFoodModalOpen(false)}
      />
    </div>
  );
}
