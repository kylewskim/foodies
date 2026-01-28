import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getItemsExpiringSoon, getItemsByUser } from '../firebase/saveReceipt';
import type { Item } from '../types';
import { getDaysUntilExpiration } from '../utils/dateHelpers';
import { AddFoodModal } from '../components/AddFoodModal';
import { BottomNavigation } from '../components/BottomNavigation';

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
  const { user, logout } = useAuth();
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
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (user) {
      loadHomeData();
    }
  }, [location.pathname, user]);

  const loadHomeData = async () => {
    if (!user) return;
    
    try {
      const allItems = await getItemsByUser(user.uid);
      const expiring = await getItemsExpiringSoon(user.uid, 7);
      setExpiringItems(expiring);

      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const activeItems = allItems.filter(item => {
        const expirationDate = item.manualExpirationDate || item.autoExpirationDate;
        const expDate = new Date(expirationDate);
        return expDate >= now;
      });
      
      const itemsUsedJustInTime = activeItems.length;
      const estimatedValueSaved = itemsUsedJustInTime * 2.5;
      
      setMonthlyStats({
        itemsUsedJustInTime,
        estimatedValueSaved,
      });

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
      const { deleteDoc } = await import('firebase/firestore');
      const { doc } = await import('firebase/firestore');
      const { db } = await import('../firebase/firebaseConfig');
      
      await deleteDoc(doc(db, 'items', item.itemId));
      await loadHomeData();
    } catch (error) {
      console.error('Error using item:', error);
      alert('Failed to mark item as used');
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

  const getExpirationTag = (item: Item) => {
    const expirationDate = item.manualExpirationDate || item.autoExpirationDate;
    const daysUntil = getDaysUntilExpiration(expirationDate);
    
    if (daysUntil < 0) {
      return { text: 'Expired', color: '#dc3545', bgColor: '#ffebee' };
    }
    if (daysUntil === 0) {
      return { text: 'Today', color: '#c62828', bgColor: '#ffcdd2' };
    }
    if (daysUntil <= 3) {
      return { text: 'Soon', color: '#e65100', bgColor: '#fff3e0' };
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
      {/* Top Header */}
      <div style={{
        backgroundColor: '#fafaf8',
        padding: '16px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'relative'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            backgroundColor: '#e8e8e8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
          }}>
            {user?.photoURL ? (
              <img 
                src={user.photoURL} 
                alt="Profile" 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <span style={{ fontSize: '24px' }}>👤</span>
            )}
          </div>
          <h1 style={{ 
            margin: 0, 
            fontSize: '20px', 
            fontWeight: '600', 
            color: '#1a1a1a',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          }}>
            Hi, {user?.displayName?.split(' ')[0] || 'there'}!
          </h1>
        </div>
        <div 
          onClick={() => setShowMenu(!showMenu)}
          style={{
            padding: '8px',
            cursor: 'pointer',
            color: '#1a1a1a'
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </div>

        {/* Dropdown Menu */}
        {showMenu && (
          <>
            <div 
              onClick={() => setShowMenu(false)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 999
              }}
            />
            <div style={{
              position: 'absolute',
              top: '60px',
              right: '20px',
              backgroundColor: 'white',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              padding: '8px 0',
              minWidth: '160px',
              zIndex: 1000
            }}>
              <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid #f0f0f0',
                fontSize: '14px',
                color: '#666'
              }}>
                {user?.email}
              </div>
              <button
                onClick={() => {
                  setShowMenu(false);
                  logout();
                }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  textAlign: 'left',
                  fontSize: '14px',
                  color: '#dc3545',
                  cursor: 'pointer',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                }}
              >
                Sign out
              </button>
            </div>
          </>
        )}
      </div>

      {/* Monthly Impact Section */}
      <div style={{ padding: '12px 20px 20px 20px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '12px'
        }}>
          <h2 style={{ 
            fontSize: '16px', 
            fontWeight: '600',
            color: '#1a1a1a',
            margin: 0,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          }}>
            Monthly impact
          </h2>
          <div style={{
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            border: '1px solid #ccc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            color: '#999',
            cursor: 'pointer'
          }}>
            ?
          </div>
        </div>
        
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          padding: '24px',
          display: 'flex',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          {/* Left Column */}
          <div style={{
            flex: 1,
            borderRight: '1px solid #f0f0f0',
            paddingRight: '24px'
          }}>
            <div style={{ 
              fontSize: '36px', 
              fontWeight: '600', 
              color: '#1a1a1a', 
              marginBottom: '2px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
              {monthlyStats.itemsUsedJustInTime}
            </div>
            <div style={{ 
              fontSize: '14px', 
              color: '#999', 
              marginBottom: '4px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
              items
            </div>
            <div style={{ 
              fontSize: '13px', 
              color: '#b0b0b0',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
              Used just in time
            </div>
          </div>

          {/* Right Column */}
          <div style={{
            flex: 1,
            paddingLeft: '24px'
          }}>
            <div style={{ 
              fontSize: '36px', 
              fontWeight: '600', 
              color: '#1a1a1a', 
              marginBottom: '2px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
              {Math.round(monthlyStats.estimatedValueSaved)}
            </div>
            <div style={{ 
              fontSize: '14px', 
              color: '#999', 
              marginBottom: '4px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
              USD
            </div>
            <div style={{ 
              fontSize: '13px', 
              color: '#b0b0b0',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
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
          marginBottom: '12px'
        }}>
          <h2 style={{ 
            fontSize: '16px', 
            fontWeight: '600',
            color: '#1a1a1a',
            margin: 0,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          }}>
            Eat Soon
          </h2>
          {expiringItems.length > 0 && (
            <Link
              to="/inventory"
              style={{
                fontSize: '14px',
                color: '#999',
                textDecoration: 'none',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
              }}
            >
              See All
            </Link>
          )}
        </div>

        {expiringItems.length === 0 ? (
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '16px',
            padding: '40px 30px',
            textAlign: 'center',
            color: '#999',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
          }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>✅</div>
            <div style={{ 
              fontSize: '14px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
              No items expiring soon!
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {expiringItems.slice(0, 3).map(item => {
              const tag = getExpirationTag(item);
              return (
                <div
                  key={item.itemId}
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: '16px',
                    padding: '16px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                  }}
                >
                  {/* Top Row - Icon, Tag, Purchase Info, Arrow */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '12px'
                  }}>
                    {/* Category Icon */}
                    <div style={{ 
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: '#f5f5f5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px'
                    }}>
                      {getCategoryIcon(item.category)}
                    </div>

                    {/* Tag */}
                    {tag && (
                      <div style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        backgroundColor: tag.bgColor,
                        color: tag.color,
                        fontSize: '13px',
                        fontWeight: '500',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                      }}>
                        {tag.text}
                      </div>
                    )}

                    {/* Spacer */}
                    <div style={{ flex: 1 }} />

                    {/* Purchase Info */}
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '4px',
                      color: '#999',
                      fontSize: '13px',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12,6 12,12 16,14" />
                      </svg>
                      <span>{getDaysSincePurchase(item)}</span>
                    </div>

                    {/* Arrow */}
                    <Link
                      to={`/item/${item.itemId}`}
                      style={{ 
                        color: '#ccc', 
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="9,18 15,12 9,6" />
                      </svg>
                    </Link>
                  </div>

                  {/* Bottom Row - Name, Location, Used Button */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ 
                        fontSize: '18px', 
                        fontWeight: '600', 
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
                        {getLocationText(item.location)}
                      </div>
                    </div>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUseItem(item);
                      }}
                      style={{
                        padding: '8px 20px',
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        backgroundColor: 'white',
                        color: '#1a1a1a',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
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
          marginBottom: '12px'
        }}>
          <h2 style={{ 
            fontSize: '16px', 
            fontWeight: '600',
            color: '#1a1a1a',
            margin: 0,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          }}>
            Inventory
          </h2>
          <Link
            to="/inventory"
            style={{
              fontSize: '14px',
              color: '#999',
              textDecoration: 'none',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}
          >
            See All
          </Link>
        </div>

        <div style={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          padding: '24px 16px',
          display: 'flex',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          {/* Total Column */}
          <div style={{
            flex: 1,
            borderRight: '1px solid #f0f0f0',
            textAlign: 'center'
          }}>
            <div style={{ 
              fontSize: '13px', 
              color: '#999', 
              marginBottom: '8px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
              Total
            </div>
            <div style={{ 
              fontSize: '32px', 
              fontWeight: '600', 
              color: '#1a1a1a', 
              marginBottom: '4px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
              {inventoryStats.total}
            </div>
            <div style={{ 
              fontSize: '13px', 
              color: '#b0b0b0',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
              items
            </div>
          </div>

          {/* Used Column */}
          <div style={{
            flex: 1,
            borderRight: '1px solid #f0f0f0',
            textAlign: 'center'
          }}>
            <div style={{ 
              fontSize: '13px', 
              color: '#999', 
              marginBottom: '8px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
              Used
            </div>
            <div style={{ 
              fontSize: '32px', 
              fontWeight: '600', 
              color: '#4caf50', 
              marginBottom: '4px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
              {inventoryStats.usedThisWeek}
            </div>
            <div style={{ 
              fontSize: '13px', 
              color: '#b0b0b0',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
              this week
            </div>
          </div>

          {/* Expiring Column */}
          <div style={{
            flex: 1,
            textAlign: 'center'
          }}>
            <div style={{ 
              fontSize: '13px', 
              color: '#999', 
              marginBottom: '8px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
              Expiring
            </div>
            <div style={{ 
              fontSize: '32px', 
              fontWeight: '600', 
              color: '#f44336', 
              marginBottom: '4px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
              {inventoryStats.expiringSoon}
            </div>
            <div style={{ 
              fontSize: '13px', 
              color: '#b0b0b0',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
              soon
            </div>
          </div>
        </div>
      </div>

      {/* Floating Add Button */}
      <button
        onClick={() => setIsAddFoodModalOpen(true)}
        style={{
          position: 'fixed',
          bottom: '80px',
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
