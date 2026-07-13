const AUTH_KEY = "fitness_auth";

/**
 * Detect and wipe old Basic-auth tokens left over from the pre-session-token
 * era (before 2025-07-13). Old tokens are standard base64 (padding, decodes
 * to "fitness:<password>"). New tokens are urlsafe-base64 random blobs.
 *
 * TODO(NER-186): remove this migration once enough time has passed that no
 * active browser still has an old token in localStorage.
 */
function _wipeOldToken(raw: string): string | null {
  try {
    // Only standard base64 (with +/ and = padding) is the old format.
    // urlsafe base64 uses -_ and no padding, and atob won't decode it.
    const decoded = atob(raw);
    // Old format: "fitness:<password>" — contains a colon.
    if (decoded.includes(":")) {
      localStorage.removeItem(AUTH_KEY);
      return null;
    }
  } catch {
    // Not valid base64 — probably a new urlsafe token, keep it.
  }
  return raw;
}

export function getStoredAuth(): string | null {
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) return null;
  return _wipeOldToken(raw);
}

export function setStoredAuth(token: string) {
  localStorage.setItem(AUTH_KEY, token);
}

export function clearStoredAuth() {
  localStorage.removeItem(AUTH_KEY);
}