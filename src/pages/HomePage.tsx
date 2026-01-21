import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getOrCreateSessionId } from '../utils/session';
import { getItemsExpiringSoon, getItemsBySession } from '../firebase/saveReceipt';
import type { Item } from '../types';
import { getDaysUntilExpiration } from '../utils/dateHelpers';
import { AddFoodModal } from '../components/AddFoodModal';

interface MonthlyStats {
  itemsUsedJustInTime: number;
  estimatedValueSaved: number;
}

interface InventoryStats {
  total: number;
  usedThisWeek: number;
  expiringSoon: number;
}

export function HomePage() {
  const location = useLocation();
  const [expiringItems, setExpiringItems] = useState<Item[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats>({
    itemsUsedJustInTime: 0,
    estimatedValueSaved: 0,
  });
  const [inventoryStats, setInventoryStats] = useState<InventoryStats>({
    total: 0,
    usedThisWeek: 0,
    expiringSoon: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isAddFoodModalOpen, setIsAddFoodModalOpen] = useState(false);

  useEffect(() => {
    loadHomeData();
  }, [location.pathname]); // Reload when pathname changes (e.g., returning from add-item)

  const loadHomeData = async () => {
    try {
      const sessionId = getOrCreateSessionId();
      
      // Get all items
      const allItems = await getItemsBySession(sessionId);
      
      // Get expiring items (within 7 days)
      const expiring = await getItemsExpiringSoon(sessionId, 7);
      setExpiringItems(expiring);

      // Calculate monthly stats
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      // Items used just in time (items that were used before expiring, within last month)
      // For now, we'll count active items that haven't expired yet as "used just in time"
      const activeItems = allItems.filter(item => {
        const expirationDate = item.manualExpirationDate || item.autoExpirationDate;
        const expDate = new Date(expirationDate);
        return expDate >= now;
      });
      
      const itemsUsedJustInTime = activeItems.length;
      const estimatedValueSaved = itemsUsedJustInTime * 2.5; // $2.50 per item average
      
      setMonthlyStats({
        itemsUsedJustInTime,
        estimatedValueSaved,
      });

      // Calculate inventory stats
      const total = allItems.length;
      const usedThisWeek = allItems.filter(item => {
        const purchaseDate = new Date(item.purchaseDate);
        return purchaseDate >= oneWeekAgo;
      }).length;
      const expiringSoon = expiring.length;

      setInventoryStats({
        total,
        usedThisWeek,
        expiringSoon,
      });
    } catch (error) {
      console.error('Error loading home data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUseItem = async (item: Item) => {
    try {
      // Mark item as used by deleting it (for now)
      const { deleteDoc } = await import('firebase/firestore');
      const { doc } = await import('firebase/firestore');
      const { db } = await import('../firebase/firebaseConfig');
      
      await deleteDoc(doc(db, 'items', item.itemId));
      
      // Reload data
      await loadHomeData();
    } catch (error) {
      console.error('Error using item:', error);
      alert('Failed to mark item as used');
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

  const getExpirationTag = (item: Item) => {
    const expirationDate = item.manualExpirationDate || item.autoExpirationDate;
    const daysUntil = getDaysUntilExpiration(expirationDate);
    
    if (daysUntil < 0) {
      return { text: 'Expired', color: '#dc3545', bgColor: '#fee' };
    }
    if (daysUntil === 0) {
      return { text: 'Today', color: '#fff', bgColor: '#fd7e14' };
    }
    if (daysUntil <= 2) {
      return { text: 'Soon', color: '#fff', bgColor: '#ffc107' };
    }
    return null;
  };

  const getDaysSincePurchase = (item: Item) => {
    const purchaseDate = new Date(item.purchaseDate);
    const now = new Date();
    const diffTime = now.getTime() - purchaseDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Bought today';
    if (diffDays === 1) return 'Bought 1 day ago';
    return `Bought ${diffDays} days ago`;
  };

  const getLocationText = (location: string) => {
    const locations: Record<string, string> = {
      'fridge': 'Refrigerator',
      'freezer': 'Freezer',
      'pantry': 'Pantry',
    };
    return locations[location] || location;
  };

  const getExpirationText = (item: Item) => {
    const expirationDate = item.manualExpirationDate || item.autoExpirationDate;
    const daysUntil = getDaysUntilExpiration(expirationDate);
    
    if (daysUntil < 0) {
      return `Expired ${Math.abs(daysUntil)} days ago`;
    }
    if (daysUntil === 0) {
      return 'Expires today';
    }
    if (daysUntil === 1) {
      return 'Expires tomorrow';
    }
    return `Expires in ${daysUntil} days`;
  };

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#fafafa'
      }}>
        <div style={{ fontSize: '18px', color: '#666' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#fafafa',
      paddingBottom: '80px'
    }}>
      {/* Top Header */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: '#e0e0e0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px'
          }}>
            👤
          </div>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#000' }}>
            Hi, User!
          </h1>
        </div>
        <div style={{
          fontSize: '20px',
          cursor: 'pointer',
          color: '#000'
        }}>
          ☰
        </div>
      </div>

      {/* Monthly Impact Section */}
      <div style={{ padding: '20px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '15px'
        }}>
          <h2 style={{ 
            fontSize: '18px', 
            fontWeight: 'bold',
            color: '#000',
            margin: 0
          }}>
            Monthly impact
          </h2>
          <span style={{ fontSize: '14px', color: '#999' }}>?</span>
        </div>
        
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          {/* Left Column */}
          <div style={{
            flex: 1,
            borderRight: '1px solid #e0e0e0',
            paddingRight: '20px'
          }}>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#000', marginBottom: '4px' }}>
              {monthlyStats.itemsUsedJustInTime}
            </div>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
              items
            </div>
            <div style={{ fontSize: '12px', color: '#999' }}>
              Used just in time
            </div>
          </div>

          {/* Right Column */}
          <div style={{
            flex: 1,
            paddingLeft: '20px'
          }}>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#000', marginBottom: '4px' }}>
              {Math.round(monthlyStats.estimatedValueSaved)}
            </div>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
              USD
            </div>
            <div style={{ fontSize: '12px', color: '#999' }}>
              Est. value saved
            </div>
          </div>
        </div>
      </div>

      {/* Eat Soon Section */}
      <div style={{ padding: '0 20px 20px 20px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '15px'
        }}>
          <h2 style={{ 
            fontSize: '18px', 
            fontWeight: 'bold',
            color: '#000',
            margin: 0
          }}>
            Eat Soon
          </h2>
          {expiringItems.length > 0 && (
            <Link
              to="/inventory"
              style={{
                fontSize: '14px',
                color: '#999',
                textDecoration: 'none'
              }}
            >
              See All
            </Link>
          )}
        </div>

        {expiringItems.length === 0 ? (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '30px',
            textAlign: 'center',
            color: '#999',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '32px', marginBottom: '10px' }}>✅</div>
            <div style={{ fontSize: '14px' }}>No items expiring soon!</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {expiringItems.slice(0, 3).map(item => {
              const tag = getExpirationTag(item);
              return (
                <div
                  key={item.itemId}
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    padding: '15px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}
                >
                  {/* Category Icon */}
                  <div style={{ fontSize: '24px' }}>
                    {getCategoryIcon(item.category)}
                  </div>

                  {/* Tag */}
                  {tag && (
                    <div style={{
                      padding: '4px 10px',
                      borderRadius: '12px',
                      backgroundColor: tag.bgColor,
                      color: tag.color,
                      fontSize: '12px',
                      fontWeight: 'bold',
                      whiteSpace: 'nowrap'
                    }}>
                      {tag.text}
                    </div>
                  )}

                  {/* Item Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '16px', fontWeight: '500', color: '#000', marginBottom: '4px' }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      {getLocationText(item.location)}
                    </div>
                  </div>

                  {/* Expiration Info and Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '12px', color: '#666', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>⏰</span>
                        <span>{getExpirationText(item)}</span>
                      </div>
                    </div>
                    <Link
                      to={`/item/${item.itemId}`}
                      style={{ fontSize: '16px', color: '#ccc', textDecoration: 'none' }}
                    >
                      ›
                    </Link>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUseItem(item);
                      }}
                      style={{
                        padding: '6px 16px',
                        border: '1px solid #e0e0e0',
                        borderRadius: '6px',
                        backgroundColor: 'white',
                        color: '#666',
                        fontSize: '12px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Used
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Inventory Overview Section */}
      <div style={{ padding: '0 20px 20px 20px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '15px'
        }}>
          <h2 style={{ 
            fontSize: '18px', 
            fontWeight: 'bold',
            color: '#000',
            margin: 0
          }}>
            Inventory
          </h2>
          <Link
            to="/inventory"
            style={{
              fontSize: '14px',
              color: '#999',
              textDecoration: 'none'
            }}
          >
            See All
          </Link>
        </div>

        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          {/* Total Column */}
          <div style={{
            flex: 1,
            borderRight: '1px solid #e0e0e0',
            paddingRight: '20px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
              Total
            </div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#000', marginBottom: '4px' }}>
              {inventoryStats.total}
            </div>
            <div style={{ fontSize: '12px', color: '#999' }}>
              items
            </div>
          </div>

          {/* Used Column */}
          <div style={{
            flex: 1,
            borderRight: '1px solid #e0e0e0',
            paddingLeft: '20px',
            paddingRight: '20px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
              Used
            </div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#28a745', marginBottom: '4px' }}>
              {inventoryStats.usedThisWeek}
            </div>
            <div style={{ fontSize: '12px', color: '#999' }}>
              this week
            </div>
          </div>

          {/* Expiring Column */}
          <div style={{
            flex: 1,
            paddingLeft: '20px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
              Expiring
            </div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#dc3545', marginBottom: '4px' }}>
              {inventoryStats.expiringSoon}
            </div>
            <div style={{ fontSize: '12px', color: '#999' }}>
              soon
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation Bar - Black Background */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#000',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        padding: '12px 0',
        zIndex: 100
      }}>
        {/* Today (Active) */}
        <Link 
          to="/" 
          style={{ 
            textDecoration: 'none', 
            color: '#000', 
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            flex: 1
          }}
        >
          <div style={{ fontSize: '20px' }}>🏠</div>
          <div style={{ fontSize: '12px', fontWeight: '500' }}>Today</div>
        </Link>

        {/* Add Button - Large Circular */}
        <button
          onClick={() => setIsAddFoodModalOpen(true)}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            marginTop: '-25px'
          }}
        >
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: '#000',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '32px',
            border: '2px solid #fff'
          }}>
            +
          </div>
        </button>

        {/* Inventory (Inactive) */}
        <Link 
          to="/inventory" 
          style={{ 
            textDecoration: 'none', 
            color: '#999', 
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            flex: 1
          }}
        >
          <div style={{ fontSize: '20px' }}>📦</div>
          <div style={{ fontSize: '12px' }}>Inventory          </div>
        </Link>
      </div>

      {/* Add Food Modal */}
      <AddFoodModal
        isOpen={isAddFoodModalOpen}
        onClose={() => setIsAddFoodModalOpen(false)}
      />
    </div>
  );
}
