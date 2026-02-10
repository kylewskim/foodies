import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  isNotificationSupported,
  isInstalledPWA,
  getNotificationPermission,
  requestNotificationPermission,
  removeFCMToken,
} from '../firebase/notifications';
import { getUserPreferences, saveUserPreferences } from '../firebase/saveReceipt';

const expireInOptions = [
  { id: '1_day', label: '1 day' },
  { id: '3_days', label: '3 days' },
  { id: '1_week', label: '1 week' },
];
const timeOfDayOptions = [
  { id: 'morning', label: 'Morning' },
  { id: 'afternoon', label: 'Afternoon' },
  { id: 'evening', label: 'Evening' },
];

interface NotificationSettingsProps {
  onBack: () => void;
}

export function NotificationSettings({ onBack }: NotificationSettingsProps) {
  const { user } = useAuth();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [notifyExpireIn, setNotifyExpireIn] = useState<string | null>(null);
  const [notifyTimeOfDay, setNotifyTimeOfDay] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const supported = isNotificationSupported();
  const permission = getNotificationPermission();
  // Detect actual iOS (not macOS pretending to be iPad)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !('ontouchend' in document === false);
  const isMobileIOS = isIOS && navigator.maxTouchPoints > 1 && !window.matchMedia('(pointer: fine)').matches;
  const isPWA = isInstalledPWA();

  useEffect(() => {
    if (!user) return;
    getUserPreferences(user.uid).then(prefs => {
      if (prefs) {
        setPushEnabled(prefs.pushEnabled ?? false);
        setNotifyExpireIn(prefs.notifyExpireIn);
        setNotifyTimeOfDay(prefs.notifyTimeOfDay);
      }
      setLoading(false);
    });
  }, [user]);

  const handleToggle = async () => {
    if (!user || toggling) return;
    setToggling(true);

    try {
      if (pushEnabled) {
        // Disable
        await removeFCMToken(user.uid);
        setPushEnabled(false);
        await saveUserPreferences(user.uid, { pushEnabled: false });
      } else {
        // Enable
        const success = await requestNotificationPermission(user.uid);
        if (success) {
          setPushEnabled(true);
          await saveUserPreferences(user.uid, { pushEnabled: true });
        }
      }
    } catch (error) {
      console.error('Error toggling notifications:', error);
    } finally {
      setToggling(false);
    }
  };

  const handlePreferenceChange = async (key: string, value: string) => {
    if (!user) return;
    if (key === 'notifyExpireIn') setNotifyExpireIn(value);
    if (key === 'notifyTimeOfDay') setNotifyTimeOfDay(value);
    await saveUserPreferences(user.uid, { [key]: value });
  };

  // iOS (mobile) not installed as PWA
  if (isMobileIOS && !isPWA) {
    return (
      <SettingsPanel onBack={onBack} title="Notifications">
        <InfoCard
          title="Add to Home Screen"
          message="To receive push notifications on iOS, you need to add Freshli to your Home Screen first. Open the share menu and tap 'Add to Home Screen'."
        />
      </SettingsPanel>
    );
  }

  // Browser doesn't support notifications
  if (!supported) {
    return (
      <SettingsPanel onBack={onBack} title="Notifications">
        <InfoCard
          title="Not supported"
          message="Your browser doesn't support push notifications. Try using a modern browser like Chrome, Firefox, or Safari."
        />
      </SettingsPanel>
    );
  }

  // Permission denied
  if (permission === 'denied' && !pushEnabled) {
    return (
      <SettingsPanel onBack={onBack} title="Notifications">
        <InfoCard
          title="Notifications blocked"
          message="You've blocked notifications for Freshli. To enable them, go to your browser settings and allow notifications for this site."
        />
      </SettingsPanel>
    );
  }

  if (loading) {
    return (
      <SettingsPanel onBack={onBack} title="Notifications">
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(0,0,0,0.4)', fontFamily: '"Poppins", sans-serif', fontSize: '14px' }}>
          Loading...
        </div>
      </SettingsPanel>
    );
  }

  return (
    <SettingsPanel onBack={onBack} title="Notifications">
      {/* Toggle */}
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '16px',
        padding: '16px 20px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{
          fontFamily: '"Poppins", sans-serif',
          fontSize: '16px',
          color: '#11130b',
        }}>
          Push notifications
        </span>
        <button
          onClick={handleToggle}
          disabled={toggling}
          style={{
            width: '52px',
            height: '32px',
            borderRadius: '16px',
            border: 'none',
            backgroundColor: pushEnabled ? '#073d35' : '#ccc',
            cursor: toggling ? 'not-allowed' : 'pointer',
            position: 'relative',
            transition: 'background-color 0.2s',
            opacity: toggling ? 0.6 : 1,
          }}
        >
          <div style={{
            width: '26px',
            height: '26px',
            borderRadius: '13px',
            backgroundColor: '#fff',
            position: 'absolute',
            top: '3px',
            left: pushEnabled ? '23px' : '3px',
            transition: 'left 0.2s',
          }} />
        </button>
      </div>

      {/* Preferences (only show when enabled) */}
      {pushEnabled && (
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          padding: '20px',
        }}>
          {/* Notify when expire in */}
          <div style={{ marginBottom: '24px' }}>
            <p style={{
              fontFamily: '"Poppins", sans-serif',
              fontSize: '13px',
              color: 'rgba(0,0,0,0.5)',
              margin: '0 0 12px',
            }}>
              Notify me when items expire in
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              {expireInOptions.map(option => (
                <button
                  key={option.id}
                  onClick={() => handlePreferenceChange('notifyExpireIn', option.id)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: notifyExpireIn === option.id ? '16px' : '20000px',
                    border: notifyExpireIn === option.id ? '1px solid #073d35' : 'none',
                    backgroundColor: notifyExpireIn === option.id ? '#e3e9e3' : '#efeee7',
                    cursor: 'pointer',
                    fontFamily: '"Poppins", sans-serif',
                    fontSize: '14px',
                    color: '#11130b',
                    textAlign: 'center',
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time of day */}
          <div>
            <p style={{
              fontFamily: '"Poppins", sans-serif',
              fontSize: '13px',
              color: 'rgba(0,0,0,0.5)',
              margin: '0 0 12px',
            }}>
              Time of day
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              {timeOfDayOptions.map(option => (
                <button
                  key={option.id}
                  onClick={() => handlePreferenceChange('notifyTimeOfDay', option.id)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: notifyTimeOfDay === option.id ? '16px' : '20000px',
                    border: notifyTimeOfDay === option.id ? '1px solid #073d35' : 'none',
                    backgroundColor: notifyTimeOfDay === option.id ? '#e3e9e3' : '#efeee7',
                    cursor: 'pointer',
                    fontFamily: '"Poppins", sans-serif',
                    fontSize: '14px',
                    color: '#11130b',
                    textAlign: 'center',
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </SettingsPanel>
  );
}

// --- Sub-components ---

function SettingsPanel({ onBack, title, children }: { onBack: () => void; title: string; children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f7f6ef',
      paddingBottom: '92px',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <button
          onClick={onBack}
          style={{
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <svg width="15" height="12" viewBox="0 0 15 12" fill="none">
            <path d="M6 1L1 6L6 11" stroke="#333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M1 6H14" stroke="#333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1 style={{
          fontFamily: '"Poppins", sans-serif',
          fontSize: '28px',
          fontWeight: '400',
          color: '#11130b',
          margin: 0,
        }}>
          {title}
        </h1>
      </div>

      {/* Content */}
      <div style={{ padding: '0 20px' }}>
        {children}
      </div>
    </div>
  );
}

function InfoCard({ title, message }: { title: string; message: string }) {
  return (
    <div style={{
      backgroundColor: '#fff',
      borderRadius: '16px',
      padding: '20px',
    }}>
      <h3 style={{
        fontFamily: '"Poppins", sans-serif',
        fontSize: '16px',
        fontWeight: '500',
        color: '#11130b',
        margin: '0 0 8px',
      }}>
        {title}
      </h3>
      <p style={{
        fontFamily: '"Poppins", sans-serif',
        fontSize: '14px',
        color: 'rgba(0,0,0,0.6)',
        margin: 0,
        lineHeight: '1.5',
      }}>
        {message}
      </p>
    </div>
  );
}
