"use client";
import { useCallback, useRef } from "react";
import { useStore } from "@/lib/store";
import { IS_LIVE } from "@/lib/api/mode";
import { newIdempotencyKey } from "@/lib/api/client";
import { listAccountProducts, openAccount, type AccountProduct } from "@/lib/api/accounts";
import { listTerms } from "@/lib/api/auth";
import type { Account } from "@/lib/types";
import { useAccountLoad } from "./useAccountLoad";

export interface OpenTerm { id: string; req: boolean; label: string; content?: string }
export interface OpenInput { alias: string; password: string; purpose: string; fundSource: string; agreed: Record<string, boolean> }

const MOCK_TERMS: OpenTerm[] = [
  { id: "t1", req: true, label: "IAN 입출금통장 이용약관" },
  { id: "t2", req: true, label: "상품설명서 확인 (금리·수수료·예금자보호 안내)" },
  { id: "t3", req: true, label: "개인정보 수집·이용 동의" },
  { id: "t4", req: false, label: "혜택·이벤트 알림 수신 동의" },
];

/** 계좌 개설: 상품 안내(listAccountProducts)·약관(listTerms ACCOUNT_OPEN)·개설(openAccount). 같은 시도를 재시도하면 같은 멱등키를 쓴다. */
export function useOpenAccount() {
  const { openAccount: mockOpen } = useStore();
  const key = useRef(newIdempotencyKey());
  const fn = useCallback(async () => {
    const [products, terms] = await Promise.all([listAccountProducts(), listTerms("ACCOUNT_OPEN")]);
    return { product: products[0] ?? null as AccountProduct | null, terms: terms.map((t): OpenTerm => ({ id: String(t.id), req: t.required, label: t.title, content: t.content })) };
  }, []);
  const live = useAccountLoad(fn, IS_LIVE);

  const open = async (i: OpenInput): Promise<Account> => {
    if (!IS_LIVE) { await new Promise((r) => setTimeout(r, 800)); return mockOpen(i.alias); }
    const p = live.data?.product;
    if (!p) throw new Error("no product");
    const a = await openAccount({
      productId: p.id, accountPassword: i.password, nickname: i.alias || undefined,
      openingInfo: { purpose: i.purpose, fundSource: i.fundSource },
      agreements: (live.data?.terms ?? []).map((t) => ({ termId: Number(t.id), agreed: !!i.agreed[t.id] })),
    }, key.current);
    key.current = newIdempotencyKey();
    return a;
  };

  if (!IS_LIVE) return { product: { id: 0, name: "IAN 입출금통장", rate: 0.1, description: "" } as AccountProduct | null, terms: MOCK_TERMS, loading: false, error: null as string | null, retry: async () => {}, open };
  return { product: live.data?.product ?? null, terms: live.data?.terms ?? [], loading: live.loading, error: live.error, retry: live.refresh, open };
}
