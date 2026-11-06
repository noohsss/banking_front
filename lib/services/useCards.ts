"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { IS_LIVE } from "@/lib/api/mode";
import { newIdempotencyKey } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import * as cardsApi from "@/lib/api/cards";
import type { Card } from "@/lib/types";

/** 같은 시도(sig)를 재전송할 때는 같은 Idempotency-Key, 성공하면 다음 시도부터 새 키. */
export function useIdempotencyKey() {
  const ref = useRef<{ sig: string; key: string } | null>(null);
  return {
    get: (sig: string) => (ref.current?.sig === sig ? ref.current.key : (ref.current = { sig, key: newIdempotencyKey() }).key),
    reset: () => { ref.current = null; },
  };
}

type CardsState = { cards: Card[]; loading: boolean; error: string | null; refresh: () => Promise<void> };

function useMockCards(): CardsState {
  const { cards } = useStore();
  return { cards, loading: false, error: null, refresh: async () => {} };
}

function useLiveCards(): CardsState {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => cardsApi.listCards().then(setCards, (e) => setError(errorMessage(e))).finally(() => setLoading(false)), []);
  const refresh = useCallback(async () => { setLoading(true); setError(null); await load(); }, [load]);
  useEffect(() => { void load(); }, [load]);
  return { cards, loading, error, refresh };
}

/** 카드 목록. 반환: { cards, loading, error, refresh } */
export const useCards = IS_LIVE ? useLiveCards : useMockCards;

export type IssueInput = { accountId: string; dailyLimit: number; overseas: boolean };

function useMockIssue() {
  const { issueCard } = useStore();
  return async (i: IssueInput): Promise<Card> => {
    await new Promise((r) => setTimeout(r, 600)); // 기존 데모의 처리 지연 유지
    return issueCard(i.accountId, i.dailyLimit, i.overseas);
  };
}

function useLiveIssue() {
  const k = useIdempotencyKey();
  return async (i: IssueInput): Promise<Card> => {
    const c = await cardsApi.issueCard({ accountId: i.accountId, dailyLimit: i.dailyLimit, overseasEnabled: i.overseas }, k.get(JSON.stringify(i)));
    k.reset();
    return c;
  };
}

/** 카드 발급(목록 조회 없이). 실패하면 ApiError. */
export const useIssueCard = IS_LIVE ? useLiveIssue : useMockIssue;
