"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { IS_LIVE } from "@/lib/api/mode";
import { errorMessage } from "@/lib/api/errors";
import { listTransactions } from "@/lib/api/transactions";
import type { Tx } from "@/lib/types";

export interface TxFilter {
  start: Date; end: Date;                       // 조회 기간
  dir: "ALL" | "IN" | "OUT";
  sort: "desc" | "asc";
  q: string;                                    // 검색어
  min: number | null; max: number | null;       // 금액 범위
  enabled: boolean;                             // false면 조회하지 않음(입력 오류 등)
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const PAGE_SIZE = 20;

export interface TxList { items: Tx[]; total: number; hasAny: boolean; loading: boolean; loadingMore: boolean; error: string | null; hasMore: boolean; loadMore: () => Promise<void>; refresh: () => Promise<void> }

/**
 * 거래내역. mock은 저장소의 거래를 클라이언트에서 거르고, live는 기간·입출금·정렬·검색을 서버 쿼리로 보내 페이지 단위로 받는다.
 * live 검색어는 상대방 이름(counterparty)으로 보낸다(명세가 상대방·메모 OR 검색을 주지 않음).
 */
export function useTransactions(accountId: string, f: TxFilter): TxList {
  const { txs } = useStore();
  const kw = f.q.trim();

  // ---- mock ----
  const mock = useMemo(() => {
    if (IS_LIVE || !f.enabled) return [];
    const k = kw.toLowerCase();
    const numKw = k.replace(/[,원\s]/g, "");
    return txs
      .filter((t) => t.accountId === accountId)
      .filter((t) => { const d = new Date(t.at); return d >= f.start && d <= f.end; })
      .filter((t) => f.dir === "ALL" || t.type === f.dir)
      .filter((t) => (f.min === null || t.amount >= f.min) && (f.max === null || t.amount <= f.max))
      .filter((t) => !k || t.counterparty.toLowerCase().includes(k) || t.memo.toLowerCase().includes(k) || t.kind.includes(k) || (/^\d+$/.test(numKw) && String(t.amount).includes(numKw)))
      .sort((a, b) => (f.sort === "desc" ? b.at.localeCompare(a.at) : a.at.localeCompare(b.at)));
  }, [txs, accountId, f.enabled, f.start, f.end, f.dir, f.min, f.max, f.sort, kw]);

  // ---- live ----
  const [items, setItems] = useState<Tx[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(IS_LIVE && f.enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const page = useRef(0);
  const seq = useRef(0);
  const from = iso(f.start), to = iso(f.end);
  const enabled = IS_LIVE && f.enabled && !!accountId;

  const fetchPage = useCallback(async (p: number) => {
    const n = ++seq.current;
    try {
      const r = await listTransactions(accountId, {
        from, to, direction: f.dir === "ALL" ? undefined : f.dir, sort: f.sort === "desc" ? "latest" : "oldest",
        minAmount: f.min ?? undefined, maxAmount: f.max ?? undefined, counterparty: kw || undefined, page: p, size: PAGE_SIZE,
      });
      if (n !== seq.current) return;
      page.current = p; setTotal(r.total); setError(null);
      setItems((prev) => (p === 0 ? r.items : [...prev, ...r.items]));
    } catch (e) {
      if (n === seq.current) setError(errorMessage(e));
    } finally {
      if (n === seq.current) { setLoading(false); setLoadingMore(false); }
    }
  }, [accountId, from, to, f.dir, f.sort, f.min, f.max, kw]);

  const refresh = useCallback(async () => { if (!enabled) return; setLoading(true); await fetchPage(0); }, [enabled, fetchPage]);
  const loadMore = useCallback(async () => { if (!enabled) return; setLoadingMore(true); await fetchPage(page.current + 1); }, [enabled, fetchPage]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- 조회 시작(조건이 바뀌면 다시 불러온다)
  useEffect(() => { void refresh(); }, [refresh]);

  if (!IS_LIVE) return { items: mock, total: mock.length, hasAny: txs.some((t) => t.accountId === accountId), loading: false, loadingMore: false, error: null, hasMore: false, loadMore: async () => {}, refresh: async () => {} };
  return { items: f.enabled ? items : [], total, hasAny: items.length > 0, loading, loadingMore, error, hasMore: items.length < total, loadMore, refresh };
}
