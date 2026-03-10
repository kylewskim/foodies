const SESSION_ID_KEY = 'freshli_session_id';
const LEGACY_SESSION_ID_KEY = 'foodies_session_id';

/**
 * Get or create a session ID from localStorage
 */
export function getOrCreateSessionId(): string {
  const migratedSessionId = localStorage.getItem(LEGACY_SESSION_ID_KEY);
  if (migratedSessionId) {
    localStorage.setItem(SESSION_ID_KEY, migratedSessionId);
    localStorage.removeItem(LEGACY_SESSION_ID_KEY);
    return migratedSessionId;
  }

  const existingSessionId = localStorage.getItem(SESSION_ID_KEY);
  
  if (existingSessionId) {
    return existingSessionId;
  }
  
  // Generate a new session ID
  const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  localStorage.setItem(SESSION_ID_KEY, newSessionId);
  
  return newSessionId;
}

/**
 * Clear the current session
 */
export function clearSession(): void {
  localStorage.removeItem(SESSION_ID_KEY);
  localStorage.removeItem(LEGACY_SESSION_ID_KEY);
}
