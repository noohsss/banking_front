"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { IS_LIVE } from "@/lib/api/mode";
import { errorMessage } from "@/lib/api/errors";
import { createStatementRequest, listStatementRequests, type StatementRequest } from "@/lib/api/accounts";
import { useStore } from "@/lib/store";
import { uid } from "@/lib/format";

export type { StatementRequest };

/**
 * 거래내역 다운로드(이메일 발송) 신청. 상태는 접수됨/발송완료/실패.
 * mock은 접수 4초 뒤 발송완료로 바꾼다. live는 서버 목록을 따른다(새로고침해야 상태가 바뀜).
 */
export function useStatements(accountId: string): { requests: StatementRequest[]; error: string | null; request: (from: string, to: string) => Promise<StatementRequest>; refresh: () => Promise<void> } {
  const [requests, setRequests] = useState<StatementRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => { const t = timers.current; return () => t.forEach(clearTimeout); }, []);

  const { user } = useStore();
  const refresh = useCallback(async () => {
    if (!IS_LIVE || !accountId) return;
    try { setRequests(await listStatementRequests(accountId)); setError(null); } catch (e) { setError(errorMessage(e)); }
  }, [accountId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- 조회 시작(조건이 바뀌면 다시 불러온다)
  useEffect(() => { void refresh(); }, [refresh]);

  const request = useCallback(async (from: string, to: string) => {
    if (IS_LIVE) {
      const r = await createStatementRequest(accountId, from, to);
      setRequests((p) => [r, ...p]);
      return r;
    }
    const r: StatementRequest = { id: uid("sr"), from, to, email: user?.email ?? "", status: "접수됨" };
    setRequests((p) => [r, ...p]);
    timers.current.push(setTimeout(() => setRequests((p) => p.map((x) => (x.id === r.id ? { ...x, status: "발송완료" } : x))), 4000));
    return r;
  }, [accountId, user?.email]);

  return { requests, error, request, refresh };
}
