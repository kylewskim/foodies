import OpenAI from 'openai';

// OpenAI API configuration
// API key is loaded from environment variables
const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

// Tracks whether the API is available (set to false when rate-limited)
let apiAvailable = true;

if (!apiKey) {
  console.warn(
    '⚠️ OpenAI API key is not configured.\n' +
    '1. Create an account at https://platform.openai.com/\n' +
    '2. Generate an API key under API Keys\n' +
    '3. Add VITE_OPENAI_API_KEY=sk-... to your .env file'
  );
}

// OpenAI client instance
export const openai = new OpenAI({
  apiKey: apiKey || 'YOUR_API_KEY_HERE',
  dangerouslyAllowBrowser: true, // For MVP — use a server in production
  maxRetries: 0, // No retries on error; fall back immediately
});

// OpenAI model — gpt-4o-mini is fast and cost-efficient
// gpt-4o-mini: fast and affordable
// gpt-4o: more capable (use when needed)
export const FREE_MODEL = 'gpt-4o-mini';

// Returns true if the API key is set and the API is currently available
export const isOpenAIConfigured = (): boolean => {
  return !!apiKey && apiKey !== 'YOUR_API_KEY_HERE' && apiAvailable;
};

// Call when rate-limited to switch to fallback (keyword matching) mode
export const disableOpenAI = (): void => {
  if (apiAvailable) {
    console.warn('⚠️ API rate limit reached. Switching to keyword matching fallback.');
    apiAvailable = false;
  }
};

// Reset API availability (e.g., to retry without refreshing the page)
export const resetOpenAI = (): void => {
  apiAvailable = true;
};
