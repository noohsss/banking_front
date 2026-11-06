"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { IS_LIVE } from "@/lib/api/mode";
import { ApiError, errorMessage } from "@/lib/api/errors";
import * as cardsApi from "@/lib/api/cards";
import { listCardPaymentAlerts, readNotification } from "@/lib/api/cardNotifications";
import { wonUnit } from "@/lib/format";
import { useIdempotencyKey } from "./useCards";
import type { Card, CardAlert, CardPayment } from "@/lib/types";

export interface CardDetail {
  card: Card | undefined;          // loading 끝났는데 undefined 이고 error 도 없으면 "없는 카드"
  payments: CardPayment[];         // 최신순
  alerts: CardAlert[];             // 결제 알림(최근 3건)
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  hasMorePayments: boolean;
  loadMorePayments: () => Promise<void>;
  canResume: boolean;              // 정지 해제 API가 명세에 없어 live에서는 false
  update: (p: { dailyLimit?: number; overseas?: boolean }) => Promise<void>;
  suspend: () => Promise<void>;
  resume: () => Promise<void>;
  reportLost: () => Promise<void>;
  reissue: () => Promise<Card>;
  markAlertRead: (id: string) => Promise<void>;
}

function useMockCard(id: string): CardDetail {
  const { cards, payments, patchCard, reissueCard } = useStore();
  const card = cards.find((c) => c.id === id);
  const myPays = useMemo(() => payments.filter((p) => p.cardId === id).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)), [payments, id]);
  const alerts = myPays.slice(0, 3).map((p) => ({
    id: p.id, payId: p.id, at: p.requestedAt,
    text: p.completedAt ? `${p.merchant}에서 ${wonUnit(p.amount)} 결제했어요` : `${p.merchant} ${wonUnit(p.amount)} 결제를 처리하고 있어요`,
  }));
  return {
    card, payments: myPays, alerts, loading: false, error: null, refresh: async () => {},
    hasMorePayments: false, loadMorePayments: async () => {}, canResume: true,
    update: async (p) => patchCard(id, { ...(p.dailyLimit !== undefined && { dailyLimit: p.dailyLimit }), ...(p.overseas !== undefined && { overseas: p.overseas }) }),
    suspend: async () => patchCard(id, { status: "SUSPENDED" }),
    resume: async () => patchCard(id, { status: "ACTIVE" }),
    reportLost: async () => patchCard(id, { status: "LOST" }),
    reissue: async () => reissueCard(id),
    markAlertRead: async () => {},
  };
}

function useLiveCard(id: string): CardDetail {
  const [card, setCard] = useState<Card | undefined>();
  const [payments, setPayments] = useState<CardPayment[]>([]);
  const [total, setTotal] = useState(0);
  const [alerts, setAlerts] = useState<CardAlert[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [busyLoad, setBusyLoad] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lostKey = useIdempotencyKey();
  const reissueKey = useIdempotencyKey();

  const load = useCallback(() => (async () => {
    let c = await cardsApi.getCard(id);
    // 이전 카드의 replacedBy 는 목록에서만 알 수 있다
    if (c.status === "REISSUED") c = { ...c, replacedBy: (await cardsApi.listCards()).find((n) => n.id === id)?.replacedBy };
    setCard(c);
    const [p, a] = await Promise.all([cardsApi.listCardPayments(id, 0), listCardPaymentAlerts().catch(() => [] as CardAlert[])]);
    setPayments(p.items); setTotal(p.total); setAlerts(a.slice(0, 3));
  })().catch((e) => {
    setCard(undefined);
    if (!(e instanceof ApiError && e.status === 404)) setError(errorMessage(e));
  }).finally(() => { setLoadedFor(id); setBusyLoad(false); }), [id]);
  const refresh = useCallback(async () => { setBusyLoad(true); setError(null); await load(); }, [load]);
  useEffect(() => { void load(); }, [load]);
  const loading = busyLoad || loadedFor !== id; // id 가 바뀌면(재발급 후 새 카드 보기) 다시 로딩

  const loadMorePayments = async () => {
    const p = await cardsApi.listCardPayments(id, Math.ceil(payments.length / 20));
    setPayments((prev) => [...prev, ...p.items.filter((n) => !prev.some((o) => o.id === n.id))]); setTotal(p.total);
  };
  const keep = (c: Card) => setCard((old) => ({ ...c, replacedBy: old?.replacedBy ?? c.replacedBy }));

  return {
    card: loadedFor === id ? card : undefined, payments, alerts, loading, error, refresh, canResume: false,
    hasMorePayments: payments.length < total, loadMorePayments,
    update: async (p) => keep(await cardsApi.updateCardSettings(id, { dailyLimit: p.dailyLimit, overseasEnabled: p.overseas })),
    suspend: async () => keep(await cardsApi.suspendCard(id)),
    resume: async () => { throw new ApiError(0, "UNSUPPORTED", "정지 해제는 아직 지원하지 않아요."); },
    reportLost: async () => { keep(await cardsApi.reportCardLost(id, lostKey.get(id))); lostKey.reset(); },
    reissue: async () => { const c = await cardsApi.reissueCard(id, reissueKey.get(id)); reissueKey.reset(); setCard((o) => o && { ...o, status: "REISSUED", replacedBy: c.id }); return c; },
    markAlertRead: async (aid) => { await readNotification(aid); setAlerts((l) => l.map((a) => (a.id === aid ? { ...a, unread: false } : a))); },
  };
}

/** 카드 상세 + 사용내역 + 결제 알림 + 관리 동작. 변경 동작은 실패 시 ApiError를 던진다. */
export const useCard = IS_LIVE ? useLiveCard : useMockCard;
