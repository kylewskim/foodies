import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getItemsByUser, updateItem, deleteItem, markItemAsTrashed, markItemAsUsed } from '../firebase/saveReceipt';
import type { Item, StorageLocation } from '../types';
import { getDaysUntilExpiration } from '../utils/dateHelpers';

const LOCATION_LABELS: Record<StorageLocation, string> = {
  fridge: 'Fridge',
  freezer: 'Freezer',
  pantry: 'Pantry',
};

import { ProductImage } from '../components/ProductImage';


const FILTER_CATEGORIES = ['All', 'Produce', 'Dairy', 'Protein', 'Grains', 'Snacks', 'Frozen'];

export function LocationDetailPage() {
  const navigate = useNavigate();
  const { locationName } = useParams<{ locationName: string }>();
  const { user } = useAuth();

  const location = locationName as StorageLocation;
  const label = LOCATION_LABELS[location] ?? locationName ?? '';

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showMoveToModal, setShowMoveToModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [swipedItemId, setSwipedItemId] = useState<string | null>(null);
  const [touchStart, setTouchStart] = useState(0);
  const [touchCurrent, setTouchCurrent] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [touchedItemId, setTouchedItemId] = useState<string | null>(null);
  const [isSwipeActive, setIsSwipeActive] = useState(false);

  const SWIPE_THRESHOLD = 15;
  const SWIPE_OPEN_THRESHOLD = 60;
  const ACTION_WIDTH = 176;

  useEffect(() => {
    if (user) loadItems();
  }, [user, locationName]);

  const loadItems = async () => {
    if (!user) return;
    try {
      const allItems = await getItemsByUser(user.uid);
      const filtered = allItems.filter((i) => i.location === location);
      setItems(filtered);
    } catch (err) {
      console.error('Error loading items:', err);
    } finally {
      setLoading(false);
    }
  };

  const sortedItems = [...items].sort((a, b) => {
    const expA = new Date(a.manualExpirationDate || a.autoExpirationDate || '9999-12-31');
    const expB = new Date(b.manualExpirationDate || b.autoExpirationDate || '9999-12-31');
    return expA.getTime() - expB.getTime();
  });

  const filteredByCategory = activeCategory
    ? sortedItems.filter((i) => i.category === activeCategory)
    : sortedItems;

  const displayedItems = isSearchMode && searchQuery
    ? filteredByCategory.filter((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : filteredByCategory;

  const getExpiryBadge = (item: Item) => {
    const expirationDate = item.manualExpirationDate || item.autoExpirationDate;
    const daysUntil = getDaysUntilExpiration(expirationDate);
    if (daysUntil < 0) return { text: 'Expired', bgColor: 'rgba(17,19,11,0.2)', textColor: '#333' };
    if (daysUntil === 0) return { text: 'Expires today', bgColor: 'rgba(252,238,117,0.75)', textColor: '#756900' };
    if (daysUntil <= 3) return { text: `${daysUntil} days left`, bgColor: 'rgba(215,237,100,0.75)', textColor: '#516c00' };
    return null; // No badge for items with >3 days remaining
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleMoveSelected = async (newLocation: StorageLocation) => {
    const updates = items
      .filter((i) => selectedIds.has(i.itemId))
      .map((i) => updateItem({ ...i, location: newLocation }));
    await Promise.all(updates);
    setShowMoveToModal(false);
    setSelectedIds(new Set());
    setIsBulkMode(false);
    await loadItems();
  };

  const handleDeleteSelected = async () => {
    const deletes = Array.from(selectedIds).map((id) => deleteItem(id));
    await Promise.all(deletes);
    setShowDeleteModal(false);
    setSelectedIds(new Set());
    setIsBulkMode(false);
    await loadItems();
  };

  const handleTouchStart = (e: React.TouchEvent, itemId: string) => {
    if (isBulkMode) return;
    setTouchStart(e.touches[0].clientX);
    setTouchCurrent(e.touches[0].clientX);
    setTouchedItemId(itemId);
    setIsDragging(true);
    setIsSwipeActive(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || isBulkMode) return;

    const currentX = e.touches[0].clientX;
    setTouchCurrent(currentX);

    const moveDistance = Math.abs(touchStart - currentX);
    if (moveDistance > SWIPE_THRESHOLD && !isSwipeActive) {
      setIsSwipeActive(true);
      setSwipedItemId(touchedItemId);
    }
  };

  const handleTouchEnd = (itemId: string) => {
    if (isBulkMode) return;

    const swipeDistance = touchStart - touchCurrent;
    if (isSwipeActive) {
      if (swipeDistance > SWIPE_OPEN_THRESHOLD) {
        setSwipedItemId(itemId);
      } else {
        setSwipedItemId(null);
      }
    }

    setIsDragging(false);
    setTouchStart(0);
    setTouchCurrent(0);
    setTouchedItemId(null);
    setIsSwipeActive(false);
  };

  const handleTrash = async (itemId: string) => {
    try {
      await markItemAsTrashed(itemId);
      setSwipedItemId(null);
      await loadItems();
    } catch (error) {
      console.error('Error trashing item:', error);
    }
  };

  const handleUsed = async (itemId: string) => {
    try {
      await markItemAsUsed(itemId);
      setSwipedItemId(null);
      await loadItems();
    } catch (error) {
      console.error('Error marking item as used:', error);
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', backgroundColor: '#f7f6ef',
      }}>
        <div style={{ fontSize: '18px', color: '#666' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f7f6ef', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      {isSearchMode ? (
        /* Search mode */
        <div style={{ padding: '12px 20px', paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => { setIsSearchMode(false); setSearchQuery(''); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <svg width="16" height="19" viewBox="0 0 16 19" fill="none">
                <path d="M8 1L1 9.5L8 18" stroke="#073d33" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <input
              autoFocus
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search in ${label}...`}
              style={{
                flex: 1, height: '40px', borderRadius: '20px',
                border: '1px solid #e0e0e0', padding: '0 16px',
                fontFamily: '"Poppins", sans-serif', fontSize: '14px',
                backgroundColor: 'white', outline: 'none',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', fontSize: '18px', color: '#999' }}
              >
                ×
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Nav row + title row */}
          <div style={{ padding: '16px 20px 0 20px', paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
            {/* Nav row: back arrow | right icons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <button
                onClick={() => isBulkMode
                  ? (setIsBulkMode(false), setSelectedIds(new Set()))
                  : navigate('/')
                }
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 8px 8px 0', display: 'flex', alignItems: 'center' }}
              >
                <svg width="16" height="19" viewBox="0 0 16 19" fill="none">
                  <path d="M8 1L1 9.5L8 18" stroke="#11130b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                {!isBulkMode && (
                  <>
                    <button
                      onClick={() => setIsSearchMode(true)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                      aria-label="Search"
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <circle cx="10.5" cy="10.5" r="6.5" stroke="#11130b" strokeOpacity="0.6" strokeWidth="1.6" />
                        <path d="M15.5 15.5L20 20" stroke="#11130b" strokeOpacity="0.6" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setIsBulkMode(true)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                      aria-label="Bulk select"
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <g clipPath="url(#clip0_loc)">
                          <path d="M24 0H0V24H24V0Z" fill="white" fillOpacity="0.01" />
                          <path d="M17 2.5H4C3.17158 2.5 2.5 3.17158 2.5 4V17C2.5 17.8285 3.17158 18.5 4 18.5H17C17.8285 18.5 18.5 17.8285 18.5 17V4C18.5 3.17158 17.8285 2.5 17 2.5Z" stroke="#11130B" strokeLinejoin="round" />
                          <path d="M22.0002 6.50098V21C22.0002 21.5523 21.5525 22 21.0002 22H6.50195" stroke="#11130B" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M6.5 10.2429L9.49985 13.0055L14.5 7.85962" stroke="#11130B" strokeLinecap="round" strokeLinejoin="round" />
                        </g>
                        <defs>
                          <clipPath id="clip0_loc">
                            <rect width="24" height="24" fill="white" />
                          </clipPath>
                        </defs>
                      </svg>
                    </button>
                  </>
                )}
                {isBulkMode && (
                  <button
                    onClick={() => { setIsBulkMode(false); setSelectedIds(new Set()); }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontFamily: '"Poppins", sans-serif', fontSize: '14px', color: '#073d33', padding: 0,
                    }}
                  >
                    Done
                  </button>
                )}
              </div>
            </div>

            {/* Title row: "Fridge ↓" */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', paddingBottom: '12px' }}>
              <span style={{
                fontFamily: '"Poppins", sans-serif', fontSize: '28px',
                fontWeight: '400', color: '#11130b',
              }}>
                {isBulkMode ? `${selectedIds.size} Selected` : label}
              </span>
              {!isBulkMode && (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M6 9L12 15L18 9" stroke="#11130b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          </div>

          {/* Filter chips row — only when not in bulk mode */}
          {!isBulkMode && (
            <div style={{
              display: 'flex', gap: '8px', alignItems: 'center',
              padding: '0 20px 12px',
              overflowX: 'auto', WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
            }}>
              {/* Filter icon pill */}
              <div style={{
                padding: '6px', borderRadius: '16px', backgroundColor: '#efeee7',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M3 6h18M7 12h10M11 18h2" stroke="#11130b" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              {/* Category chips */}
              {FILTER_CATEGORIES.map((cat) => {
                const isActive = cat === 'All' ? !activeCategory : activeCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat === 'All' ? null : cat)}
                    style={{
                      padding: '6px 12px', borderRadius: '16px', border: 'none', flexShrink: 0,
                      backgroundColor: isActive ? '#e3e9e3' : '#efeee7',
                      color: isActive ? '#073d33' : '#11130b',
                      fontFamily: '"Poppins", sans-serif', fontSize: '12px', cursor: 'pointer',
                    }}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Items list */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: isBulkMode ? '80px' : '20px', padding: '0 20px' }}>
        {displayedItems.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '60px 0', gap: '8px',
          }}>
            <p style={{ fontFamily: '"Poppins", sans-serif', fontSize: '18px', color: '#11130b', margin: 0 }}>
              {isSearchMode && searchQuery ? 'No results found' : `${label} is empty`}
            </p>
          </div>
        ) : (
          displayedItems.map((item) => {
            const badge = getExpiryBadge(item);
            const isSelected = selectedIds.has(item.itemId);
            const isSwipedOpen = swipedItemId === item.itemId;
            const isCurrentlyDragging = isDragging && touchedItemId === item.itemId && isSwipeActive;
            const swipeOffset = isCurrentlyDragging
              ? Math.max(-ACTION_WIDTH, Math.min(0, touchCurrent - touchStart))
              : isSwipedOpen ? -ACTION_WIDTH : 0;
            const purchaseLabel = (() => {
              const diffDays = Math.floor((Date.now() - new Date(item.purchaseDate).getTime()) / 86400000);
              if (diffDays === 0) return 'Bought today';
              if (diffDays === 1) return 'Bought 1 day ago';
              return `Bought ${diffDays} days ago`;
            })();

            if (isBulkMode) {
              return (
                <div
                  key={item.itemId}
                  onClick={() => toggleSelect(item.itemId)}
                  style={{
                    display: 'flex', alignItems: 'center',
                    paddingTop: '16px', paddingBottom: '16px',
                    borderBottom: '1px solid rgba(51,51,51,0.1)',
                    cursor: 'pointer', minWidth: 0,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                    <div style={{
                      width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                      border: `1.5px solid ${isSelected ? '#073d33' : '#b8b8b3'}`,
                      backgroundColor: isSelected ? '#073d33' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isSelected && (
                        <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
                          <path d="M1 4.5L4.5 8L11 1" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <ProductImage imageUrl={item.imageUrl} name={item.name} category={item.category} size={60} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
                      <span style={{
                        fontFamily: '"Poppins", sans-serif', fontSize: '18px',
                        color: '#11130b', textTransform: 'capitalize',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {item.name}
                      </span>
                      <span style={{
                        fontFamily: '"Poppins", sans-serif', fontSize: '12px',
                        color: 'rgba(17,19,11,0.5)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {purchaseLabel}
                      </span>
                    </div>
                  </div>
                  {badge && (
                    <div style={{
                      backgroundColor: badge.bgColor, borderRadius: '8px',
                      padding: '0 8px', height: '20px',
                      display: 'flex', alignItems: 'center', flexShrink: 0, marginLeft: '8px',
                    }}>
                      <span style={{ fontFamily: '"Poppins", sans-serif', fontSize: '10px', color: badge.textColor }}>
                        {badge.text}
                      </span>
                    </div>
                  )}
                </div>
              );
            }

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
                      Trash
                    </p>
                  </div>
                  <div
                    onClick={() => handleUsed(item.itemId)}
                    style={{
                      backgroundColor: '#d8654a',
                      width: '88px',
                      height: '92px',
                      display: 'flex',
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
                      Used
                    </p>
                  </div>
                </div>

                <div
                  onTouchStart={(e) => handleTouchStart(e, item.itemId)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={() => handleTouchEnd(item.itemId)}
                  onClick={(e) => {
                    if (isSwipeActive) {
                      e.preventDefault();
                      return;
                    }
                    if (isSwipedOpen) {
                      e.preventDefault();
                      setSwipedItemId(null);
                    } else {
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
                    paddingLeft: '0',
                    paddingRight: '0',
                    cursor: 'pointer',
                    transform: `translateX(${swipeOffset}px)`,
                    transition: isCurrentlyDragging ? 'none' : 'transform 0.3s ease',
                    boxSizing: 'border-box',
                  }}>
                  <ProductImage imageUrl={item.imageUrl} name={item.name} category={item.category} size={60} />
                  <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
                      <span style={{
                        fontFamily: '"Poppins", sans-serif',
                        fontSize: '18px',
                        color: '#11130b',
                        textTransform: 'capitalize',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {item.name}
                      </span>
                      <span style={{
                        fontFamily: '"Poppins", sans-serif',
                        fontSize: '12px',
                        color: 'rgba(17,19,11,0.5)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {purchaseLabel}
                      </span>
                    </div>
                    {badge && (
                      <div style={{
                        backgroundColor: badge.bgColor,
                        borderRadius: '8px',
                        padding: '0 8px',
                        height: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        flexShrink: 0,
                        marginLeft: '8px',
                        maxWidth: '44%',
                      }}>
                        <span style={{
                          fontFamily: '"Poppins", sans-serif',
                          fontSize: '10px',
                          color: badge.textColor,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {badge.text}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bulk mode bottom toolbar */}
      {isBulkMode && (
        <div style={{
          position: 'fixed', left: 0, right: 0, bottom: 0,
          height: '74px', paddingBottom: 'env(safe-area-inset-bottom)',
          backgroundColor: '#f7f6ef', borderTop: '1px solid rgba(0,0,0,0.08)',
          display: 'flex', zIndex: 30,
        }}>
          <button
            onClick={() => setShowMoveToModal(true)}
            disabled={selectedIds.size === 0}
            style={{
              flex: 1, border: 'none', background: 'none',
              cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer',
              opacity: selectedIds.size === 0 ? 0.4 : 1,
              fontFamily: '"Poppins", sans-serif', fontSize: '12px', color: '#073d33',
            }}
          >
            Move To
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            disabled={selectedIds.size === 0}
            style={{
              flex: 1, border: 'none', background: 'none',
              cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer',
              opacity: selectedIds.size === 0 ? 0.4 : 1,
              fontFamily: '"Poppins", sans-serif', fontSize: '12px', color: '#d8654a',
            }}
          >
            Delete
          </button>
        </div>
      )}

      {/* Move To modal */}
      {showMoveToModal && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000 }}
          onClick={() => setShowMoveToModal(false)}
        >
          <div
            style={{
              position: 'absolute', left: 0, right: 0, bottom: 0,
              backgroundColor: '#f7f6ef',
              borderTopLeftRadius: '20px', borderTopRightRadius: '20px',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '20px', borderBottom: '1px solid rgba(0,0,0,0.08)',
            }}>
              <span style={{ fontFamily: '"Poppins", sans-serif', fontSize: '20px', color: '#1a1a1a' }}>Move To</span>
              <button onClick={() => setShowMoveToModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M5 5L15 15M15 5L5 15" stroke="#073d33" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div style={{ padding: '12px' }}>
              {(['fridge', 'freezer', 'pantry'] as StorageLocation[])
                .filter((loc) => loc !== location)
                .map((loc) => (
                  <button
                    key={loc}
                    onClick={() => handleMoveSelected(loc)}
                    style={{
                      width: '100%', height: '56px', marginBottom: '12px',
                      borderRadius: '9999px', border: '1.5px solid #073d33',
                      backgroundColor: '#d3e2d0', color: '#484f46',
                      fontFamily: '"Poppins", sans-serif', fontSize: '16px', cursor: 'pointer',
                    }}
                  >
                    {LOCATION_LABELS[loc]}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000 }}
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            style={{
              position: 'absolute', left: 0, right: 0, bottom: 0,
              backgroundColor: '#f7f6ef',
              borderTopLeftRadius: '20px', borderTopRightRadius: '20px',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '20px', borderBottom: '1px solid rgba(0,0,0,0.08)',
            }}>
              <span style={{ fontFamily: '"Poppins", sans-serif', fontSize: '20px', color: '#1a1a1a' }}>Delete items?</span>
              <button onClick={() => setShowDeleteModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M5 5L15 15M15 5L5 15" stroke="#073d33" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div style={{ padding: '20px' }}>
              <p style={{ margin: 0, fontFamily: '"Poppins", sans-serif', fontSize: '14px', color: '#073d33', lineHeight: '1.5' }}>
                These items will be removed from your inventory.<br />
                You can't undo this action.
              </p>
            </div>
            <div style={{ padding: '12px' }}>
              <button
                onClick={handleDeleteSelected}
                style={{
                  width: '100%', height: '56px', marginBottom: '12px',
                  borderRadius: '9999px', border: 'none',
                  backgroundColor: '#073d33', color: '#f7f6ef',
                  fontFamily: '"Poppins", sans-serif', fontSize: '16px', fontWeight: '500', cursor: 'pointer',
                }}
              >
                Delete
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                style={{
                  width: '100%', height: '56px', borderRadius: '9999px',
                  border: '1.5px solid #073d33', backgroundColor: '#d3e2d0', color: '#484f46',
                  fontFamily: '"Poppins", sans-serif', fontSize: '16px', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
