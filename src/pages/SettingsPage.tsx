import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BottomNavigation } from '../components/BottomNavigation';
import { NotificationSettings } from '../components/NotificationSettings';
import { getUserPreferences, saveUserPreferences, getUsedItems, resetUserData } from '../firebase/saveReceipt';
import { clearRecipesRefreshFlag, markRecipesNeedRefresh } from '../firebase/userRecipes';
import { clearFavoriteRecipes } from '../firebase/favoriteRecipes';
import { removeFCMToken } from '../firebase/notifications';

const dietaryOptions = ['Vegetarian', 'Vegan', 'Pescatarian', 'Gluten-free', 'Dairy-free', 'Low-carb'];
const allergyOptions = ['Nuts', 'Shellfish', 'Eggs', 'Soy', 'Dairy', 'Wheat'];
const exclusionOptions = ['Beef', 'Pork', 'Shellfish', 'Mushrooms', 'Cilantro', 'Onions'];

export function SettingsPage() {
  const { user, logout, checkOnboardingStatus } = useAuth();
  const navigate = useNavigate();
  const [, setIsLoggingOut] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showFoodPrefs, setShowFoodPrefs] = useState(false);
  const [showImpactModal, setShowImpactModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  const [itemsWasted, setItemsWasted] = useState(0);
  const [valueSaved, setValueSaved] = useState(0);

  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [ingredientExclusions, setIngredientExclusions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (user) loadImpactStats();
  }, [user]);

  const loadImpactStats = async () => {
    if (!user) return;
    try {
      const now = new Date();
      const usedItems = await getUsedItems(user.uid, now.getMonth() + 1, now.getFullYear());
      const totalValueCents = usedItems.reduce((sum, item) => sum + (item.price ?? 0), 0);
      setItemsWasted(usedItems.length);
      setValueSaved(Math.round(totalValueCents / 100));
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

  const handleResetAllData = async () => {
    if (!user || resetting) return;

    setResetting(true);
    try {
      await Promise.allSettled([
        removeFCMToken(user.uid),
        clearFavoriteRecipes(user.uid),
      ]);

      await resetUserData(user.uid);
      await saveUserPreferences(user.uid, {
        onboardingCompleted: false,
        helpWith: null,
        dietaryPreferences: [],
        allergies: [],
        ingredientExclusions: [],
        notifyExpireIn: null,
        notifyTimeOfDay: null,
        pushEnabled: false,
      });

      clearRecipesRefreshFlag();
      await checkOnboardingStatus(user.uid);
      navigate('/onboarding', { replace: true });
    } catch (error) {
      console.error('Error resetting all user data:', error);
    } finally {
      setResetting(false);
      setShowResetModal(false);
    }
  };

  const getCurrentMonth = () => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    return months[new Date().getMonth()];
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f7f6ef', paddingBottom: '100px' }}>

      {/* Profile — centered on cream bg, no card */}
      <div style={{
        paddingTop: '56px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
      }}>
        {/* Avatar */}
        <div style={{
          width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#073d33',
          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        }}>
          {user?.photoURL ? (
            <img src={user.photoURL} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
                stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="7" r="4"
                stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        {/* Name + email */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontFamily: '"Poppins", sans-serif', fontSize: '18px', fontWeight: '600', color: '#1a1a1a' }}>
            {user?.displayName || 'User'}
          </span>
          <span style={{ fontFamily: '"Poppins", sans-serif', fontSize: '14px', color: 'rgba(51,51,51,0.6)' }}>
            {user?.email || ''}
          </span>
        </div>
      </div>

      {/* Impact card */}
      <div style={{
        margin: '24px 20px 0',
        border: '1px solid #d3e2d0',
        borderRadius: '12px',
        padding: '20px 24px',
        display: 'flex', flexDirection: 'column', gap: '16px',
      }}>
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontFamily: '"Poppins", sans-serif', fontSize: '14px', fontWeight: '500', color: '#073d33' }}>
            Impact in {getCurrentMonth()}
          </span>
          <button
            onClick={() => setShowImpactModal(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
            aria-label="Impact info"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke="#073d33" strokeOpacity="0.6" />
              <path d="M8 7V11" stroke="#073d33" strokeOpacity="0.6" strokeWidth="1.4" strokeLinecap="round" />
              <circle cx="8" cy="5.5" r="0.7" fill="#073d33" fillOpacity="0.6" />
            </svg>
          </button>
        </div>
        {/* Stats row */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {/* Left stat */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{
              fontFamily: '"Canela", Georgia, serif', fontSize: '48px', fontWeight: '300',
              color: '#073d33', lineHeight: '1',
            }}>
              {itemsWasted}
            </span>
            <span style={{ fontFamily: '"Poppins", sans-serif', fontSize: '14px', color: '#073d33', marginTop: '4px' }}>
              Items are wasted
            </span>
          </div>
          {/* Vertical divider */}
          <div style={{ width: '1px', height: '60px', backgroundColor: '#d3e2d0' }} />
          {/* Right stat */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              <span style={{
                fontFamily: '"Canela", Georgia, serif', fontSize: '20px', fontWeight: '300',
                color: '#073d33', lineHeight: '1.4',
              }}>$</span>
              <span style={{
                fontFamily: '"Canela", Georgia, serif', fontSize: '48px', fontWeight: '300',
                color: '#073d33', lineHeight: '1',
              }}>
                {valueSaved}
              </span>
            </div>
            <span style={{ fontFamily: '"Poppins", sans-serif', fontSize: '14px', color: '#073d33', marginTop: '4px' }}>
              Est. value saved
            </span>
          </div>
        </div>
      </div>

      {/* Menu items — directly on cream bg with dividers */}
      <div style={{ marginTop: '24px' }}>
        <MenuRow
          icon={<BookIcon />}
          title="Food Rules"
          subtitle="Dietary preferences & restrictions"
          onClick={() => setShowFoodPrefs(true)}
        />
        <MenuRow
          icon={<StarIcon />}
          title="Collected Recipes"
          subtitle="Recipes you've saved"
          onClick={() => navigate('/collection')}
        />
        <MenuRow
          icon={<BellIcon />}
          title="Notification"
          subtitle="When we notify you"
          onClick={() => setShowNotifications(true)}
        />
        <MenuRow
          icon={<ResetIcon />}
          title="Reset All Data"
          subtitle="Delete items and start from onboarding"
          onClick={() => setShowResetModal(true)}
          isDestructive
        />
        <MenuRow
          icon={<LogoutIcon />}
          title="Sign Out"
          onClick={handleLogout}
          isDestructive
          showBorder={false}
        />
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
              <span style={{ fontFamily: '"Poppins", sans-serif', fontSize: '18px', fontWeight: '500', color: '#11130b' }}>
                How Impact Is Calculated
              </span>
              <button onClick={() => setShowImpactModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M5 5L15 15M15 5L5 15" stroke="#073d33" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div style={{ padding: '20px 20px 32px' }}>
              <p style={{ fontFamily: '"Poppins", sans-serif', fontSize: '14px', color: '#073d33', lineHeight: '1.6', margin: '0 0 16px' }}>
                Items wasted is the number of food items that ended up being thrown away during {getCurrentMonth()}—typically items marked as discarded or expired without being used. We count items (each inventory entry), not weight.
              </p>
              <p style={{ fontFamily: '"Poppins", sans-serif', fontSize: '14px', color: '#073d33', lineHeight: '1.6', margin: 0 }}>
                Estimated value saved is the estimated dollar amount of food you likely saved from being wasted during {getCurrentMonth()}. It’s calculated from items that were at risk of expiring but were later used up instead of being discarded, using available price info (such as receipt prices or typical estimates). This number reflects overall impact trends rather than an exact total.
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
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 100, backgroundColor: '#f7f6ef', overflowY: 'auto',
        }}>
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

      {showResetModal && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 1000 }}
          onClick={() => !resetting && setShowResetModal(false)}
        >
          <div
            style={{
              position: 'absolute',
              left: 20,
              right: 20,
              top: '50%',
              transform: 'translateY(-50%)',
              backgroundColor: '#f7f6ef',
              borderRadius: '20px',
              padding: '24px 20px 20px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h2 style={{ fontFamily: '"Canela", Georgia, serif', fontSize: '28px', fontWeight: 300, color: '#11130b', margin: 0 }}>
                Reset all data?
              </h2>
              <p style={{ fontFamily: '"Poppins", sans-serif', fontSize: '14px', lineHeight: '1.6', color: '#333333', margin: 0 }}>
                This deletes your saved items, receipts, favorites, and notification preferences, then sends you back to onboarding.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={handleResetAllData}
                disabled={resetting}
                style={{
                  width: '100%',
                  padding: '16px',
                  backgroundColor: '#bb0003',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '16px',
                  fontSize: '16px',
                  fontWeight: '500',
                  fontFamily: '"Poppins", sans-serif',
                  cursor: resetting ? 'not-allowed' : 'pointer',
                  opacity: resetting ? 0.7 : 1,
                }}
              >
                {resetting ? 'Resetting...' : 'Yes, reset everything'}
              </button>
              <button
                onClick={() => setShowResetModal(false)}
                disabled={resetting}
                style={{
                  width: '100%',
                  padding: '16px',
                  backgroundColor: '#efeee7',
                  color: '#11130b',
                  border: 'none',
                  borderRadius: '16px',
                  fontSize: '16px',
                  fontWeight: '500',
                  fontFamily: '"Poppins", sans-serif',
                  cursor: resetting ? 'not-allowed' : 'pointer',
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

// ─── Icons ────────────────────────────────────────────────────────────────────

function BookIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"
        stroke="#11130b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"
        stroke="#11130b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <polygon
        points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
        stroke="#11130b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
        stroke="#11130b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0"
        stroke="#11130b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
        stroke="#bb0003" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="16 17 21 12 16 7"
        stroke="#bb0003" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="21" y1="12" x2="9" y2="12"
        stroke="#bb0003" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 12A9 9 0 1 0 6.05 5.2"
        stroke="#bb0003"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 4V9H8"
        stroke="#bb0003"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

interface MenuRowProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onClick: () => void;
  showBorder?: boolean;
  isDestructive?: boolean;
}

function MenuRow({ icon, title, subtitle, onClick, showBorder = true, isDestructive = false }: MenuRowProps) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: subtitle ? '16px 20px 17px' : '24px 20px',
        backgroundColor: 'transparent',
        border: 'none',
        borderBottom: showBorder ? '1px solid #e5e5e0' : 'none',
        cursor: 'pointer',
        textAlign: 'left',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: '"Poppins", sans-serif', fontSize: '18px',
          color: isDestructive ? '#bb0003' : '#1a1a1a',
        }}>
          {title}
        </div>
        {subtitle && (
          <div style={{
            fontFamily: '"Poppins", sans-serif', fontSize: '14px',
            color: 'rgba(51,51,51,0.6)', marginTop: '4px',
          }}>
            {subtitle}
          </div>
        )}
      </div>
      {!isDestructive && (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
          <path d="M9 18L15 12 9 6" stroke="#073d33" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
