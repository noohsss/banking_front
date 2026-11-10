// AI 도우미 순수 함수(화면·훅 밖에서 단위 확인 가능). 초안·이력은 sessionStorage/메모리에만 두고 localStorage에는 저장하지 않는다.
import type { TransferDraft } from "@/lib/api/assistant";

export const DRAFT_KEY = "ian.transferDraft";
const ACCOUNT_RE = /^\d{3}-\d{4}-\d{4}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MEMO_MAX = 20; // /transfer 메모 입력 한도
const MAX_AMOUNT = 999999999999;

/** 스키마·계좌번호 형식·금액(정수 양수)을 확인한다. 하나라도 어긋나면 null(무시). */
export function parseTransferDraft(v: unknown): TransferDraft | null {
  if (!v || typeof v !== "object") return null;
  const d = v as Record<string, unknown>;
  const str = (x: unknown) => typeof x === "string" && x.length > 0;
  if (!str(d.fromAccountId) || !UUID_RE.test(d.fromAccountId as string) || !str(d.toAccountNum) || !ACCOUNT_RE.test(d.toAccountNum as string)) return null;
  if (typeof d.fromAccountLabel !== "string" || typeof d.toHolderNameMasked !== "string") return null;
  if (typeof d.amount !== "number" || !Number.isSafeInteger(d.amount) || d.amount <= 0 || d.amount > MAX_AMOUNT) return null;
  if (d.memo != null && typeof d.memo !== "string") return null;
  return { fromAccountId: d.fromAccountId as string, fromAccountLabel: d.fromAccountLabel, toAccountNum: d.toAccountNum as string, toHolderNameMasked: d.toHolderNameMasked, amount: d.amount, memo: d.memo ? (d.memo as string).slice(0, MEMO_MAX) : null };
}

/** 한 번만 읽고 즉시 지운다. 없거나 깨졌거나 유효하지 않으면 null. */
export function takeTransferDraft(): TransferDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (raw == null) return null;
    sessionStorage.removeItem(DRAFT_KEY);
    return parseTransferDraft(JSON.parse(raw));
  } catch { return null; }
}

export const saveTransferDraft = (d: TransferDraft) => sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));

/** 직전 기간 대비 지출 증감. 직전 지출이 0이면 비율은 null. */
export function spendingDelta(totalOut: number, previousTotalOut: number): { diff: number; pct: number | null } {
  const diff = totalOut - previousTotalOut;
  return { diff, pct: previousTotalOut > 0 ? Math.round((diff / previousTotalOut) * 100) : null };
}
