"use client";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { IS_LIVE } from "@/lib/api/mode";
import { ApiError } from "@/lib/api/errors";
import { createTransfer, getTransfer, lookupAccount } from "@/lib/api/transfers";
import { getTransferLimits, type TransferLimitsInfo } from "@/lib/api/transferLimits";
import type { Transfer } from "@/lib/types";
import { useAccounts } from "./useAccounts";

export interface SendInput { fromId: string; toNumber: string; amount: number; memo: string; pin: string; key: string }
export type TransferLimits = TransferLimitsInfo;

// 모의 저장소의 실패 코드 → 명세 오류 코드/HTTP 상태
const MOCK_ERR = {
  BALANCE: [422, "INSUFFICIENT_BALANCE"], DAILY: [422, "DAILY_LIMIT_EXCEEDED"], MONTHLY: [422, "MONTHLY_LIMIT_EXCEEDED"],
  STATUS: [409, "ACCOUNT_STATE_NOT_ALLOWED"], RECIPIENT: [404, "RECIPIENT_NOT_FOUND"], AMOUNT: [400, "VALIDATION_ERROR"],
} as const;

/**
 * 즉시이체 훅. fromId의 한도 현황(limits)도 함께 돌려준다(live: 불러오는 동안·실패 시 null).
 * - lookup: 수취인 확인. 예금주명, 없는 계좌면 null. 그 밖의 실패는 ApiError를 던진다.
 * - checkPin: mock 전용 사전 검증(live는 항상 true — 서버가 send에서 403 PIN_INVALID로 알려 준다).
 * - send: 이체 실행. 같은 시도를 재전송할 때는 같은 key를 넘겨야 중복 이체가 안 된다. 실패는 ApiError, 응답 status는 PENDING일 수 있다.
 * - check: PENDING·응답 유실 시 GET /transfers/{id}로 결과 확인.
 */
export function useTransfer(fromId?: string) {
  const store = useStore();
  const { refresh: refreshAccounts } = useAccounts();
  const [live, setLive] = useState<{ id: string; info: TransferLimits } | null>(null);

  const loadLimits = useCallback(async () => {
    if (!IS_LIVE || !fromId) return;
    await getTransferLimits(fromId).then((info) => setLive({ id: fromId, info }), () => setLive(null));
  }, [fromId]);
  useEffect(() => { void loadLimits(); }, [loadLimits]);

  const a = fromId ? store.getAccount(fromId) : undefined;
  const limits: TransferLimits | null = IS_LIVE ? (live && live.id === fromId ? live.info : null) : a ? { dailyLimit: a.dailyLimit, monthlyLimit: a.monthlyLimit, usedToday: store.usedToday(a.id), usedMonth: store.usedMonth(a.id) } : null;

  const lookup = async (number: string): Promise<string | null> => {
    if (!IS_LIVE) return store.lookupRecipient(number);
    try { return await lookupAccount(number); } catch (e) {
      if (e instanceof ApiError && e.is("RECIPIENT_NOT_FOUND")) return null;
      throw e;
    }
  };

  const send = async (i: SendInput): Promise<Transfer> => {
    if (!IS_LIVE) {
      const r = store.transfer({ fromId: i.fromId, toNumber: i.toNumber, amount: i.amount, memo: i.memo });
      if (r.ok) return r.transfer;
      const [status, code] = MOCK_ERR[r.code];
      throw new ApiError(status, code, r.message);
    }
    const t = await createTransfer({ fromAccountId: i.fromId, toAccountNum: i.toNumber, amount: i.amount, memo: i.memo || undefined, pin: i.pin }, i.key);
    if (t.status === "SUCCESS") { await refreshAccounts(); await loadLimits(); }
    return t;
  };

  const check = async (id: string): Promise<Transfer> => {
    if (!IS_LIVE) throw new ApiError(0, "NETWORK", "");
    const t = await getTransfer(id);
    if (t.status === "SUCCESS") { await refreshAccounts(); await loadLimits(); }
    return t;
  };

  return { limits, lookup, checkPin: (pin: string) => (IS_LIVE ? true : store.checkPin(pin)), send, check };
}
