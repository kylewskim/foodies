import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BottomNavigation } from '../components/BottomNavigation';
import { NotificationSettings } from '../components/NotificationSettings';
import { getUserPreferences, saveUserPreferences } from '../firebase/saveReceipt';
import { markRecipesNeedRefresh } from '../firebase/userRecipes';

// Same options as OnboardingPage
const dietaryOptions = ['Vegetarian', 'Vegan', 'Pescatarian', 'Gluten-free', 'Dairy-free', 'Low-carb'];
const allergyOptions = ['Nuts', 'Shellfish', 'Eggs', 'Soy', 'Dairy', 'Wheat'];
const exclusionOptions = ['Beef', 'Pork', 'Shellfish', 'Mushrooms', 'Cilantro', 'Onions'];

export function SettingsPage() {
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showFoodPrefs, setShowFoodPrefs] = useState(false);

  // Food preferences state
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [ingredientExclusions, setIngredientExclusions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Load preferences when overlay opens
  useEffect(() => {
    if (showFoodPrefs && user && !prefsLoaded) {
      getUserPreferences(user.uid).then(prefs => {
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
    setList(list.includes(item) ? list.filter(i => i !== item) : [...list, item]);
  };

  const handleSavePrefs = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await saveUserPreferences(user.uid, {
        dietaryPreferences,
        allergies,
        ingredientExclusions,
      });
      // Mark recipes for refresh so next visit re-runs engine with new restrictions
      markRecipesNeedRefresh();
      setShowFoodPrefs(false);
    } catch (err) {
      console.error('Error saving preferences:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f7f6ef',
      paddingBottom: '92px',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        backgroundColor: '#f7f6ef',
      }}>
        <h1 style={{
          fontFamily: '"Poppins", sans-serif',
          fontSize: '28px',
          fontWeight: '400',
          color: '#11130b',
          margin: 0,
        }}>
          Settings
        </h1>
      </div>

      {/* Content */}
      <div style={{ padding: '0 20px' }}>
        {/* Profile Section */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '16px',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              backgroundColor: '#073d35',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}>
              {user?.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt="Profile" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span style={{
                  color: '#fff',
                  fontSize: '24px',
                  fontWeight: '500',
                  fontFamily: '"Poppins", sans-serif',
                }}>
                  {user?.displayName?.charAt(0) || user?.email?.charAt(0) || '?'}
                </span>
              )}
            </div>
            <div>
              <div style={{
                fontFamily: '"Poppins", sans-serif',
                fontSize: '18px',
                fontWeight: '500',
                color: '#11130b',
                marginBottom: '4px',
              }}>
                {user?.displayName || 'User'}
              </div>
              <div style={{
                fontFamily: '"Poppins", sans-serif',
                fontSize: '14px',
                color: 'rgba(0,0,0,0.5)',
              }}>
                {user?.email || ''}
              </div>
            </div>
          </div>
        </div>

        {/* Settings Options */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          overflow: 'hidden',
          marginBottom: '16px',
        }}>
          <SettingsItem
            icon="🔔"
            label="Notifications"
            onClick={() => setShowNotifications(true)}
          />
          <SettingsItem 
            icon="🏠" 
            label="Household" 
            onClick={() => {}}
          />
          <SettingsItem 
            icon="🍽️" 
            label="Food preferences" 
            onClick={() => setShowFoodPrefs(true)}
          />
          <SettingsItem 
            icon="🌙" 
            label="Appearance" 
            onClick={() => {}}
            showBorder={false}
          />
        </div>

        {/* Support Section */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          overflow: 'hidden',
          marginBottom: '16px',
        }}>
          <SettingsItem 
            icon="❓" 
            label="Help & Support" 
            onClick={() => {}}
          />
          <SettingsItem 
            icon="📄" 
            label="Terms & Conditions" 
            onClick={() => {}}
          />
          <SettingsItem 
            icon="🔒" 
            label="Privacy Policy" 
            onClick={() => {}}
            showBorder={false}
          />
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          style={{
            width: '100%',
            padding: '16px',
            backgroundColor: '#fff',
            border: 'none',
            borderRadius: '16px',
            cursor: isLoggingOut ? 'not-allowed' : 'pointer',
            opacity: isLoggingOut ? 0.6 : 1,
          }}
        >
          <span style={{
            fontFamily: '"Poppins", sans-serif',
            fontSize: '16px',
            fontWeight: '500',
            color: '#e53935',
          }}>
            {isLoggingOut ? 'Logging out...' : 'Log out'}
          </span>
        </button>

        {/* Version Info */}
        <div style={{
          textAlign: 'center',
          marginTop: '24px',
          fontFamily: '"Poppins", sans-serif',
          fontSize: '12px',
          color: 'rgba(0,0,0,0.3)',
        }}>
          Freshli v1.0.0
        </div>
      </div>

      <BottomNavigation />

      {/* Notification Settings Overlay */}
      {showNotifications && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}>
          <NotificationSettings onBack={() => setShowNotifications(false)} />
        </div>
      )}

      {/* Food Preferences Overlay */}
      {showFoodPrefs && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 100,
          backgroundColor: '#f7f6ef',
          overflowY: 'auto',
        }}>
          {/* Header */}
          <div style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <button
              onClick={() => setShowFoodPrefs(false)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#11130b" strokeWidth="2">
                <polyline points="15,18 9,12 15,6" />
              </svg>
            </button>
            <h1 style={{
              fontFamily: '"Poppins", sans-serif',
              fontSize: '20px',
              fontWeight: '500',
              color: '#11130b',
              margin: 0,
            }}>
              Food preferences
            </h1>
          </div>

          <div style={{ padding: '0 20px', paddingBottom: '100px' }}>
            {/* Dietary Preferences */}
            <PreferenceSection
              title="Dietary preferences"
              options={dietaryOptions}
              selected={dietaryPreferences}
              onToggle={(item) => toggleItem(dietaryPreferences, setDietaryPreferences, item)}
            />

            {/* Allergies */}
            <PreferenceSection
              title="Allergies"
              options={allergyOptions}
              selected={allergies}
              onToggle={(item) => toggleItem(allergies, setAllergies, item)}
            />

            {/* Ingredient Exclusions */}
            <PreferenceSection
              title="Ingredients to exclude"
              options={exclusionOptions}
              selected={ingredientExclusions}
              onToggle={(item) => toggleItem(ingredientExclusions, setIngredientExclusions, item)}
            />

            {/* Save Button */}
            <button
              onClick={handleSavePrefs}
              disabled={saving}
              style={{
                width: '100%',
                padding: '16px',
                backgroundColor: '#073d35',
                color: '#fff',
                border: 'none',
                borderRadius: '16px',
                fontSize: '16px',
                fontWeight: '500',
                fontFamily: '"Poppins", sans-serif',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
                marginTop: '16px',
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
  icon: string;
  label: string;
  onClick: () => void;
  showBorder?: boolean;
}

function SettingsItem({ icon, label, onClick, showBorder = true }: SettingsItemProps) {
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
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <span style={{ fontSize: '20px' }}>{icon}</span>
        <span style={{
          fontFamily: '"Poppins", sans-serif',
          fontSize: '16px',
          color: '#11130b',
        }}>
          {label}
        </span>
      </div>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2">
        <polyline points="9,18 15,12 9,6" />
      </svg>
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
      <h3 style={{
        fontFamily: '"Poppins", sans-serif',
        fontSize: '16px',
        fontWeight: '500',
        color: '#11130b',
        margin: '0 0 12px 0',
      }}>
        {title}
      </h3>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
      }}>
        {options.map(option => {
          const isSelected = selected.includes(option);
          return (
            <button
              key={option}
              onClick={() => onToggle(option)}
              style={{
                padding: '8px 16px',
                borderRadius: '20px',
                border: isSelected ? '1.5px solid #073d35' : '1.5px solid #ddd',
                backgroundColor: isSelected ? '#d3e2d0' : '#fff',
                color: isSelected ? '#073d35' : '#333',
                fontFamily: '"Poppins", sans-serif',
                fontSize: '14px',
                fontWeight: isSelected ? '500' : '400',
                cursor: 'pointer',
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
