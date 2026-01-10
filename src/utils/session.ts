const SESSION_ID_KEY = 'foodies_session_id';

/**
 * Get or create a session ID from localStorage
 */
export function getOrCreateSessionId(): string {
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
}
