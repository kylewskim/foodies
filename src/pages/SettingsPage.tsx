import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BottomNavigation } from '../components/BottomNavigation';
import { NotificationSettings } from '../components/NotificationSettings';
import { getUserPreferences, saveUserPreferences, getUsedItems } from '../firebase/saveReceipt';
import { markRecipesNeedRefresh } from '../firebase/userRecipes';

const dietaryOptions = ['Vegetarian', 'Vegan', 'Pescatarian', 'Gluten-free', 'Dairy-free', 'Low-carb'];
const allergyOptions = ['Nuts', 'Shellfish', 'Eggs', 'Soy', 'Dairy', 'Wheat'];
const exclusionOptions = ['Beef', 'Pork', 'Shellfish', 'Mushrooms', 'Cilantro', 'Onions'];

export function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [, setIsLoggingOut] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showFoodPrefs, setShowFoodPrefs] = useState(false);
  const [showImpactModal, setShowImpactModal] = useState(false);

  // Impact stats
  const [itemsUsed, setItemsUsed] = useState(0);
  const [valueSaved, setValueSaved] = useState(0);

  // Food preferences
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [ingredientExclusions, setIngredientExclusions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  useEffect(() => {
    if (user) loadImpactStats();
  }, [user]);

  const loadImpactStats = async () => {
    if (!user) return;
    try {
      const now = new Date();
      const usedItems = await getUsedItems(user.uid, now.getMonth() + 1, now.getFullYear());
      const totalValue = usedItems.reduce((sum, item) => {
        return sum + (item.price ? item.price / 100 : 2.5);
      }, 0);
      setItemsUsed(usedItems.length);
      setValueSaved(Math.round(totalValue));
    } catch (err) {
      console.error('Error loading impact stats:', err);
    }
  };

  useEffect(() => {
    if (showFoodPrefs && user && !prefsLoaded) {
      getUserPreferences(user.uid).then((prefs) => {
        if (prefs) {
          setDietaryPreferences(prefs.dietaryPreferences || []);
          setAllergies(prefs.allergies || []);
          setIngredientExclusions(prefs.ingredientExclusions || []);
        }
        setPrefsLoaded(true);
      });
    }
  }, [showFoodPrefs, user, prefsLoaded]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
      setIsLoggingOut(false);
    }
  };

  const toggleItem = (list: string[], setList: (v: string[]) => void, item: string) => {
    setList(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  };

  const handleSavePrefs = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await saveUserPreferences(user.uid, { dietaryPreferences, allergies, ingredientExclusions });
      markRecipesNeedRefresh();
      setShowFoodPrefs(false);
    } catch (err) {
      console.error('Error saving preferences:', err);
    } finally {
      setSaving(false);
    }
  };

  const getCurrentMonth = () => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    return months[new Date().getMonth()];
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f7f6ef', paddingBottom: '92px' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', backgroundColor: '#f7f6ef' }}>
        <h1
          style={{
            fontFamily: '"Poppins", sans-serif',
            fontSize: '28px',
            fontWeight: '400',
            color: '#11130b',
            margin: 0,
          }}
        >
          Profile
        </h1>
      </div>

      <div style={{ padding: '0 20px' }}>
        {/* Profile Section — centered */}
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '32px 20px 24px',
            marginBottom: '16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: '#073d33',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ color: '#fff', fontSize: '32px', fontWeight: '500', fontFamily: '"Poppins", sans-serif' }}>
                {user?.displayName?.charAt(0) || user?.email?.charAt(0) || '?'}
              </span>
            )}
          </div>
          <div
            style={{
              fontFamily: '"Poppins", sans-serif',
              fontSize: '18px',
              fontWeight: '600',
              color: '#11130b',
              textAlign: 'center',
            }}
          >
            {user?.displayName || 'User'}
          </div>
          <div
            style={{
              fontFamily: '"Poppins", sans-serif',
              fontSize: '14px',
              color: 'rgba(0,0,0,0.5)',
              textAlign: 'center',
            }}
          >
            {user?.email || ''}
          </div>
        </div>

        {/* Impact in [Month] Card */}
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '16px',
            border: '1px solid #e8e8e5',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ fontFamily: '"Poppins", sans-serif', fontSize: '14px', fontWeight: '500', color: '#11130b' }}>
              Impact in {getCurrentMonth()}
            </span>
            <button
              onClick={() => setShowImpactModal(true)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Impact info"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.5" stroke="#11130b" strokeOpacity="0.4" />
                <path d="M8 7V11" stroke="#11130b" strokeOpacity="0.4" strokeWidth="1.4" strokeLinecap="round" />
                <circle cx="8" cy="5.5" r="0.7" fill="#11130b" fillOpacity="0.4" />
              </svg>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'stretch', gap: '0' }}>
            {/* Left stat */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', marginBottom: '4px' }}>
                <span style={{ fontFamily: '"Canela", Georgia, serif', fontSize: '40px', fontWeight: '300', color: '#11130b', lineHeight: '1' }}>
                  {itemsUsed}
                </span>
                <span style={{ fontFamily: '"Poppins", sans-serif', fontSize: '12px', color: 'rgba(17,19,11,0.4)', marginBottom: '6px' }}>
                  items
                </span>
              </div>
              <div style={{ fontFamily: '"Poppins", sans-serif', fontSize: '12px', color: 'rgba(17,19,11,0.6)' }}>
                Used just in time
              </div>
            </div>

            <div style={{ width: '1px', backgroundColor: 'rgba(17,19,11,0.1)', margin: '0 16px' }} />

            {/* Right stat */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', marginBottom: '4px' }}>
                <span style={{ fontFamily: '"Canela", Georgia, serif', fontSize: '40px', fontWeight: '300', color: '#11130b', lineHeight: '1' }}>
                  ${valueSaved}
                </span>
              </div>
              <div style={{ fontFamily: '"Poppins", sans-serif', fontSize: '12px', color: 'rgba(17,19,11,0.6)' }}>
                Est. value saved
              </div>
            </div>
          </div>
        </div>

        {/* Menu items */}
        <div style={{ backgroundColor: 'white', borderRadius: '16px', overflow: 'hidden', marginBottom: '16px' }}>
          <SettingsItem label="Food preferences" onClick={() => setShowFoodPrefs(true)} />
          <SettingsItem label="Collected Recipes" onClick={() => navigate('/collection')} />
          <SettingsItem label="Notifications" onClick={() => setShowNotifications(true)} />
          <SettingsItem label="Sign Out" onClick={handleLogout} isDestructive showBorder={false} />
        </div>

        {/* Version */}
        <div
          style={{
            textAlign: 'center',
            marginTop: '24px',
            fontFamily: '"Poppins", sans-serif',
            fontSize: '12px',
            color: 'rgba(0,0,0,0.3)',
          }}
        >
          Freshli v1.0.0
        </div>
      </div>

      <BottomNavigation />

      {/* Impact Info Modal */}
      {showImpactModal && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000 }}
          onClick={() => setShowImpactModal(false)}
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px', borderBottom: '1px solid #ddd' }}>
              <span style={{ fontFamily: '"Poppins", sans-serif', fontSize: '18px', fontWeight: '500', color: '#11130b' }}>
                How Impact Is Calculated
              </span>
              <button
                onClick={() => setShowImpactModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M5 5L15 15M15 5L5 15" stroke="#073d33" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div style={{ padding: '20px 20px 32px' }}>
              <p style={{ fontFamily: '"Poppins", sans-serif', fontSize: '14px', color: '#073d33', lineHeight: '1.6', margin: '0 0 16px' }}>
                <strong>Items used just in time:</strong> Items you marked as used during the current month before they expired.
              </p>
              <p style={{ fontFamily: '"Poppins", sans-serif', fontSize: '14px', color: '#073d33', lineHeight: '1.6', margin: 0 }}>
                <strong>Est. value saved:</strong> The estimated dollar value of items you used before they were discarded, based on purchase price or an average of $2.50 per item.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Notification Settings Overlay */}
      {showNotifications && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}>
          <NotificationSettings onBack={() => setShowNotifications(false)} />
        </div>
      )}

      {/* Food Preferences Overlay */}
      {showFoodPrefs && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 100,
            backgroundColor: '#f7f6ef',
            overflowY: 'auto',
          }}
        >
          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => setShowFoodPrefs(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#11130b" strokeWidth="2">
                <polyline points="15,18 9,12 15,6" />
              </svg>
            </button>
            <h1 style={{ fontFamily: '"Poppins", sans-serif', fontSize: '20px', fontWeight: '500', color: '#11130b', margin: 0 }}>
              Food preferences
            </h1>
          </div>
          <div style={{ padding: '0 20px', paddingBottom: '100px' }}>
            <PreferenceSection title="Dietary preferences" options={dietaryOptions} selected={dietaryPreferences}
              onToggle={(item) => toggleItem(dietaryPreferences, setDietaryPreferences, item)} />
            <PreferenceSection title="Allergies" options={allergyOptions} selected={allergies}
              onToggle={(item) => toggleItem(allergies, setAllergies, item)} />
            <PreferenceSection title="Ingredients to exclude" options={exclusionOptions} selected={ingredientExclusions}
              onToggle={(item) => toggleItem(ingredientExclusions, setIngredientExclusions, item)} />
            <button
              onClick={handleSavePrefs}
              disabled={saving}
              style={{
                width: '100%', padding: '16px', backgroundColor: '#073d33', color: '#fff',
                border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: '500',
                fontFamily: '"Poppins", sans-serif', cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1, marginTop: '16px',
              }}
            >
              {saving ? 'Saving...' : 'Save preferences'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface SettingsItemProps {
  label: string;
  onClick: () => void;
  showBorder?: boolean;
  isDestructive?: boolean;
}

function SettingsItem({ label, onClick, showBorder = true, isDestructive = false }: SettingsItemProps) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        backgroundColor: 'transparent',
        border: 'none',
        borderBottom: showBorder ? '1px solid #f0f0f0' : 'none',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <span style={{
        fontFamily: '"Poppins", sans-serif',
        fontSize: '16px',
        color: isDestructive ? '#e53935' : '#11130b',
      }}>
        {label}
      </span>
      {!isDestructive && (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2">
          <polyline points="9,18 15,12 9,6" />
        </svg>
      )}
    </button>
  );
}

interface PreferenceSectionProps {
  title: string;
  options: string[];
  selected: string[];
  onToggle: (item: string) => void;
}

function PreferenceSection({ title, options, selected, onToggle }: PreferenceSectionProps) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <h3 style={{ fontFamily: '"Poppins", sans-serif', fontSize: '16px', fontWeight: '500', color: '#11130b', margin: '0 0 12px 0' }}>
        {title}
      </h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {options.map((option) => {
          const isSelected = selected.includes(option);
          return (
            <button
              key={option}
              onClick={() => onToggle(option)}
              style={{
                padding: '8px 16px', borderRadius: '20px',
                border: isSelected ? '1.5px solid #073d33' : '1.5px solid #ddd',
                backgroundColor: isSelected ? '#d3e2d0' : '#fff',
                color: isSelected ? '#073d33' : '#333',
                fontFamily: '"Poppins", sans-serif', fontSize: '14px',
                fontWeight: isSelected ? '500' : '400', cursor: 'pointer',
              }}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
