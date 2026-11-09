import type { components } from "./schema";

export type ApiErrorBody = components["schemas"]["Error"];
export type ApiErrorCode = ApiErrorBody["code"];

/** 서버 오류 응답(`{code,message,fieldErrors,reasons}`)을 담는 예외. 네트워크 실패는 status 0. */
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public fieldErrors: { field: string; reason: string }[] = [], public reasons: string[] = [], public retryAfter?: number) {
    super(message);
    this.name = "ApiError";
  }
  /** 필드명 → 오류 문구 (폼에 바로 연결용) */
  get fields(): Record<string, string> { return Object.fromEntries(this.fieldErrors.map((f) => [f.field, f.reason])); }
  is(code: ApiErrorCode) { return this.code === code; }
}

/** 코드별 기본 안내 문구. 서버 message가 있으면 그것을 우선한다. */
const FALLBACK: Record<string, string> = {
  AUTH_FAILED: "아이디 또는 비밀번호가 맞지 않아요.",
  USER_LOCKED: "계정이 잠겼어요. 잠금 해제 방법을 확인해 주세요.",
  UNAUTHORIZED: "로그인이 만료됐어요. 다시 로그인해 주세요.",
  PIN_INVALID: "PIN이 맞지 않아요.",
  INSUFFICIENT_BALANCE: "잔액이 부족해요.",
  DAILY_LIMIT_EXCEEDED: "하루 이체한도를 넘어요.",
  MONTHLY_LIMIT_EXCEEDED: "한 달 이체한도를 넘어요.",
  RECIPIENT_NOT_FOUND: "IAN Bank에서 확인되는 계좌만 받을 수 있어요.",
  SAME_ACCOUNT: "같은 계좌로는 이체할 수 없어요.",
  ACCOUNT_STATE_NOT_ALLOWED: "거래중지 또는 해지된 계좌에서는 할 수 없어요.",
  ACCOUNT_CLOSE_BLOCKED: "해지할 수 없는 사유가 있어요.",
  USER_HAS_OPEN_ACCOUNTS: "해지하지 않은 계좌가 있어 탈퇴할 수 없어요. 계좌를 모두 해지한 뒤 다시 시도해 주세요.",
  ACCOUNT_PASSWORD_INVALID: "통장 비밀번호가 맞지 않아요.",
  CARD_STATE_NOT_ALLOWED: "현재 카드 상태에서는 할 수 없어요.",
  VERIFICATION_FAILED: "인증번호가 맞지 않거나 만료됐어요.",
  VERIFICATION_REQUIRED: "이메일 본인확인을 먼저 완료해 주세요.",
  TERMS_NOT_AGREED: "필수 약관에 동의해 주세요.",
  DUPLICATE_LOGIN_ID: "이미 사용 중인 아이디예요.",
  DUPLICATE_EMAIL: "이미 가입된 이메일이에요.",
  DUPLICATE_PHONE: "이미 가입된 휴대폰 번호예요.",
  TOO_MANY_REQUESTS: "요청이 많아요. 잠시 후 다시 시도해 주세요.",
  NOT_FOUND: "찾을 수 없어요.",
  VALIDATION_ERROR: "입력값을 다시 확인해 주세요.",
  NETWORK: "서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.",
};
export const errorMessage = (e: unknown): string => {
  if (e instanceof ApiError && e.retryAfter) return `${e.retryAfter}초 뒤에 다시 시도해 주세요.`;
  if (e instanceof ApiError) return e.message || FALLBACK[e.code] || "처리하지 못했어요. 잠시 후 다시 시도해 주세요.";
  return FALLBACK.NETWORK;
};
