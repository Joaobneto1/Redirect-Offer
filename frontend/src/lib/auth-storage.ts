const TOKEN_KEY = "redirect_offer_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function emitLogout(): void {
  clearToken();
  window.dispatchEvent(new CustomEvent("auth:logout"));
}
