import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';

interface AddFoodModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddFoodModal({ isOpen, onClose }: AddFoodModalProps) {
  const navigate = useNavigate();
  const cameraInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleScanReceipt = () => {
    // Trigger camera input
    cameraInputRef.current?.click();
  };

  const handleManualEntry = () => {
    navigate('/add-item?method=manual');
    onClose();
  };

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>, method: 'scan' | 'upload') => {
    const file = event.target.files?.[0];
    if (file) {
      // Navigate to add-item page with the selected file in state
      navigate(`/add-item?method=${method}`, {
        state: { selectedFile: file }
      });
      onClose();
    }
    // Reset input so the same file can be selected again
    event.target.value = '';
  };

  return (
    <>
      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => handleFileSelected(e, 'scan')}
        style={{ display: 'none' }}
      />
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

      {/* Bottom sheet */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#f7f6ef',
          borderTopLeftRadius: '20px',
          borderTopRightRadius: '20px',
          borderTop: '1px solid #ccc',
          zIndex: 1001,
          boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
          animation: 'slideUp 0.3s ease-out'
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px',
          borderBottom: '1px solid #ccc'
        }}>
          <h2
            style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: 400,
            color: '#1a1a1a',
            fontFamily: '"Poppins", sans-serif',
            lineHeight: 'normal',
          }}
          >
            Add
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px'
            }}
            aria-label="Close"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M6 6L18 18M18 6L6 18" stroke="#11130b" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px' }}>
          <button
            onClick={handleScanReceipt}
            style={{
              backgroundColor: '#d3e2d0',
              color: '#333',
              border: 'none',
              borderRadius: '16px',
              minHeight: '68px',
              padding: '16px',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: '#f7f6ef',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="4" y="7" width="16" height="12" rx="2.5" stroke="#073d33" strokeWidth="1.5" />
                  <circle cx="12" cy="13" r="3.2" stroke="#073d33" strokeWidth="1.5" />
                  <path d="M8 7L9.5 5.5H14.5L16 7" stroke="#073d33" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '16px',
                  fontWeight: 400,
                  marginBottom: '4px',
                  color: '#333',
                  fontFamily: '"Poppins", sans-serif',
                }}>
                  Scan Receipt
                </div>
                <div style={{
                  fontSize: '12px',
                  color: 'rgba(51,51,51,0.8)',
                  fontFamily: '"Poppins", sans-serif',
                }}>
                  Add everything at once
                </div>
              </div>
            </div>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: '#f7f6ef',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5 3L9 7L5 11" stroke="#073d33" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </button>

          <button
            onClick={handleManualEntry}
            style={{
              backgroundColor: '#d3e2d0',
              color: '#333',
              border: 'none',
              borderRadius: '16px',
              minHeight: '68px',
              padding: '16px',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: '#f7f6ef',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M4 17.5V20H6.5L16.4 10.1L13.9 7.6L4 17.5Z" stroke="#073d33" strokeWidth="1.5" strokeLinejoin="round" />
                  <path d="M12.8 8.7L15.3 11.2" stroke="#073d33" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '16px',
                  fontWeight: 400,
                  marginBottom: '4px',
                  color: '#333',
                  fontFamily: '"Poppins", sans-serif',
                }}>
                  Type It In
                </div>
                <div style={{
                  fontSize: '12px',
                  color: 'rgba(51,51,51,0.8)',
                  fontFamily: '"Poppins", sans-serif',
                }}>
                  Type in items one by one
                </div>
              </div>
            </div>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: '#f7f6ef',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5 3L9 7L5 11" stroke="#073d33" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </button>
        </div>

        <div
          style={{
            height: '34px',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            backgroundColor: '#f7f6ef',
            paddingTop: '8px',
            paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
          }}
        >
          <div style={{ width: '134px', height: '5px', borderRadius: '100px', backgroundColor: '#11130b' }} />
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
