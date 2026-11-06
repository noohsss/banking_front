"use client";
import { useCallback } from "react";
import { useStore } from "@/lib/store";
import { IS_LIVE } from "@/lib/api/mode";
import { listAccounts } from "@/lib/api/accounts";
import type { Account } from "@/lib/types";
import { useAccountLoad } from "./useAccountLoad";

/**
 * [계약] 계좌 목록 훅. 이체·카드 화면도 이것을 쓴다. 반환 형태는 바꾸지 말 것.
 * live: GET /accounts (목록의 number는 마스킹 번호, 전체 번호는 useAccount 상세에서만 온다).
 */
export function useAccounts(): { accounts: Account[]; loading: boolean; error: string | null; refresh: () => Promise<void> } {
  const { accounts } = useStore();
  const fn = useCallback(() => listAccounts(), []);
  const live = useAccountLoad(fn, IS_LIVE);
  if (!IS_LIVE) return { accounts, loading: false, error: null, refresh: async () => {} };
  return { accounts: live.data ?? [], loading: live.loading, error: live.error, refresh: live.refresh };
}
