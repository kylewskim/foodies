import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';

interface AddFoodModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddFoodModal({ isOpen, onClose }: AddFoodModalProps) {
  const navigate = useNavigate();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const albumInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleScanReceipt = () => {
    // 카메라 input 클릭
    cameraInputRef.current?.click();
  };

  const handleUploadImage = () => {
    // 앨범 input 클릭
    albumInputRef.current?.click();
  };

  const handleManualEntry = () => {
    navigate('/add-item?method=manual');
    onClose();
  };

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>, method: 'scan' | 'upload') => {
    const file = event.target.files?.[0];
    if (file) {
      // 파일을 state로 전달하면서 페이지 이동
      navigate(`/add-item?method=${method}`, { 
        state: { selectedFile: file }
      });
      onClose();
    }
    // input 초기화 (같은 파일 다시 선택 가능하도록)
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
      <input
        ref={albumInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,image/heic"
        onChange={(e) => handleFileSelected(e, 'upload')}
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
              🖼️
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
                Select photo from album
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
