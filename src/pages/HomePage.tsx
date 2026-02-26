import { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getItemsByUser } from '../firebase/saveReceipt';
import type { Item, StorageLocation } from '../types';
import { getDaysUntilExpiration } from '../utils/dateHelpers';
import { BottomNavigation } from '../components/BottomNavigation';
import { AddFoodModal } from '../components/AddFoodModal';
import { ProductImage } from '../components/ProductImage';

export function HomePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const albumInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) loadHomeData();
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
    if (file) navigate(`/add-item?method=${method}`, { state: { selectedFile: file } });
    event.target.value = '';
  };

  const locationCounts: Record<StorageLocation, number> = {
    fridge: allItems.filter((i) => i.location === 'fridge').length,
    freezer: allItems.filter((i) => i.location === 'freezer').length,
    pantry: allItems.filter((i) => i.location === 'pantry').length,
  };

  const totalItems = allItems.length;

  // Use These First — sorted by expiry ASC, top 10
  const useTheseFirst = [...allItems]
    .sort((a, b) => {
      const expA = new Date(a.manualExpirationDate || a.autoExpirationDate || '9999-12-31');
      const expB = new Date(b.manualExpirationDate || b.autoExpirationDate || '9999-12-31');
      return expA.getTime() - expB.getTime();
    })
    .slice(0, 10);

  const expiringTodayCount = allItems.filter((item) => {
    const d = getDaysUntilExpiration(item.manualExpirationDate || item.autoExpirationDate);
    return d === 0;
  }).length;

  const expiringCount = allItems.filter((item) => {
    const d = getDaysUntilExpiration(item.manualExpirationDate || item.autoExpirationDate);
    return d <= 3 && d >= 0;
  }).length;

  const getExpiryBadge = (item: Item) => {
    const d = getDaysUntilExpiration(item.manualExpirationDate || item.autoExpirationDate);
    if (d < 0) return { text: 'Expired', bgColor: 'rgba(17,19,11,0.2)', textColor: '#333' };
    if (d === 0) return { text: 'Expires today', bgColor: 'rgba(252,238,117,0.75)', textColor: '#756900' };
    if (d <= 3) return { text: `${d} days left`, bgColor: 'rgba(215,237,100,0.75)', textColor: '#516c00' };
    return null; // No badge for items with >3 days remaining
  };

  const getDaysSincePurchase = (item: Item) => {
    const diffDays = Math.floor((Date.now() - new Date(item.purchaseDate).getTime()) / 86400000);
    if (diffDays === 0) return 'Bought today';
    if (diffDays === 1) return 'Bought 1 day ago';
    return `Bought ${diffDays} days ago`;
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f7f6ef' }}>
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
    <div style={{ minHeight: '100vh', backgroundColor: '#f7f6ef', paddingBottom: '100px', position: 'relative' }}>
      {/* Hidden file inputs */}
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment"
        onChange={(e) => handleFileSelected(e, 'scan')} style={{ display: 'none' }} />
      <input ref={albumInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/heic"
        onChange={(e) => handleFileSelected(e, 'upload')} style={{ display: 'none' }} />

      {/* Header */}
      <div style={{ padding: '14px 20px 0 20px' }}>
        <h1 style={{
          margin: 0,
          fontSize: '28px',
          fontWeight: '400',
          color: '#11130b',
          fontFamily: '"Poppins", sans-serif',
          letterSpacing: '-0.39px',
        }}>
          At Home
        </h1>
      </div>

      {/* Content */}
      <div style={{ padding: '0 20px', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Browse By Location */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontFamily: '"Poppins", sans-serif', fontSize: '20px', color: '#1a1a1a', margin: 0 }}>
            Browse By Location
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            {locationCards.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => navigate(`/location/${key}`)}
                style={{
                  flex: 1,
                  backgroundColor: 'white',
                  border: 'none',
                  borderRadius: '16px',
                  padding: '12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                {/* Label row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: '"Poppins", sans-serif', fontSize: '12px', color: '#333' }}>
                    {label}
                  </span>
                  {/* Small chevron right */}
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M5 3L9 7L5 11" stroke="#073d33" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                {/* Count row */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
                  <span style={{
                    fontFamily: '"Canela", Georgia, serif',
                    fontSize: '20px',
                    fontWeight: '300',
                    color: '#073d33',
                    lineHeight: '1',
                  }}>
                    {locationCounts[key]}
                  </span>
                  <span style={{
                    fontFamily: '"Poppins", sans-serif',
                    fontSize: '10px',
                    fontWeight: '300',
                    color: '#073d33',
                    marginBottom: '2px',
                  }}>
                    items
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Empty state */}
        {totalItems === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', gap: '8px' }}>
            <p style={{ fontFamily: '"Poppins", sans-serif', fontSize: '18px', color: '#11130b', margin: 0, fontWeight: '500' }}>
              Your kitchen is empty
            </p>
            <p style={{ fontFamily: '"Poppins", sans-serif', fontSize: '14px', color: 'rgba(17,19,11,0.5)', margin: 0 }}>
              Add items to get started
            </p>
          </div>
        ) : (
          /* Use These First */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Section header */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <p style={{ fontFamily: '"Poppins", sans-serif', fontSize: '20px', color: '#1a1a1a', margin: 0 }}>
                Use These First
              </p>
              {expiringCount > 0 && (
                <p style={{ fontFamily: '"Poppins", sans-serif', fontSize: '12px', color: '#073d33', margin: 0 }}>
                  <strong>{expiringTodayCount > 0 ? expiringTodayCount : expiringCount}</strong>
                  {' '}
                  {expiringTodayCount > 0 ? 'Items expiring today' : 'Items expiring soon'}
                </p>
              )}
            </div>

            {/* Item list */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {useTheseFirst.map((item) => {
                const badge = getExpiryBadge(item);
                return (
                  <div
                    key={item.itemId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: '16px',
                      paddingBottom: '16px',
                      borderBottom: '1px solid rgba(51,51,51,0.1)',
                      cursor: 'pointer',
                    }}
                    onClick={() => navigate(`/item/${item.itemId}`)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      {/* Image */}
                      <ProductImage imageUrl={item.imageUrl} name={item.name} category={item.category} size={60} />
                      {/* Info */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
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
                        }}>
                          {getDaysSincePurchase(item)}
                        </span>
                      </div>
                    </div>
                    {/* Expiry badge — only for expired / today / ≤3 days */}
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
              })}
            </div>
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowAddModal(true)}
        style={{
          position: 'fixed', bottom: '90px', right: '20px',
          width: '56px', height: '56px', borderRadius: '50%',
          backgroundColor: '#073d33', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(7,61,51,0.4)', zIndex: 50,
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
