import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getItemsByUser, updateItem, deleteItem } from '../firebase/saveReceipt';
import type { Item, StorageLocation } from '../types';
import { getDaysUntilExpiration } from '../utils/dateHelpers';

const LOCATION_LABELS: Record<StorageLocation, string> = {
  fridge: 'Fridge',
  freezer: 'Freezer',
  pantry: 'Pantry',
};

const CATEGORY_EMOJI: Record<string, string> = {
  Produce: '🥬',
  Protein: '🍖',
  Dairy: '🥛',
  Grains: '🌾',
  Beverages: '🥤',
  Snacks: '🍪',
  Condiments: '🧂',
  Canned: '🥫',
  Frozen: '🧊',
  Other: '📦',
  Prepared: '🍱',
};

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
  const [sortBy, setSortBy] = useState<'expiry' | 'added'>('expiry');
  const [showSortModal, setShowSortModal] = useState(false);

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
    if (sortBy === 'expiry') {
      const expA = new Date(a.manualExpirationDate || a.autoExpirationDate || '9999-12-31');
      const expB = new Date(b.manualExpirationDate || b.autoExpirationDate || '9999-12-31');
      return expA.getTime() - expB.getTime();
    }
    return new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime();
  });

  const displayedItems = isSearchMode && searchQuery
    ? sortedItems.filter((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : sortedItems;

  const getExpiryBadge = (item: Item) => {
    const expirationDate = item.manualExpirationDate || item.autoExpirationDate;
    const daysUntil = getDaysUntilExpiration(expirationDate);
    if (daysUntil < 0) return { text: 'Expired', bgColor: 'rgba(17,19,11,0.2)', textColor: '#333' };
    if (daysUntil === 0) return { text: 'Expires today', bgColor: 'rgba(252,238,117,0.75)', textColor: '#756900' };
    if (daysUntil <= 3) return { text: `${daysUntil}d left`, bgColor: 'rgba(215,237,100,0.75)', textColor: '#516c00' };
    return { text: `${daysUntil}d left`, bgColor: '#d3e2d0', textColor: '#333' };
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

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f7f6ef',
        }}
      >
        <div style={{ fontSize: '18px', color: '#666' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f7f6ef', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          paddingTop: 'max(16px, env(safe-area-inset-top))',
          borderBottom: '1px solid rgba(17,19,11,0.08)',
        }}
      >
        {isSearchMode ? (
          /* Search bar */
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => {
                setIsSearchMode(false);
                setSearchQuery('');
              }}
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
                flex: 1,
                height: '40px',
                borderRadius: '20px',
                border: '1px solid #e0e0e0',
                padding: '0 16px',
                fontFamily: '"Poppins", sans-serif',
                fontSize: '14px',
                backgroundColor: 'white',
                outline: 'none',
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
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Back button + title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => (isBulkMode ? (setIsBulkMode(false), setSelectedIds(new Set())) : navigate('/'))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
              >
                <svg width="16" height="19" viewBox="0 0 16 19" fill="none">
                  <path d="M8 1L1 9.5L8 18" stroke="#073d33" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <h1
                style={{
                  margin: 0,
                  fontFamily: '"Poppins", sans-serif',
                  fontSize: '20px',
                  fontWeight: '500',
                  color: '#1a1a1a',
                }}
              >
                {isBulkMode ? `${selectedIds.size} Selected` : label}
              </h1>
            </div>

            {/* Right actions */}
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              {!isBulkMode && (
                <>
                  <button
                    onClick={() => setIsSearchMode(true)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    aria-label="Search"
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <circle cx="9" cy="9" r="6" stroke="#11130b" strokeOpacity="0.6" strokeWidth="1.6" />
                      <path d="M13.5 13.5L17 17" stroke="#11130b" strokeOpacity="0.6" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setIsBulkMode(true)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
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
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: '"Poppins", sans-serif',
                    fontSize: '14px',
                    color: '#073d33',
                    padding: 0,
                  }}
                >
                  Done
                </button>
              )}
            </div>
          </div>
        )}

        {/* Sort button row (only when not in search/bulk mode) */}
        {!isSearchMode && !isBulkMode && (
          <button
            onClick={() => setShowSortModal(true)}
            style={{
              marginTop: '12px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 4H14M4 8H12M6 12H10" stroke="#11130b" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span style={{ fontFamily: '"Poppins", sans-serif', fontSize: '12px', color: 'rgba(17,19,11,0.5)' }}>
              {sortBy === 'expiry' ? 'Expiry date' : 'Date added'}
            </span>
          </button>
        )}
      </div>

      {/* Items list */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: isBulkMode ? '80px' : '20px' }}>
        {displayedItems.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 20px',
              gap: '8px',
            }}
          >
            <p style={{ fontFamily: '"Poppins", sans-serif', fontSize: '18px', color: '#11130b', margin: 0 }}>
              {isSearchMode && searchQuery ? 'No results found' : `${label} is empty`}
            </p>
          </div>
        ) : (
          displayedItems.map((item) => {
            const badge = getExpiryBadge(item);
            const isSelected = selectedIds.has(item.itemId);

            return (
              <div
                key={item.itemId}
                onClick={() => {
                  if (isBulkMode) {
                    toggleSelect(item.itemId);
                  } else {
                    navigate(`/item/${item.itemId}`);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  borderBottom: '1px solid rgba(17,19,11,0.06)',
                  cursor: 'pointer',
                  backgroundColor: '#f7f6ef',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {isBulkMode && (
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        border: `1.5px solid ${isSelected ? '#073d33' : '#b8b8b3'}`,
                        backgroundColor: isSelected ? '#073d33' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {isSelected && (
                        <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
                          <path d="M1 4.5L4.5 8L11 1" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  )}
                  {/* Image */}
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '8px',
                      backgroundColor: '#d3e2d0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '22px',
                      overflow: 'hidden',
                      flexShrink: 0,
                    }}
                  >
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : (
                      CATEGORY_EMOJI[item.category] ?? '🍽️'
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span
                      style={{
                        fontFamily: '"Poppins", sans-serif',
                        fontSize: '14px',
                        color: '#000',
                        textTransform: 'capitalize',
                      }}
                    >
                      {item.name}
                    </span>
                    {/* Expiry badge */}
                    <div
                      style={{
                        display: 'inline-flex',
                        backgroundColor: badge.bgColor,
                        borderRadius: '6px',
                        padding: '0 6px',
                        height: '18px',
                        alignItems: 'center',
                        alignSelf: 'flex-start',
                      }}
                    >
                      <span style={{ fontFamily: '"Poppins", sans-serif', fontSize: '10px', color: badge.textColor }}>
                        {badge.text}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bulk mode bottom toolbar */}
      {isBulkMode && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            height: '74px',
            paddingBottom: 'env(safe-area-inset-bottom)',
            backgroundColor: '#f7f6ef',
            borderTop: '1px solid rgba(0,0,0,0.08)',
            display: 'flex',
            zIndex: 30,
          }}
        >
          <button
            onClick={() => setShowMoveToModal(true)}
            disabled={selectedIds.size === 0}
            style={{
              flex: 1,
              border: 'none',
              background: 'none',
              cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer',
              opacity: selectedIds.size === 0 ? 0.4 : 1,
              fontFamily: '"Poppins", sans-serif',
              fontSize: '12px',
              color: '#073d33',
            }}
          >
            Move To
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            disabled={selectedIds.size === 0}
            style={{
              flex: 1,
              border: 'none',
              background: 'none',
              cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer',
              opacity: selectedIds.size === 0 ? 0.4 : 1,
              fontFamily: '"Poppins", sans-serif',
              fontSize: '12px',
              color: '#d8654a',
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
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: '#f7f6ef',
              borderTopLeftRadius: '20px',
              borderTopRightRadius: '20px',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px',
                borderBottom: '1px solid #ddd',
              }}
            >
              <span style={{ fontFamily: '"Poppins", sans-serif', fontSize: '20px', color: '#1a1a1a' }}>Move To</span>
              <button
                onClick={() => setShowMoveToModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
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
                      width: '100%',
                      height: '56px',
                      marginBottom: '12px',
                      borderRadius: '9999px',
                      border: '1.5px solid #073d33',
                      backgroundColor: '#d3e2d0',
                      color: '#484f46',
                      fontFamily: '"Poppins", sans-serif',
                      fontSize: '16px',
                      cursor: 'pointer',
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
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: '#f7f6ef',
              borderTopLeftRadius: '20px',
              borderTopRightRadius: '20px',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px',
                borderBottom: '1px solid #ddd',
              }}
            >
              <span style={{ fontFamily: '"Poppins", sans-serif', fontSize: '20px', color: '#1a1a1a' }}>Delete items?</span>
              <button
                onClick={() => setShowDeleteModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M5 5L15 15M15 5L5 15" stroke="#073d33" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div style={{ padding: '20px' }}>
              <p style={{ margin: 0, fontFamily: '"Poppins", sans-serif', fontSize: '14px', color: '#073d33', lineHeight: '1.5' }}>
                These items will be removed from your inventory.
                <br />
                You can't undo this action.
              </p>
            </div>
            <div style={{ padding: '12px' }}>
              <button
                onClick={handleDeleteSelected}
                style={{
                  width: '100%',
                  height: '56px',
                  marginBottom: '12px',
                  borderRadius: '9999px',
                  border: 'none',
                  backgroundColor: '#073d33',
                  color: '#f7f6ef',
                  fontFamily: '"Poppins", sans-serif',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                style={{
                  width: '100%',
                  height: '56px',
                  borderRadius: '9999px',
                  border: '1.5px solid #073d33',
                  backgroundColor: '#d3e2d0',
                  color: '#484f46',
                  fontFamily: '"Poppins", sans-serif',
                  fontSize: '16px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sort modal */}
      {showSortModal && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000 }}
          onClick={() => setShowSortModal(false)}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: '#f7f6ef',
              borderTopLeftRadius: '20px',
              borderTopRightRadius: '20px',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px',
                borderBottom: '1px solid #ddd',
              }}
            >
              <span style={{ fontFamily: '"Poppins", sans-serif', fontSize: '20px', color: '#1a1a1a' }}>Sort by</span>
              <button
                onClick={() => setShowSortModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M5 5L15 15M15 5L5 15" stroke="#073d33" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div style={{ padding: '12px' }}>
              {[
                { key: 'expiry' as const, label: 'Expiry date' },
                { key: 'added' as const, label: 'Date added' },
              ].map(({ key, label: sortLabel }) => (
                <button
                  key={key}
                  onClick={() => { setSortBy(key); setShowSortModal(false); }}
                  style={{
                    width: '100%',
                    height: '56px',
                    marginBottom: '12px',
                    borderRadius: '9999px',
                    border: sortBy === key ? '1.5px solid #073d33' : '1.5px solid #e0e0e0',
                    backgroundColor: sortBy === key ? '#d3e2d0' : 'white',
                    color: sortBy === key ? '#073d33' : '#333',
                    fontFamily: '"Poppins", sans-serif',
                    fontSize: '16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingLeft: '20px',
                    paddingRight: '20px',
                  }}
                >
                  <span>{sortLabel}</span>
                  {sortBy === key && (
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M4 10L8 14L16 6" stroke="#073d33" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
