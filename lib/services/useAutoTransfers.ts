"use client";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { IS_LIVE } from "@/lib/api/mode";
import { errorMessage } from "@/lib/api/errors";
import { cancelAutoTransfer, createAutoTransfer, listAutoTransfers } from "@/lib/api/autoTransfers";
import type { AutoTransfer } from "@/lib/types";

export type AutoInput = Omit<AutoTransfer, "id" | "active" | "status" | "nextRunDate">;

/**
 * 자동이체 훅. { autos, loading, error, refresh, add, cancel }
 * - add: 등록(실패하면 ApiError). 반환 toName은 입력값으로 채운다(서버는 예금주를 내려주지 않음).
 * - cancel: live 해지(DELETE, 되돌릴 수 없음). mock은 기존 토글(toggle)도 쓴다.
 * - toggle: mock 전용 켜기/끄기. live에는 일시정지·재개가 없다(명세는 해지만).
 */
export function useAutoTransfers() {
  const store = useStore();
  const [list, setList] = useState<AutoTransfer[]>([]);
  const [loading, setLoading] = useState(IS_LIVE);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback((): Promise<void> => {
    if (!IS_LIVE) return Promise.resolve();
    return listAutoTransfers().then(
      (l) => { setList([...l].sort((a, b) => Number(b.active) - Number(a.active))); setError(null); },
      (e) => setError(errorMessage(e)),
    ).then(() => setLoading(false));
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const add = async (i: AutoInput): Promise<AutoTransfer> => {
    if (!IS_LIVE) return store.addAuto(i);
    const a = await createAutoTransfer(i);
    await refresh();
    return { ...a, toName: i.toName };
  };

  const cancel = async (id: string) => {
    if (!IS_LIVE) { store.toggleAuto(id); return; }
    await cancelAutoTransfer(id);
    await refresh();
  };

  return { autos: IS_LIVE ? list : store.autos, loading, error, refresh, add, cancel, toggle: (id: string) => store.toggleAuto(id) };
}
