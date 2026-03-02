/**
 * OCR using Google Cloud Vision API
 *
 * Free tier: 1,000 requests/month
 * Provides more accurate and faster OCR than Tesseract
 */

const GOOGLE_VISION_API_KEY = import.meta.env.VITE_GOOGLE_VISION_API_KEY;

export async function extractTextWithGoogleVision(imageFile: File): Promise<string> {
  if (!GOOGLE_VISION_API_KEY || GOOGLE_VISION_API_KEY === 'YOUR_API_KEY_HERE') {
    throw new Error('Google Vision API key is not configured.');
  }

  // Convert image to base64
  const base64Image = await fileToBase64(imageFile);

  // Call Google Cloud Vision API
  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            image: {
              content: base64Image.split(',')[1], // strip the data:image/... prefix
            },
            features: [
              {
                type: 'TEXT_DETECTION',
                maxResults: 1,
              },
            ],
            imageContext: {
              languageHints: ['ko', 'en'],
            },
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Google Vision API error: ${response.status} - ${errorData.error?.message || response.statusText}`
    );
  }

  const data = await response.json();

  // Extract text
  if (
    data.responses &&
    data.responses[0] &&
    data.responses[0].fullTextAnnotation &&
    data.responses[0].fullTextAnnotation.text
  ) {
    return data.responses[0].fullTextAnnotation.text;
  }

  // Fall back to textAnnotations if fullTextAnnotation is absent
  if (
    data.responses &&
    data.responses[0] &&
    data.responses[0].textAnnotations &&
    data.responses[0].textAnnotations.length > 0
  ) {
    return data.responses[0].textAnnotations[0].description || '';
  }

  throw new Error('No text found in image.');
}

/**
 * Convert a File to a base64 data URL
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Returns true if the Google Vision API key is configured
 */
export function isGoogleVisionConfigured(): boolean {
  return !!GOOGLE_VISION_API_KEY && GOOGLE_VISION_API_KEY !== 'YOUR_API_KEY_HERE';
}
