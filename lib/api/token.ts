/** JWT 보관. 만료/미정 정책(리프레시 토큰 여부)은 명세 미해결 이슈이므로 access token만 다룬다. */
const KEY = "ian-bank-token";

export const tokenStore = {
  get(): string | null { try { return typeof window === "undefined" ? null : localStorage.getItem(KEY); } catch { return null; } },
  set(t: string) { try { localStorage.setItem(KEY, t); } catch {} },
  clear() { try { localStorage.removeItem(KEY); } catch {} },
};

/** 401을 받았을 때 호출되는 훅. 스토어가 등록해 로그인 화면으로 보낸다. */
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: (() => void) | null) => { onUnauthorized = fn; };
export const fireUnauthorized = () => onUnauthorized?.();
