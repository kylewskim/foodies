import { useState, useRef } from 'react';
import Tesseract from 'tesseract.js';
import { extractTextWithGoogleVision, isGoogleVisionConfigured } from '../utils/googleVisionOCR';

interface ImageUploadProps {
  onTextExtracted?: (text: string) => void;
  onFileSelected?: (file: File) => void; // If provided, skips OCR and hands the raw file to the caller
  useCamera?: boolean; // true: open camera directly, false: pick from photo library
}

export function ImageUpload({ onTextExtracted, onFileSelected, useCamera = true }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usingGoogleVision, setUsingGoogleVision] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Generate image preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setError(null);

    // If caller handles the full pipeline (Vision LLM path), hand off the file directly
    if (onFileSelected) {
      onFileSelected(file);
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      let extractedText: string;

      // Prefer Google Vision API if configured
      if (isGoogleVisionConfigured()) {
        setUsingGoogleVision(true);
        setProgress(30);

        try {
          extractedText = await extractTextWithGoogleVision(file);
          setProgress(100);
        } catch (googleError) {
          console.warn('Google Vision API failed, falling back to Tesseract:', googleError);
          setUsingGoogleVision(false);
          // Fall back to Tesseract
          extractedText = await extractTextWithTesseract(file);
        }
      } else {
        // Use Tesseract.js
        setUsingGoogleVision(false);
        extractedText = await extractTextWithTesseract(file);
      }

      if (!extractedText.trim()) {
        setError('No text found in the image. Please try a different image.');
        setUploading(false);
        return;
      }

      onTextExtracted?.(extractedText);
    } catch (err) {
      console.error('OCR Error:', err);
      setError('Failed to process the image. Please try again.');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  /**
   * OCR using Tesseract.js (fallback)
   */
  const extractTextWithTesseract = async (file: File): Promise<string> => {
    const result = await Tesseract.recognize(file, 'eng+kor', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          setProgress(30 + Math.round(m.progress * 70)); // 30-100% range
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
      // Attach the dropped file to the hidden input
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
      <h3>{useCamera ? '📷 Scan Receipt' : '🖼️ Select Image'}</h3>
      
      {/* Drag and drop area */}
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
              alt="Uploaded image"
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
                Choose a different image
              </button>
            )}
          </div>
        ) : (
          <div>
            <p style={{ fontSize: '16px', color: '#666', margin: 0 }}>
              {useCamera ? '📷 Tap to open camera' : '🖼️ Tap to pick from library'}
            </p>
            <p style={{ fontSize: '14px', color: '#999', marginTop: '8px' }}>
              {useCamera ? 'Take a photo of your receipt' : 'Select a grocery photo'}
            </p>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={useCamera ? "image/*" : "image/jpeg,image/png,image/gif,image/webp,image/heic"}
        {...(useCamera ? { capture: 'environment' } : {})}
        onChange={handleFileChange}
        disabled={uploading}
        style={{ display: 'none' }}
      />

      {/* Progress indicator */}
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
              <>🔍 Recognizing image with <strong>Google Vision API</strong>... (more accurate!)</>
            ) : (
              <>🔍 Recognizing image with Tesseract.js...</>
            )}
          </p>
        </div>
      )}

      {/* Error message */}
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

      {/* Tip message */}
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
        <strong>💡 Tip:</strong> Clearer images improve recognition accuracy.
        Take the photo in a well-lit area so the receipt is easy to read.
      </div>
    </div>
  );
}
