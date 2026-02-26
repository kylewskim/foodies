import { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getItemsByUser } from '../firebase/saveReceipt';
import type { Item, StorageLocation } from '../types';
import { getDaysUntilExpiration } from '../utils/dateHelpers';
import { BottomNavigation } from '../components/BottomNavigation';
import { AddFoodModal } from '../components/AddFoodModal';

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

export function HomePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Hidden file inputs for AddFoodModal camera/album paths
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const albumInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      loadHomeData();
    }
  }, [location.pathname, user]);

  const loadHomeData = async () => {
    if (!user) return;
    try {
      const items = await getItemsByUser(user.uid);
      setAllItems(items);
    } catch (error) {
      console.error('Error loading home data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>, method: 'scan' | 'upload') => {
    const file = event.target.files?.[0];
    if (file) {
      navigate(`/add-item?method=${method}`, { state: { selectedFile: file } });
    }
    event.target.value = '';
  };

  // Per-location counts
  const locationCounts: Record<StorageLocation, number> = {
    fridge: allItems.filter((i) => i.location === 'fridge').length,
    freezer: allItems.filter((i) => i.location === 'freezer').length,
    pantry: allItems.filter((i) => i.location === 'pantry').length,
  };

  const totalItems = allItems.length;

  // "Use These First" — sorted by expiry date ASC, top 10
  const useTheseFirst = [...allItems]
    .sort((a, b) => {
      const expA = new Date(a.manualExpirationDate || a.autoExpirationDate || '9999-12-31');
      const expB = new Date(b.manualExpirationDate || b.autoExpirationDate || '9999-12-31');
      return expA.getTime() - expB.getTime();
    })
    .slice(0, 10);

  const getExpiryBadge = (item: Item) => {
    const expirationDate = item.manualExpirationDate || item.autoExpirationDate;
    const daysUntil = getDaysUntilExpiration(expirationDate);

    if (daysUntil < 0) {
      return { text: 'Expired', bgColor: 'rgba(17,19,11,0.2)', textColor: '#333' };
    }
    if (daysUntil === 0) {
      return { text: 'Expires today', bgColor: 'rgba(252,238,117,0.75)', textColor: '#756900' };
    }
    if (daysUntil <= 3) {
      return { text: `${daysUntil}d left`, bgColor: 'rgba(215,237,100,0.75)', textColor: '#516c00' };
    }
    return { text: `${daysUntil}d left`, bgColor: '#d3e2d0', textColor: '#333' };
  };

  const getDaysSincePurchase = (item: Item) => {
    const purchaseDate = new Date(item.purchaseDate);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Bought today';
    if (diffDays === 1) return 'Bought 1 day ago';
    return `Bought ${diffDays} days ago`;
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

  const locationCards: { key: StorageLocation; label: string }[] = [
    { key: 'fridge', label: 'Fridge' },
    { key: 'freezer', label: 'Freezer' },
    { key: 'pantry', label: 'Pantry' },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f7f6ef',
        paddingBottom: '100px',
        position: 'relative',
      }}
    >
      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => handleFileSelected(e, 'scan')}
        style={{ display: 'none' }}
      />
      <input
        ref={albumInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,image/heic"
        onChange={(e) => handleFileSelected(e, 'upload')}
        style={{ display: 'none' }}
      />

      {/* Header */}
      <div style={{ padding: '20px 20px 16px 20px' }}>
        <h1
          style={{
            margin: 0,
            fontSize: '28px',
            fontWeight: '400',
            color: '#11130b',
            fontFamily: '"Poppins", sans-serif',
          }}
        >
          At Home
        </h1>
      </div>

      {/* Browse By Location */}
      <div style={{ padding: '0 20px 24px 20px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          {locationCards.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => navigate(`/location/${key}`)}
              style={{
                flex: 1,
                backgroundColor: 'white',
                border: '1px solid #e0e0e0',
                borderRadius: '12px',
                padding: '16px 12px',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <span
                style={{
                  fontFamily: '"Poppins", sans-serif',
                  fontSize: '16px',
                  fontWeight: '500',
                  color: '#11130b',
                }}
              >
                {label}
              </span>
              <span
                style={{
                  fontFamily: '"Poppins", sans-serif',
                  fontSize: '12px',
                  color: 'rgba(17,19,11,0.5)',
                }}
              >
                {locationCounts[key]} item{locationCounts[key] !== 1 ? 's' : ''}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {totalItems === 0 ? (
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
          <p
            style={{
              fontFamily: '"Poppins", sans-serif',
              fontSize: '18px',
              color: '#11130b',
              margin: 0,
              fontWeight: '500',
            }}
          >
            Your kitchen is empty
          </p>
          <p
            style={{
              fontFamily: '"Poppins", sans-serif',
              fontSize: '14px',
              color: 'rgba(17,19,11,0.5)',
              margin: 0,
            }}
          >
            Add items to get started
          </p>
        </div>
      ) : (
        /* Use These First section */
        <div style={{ padding: '0 20px' }}>
          <h2
            style={{
              fontFamily: '"Poppins", sans-serif',
              fontSize: '20px',
              fontWeight: '400',
              color: '#11130b',
              margin: '0 0 16px 0',
            }}
          >
            Use These First
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {useTheseFirst.map((item) => {
              const badge = getExpiryBadge(item);
              return (
                <div
                  key={item.itemId}
                  onClick={() => navigate(`/item/${item.itemId}`)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Image */}
                    <div
                      style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '8px',
                        backgroundColor: '#f5f5f5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '28px',
                        overflow: 'hidden',
                        flexShrink: 0,
                      }}
                    >
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                      ) : (
                        CATEGORY_EMOJI[item.category] ?? '🍽️'
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span
                        style={{
                          fontFamily: '"Poppins", sans-serif',
                          fontSize: '18px',
                          color: '#000',
                          textTransform: 'capitalize',
                        }}
                      >
                        {item.name}
                      </span>
                      <span
                        style={{
                          fontFamily: '"Poppins", sans-serif',
                          fontSize: '12px',
                          color: 'rgba(0,0,0,0.5)',
                        }}
                      >
                        {getDaysSincePurchase(item)}
                      </span>
                      {/* Expiry badge */}
                      <div
                        style={{
                          display: 'inline-flex',
                          backgroundColor: badge.bgColor,
                          borderRadius: '8px',
                          padding: '0 8px',
                          height: '20px',
                          alignItems: 'center',
                          alignSelf: 'flex-start',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: '"Poppins", sans-serif',
                            fontSize: '10px',
                            color: badge.textColor,
                          }}
                        >
                          {badge.text}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setShowAddModal(true)}
        style={{
          position: 'fixed',
          bottom: '90px',
          right: '20px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: '#073d33',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(7,61,51,0.35)',
          zIndex: 50,
        }}
        aria-label="Add food"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 5V19M5 12H19" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </button>

      <BottomNavigation />

      <AddFoodModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />
    </div>
  );
}
