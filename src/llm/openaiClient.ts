import OpenAI from 'openai';

// Groq API 설정 (매우 빠르고 무료!)
// 환경변수에서 API 키를 가져옵니다
const apiKey = import.meta.env.VITE_GROQ_API_KEY;

// API 사용 가능 여부 (한도 초과 시 false로 변경)
let apiAvailable = true;

if (!apiKey) {
  console.warn(
    '⚠️ Groq API 키가 설정되지 않았습니다.\n' +
    '1. https://console.groq.com/ 에서 무료 계정 생성 (Google/GitHub 로그인)\n' +
    '2. API Keys에서 키 발급 (무료, 신용카드 불필요)\n' +
    '3. .env 파일에 VITE_GROQ_API_KEY=gsk_... 추가\n\n' +
    '💡 Groq는 매우 빠르고 무료입니다!'
  );
}

// Groq는 OpenAI 호환 API를 제공합니다
export const openai = new OpenAI({
  apiKey: apiKey || 'YOUR_API_KEY_HERE',
  baseURL: 'https://api.groq.com/openai/v1', // Groq 엔드포인트
  dangerouslyAllowBrowser: true, // MVP용 - 프로덕션에서는 서버 사용 권장
  maxRetries: 0, // 에러 시 재시도 하지 않음 (폴백으로 빠르게 전환)
});

// 무료 Groq 모델 - 매우 빠르고 강력!
// llama-3.3-70b-versatile: 가장 강력한 무료 모델
// mixtral-8x7b-32768: 빠르고 안정적
export const FREE_MODEL = 'llama-3.3-70b-versatile';

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
