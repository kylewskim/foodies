import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getItemsByLocation, getItemsByUser, markItemAsTrashed, markItemAsUsed, updateItem } from '../firebase/saveReceipt';
import type { Item, StorageLocation } from '../types';
import { fetchProductImage } from '../services/productImageService';
import { getDaysUntilExpiration } from '../utils/dateHelpers';
import { BottomNavigation } from '../components/BottomNavigation';
import { ProductImage } from '../components/ProductImage';

export function InventoryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const locationFilter = (searchParams.get('location') as StorageLocation) || 'fridge';
  const [items, setItems] = useState<Item[]>([]);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Swipe state
  const [swipedItemId, setSwipedItemId] = useState<string | null>(null);
  const [touchStart, setTouchStart] = useState<number>(0);
  const [touchCurrent, setTouchCurrent] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [touchedItemId, setTouchedItemId] = useState<string | null>(null);
  const [isSwipeActive, setIsSwipeActive] = useState(false);
  const SWIPE_THRESHOLD = 15; // Minimum px to move before activating swipe

  useEffect(() => {
    if (user) {
      loadItems();
      loadAllItems();
    }
  }, [locationFilter, user]);

  const loadItems = async () => {
    if (!user) return;

    try {
      const locationItems = await getItemsByLocation(user.uid, locationFilter);

      // Sort by expiration date
      locationItems.sort((a, b) => {
        const expA = new Date(a.manualExpirationDate || a.autoExpirationDate);
        const expB = new Date(b.manualExpirationDate || b.autoExpirationDate);
        return expA.getTime() - expB.getTime();
      });

      setItems(locationItems);

      // Background image fetch for items without imageUrl — fire-and-forget
      locationItems
        .filter(item => !item.imageUrl)
        .forEach(async (item) => {
          const url = await fetchProductImage(item.name);
          if (url) {
            const updated = { ...item, imageUrl: url };
            setItems(prev => prev.map(p => p.itemId === item.itemId ? updated : p));
            updateItem(updated).catch(console.warn);
          }
        });
    } catch (error) {
      console.error('Error loading items:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllItems = async () => {
    if (!user) return;

    try {
      const userItems = await getItemsByUser(user.uid);
      setAllItems(userItems);
    } catch (error) {
      console.error('Error loading all items:', error);
    }
  };

  const handleTouchStart = (e: React.TouchEvent, itemId: string) => {
    setTouchStart(e.touches[0].clientX);
    setTouchCurrent(e.touches[0].clientX);
    setTouchedItemId(itemId);
    setIsDragging(true);
    setIsSwipeActive(false); // Don't activate swipe until threshold is exceeded
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;

    const currentX = e.touches[0].clientX;
    setTouchCurrent(currentX);

    // Check if we've exceeded the swipe threshold
    const moveDistance = Math.abs(touchStart - currentX);
    if (moveDistance > SWIPE_THRESHOLD && !isSwipeActive) {
      setIsSwipeActive(true);
      setSwipedItemId(touchedItemId);
    }
  };

  const handleTouchEnd = (itemId: string) => {
    const swipeDistance = touchStart - touchCurrent;

    // Only process as swipe if swipe was activated
    if (isSwipeActive) {
      if (swipeDistance > 60) {
        // Swiped left enough, keep it open
        setSwipedItemId(itemId);
      } else {
        // Not enough swipe, close it
        setSwipedItemId(null);
      }
    }
    // If swipe wasn't activated, the onClick handler will handle navigation

    setIsDragging(false);
    setTouchStart(0);
    setTouchCurrent(0);
    setTouchedItemId(null);
    setIsSwipeActive(false);
  };

  const handleTrash = async (itemId: string) => {
    if (!user) return;
    try {
      await markItemAsTrashed(itemId);
      setSwipedItemId(null);
      await loadItems();
      await loadAllItems();
    } catch (error) {
      console.error('Error trashing item:', error);
    }
  };

  const handleUsed = async (itemId: string) => {
    if (!user) return;
    try {
      await markItemAsUsed(itemId);
      setSwipedItemId(null);
      await loadItems();
      await loadAllItems();
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
        bgColor: 'rgba(252,238,117,0.75)',
        textColor: '#756900',
      };
    }

    if (daysUntil <= 5) {
      return {
        text: `Eat within ${daysUntil} day${daysUntil === 1 ? '' : 's'}`,
        bgColor: 'rgba(215,237,100,0.75)',
        textColor: '#516c00',
      };
    }

    return null;
  };

  const getDaysSincePurchase = (item: Item) => {
    const purchaseDate = new Date(item.purchaseDate);
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

  // Search results - search across all locations
  const getSearchResults = () => {
    if (!searchQuery.trim()) return { fridge: [], freezer: [], pantry: [] };

    const query = searchQuery.toLowerCase();
    const results: Record<StorageLocation, Item[]> = { fridge: [], freezer: [], pantry: [] };

    allItems.forEach(item => {
      if (item.name.toLowerCase().includes(query)) {
        results[item.location].push(item);
      }
    });

    return results;
  };

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

  // Search View
  if (showSearch) {
    const searchResults = getSearchResults();
    const hasQuery = searchQuery.trim().length > 0;

    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f7f6ef',
        paddingBottom: '100px'
      }}>
        {/* Search Header */}
        <div style={{
          padding: '14px 20px',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#efeee7',
            borderRadius: '16px',
            padding: '12px 16px',
            gap: '16px',
          }}>
            {/* Search Icon */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="#11130b" strokeWidth="1.5"/>
              <path d="M16 16L20 20" stroke="#11130b" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>

            {/* Input */}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              autoFocus
              style={{
                flex: 1,
                border: 'none',
                backgroundColor: 'transparent',
                fontSize: '14px',
                fontFamily: '"Poppins", sans-serif',
                color: '#11130b',
                outline: 'none',
              }}
            />

            {/* Clear/Close Button */}
            <button
              onClick={() => {
                if (searchQuery) {
                  setSearchQuery('');
                } else {
                  setShowSearch(false);
                }
              }}
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: '#11130b',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
              }}
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M1 1L7 7M7 1L1 7" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Search Results */}
        {hasQuery && (
          <div style={{ padding: '0 20px' }}>
            {(['fridge', 'freezer', 'pantry'] as StorageLocation[]).map(loc => {
              const locItems = searchResults[loc];
              return (
                <div key={loc} style={{ marginBottom: '24px' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px',
                  }}>
                    <p style={{
                      fontSize: '14px',
                      fontFamily: '"Poppins", sans-serif',
                      color: '#11130b',
                      margin: 0,
                      textTransform: 'capitalize',
                    }}>
                      {loc}
                    </p>
                    <p style={{
                      fontSize: '10px',
                      fontFamily: '"Poppins", sans-serif',
                      color: '#11130b',
                      opacity: 0.4,
                      margin: 0,
                    }}>
                      {locItems.length > 0 ? `${locItems.length} Found` : 'None Found'}
                    </p>
                  </div>

                  {locItems.map(item => {
                    const statusBadge = getStatusBadge(item);
                    const daysSince = getDaysSincePurchase(item);

                    return (
                      <div
                        key={item.itemId}
                        onClick={() => navigate(`/item/${item.itemId}`)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '16px 0',
                          borderBottom: '1px solid rgba(51,51,51,0.1)',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {/* Item Image */}
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '8px',
                            backgroundColor: '#f5f5f5',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '20px',
                          }}>
                            {item.category === 'Produce' && '🥬'}
                            {item.category === 'Protein' && '🍖'}
                            {item.category === 'Dairy' && '🥛'}
                            {item.category === 'Grains' && '🌾'}
                            {item.category === 'Beverages' && '🥤'}
                            {item.category === 'Snacks' && '🍪'}
                            {item.category === 'Condiments' && '🧂'}
                            {item.category === 'Canned' && '🥫'}
                            {item.category === 'Frozen' && '🧊'}
                            {item.category === 'Other' && '📦'}
                            {!['Produce', 'Protein', 'Dairy', 'Grains', 'Beverages', 'Snacks', 'Condiments', 'Canned', 'Frozen', 'Other'].includes(item.category) && '🍽️'}
                          </div>

                          {/* Item Info */}
                          <div>
                            <p style={{
                              fontSize: '12px',
                              fontFamily: '"Poppins", sans-serif',
                              color: '#11130b',
                              margin: 0,
                              textTransform: 'capitalize',
                            }}>
                              {item.name}
                            </p>
                            <p style={{
                              fontSize: '10px',
                              fontFamily: '"Poppins", sans-serif',
                              color: '#11130b',
                              opacity: 0.5,
                              margin: 0,
                            }}>
                              Bought {daysSince} days ago
                            </p>
                          </div>
                        </div>

                        {/* Status Badge */}
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
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom Navigation */}
        <BottomNavigation />
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
        padding: '14px 20px',
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
          At Home
        </h1>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          {/* Search Icon */}
          <div
            onClick={() => setShowSearch(true)}
            style={{
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="#11130b" strokeWidth="1.5"/>
              <path d="M16 16L20 20" stroke="#11130b" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>

          {/* Add Icon */}
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
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1V13M1 7H13" stroke="#11130b" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>

          {/* List Icon */}
          <div
            style={{
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="5" cy="6" r="2" fill="#11130b"/>
              <circle cx="5" cy="12" r="2" fill="#11130b"/>
              <circle cx="5" cy="18" r="2" fill="#11130b"/>
              <path d="M10 6H20" stroke="#11130b" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M10 12H20" stroke="#11130b" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M10 18H20" stroke="#11130b" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
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

      {/* Items List - Full Width Swipe */}
      <div>
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
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filteredItems.map(item => {
              const statusBadge = getStatusBadge(item);
              const daysSince = getDaysSincePurchase(item);
              const isSwipedOpen = swipedItemId === item.itemId;
              const isCurrentlyDragging = isDragging && touchedItemId === item.itemId && isSwipeActive;
              const swipeOffset = isCurrentlyDragging
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

                  {/* Item Row (Swipeable) - Full Width */}
                  <div
                    onTouchStart={(e) => handleTouchStart(e, item.itemId)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={() => handleTouchEnd(item.itemId)}
                    onClick={(e) => {
                      // Only navigate if swipe wasn't activated and item isn't swiped open
                      if (isSwipeActive) {
                        // Swipe was activated, don't navigate
                        e.preventDefault();
                        return;
                      }
                      if (isSwipedOpen) {
                        // Item is swiped open, close it instead of navigating
                        e.preventDefault();
                        setSwipedItemId(null);
                      } else {
                        // Normal tap, navigate to detail
                        navigate(`/item/${item.itemId}`);
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
                      paddingLeft: '20px',
                      paddingRight: '20px',
                      cursor: 'pointer',
                      transform: `translateX(${swipeOffset}px)`,
                      transition: isCurrentlyDragging ? 'none' : 'transform 0.3s ease',
                      boxSizing: 'border-box',
                    }}
                  >
                    {/* Item Image */}
                    <ProductImage imageUrl={item.imageUrl} name={item.name} category={item.category} size={60} />

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
