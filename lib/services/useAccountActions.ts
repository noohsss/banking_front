"use client";
import { useStore } from "@/lib/store";
import { IS_LIVE } from "@/lib/api/mode";
import { ApiError } from "@/lib/api/errors";
import * as acc from "@/lib/api/accounts";
import { sendEmailVerification, verifyEmailCode } from "@/lib/api/auth";

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const DEMO_CODE = "000000";

/**
 * 계좌 변경 동작. 모두 async이고 live에서 실패하면 ApiError를 던진다(화면은 errorMessage로 안내).
 * PIN은 live에서 요청 본문에만 실리고, 틀리면 403 PIN_INVALID. mock은 PinSheet가 이미 검증했다고 보고 저장소를 바꾼다.
 */
export function useAccountActions() {
  const s = useStore();
  return {
    setFavorite: async (id: string, favorite: boolean): Promise<void> => {
      if (IS_LIVE) { await acc.updateAccount(id, { isFavorite: favorite }); return; }
      if (s.getAccount(id)?.favorite !== favorite) s.toggleFavorite(id);
    },
    changeLimits: async (id: string, daily: number, monthly: number, pin: string): Promise<void> => {
      if (IS_LIVE) { await acc.updateTransferLimits(id, daily, monthly, pin); return; }
      await delay(500); s.setLimits(id, daily, monthly);
    },
    /** 거래중지 해제 1단계: 이메일 인증번호 발송. verificationId를 돌려준다. */
    sendUnlockCode: async (email: string): Promise<number> => (IS_LIVE ? sendEmailVerification(email, "UNLOCK_ACCOUNT") : 0),
    /** 2단계: 인증번호 확인 */
    verifyUnlockCode: async (verificationId: number, code: string): Promise<void> => {
      if (IS_LIVE) { await verifyEmailCode(verificationId, code); return; }
      await delay(500);
      if (code !== DEMO_CODE) throw new ApiError(422, "VERIFICATION_FAILED", "인증번호가 맞지 않아요. 메일을 다시 확인하거나 인증번호를 다시 받아 주세요.");
    },
    /** 3단계: 인증 완료된 verificationId로 해제 */
    unlock: async (id: string, verificationId: number): Promise<void> => {
      if (IS_LIVE) { await acc.unlockAccount(id, verificationId); return; }
      s.releaseSuspension(id);
    },
    closeAccount: async (id: string, pin: string): Promise<void> => {
      if (IS_LIVE) { await acc.closeAccount(id, pin); return; }
      await delay(600); s.closeAccount(id);
    },
  };
}

/** 에러가 PIN 불일치인지 */
export const isPinInvalid = (e: unknown) => e instanceof ApiError && e.code === "PIN_INVALID";
