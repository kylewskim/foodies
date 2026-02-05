import { useEffect, useState, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getItemsExpiringSoon, getUsedItems } from '../firebase/saveReceipt';
import type { Item } from '../types';
import { getDaysUntilExpiration } from '../utils/dateHelpers';
import { BottomNavigation } from '../components/BottomNavigation';

// Import icons
import scanReceiptIcon from '../assets/icon/scan_receipt.svg';
import typeInIcon from '../assets/icon/type_in.svg';
import infoIcon from '../assets/icon/info_icon.svg';
import arrowRightIcon from '../assets/icon/arrow_right.svg';

interface MonthlyStats {
  itemsUsedJustInTime: number;
  estimatedValueSaved: number;
}

export function HomePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [expiringItems, setExpiringItems] = useState<Item[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats>({
    itemsUsedJustInTime: 0,
    estimatedValueSaved: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showScanOptions, setShowScanOptions] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  
  // File input refs
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const albumInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      loadHomeData();
    }
  }, [location.pathname, user]);

  const loadHomeData = async () => {
    if (!user) return;

    try {
      const expiring = await getItemsExpiringSoon(user.uid, 7);
      setExpiringItems(expiring);

      // Get used items for current month
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      const usedItems = await getUsedItems(user.uid, currentMonth, currentYear);

      // Calculate actual savings from items with prices
      const itemsUsedJustInTime = usedItems.length;
      const estimatedValueSaved = usedItems.reduce((total, item) => {
        // Price is stored in cents, convert to dollars
        const itemPrice = item.price ? item.price / 100 : 2.5; // Default $2.50 if no price
        return total + itemPrice;
      }, 0);

      setMonthlyStats({
        itemsUsedJustInTime,
        estimatedValueSaved,
      });
    } catch (error) {
      console.error('Error loading home data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getExpirationDays = (item: Item) => {
    const expirationDate = item.manualExpirationDate || item.autoExpirationDate;
    const days = getDaysUntilExpiration(expirationDate);
    if (days < 0) return 'Expired';
    if (days === 0) return 'Expires today';
    if (days === 1) return 'Expires in 1 d';
    return `Expires in ${days} ds`;
  };

  const getLocationText = (loc: string) => {
    const locations: Record<string, string> = {
      'fridge': 'In fridge',
      'freezer': 'In freezer',
      'pantry': 'In pantry',
    };
    return locations[loc] || loc;
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

  const getCurrentMonth = () => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                    'July', 'August', 'September', 'October', 'November', 'December'];
    return months[new Date().getMonth()];
  };

  // Handle scan receipt options
  const handleScanReceiptClick = () => {
    setShowScanOptions(!showScanOptions);
  };

  const handleCameraClick = () => {
    setShowScanOptions(false);
    cameraInputRef.current?.click();
  };

  const handleAlbumClick = () => {
    setShowScanOptions(false);
    albumInputRef.current?.click();
  };

  const handleFileClick = () => {
    setShowScanOptions(false);
    fileInputRef.current?.click();
  };

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>, method: 'scan' | 'upload') => {
    const file = event.target.files?.[0];
    if (file) {
      navigate(`/add-item?method=${method}`, {
        state: { selectedFile: file }
      });
    }
    event.target.value = '';
  };

  const handleTypeItIn = () => {
    navigate('/add-item?method=manual');
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
        <div style={{ fontSize: '18px', color: '#666' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f7f6ef',
      paddingBottom: '100px'
    }}>
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
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        onChange={(e) => handleFileSelected(e, 'upload')}
        style={{ display: 'none' }}
      />

      {/* Header - Hi, Name */}
      <div style={{
        padding: '20px 24px 16px 24px',
      }}>
        <h1 style={{ 
          margin: 0, 
          fontSize: '28px', 
          fontWeight: '400', 
          color: '#1a1a1a',
          fontFamily: '"Poppins", sans-serif',
          letterSpacing: '-0.39px',
          lineHeight: '48px',
        }}>
          Hi, {user?.displayName?.split(' ')[0] || 'there'}
        </h1>
      </div>

      {/* Impact Card with Scan/Type buttons */}
      <div style={{ padding: '0 20px 24px 20px' }}>
        <div style={{
          border: '1px solid #073d35',
          borderRadius: '36px',
          padding: '6px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}>
          {/* Dark green impact section */}
          <div style={{
            backgroundColor: '#073d35',
            borderRadius: '32px',
            padding: '20px 24px',
          }}>
            {/* Impact in Month header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '16px',
            }}>
              <span style={{
                fontFamily: '"Poppins", sans-serif',
                fontSize: '14px',
                fontWeight: '500',
                color: '#d3e2d0',
              }}>
                Impact in {getCurrentMonth()}
              </span>
              <img src={infoIcon} alt="info" style={{ width: '12px', height: '12px' }} />
            </div>

            {/* Stats row */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
            }}>
              {/* Left stat - Items */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                  <span style={{
                    fontFamily: '"Canela", Georgia, serif',
                    fontSize: '48px',
                    fontWeight: '300',
                    color: '#f7f6ef',
                    lineHeight: '1',
                  }}>
                    {monthlyStats.itemsUsedJustInTime}
                  </span>
                  <span style={{
                    fontFamily: '"Poppins", sans-serif',
                    fontSize: '12px',
                    color: 'rgba(255,255,255,0.5)',
                    marginBottom: '8px',
                  }}>
                    items
                  </span>
                </div>
                <div style={{
                  fontFamily: '"Poppins", sans-serif',
                  fontSize: '12px',
                  color: '#d3e2d0',
                }}>
                  Used just in time
                </div>
              </div>

              {/* Divider */}
              <div style={{
                width: '1px',
                height: '40px',
                backgroundColor: 'rgba(255,255,255,0.2)',
                margin: '0 20px',
              }} />

              {/* Right stat - USD */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                  <span style={{
                    fontFamily: '"Canela", Georgia, serif',
                    fontSize: '48px',
                    fontWeight: '300',
                    color: '#f7f6ef',
                    lineHeight: '1',
                  }}>
                    {Math.round(monthlyStats.estimatedValueSaved)}
                  </span>
                  <span style={{
                    fontFamily: '"Poppins", sans-serif',
                    fontSize: '12px',
                    color: 'rgba(255,255,255,0.5)',
                    marginBottom: '8px',
                  }}>
                    USD
                  </span>
                </div>
                <div style={{
                  fontFamily: '"Poppins", sans-serif',
                  fontSize: '12px',
                  color: '#d3e2d0',
                }}>
                  Est. value saved
                </div>
              </div>
            </div>
          </div>

          {/* Scan Receipt / Type it in buttons */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
          }}>
            {/* Scan Receipt Button */}
            <div style={{ flex: 1, position: 'relative' }}>
              <button
                onClick={handleScanReceiptClick}
                style={{
                  width: '100%',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <img src={scanReceiptIcon} alt="Scan" style={{ width: '20px', height: '20px' }} />
                <span style={{
                  fontFamily: '"Poppins", sans-serif',
                  fontSize: '12px',
                  color: '#073d35',
                  textTransform: 'capitalize',
                }}>
                  Scan Receipt
                </span>
              </button>

              {/* Scan Options Dropdown */}
              {showScanOptions && (
                <>
                  <div 
                    onClick={() => setShowScanOptions(false)}
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
                    top: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    padding: '8px 0',
                    minWidth: '160px',
                    zIndex: 1000,
                  }}>
                    <button
                      onClick={handleCameraClick}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        textAlign: 'left',
                        fontSize: '14px',
                        color: '#1a1a1a',
                        cursor: 'pointer',
                        fontFamily: '"Poppins", sans-serif',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                      }}
                    >
                      📷 Take Photo
                    </button>
                    <button
                      onClick={handleAlbumClick}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        textAlign: 'left',
                        fontSize: '14px',
                        color: '#1a1a1a',
                        cursor: 'pointer',
                        fontFamily: '"Poppins", sans-serif',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                      }}
                    >
                      🖼️ Photo Library
                    </button>
                    <button
                      onClick={handleFileClick}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        textAlign: 'left',
                        fontSize: '14px',
                        color: '#1a1a1a',
                        cursor: 'pointer',
                        fontFamily: '"Poppins", sans-serif',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                      }}
                    >
                      📁 Upload File
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Divider */}
            <div style={{
              width: '1px',
              height: '32px',
              backgroundColor: '#e0e0e0',
            }} />

            {/* Type it in Button */}
            <button
              onClick={handleTypeItIn}
              style={{
                flex: 1,
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <img src={typeInIcon} alt="Type" style={{ width: '20px', height: '20px' }} />
              <span style={{
                fontFamily: '"Poppins", sans-serif',
                fontSize: '12px',
                color: '#073d35',
                textTransform: 'capitalize',
              }}>
                Type It In
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Cook Before It's Expired Section */}
      <div style={{ padding: '0 20px' }}>
        <h2 style={{
          fontSize: '20px',
          fontWeight: '400',
          color: '#1a1a1a',
          margin: '0 0 16px 0',
          fontFamily: '"Poppins", sans-serif',
        }}>
          Cook Before It's Expired
        </h2>

        {/* Category Filter Chips */}
        {expiringItems.length > 0 && (
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '24px',
            overflowX: 'auto',
            paddingBottom: '4px',
          }}>
            {['All', 'Produce', 'Dairy', 'Protein', 'Grains', 'Beverages'].map(cat => (
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
        )}

        {expiringItems.length === 0 ? (
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '16px',
            padding: '40px 30px',
            textAlign: 'center',
            color: '#999',
          }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>✅</div>
            <div style={{
              fontSize: '14px',
              fontFamily: '"Poppins", sans-serif',
            }}>
              No items expiring soon!
            </div>
          </div>
        ) : expiringItems.filter(item => categoryFilter === 'All' || item.category === categoryFilter).length === 0 ? (
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '16px',
            padding: '40px 30px',
            textAlign: 'center',
            color: '#999',
          }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔍</div>
            <div style={{
              fontSize: '14px',
              fontFamily: '"Poppins", sans-serif',
            }}>
              No {categoryFilter.toLowerCase()} items expiring soon
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {expiringItems
              .filter(item => categoryFilter === 'All' || item.category === categoryFilter)
              .map(item => (
              <div
                key={item.itemId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                {/* Left side - Image and Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Food Image */}
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '8px',
                    backgroundColor: '#f5f5f5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '28px',
                    overflow: 'hidden',
                  }}>
                    {item.category === 'Produce' && '🥬'}
                    {item.category === 'Protein' && '🍖'}
                    {item.category === 'Dairy' && '🥛'}
                    {item.category === 'Grains' && '🌾'}
                    {item.category === 'Beverages' && '🥤'}
                    {!['Produce', 'Protein', 'Dairy', 'Grains', 'Beverages'].includes(item.category) && '🍽️'}
                  </div>

                  {/* Item Info */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div>
                      <div style={{
                        fontFamily: '"Poppins", sans-serif',
                        fontSize: '16px',
                        color: '#000',
                        marginBottom: '4px',
                      }}>
                        {item.name}
                      </div>
                      <div style={{
                        fontFamily: '"Poppins", sans-serif',
                        fontSize: '12px',
                        color: 'rgba(0,0,0,0.4)',
                      }}>
                        {getLocationText(item.location)} | {getDaysSincePurchase(item)}
                      </div>
                    </div>
                    
                    {/* Expiration Tag */}
                    <div style={{
                      display: 'inline-flex',
                      backgroundColor: '#d3e2d0',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      alignSelf: 'flex-start',
                    }}>
                      <span style={{
                        fontFamily: '"Poppins", sans-serif',
                        fontSize: '10px',
                        color: '#333',
                        opacity: 0.5,
                      }}>
                        {getExpirationDays(item)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right side - Arrow button */}
                <Link
                  to={`/item/${item.itemId}`}
                  style={{ textDecoration: 'none' }}
                >
                  <img src={arrowRightIcon} alt="View" style={{ width: '40px', height: '40px' }} />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
}
