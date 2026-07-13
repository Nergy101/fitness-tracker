const AUTH_KEY = "fitness_auth";

/**
 * Detect and wipe old Basic-auth tokens left over from the pre-session-token
 * era (before 2025-07-13). Old tokens are standard base64 (always have =
 * padding, decode to "fitness:<password>"). New tokens are 43-char
 * urlsafe-base64 with no padding — we only inspect padding-bearing tokens
 * because ~26% of urlsafe tokens happen to be valid standard base64, and
 * ~12% of those contain a colon byte in their random payload, which would
 * falsely wipe a valid session token.
 *
 * TODO(NER-186): remove this migration once enough time has passed that no
 * active browser still has an old token in localStorage.
 */
function _wipeOldToken(raw: string): string | null {
  // Old tokens always carry = base64 padding; new tokens (token_urlsafe(32))
  // are exactly 43 chars with no padding.
  if (!raw.includes("=")) return raw;
  try {
    const decoded = atob(raw);
    if (decoded.includes(":")) {
      localStorage.removeItem(AUTH_KEY);
      return null;
    }
  } catch {
    // Corrupt base64 — definitely not our old format.
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