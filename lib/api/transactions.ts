import { api, call, type components } from "./client";
import type { Tx, TxKind } from "../types";

type ApiTx = components["schemas"]["Transaction"];

/** 방향(IN/OUT)·유형 코드 → UI kind. TRANSFER 입금은 mock과 같이 "입금"으로 보여 준다. */
const kindOf = (t: ApiTx): TxKind => {
  const inn = t.transactionDirection === "IN";
  switch (t.transactionType) {
    case "DEPOSIT": return "입금";
    case "WITHDRAW": return "출금";
    case "TRANSFER": return inn ? "입금" : "이체";
    case "AUTO_TRANSFER": return "자동이체";
    case "CARD": return "카드결제";
    default: return inn ? "입금" : "출금";
  }
};

export const mapTx = (t: ApiTx): Tx => ({
  id: String(t.id ?? ""), accountId: t.accountId ?? "", at: t.transactionAt ?? "", type: t.transactionDirection ?? "OUT", amount: t.amount ?? 0,
  balanceAfter: t.newBalance ?? 0, counterparty: t.counterpartyName || t.counterpartyAccount || "", memo: t.memo ?? "", kind: kindOf(t),
});

export interface TxQuery {
  from?: string; to?: string;                 // YYYY-MM-DD
  direction?: "IN" | "OUT";                   // 미지정 = 전체
  minAmount?: number; maxAmount?: number;
  counterparty?: string; memo?: string;
  sort?: "latest" | "oldest";
  page?: number; size?: number;               // page는 0부터
}
export interface TxPage { items: Tx[]; page: number; size: number; total: number }

export const listTransactions = async (accountId: string, q: TxQuery = {}): Promise<TxPage> => {
  const r = await call(api.GET("/accounts/{accountId}/transactions", { params: { path: { accountId }, query: q } }));
  return { items: (r.items ?? []).map(mapTx), page: r.page ?? q.page ?? 0, size: r.size ?? q.size ?? 20, total: r.totalElements ?? 0 };
};

export const getTransaction = async (accountId: string, transactionId: number): Promise<Tx> =>
  mapTx(await call(api.GET("/accounts/{accountId}/transactions/{transactionId}", { params: { path: { accountId, transactionId } } })));
