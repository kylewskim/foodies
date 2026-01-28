import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BottomNavigation } from '../components/BottomNavigation';

export function SettingsPage() {
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
      setIsLoggingOut(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f7f6ef',
      paddingBottom: '80px',
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
            {/* Profile Avatar */}
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

            {/* Profile Info */}
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
            onClick={() => {}}
          />
          <SettingsItem 
            icon="🏠" 
            label="Household" 
            onClick={() => {}}
          />
          <SettingsItem 
            icon="🍽️" 
            label="Food preferences" 
            onClick={() => {}}
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

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
}

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
