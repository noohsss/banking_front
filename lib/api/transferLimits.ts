import { api, call } from "./client";

export interface TransferLimitsInfo { dailyLimit: number; monthlyLimit: number; usedToday: number; usedMonth: number }

/** 계좌별 이체한도와 오늘·이번 달 사용액 (GET /accounts/{id}/limits) */
export const getTransferLimits = async (accountId: string): Promise<TransferLimitsInfo> => {
  const l = await call(api.GET("/accounts/{accountId}/limits", { params: { path: { accountId } } }));
  return { dailyLimit: l.dailyLimit ?? 0, monthlyLimit: l.monthLimit ?? 0, usedToday: l.dailyUsed ?? 0, usedMonth: l.monthUsed ?? 0 };
};
