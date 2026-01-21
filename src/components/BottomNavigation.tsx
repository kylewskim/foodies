import { Link, useLocation } from 'react-router-dom';

interface BottomNavigationProps {
  onAddClick: () => void;
}

export function BottomNavigation({ onAddClick }: BottomNavigationProps) {
  const location = useLocation();
  const isHome = location.pathname === '/';
  const isInventory = location.pathname === '/inventory';

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: '#fff',
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
      padding: '12px 0 24px 0',
      borderTop: '1px solid #f0f0f0',
      zIndex: 100
    }}>
      {/* Today */}
      <Link 
        to="/" 
        style={{ 
          textDecoration: 'none', 
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
          flex: 1
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={isHome ? '#000' : '#999'} strokeWidth="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9,22 9,12 15,12 15,22" />
        </svg>
        <div style={{ 
          fontSize: '12px', 
          fontWeight: isHome ? '600' : '400',
          color: isHome ? '#000' : '#999'
        }}>
          Today
        </div>
      </Link>

      {/* Add Button - Large Circular */}
      <button
        onClick={onAddClick}
        style={{
          background: '#000',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: '-28px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* Inventory */}
      <Link 
        to="/inventory" 
        style={{ 
          textDecoration: 'none', 
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
          flex: 1
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={isInventory ? '#000' : '#999'} strokeWidth="2">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27,6.96 12,12.01 20.73,6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
        <div style={{ 
          fontSize: '12px',
          fontWeight: isInventory ? '600' : '400',
          color: isInventory ? '#000' : '#999'
        }}>
          Inventory
        </div>
      </Link>
    </div>
  );
}
