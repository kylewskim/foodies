import { useEffect, useState } from 'react';

interface NotificationToastProps {
  title: string;
  body: string;
  onClose: () => void;
  onClick?: () => void;
}

export function NotificationToast({ title, body, onClose, onClick }: NotificationToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Slide in
    requestAnimationFrame(() => setVisible(true));

    // Auto-dismiss after 5s
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, 5000);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      onClick={onClick}
      style={{
        position: 'fixed',
        top: visible ? '16px' : '-100px',
        left: '16px',
        right: '16px',
        zIndex: 9999,
        backgroundColor: '#073d35',
        borderRadius: '16px',
        padding: '16px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'top 0.3s ease',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: '"Poppins", sans-serif',
            fontSize: '14px',
            fontWeight: '500',
            color: '#e3fd5c',
            marginBottom: '4px',
          }}>
            {title}
          </div>
          <div style={{
            fontFamily: '"Poppins", sans-serif',
            fontSize: '13px',
            color: 'rgba(255,255,255,0.8)',
          }}>
            {body}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setVisible(false);
            setTimeout(onClose, 300);
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            marginLeft: '8px',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 1L11 11M11 1L1 11" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
