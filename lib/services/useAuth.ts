"use client";
import { useStore } from "@/lib/store";
import { IS_LIVE } from "@/lib/api/mode";
import { ApiError } from "@/lib/api/errors";
import * as authApi from "@/lib/api/auth";
import * as usersApi from "@/lib/api/users";
import type { User } from "@/lib/types";

export interface SignupInput {
  loginId: string; name: string; email: string; phone: string; birth?: string; password: string; pin: string;
  verificationId: number; agreements: { termId: number; agreed: boolean }[];
}

const fail = (code: string, message?: string): never => { throw new ApiError(0, code, message ?? ""); };

/**
 * 인증·내 정보 훅. 변경 동작은 async이고 실패하면 ApiError를 던진다(화면은 errorMessage/fields 사용).
 * mock은 store에 위임(기존 동작 그대로), live는 lib/api/auth·users 호출.
 */
export function useAuth() {
  const st = useStore();
  const { user, ready, setUser } = st;
  return {
    user, ready,
    async login(id: string, pw: string): Promise<void> {
      if (!IS_LIVE) { const r = st.login(id, pw); if (!r.ok) fail("AUTH_FAILED", r.message); return; }
      setUser(await authApi.login(id, pw));
    },
    /** mock은 loginId를 쓰지 않는다(PIN만으로 로그인). live는 loginId+PIN. */
    async loginWithPin(loginId: string, pin: string): Promise<void> {
      if (!IS_LIVE) { const r = st.loginWithPin(pin); if (!r.ok) fail("PIN_INVALID", r.message); return; }
      setUser(await authApi.loginWithPin(loginId, pin));
    },
    async signup(i: SignupInput): Promise<void> {
      if (!IS_LIVE) {
        const r = st.signup({ loginId: i.loginId, name: i.name, email: i.email, phone: i.phone, birth: i.birth, password: i.password, pin: i.pin });
        if (!r.ok) fail("DUPLICATE_LOGIN_ID", r.message); return;
      }
      await authApi.signup(i);
    },
    /** 인증번호 발송 → verificationId. mock은 0. */
    async sendEmailCode(email: string, purpose: authApi.Purpose): Promise<number> { return IS_LIVE ? authApi.sendEmailVerification(email, purpose) : 0; },
    /** mock은 호출 전 화면에서 6자리 숫자 검사만 한다. */
    async verifyEmailCode(verificationId: number, code: string): Promise<void> { if (IS_LIVE) await authApi.verifyEmailCode(verificationId, code); },
    async resetPassword(loginId: string, verificationId: number, newPassword: string): Promise<void> { if (IS_LIVE) await authApi.resetPassword(loginId, verificationId, newPassword); },
    logout: st.logout,
    /** mock: 로컬 PIN 확인. live: 사전 검증 API가 없으므로 항상 true(탈퇴 요청에서 서버가 판정). */
    checkPin: (pin: string) => (IS_LIVE ? true : st.checkPin(pin)),
    /** live는 PIN이 틀리면 ApiError(PIN_INVALID)를 던진다. */
    withdraw: async (pin: string): Promise<void> => { await st.withdraw(pin); },
    async updateMe(p: { name: string; email: string; phone: string }): Promise<void> {
      if (!IS_LIVE) { st.updateUser(p); return; }
      // 이메일 변경 API 없음(명세: 이름·휴대폰·생년월일만). 이메일은 보내지 않는다.
      const u: User = await usersApi.updateMe({ name: p.name, phone: p.phone });
      setUser(u);
    },
  };
}
