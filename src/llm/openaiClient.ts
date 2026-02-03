import OpenAI from 'openai';

// OpenAI API 설정
// 환경변수에서 API 키를 가져옵니다
const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

// API 사용 가능 여부 (한도 초과 시 false로 변경)
let apiAvailable = true;

if (!apiKey) {
  console.warn(
    '⚠️ OpenAI API 키가 설정되지 않았습니다.\n' +
    '1. https://platform.openai.com/ 에서 계정 생성\n' +
    '2. API Keys에서 키 발급\n' +
    '3. .env 파일에 VITE_OPENAI_API_KEY=sk-... 추가'
  );
}

// OpenAI 클라이언트 생성
export const openai = new OpenAI({
  apiKey: apiKey || 'YOUR_API_KEY_HERE',
  dangerouslyAllowBrowser: true, // MVP용 - 프로덕션에서는 서버 사용 권장
  maxRetries: 0, // 에러 시 재시도 하지 않음 (폴백으로 빠르게 전환)
});

// OpenAI 모델 - gpt-4o-mini는 빠르고 저렴
// gpt-4o-mini: 빠르고 비용 효율적인 모델
// gpt-4o: 더 강력한 모델 (필요시 사용)
export const FREE_MODEL = 'gpt-4o-mini';

// API 키가 설정되었고 사용 가능한지 확인
export const isOpenAIConfigured = (): boolean => {
  return !!apiKey && apiKey !== 'YOUR_API_KEY_HERE' && apiAvailable;
};

// API 한도 초과 시 호출하여 폴백 모드로 전환
export const disableOpenAI = (): void => {
  if (apiAvailable) {
    console.warn('⚠️ API 한도 초과! 기본 키워드 매칭 모드로 전환합니다.');
    apiAvailable = false;
  }
};

// API 상태 리셋 (새로고침 없이 다시 시도할 때)
export const resetOpenAI = (): void => {
  apiAvailable = true;
};
