/**
 * Google Cloud Vision API를 사용한 OCR
 * 
 * 무료 크레딧: 월 1,000회
 * 더 정확하고 빠른 OCR 제공
 */

const GOOGLE_VISION_API_KEY = import.meta.env.VITE_GOOGLE_VISION_API_KEY;

export async function extractTextWithGoogleVision(imageFile: File): Promise<string> {
  if (!GOOGLE_VISION_API_KEY || GOOGLE_VISION_API_KEY === 'YOUR_API_KEY_HERE') {
    throw new Error('Google Vision API 키가 설정되지 않았습니다.');
  }

  // 이미지를 base64로 변환
  const base64Image = await fileToBase64(imageFile);

  // Google Cloud Vision API 호출
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
              content: base64Image.split(',')[1], // data:image/... 부분 제거
            },
            features: [
              {
                type: 'TEXT_DETECTION',
                maxResults: 1,
              },
            ],
            imageContext: {
              languageHints: ['ko', 'en'], // 한국어, 영어 우선
            },
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Google Vision API 오류: ${response.status} - ${errorData.error?.message || response.statusText}`
    );
  }

  const data = await response.json();

  // 텍스트 추출
  if (
    data.responses &&
    data.responses[0] &&
    data.responses[0].fullTextAnnotation &&
    data.responses[0].fullTextAnnotation.text
  ) {
    return data.responses[0].fullTextAnnotation.text;
  }

  // fullTextAnnotation이 없으면 textAnnotations에서 추출
  if (
    data.responses &&
    data.responses[0] &&
    data.responses[0].textAnnotations &&
    data.responses[0].textAnnotations.length > 0
  ) {
    return data.responses[0].textAnnotations[0].description || '';
  }

  throw new Error('이미지에서 텍스트를 찾을 수 없습니다.');
}

/**
 * 파일을 base64로 변환
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
 * Google Vision API 키가 설정되어 있는지 확인
 */
export function isGoogleVisionConfigured(): boolean {
  return !!GOOGLE_VISION_API_KEY && GOOGLE_VISION_API_KEY !== 'YOUR_API_KEY_HERE';
}
