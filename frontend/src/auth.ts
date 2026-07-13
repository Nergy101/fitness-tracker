const AUTH_KEY = "fitness_auth";

export function getStoredAuth(): string | null {
  return localStorage.getItem(AUTH_KEY);
}

export function setStoredAuth(token: string) {
  localStorage.setItem(AUTH_KEY, token);
}

export function clearStoredAuth() {
  localStorage.removeItem(AUTH_KEY);
}