"use client";
import { useCallback } from "react";
import { useStore } from "@/lib/store";
import { IS_LIVE } from "@/lib/api/mode";
import { getCloseEligibility } from "@/lib/api/accounts";
import { useAccountLoad } from "./useAccountLoad";

export interface CloseCheck { ok: boolean; reasons: string[]; hasCard: boolean; hasAuto: boolean }

/** 해지 가능 여부와 사유. live는 GET close-eligibility의 reasons를 그대로 보여 준다. */
export function useCloseCheck(id: string): { check: CloseCheck | null; loading: boolean; error: string | null; refresh: () => Promise<void> } {
  const { canClose, cards, autos, getAccount: mockGet } = useStore();
  const fn = useCallback(async (): Promise<CloseCheck> => {
    const { eligible, ...rest } = await getCloseEligibility(id);
    return { ok: eligible, ...rest };
  }, [id]);
  const live = useAccountLoad(fn, IS_LIVE && !!id);
  if (!IS_LIVE) {
    const a = mockGet(id);
    const c = canClose(id);
    return {
      check: { ...c, hasCard: cards.some((x) => x.accountId === id && x.status !== "CLOSED" && x.status !== "REISSUED"), hasAuto: !!a && autos.some((x) => (x.fromId === id || x.toNumber === a.number) && x.active) },
      loading: false, error: null, refresh: async () => {},
    };
  }
  return { check: live.data ?? null, loading: live.loading, error: live.error, refresh: live.refresh };
}
