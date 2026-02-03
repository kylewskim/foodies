import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getItemsByLocation, getItemsByUser, deleteItem } from '../firebase/saveReceipt';
import type { Item, StorageLocation } from '../types';
import { getDaysUntilExpiration } from '../utils/dateHelpers';
import { BottomNavigation } from '../components/BottomNavigation';

export function InventoryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const locationFilter = (searchParams.get('location') as StorageLocation) || 'fridge';
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  // Swipe state
  const [swipedItemId, setSwipedItemId] = useState<string | null>(null);
  const [touchStart, setTouchStart] = useState<number>(0);
  const [touchCurrent, setTouchCurrent] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (user) {
      loadItems();
    }
  }, [locationFilter, user]);

  const loadItems = async () => {
    if (!user) return;

    try {
      const allItems = await getItemsByLocation(user.uid, locationFilter);

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

  const handleTouchStart = (e: React.TouchEvent, itemId: string) => {
    setTouchStart(e.touches[0].clientX);
    setSwipedItemId(itemId);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    setTouchCurrent(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    const swipeDistance = touchStart - touchCurrent;

    if (swipeDistance > 60) {
      // Swiped left, keep it open
      setSwipedItemId(swipedItemId);
    } else {
      // Close it
      setSwipedItemId(null);
    }

    setIsDragging(false);
    setTouchStart(0);
    setTouchCurrent(0);
  };

  const handleTrash = async (itemId: string) => {
    if (!user) return;
    try {
      await deleteItem(user.uid, itemId);
      setSwipedItemId(null);
      await loadItems();
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const handleUsed = async (itemId: string) => {
    if (!user) return;
    try {
      await deleteItem(user.uid, itemId);
      setSwipedItemId(null);
      await loadItems();
    } catch (error) {
      console.error('Error marking item as used:', error);
    }
  };

  const getStatusBadge = (item: Item) => {
    const expirationDate = item.manualExpirationDate || item.autoExpirationDate;
    const daysUntil = getDaysUntilExpiration(expirationDate);

    if (daysUntil < 0) {
      return {
        text: 'Expired',
        bgColor: 'rgba(17,19,11,0.2)',
        textColor: '#333',
      };
    }

    if (daysUntil === 0) {
      return {
        text: 'Expires today',
        bgColor: '#fcee75',
        textColor: '#756900',
      };
    }

    if (daysUntil <= 3) {
      return {
        text: 'Eat within 3 days',
        bgColor: '#d7ed64',
        textColor: '#516c00',
      };
    }

    return null;
  };

  const getDaysSincePurchase = (item: Item) => {
    const purchaseDate = new Date(item.boughtDate || item.createdAt);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - purchaseDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const locationTabs: { key: StorageLocation; label: string }[] = [
    { key: 'fridge', label: 'FRIDGE' },
    { key: 'freezer', label: 'FREEZER' },
    { key: 'pantry', label: 'PANTRY' },
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
        backgroundColor: '#f7f6ef'
      }}>
        <div style={{ fontSize: '18px', color: '#666', fontFamily: '"Poppins", sans-serif' }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f7f6ef',
      paddingBottom: '100px'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <h1 style={{
          margin: 0,
          fontSize: '28px',
          fontWeight: '400',
          fontFamily: '"Poppins", sans-serif',
          color: '#11130b',
        }}>
          My Food
        </h1>
        <div
          onClick={() => navigate('/add-item')}
          style={{
            width: '32px',
            height: '32px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="16" fill="#11130b"/>
            <path d="M16 10V22M10 16H22" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
      </div>

      {/* Location Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '0.8px solid rgba(17,19,11,0.2)',
        paddingTop: '16px',
      }}>
        {locationTabs.map(tab => (
          <div
            key={tab.key}
            onClick={() => setSearchParams({ location: tab.key })}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
              paddingLeft: '20px',
              paddingRight: '20px',
              cursor: 'pointer',
            }}
          >
            <p style={{
              fontSize: '14px',
              fontFamily: locationFilter === tab.key ? '"Poppins", sans-serif' : '"Poppins:Light", sans-serif',
              fontWeight: locationFilter === tab.key ? '400' : '300',
              letterSpacing: '0.5px',
              color: '#11130b',
              opacity: locationFilter === tab.key ? 1 : 0.6,
              margin: 0,
            }}>
              {tab.label}
            </p>
            {locationFilter === tab.key && (
              <div style={{
                backgroundColor: '#11130b',
                height: '1.998px',
                width: '100%',
              }} />
            )}
          </div>
        ))}
      </div>

      {/* Category Filter */}
      <div style={{
        display: 'flex',
        gap: '8px',
        padding: '16px 20px',
        overflowX: 'auto',
      }}>
        {categoryTabs.map(cat => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            style={{
              padding: '6px 12px',
              borderRadius: '16px',
              border: 'none',
              backgroundColor: categoryFilter === cat ? '#e3e9e3' : '#efeee7',
              color: categoryFilter === cat ? '#073d35' : '#11130b',
              fontSize: '12px',
              fontWeight: '400',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontFamily: '"Poppins", sans-serif',
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
              fontFamily: '"Poppins", sans-serif'
            }}>
              No items found
            </div>
            <div style={{
              fontSize: '14px',
              fontFamily: '"Poppins", sans-serif'
            }}>
              Add items to get started
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredItems.map(item => {
              const statusBadge = getStatusBadge(item);
              const daysSince = getDaysSincePurchase(item);
              const isSwipedOpen = swipedItemId === item.itemId;
              const swipeOffset = isDragging && swipedItemId === item.itemId
                ? Math.min(0, touchCurrent - touchStart)
                : isSwipedOpen ? -176 : 0;

              return (
                <div
                  key={item.itemId}
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '92px',
                    overflow: 'hidden',
                  }}
                >
                  {/* Action Buttons (Behind) */}
                  <div style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    height: '92px',
                    display: 'flex',
                  }}>
                    <div
                      onClick={() => handleTrash(item.itemId)}
                      style={{
                        backgroundColor: '#a9a8a4',
                        width: '88px',
                        height: '92px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <p style={{
                        fontSize: '12px',
                        fontWeight: '500',
                        fontFamily: '"Poppins", sans-serif',
                        color: 'white',
                        margin: 0,
                        textTransform: 'capitalize',
                      }}>
                        trash
                      </p>
                    </div>
                    <div
                      onClick={() => handleUsed(item.itemId)}
                      style={{
                        backgroundColor: '#d8654a',
                        width: '88px',
                        height: '92px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <p style={{
                        fontSize: '12px',
                        fontWeight: '500',
                        fontFamily: '"Poppins", sans-serif',
                        color: 'white',
                        margin: 0,
                        textTransform: 'capitalize',
                      }}>
                        used
                      </p>
                    </div>
                  </div>

                  {/* Item Row (Swipeable) */}
                  <div
                    onTouchStart={(e) => handleTouchStart(e, item.itemId)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onClick={(e) => {
                      if (!isSwipedOpen) {
                        navigate(`/item/${item.itemId}`);
                      } else {
                        e.preventDefault();
                        setSwipedItemId(null);
                      }
                    }}
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: '100%',
                      height: '92px',
                      backgroundColor: '#f7f6ef',
                      borderBottom: '1px solid rgba(51,51,51,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      paddingTop: '16px',
                      paddingBottom: '16px',
                      cursor: 'pointer',
                      transform: `translateX(${swipeOffset}px)`,
                      transition: isDragging ? 'none' : 'transform 0.3s ease',
                    }}
                  >
                    {/* Item Image */}
                    <div style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '8px',
                      backgroundColor: '#f5f5f5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '32px',
                      overflow: 'hidden',
                      flexShrink: 0,
                    }}>
                      {item.category === 'Produce' && '🥬'}
                      {item.category === 'Protein' && '🍖'}
                      {item.category === 'Dairy' && '🥛'}
                      {item.category === 'Grains' && '🌾'}
                      {item.category === 'Beverages' && '🥤'}
                      {!['Produce', 'Protein', 'Dairy', 'Grains', 'Beverages'].includes(item.category) && '🍽️'}
                    </div>

                    {/* Item Info */}
                    <div style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}>
                      <p style={{
                        fontSize: '18px',
                        fontFamily: '"Poppins", sans-serif',
                        color: '#11130b',
                        margin: 0,
                        textTransform: 'capitalize',
                      }}>
                        {item.name}
                      </p>
                      <div style={{
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'center',
                      }}>
                        {statusBadge && (
                          <div style={{
                            backgroundColor: statusBadge.bgColor,
                            height: '20px',
                            padding: '0 8px',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <p style={{
                              fontSize: '10px',
                              fontFamily: '"Poppins", sans-serif',
                              color: statusBadge.textColor,
                              margin: 0,
                            }}>
                              {statusBadge.text}
                            </p>
                          </div>
                        )}
                        <p style={{
                          fontSize: '12px',
                          fontFamily: '"Poppins", sans-serif',
                          color: '#11130b',
                          opacity: 0.5,
                          margin: 0,
                        }}>
                          Bought {daysSince} days ago
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
}
