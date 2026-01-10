import { useState, useRef } from 'react';
import Tesseract from 'tesseract.js';
import { extractTextWithGoogleVision, isGoogleVisionConfigured } from '../utils/googleVisionOCR';

interface ImageUploadProps {
  onTextExtracted: (text: string) => void;
}

export function ImageUpload({ onTextExtracted }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usingGoogleVision, setUsingGoogleVision] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 이미지 미리보기 생성
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setError(null);
    setUploading(true);
    setProgress(0);

    try {
      let extractedText: string;

      // Google Vision API가 설정되어 있으면 우선 사용
      if (isGoogleVisionConfigured()) {
        setUsingGoogleVision(true);
        setProgress(30);
        
        try {
          extractedText = await extractTextWithGoogleVision(file);
          setProgress(100);
        } catch (googleError) {
          console.warn('Google Vision API 실패, Tesseract로 폴백:', googleError);
          setUsingGoogleVision(false);
          // Tesseract로 폴백
          extractedText = await extractTextWithTesseract(file);
        }
      } else {
        // Tesseract.js 사용
        setUsingGoogleVision(false);
        extractedText = await extractTextWithTesseract(file);
      }

      if (!extractedText.trim()) {
        setError('이미지에서 텍스트를 찾을 수 없습니다. 다른 이미지를 시도해주세요.');
        setUploading(false);
        return;
      }

      onTextExtracted(extractedText);
    } catch (err) {
      console.error('OCR Error:', err);
      setError('이미지 인식에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  /**
   * Tesseract.js를 사용한 OCR (폴백)
   */
  const extractTextWithTesseract = async (file: File): Promise<string> => {
    const result = await Tesseract.recognize(file, 'eng+kor', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          setProgress(30 + Math.round(m.progress * 70)); // 30-100% 범위
        }
      },
    });
    return result.data.text;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      // 파일 입력에 파일 설정
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      if (fileInputRef.current) {
        fileInputRef.current.files = dataTransfer.files;
        handleFileChange({ target: { files: dataTransfer.files } } as React.ChangeEvent<HTMLInputElement>);
      }
    }
  };

  const handleClear = () => {
    setPreviewUrl(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h3>📷 영수증 이미지 업로드</h3>
      
      {/* 드래그 앤 드롭 영역 */}
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{
          marginTop: '15px',
          padding: '30px',
          border: '2px dashed #aaa',
          borderRadius: '8px',
          textAlign: 'center',
          backgroundColor: '#f9f9f9',
          cursor: 'pointer',
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        {previewUrl ? (
          <div>
            <img
              src={previewUrl}
              alt="업로드된 이미지"
              style={{
                maxWidth: '100%',
                maxHeight: '200px',
                borderRadius: '4px',
                marginBottom: '10px',
              }}
            />
            {!uploading && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                style={{
                  display: 'block',
                  margin: '10px auto 0',
                  padding: '8px 16px',
                  fontSize: '14px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                다른 이미지 선택
              </button>
            )}
          </div>
        ) : (
          <div>
            <p style={{ fontSize: '16px', color: '#666', margin: 0 }}>
              📤 클릭하거나 이미지를 드래그하세요
            </p>
            <p style={{ fontSize: '14px', color: '#999', marginTop: '8px' }}>
              영수증, 식료품 목록 등의 이미지를 업로드하세요
            </p>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        disabled={uploading}
        style={{ display: 'none' }}
      />

      {/* 진행 상태 표시 */}
      {uploading && (
        <div style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                flex: 1,
                height: '8px',
                backgroundColor: '#e0e0e0',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: '100%',
                  backgroundColor: usingGoogleVision ? '#4285f4' : '#007bff',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            <span style={{ fontSize: '14px', color: '#666' }}>{progress}%</span>
          </div>
          <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
            {usingGoogleVision ? (
              <>🔍 <strong>Google Vision API</strong>로 이미지 인식 중... (더 정확함!)</>
            ) : (
              <>🔍 Tesseract.js로 이미지 인식 중...</>
            )}
          </p>
        </div>
      )}

      {/* 에러 메시지 */}
      {error && (
        <div
          style={{
            marginTop: '15px',
            padding: '12px',
            backgroundColor: '#f8d7da',
            color: '#721c24',
            borderRadius: '6px',
            fontSize: '14px',
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* 안내 메시지 */}
      <div
        style={{
          marginTop: '15px',
          padding: '12px',
          backgroundColor: '#e7f3ff',
          borderRadius: '6px',
          fontSize: '14px',
          color: '#004085',
        }}
      >
        <strong>💡 팁:</strong> 선명한 이미지일수록 인식률이 높습니다. 
        영수증이 잘 보이도록 밝은 곳에서 촬영해주세요.
        {!isGoogleVisionConfigured() && (
          <>
            <br />
            <strong>✨ Google Vision API를 설정하면 더 정확한 인식이 가능합니다!</strong>
            <br />
            <small>
              1. https://console.cloud.google.com/ 접속<br />
              2. Vision API 활성화<br />
              3. API 키 발급 후 .env에 VITE_GOOGLE_VISION_API_KEY 추가
            </small>
          </>
        )}
      </div>
    </div>
  );
}
