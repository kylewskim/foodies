import { useNavigate } from 'react-router-dom';

interface AddFoodModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddFoodModal({ isOpen, onClose }: AddFoodModalProps) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleScanReceipt = () => {
    navigate('/add-item?method=scan');
    onClose();
  };

  const handleUploadImage = () => {
    navigate('/add-item?method=upload');
    onClose();
  };

  const handleManualEntry = () => {
    navigate('/add-item?method=manual');
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          animation: 'fadeIn 0.3s ease-out'
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'white',
          borderTopLeftRadius: '20px',
          borderTopRightRadius: '20px',
          padding: '20px',
          zIndex: 1001,
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
          animation: 'slideUp 0.3s ease-out'
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: 'bold',
            color: '#000'
          }}>
            Add food
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              color: '#666',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px'
            }}
          >
            ×
          </button>
        </div>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Scan Receipt - Highlighted */}
          <button
            onClick={handleScanReceipt}
            style={{
              backgroundColor: '#333',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '20px',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              transition: 'opacity 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px'
            }}>
              📷
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: '16px',
                fontWeight: 'bold',
                marginBottom: '4px'
              }}>
                Scan receipt
              </div>
              <div style={{
                fontSize: '14px',
                color: 'rgba(255,255,255,0.8)'
              }}>
                Automatically add items from receipt
              </div>
            </div>
          </button>

          {/* Upload Image */}
          <button
            onClick={handleUploadImage}
            style={{
              backgroundColor: 'white',
              color: '#333',
              border: '1px solid #e0e0e0',
              borderRadius: '12px',
              padding: '20px',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f8f9fa';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
            }}
          >
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: '#f0f0f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px'
            }}>
              📤
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: '16px',
                fontWeight: 'bold',
                marginBottom: '4px',
                color: '#000'
              }}>
                Upload image
              </div>
              <div style={{
                fontSize: '14px',
                color: '#666'
              }}>
                Add photo of food items
              </div>
            </div>
          </button>

          {/* Manual Entry */}
          <button
            onClick={handleManualEntry}
            style={{
              backgroundColor: 'white',
              color: '#333',
              border: '1px solid #e0e0e0',
              borderRadius: '12px',
              padding: '20px',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f8f9fa';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
            }}
          >
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: '#f0f0f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px'
            }}>
              ✏️
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: '16px',
                fontWeight: 'bold',
                marginBottom: '4px',
                color: '#000'
              }}>
                Manual entry
              </div>
              <div style={{
                fontSize: '14px',
                color: '#666'
              }}>
                Type in items yourself
              </div>
            </div>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}
