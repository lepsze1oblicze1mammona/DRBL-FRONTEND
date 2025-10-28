// lib/auth.ts
export type TokenInfo = {
  token: string;
  expiresAt: string; // ISO string
};

export function getTokenInfo(): TokenInfo | null {
  const token = localStorage.getItem("token");
  const expiresAt = localStorage.getItem("expiresAt");
  if (!token || !expiresAt) return null;
  return { token, expiresAt };
}

export function setTokenInfo(token: string, expiresAt: string) {
  localStorage.setItem("token", token);
  localStorage.setItem("expiresAt", expiresAt);
}

export function clearTokenInfo() {
  localStorage.removeItem("token");
  localStorage.removeItem("expiresAt");
  localStorage.removeItem("user");
}
