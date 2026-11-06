"use client";
import { useCallback } from "react";
import { useStore } from "@/lib/store";
import { IS_LIVE } from "@/lib/api/mode";
import { getAccount, getTransferLimits } from "@/lib/api/accounts";
import type { Account } from "@/lib/types";
import { useAccountLoad } from "./useAccountLoad";

/** 계좌 상세(전체 계좌번호·한도 포함). 없으면 account undefined, 404면 notFound. */
export function useAccount(id: string): { account: Account | undefined; loading: boolean; error: string | null; notFound: boolean; refresh: () => Promise<void> } {
  const { getAccount: mockGet } = useStore();
  const fn = useCallback(() => getAccount(id), [id]);
  const live = useAccountLoad(fn, IS_LIVE && !!id);
  if (!IS_LIVE) return { account: mockGet(id), loading: false, error: null, notFound: false, refresh: async () => {} };
  return { account: live.data, loading: live.loading, error: live.error, notFound: live.notFound, refresh: live.refresh };
}

export interface Limits { dailyLimit: number; monthlyLimit: number; dailyUsed: number; monthlyUsed: number }

/** 이체한도와 오늘·이번 달 사용액. id가 없으면 호출하지 않는다. */
export function useTransferLimits(id: string | undefined): { limits: Limits | null; loading: boolean; error: string | null; refresh: () => Promise<void> } {
  const { getAccount: mockGet, usedToday, usedMonth } = useStore();
  const fn = useCallback(() => getTransferLimits(id!), [id]);
  const live = useAccountLoad(fn, IS_LIVE && !!id);
  if (!IS_LIVE) {
    const a = id ? mockGet(id) : undefined;
    return { limits: a ? { dailyLimit: a.dailyLimit, monthlyLimit: a.monthlyLimit, dailyUsed: usedToday(a.id), monthlyUsed: usedMonth(a.id) } : null, loading: false, error: null, refresh: async () => {} };
  }
  return { limits: live.data ?? null, loading: live.loading, error: live.error, refresh: live.refresh };
}
