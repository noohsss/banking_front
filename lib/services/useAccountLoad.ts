"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, errorMessage } from "@/lib/api/errors";

/** live 전용 조회 헬퍼(accounts 훅 공용). enabled=false면 호출하지 않는다. fn은 useCallback으로 고정해서 넘길 것. */
export function useAccountLoad<T>(fn: () => Promise<T>, enabled: boolean) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(enabled);
  const [err, setErr] = useState<unknown>(null);
  const seq = useRef(0);
  const refresh = useCallback(async () => {
    if (!enabled) return;
    const n = ++seq.current;
    setLoading(true);
    try { const d = await fn(); if (n === seq.current) { setData(d); setErr(null); } }
    catch (e) { if (n === seq.current) setErr(e); }
    finally { if (n === seq.current) setLoading(false); }
  }, [fn, enabled]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- 조회 시작(조건이 바뀌면 다시 불러온다)
  useEffect(() => { void refresh(); }, [refresh]);
  return { data, loading, error: err ? errorMessage(err) : null, notFound: err instanceof ApiError && err.status === 404, refresh };
}
