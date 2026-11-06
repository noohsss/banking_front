import { api, call, type components } from "./client";
import type { Transfer } from "@/lib/types";

type ApiTransfer = components["schemas"]["Transfer"];

/** 서버는 수취인 번호·예금주를 마스킹해 내려준다. UI 타입의 toNumber/toName에 마스킹된 값을 그대로 담는다. */
export const toTransfer = (t: ApiTransfer): Transfer => ({
  id: t.id ?? "",
  fromId: t.fromAccountId ?? "",
  toNumber: t.toAccountNumMasked ?? "",
  toName: t.toHolderNameMasked ?? "",
  amount: t.amount ?? 0,
  memo: t.memo ?? "",
  at: t.completeAt ?? t.requestAt ?? "",
  status: t.status ?? "PENDING",
  failReason: t.failReason ?? undefined,
});

/** 수취 계좌 확인. 없는 계좌면 ApiError(RECIPIENT_NOT_FOUND). 예금주는 마스킹돼 온다. */
export const lookupAccount = async (accountNum: string) => {
  const r = await call(api.GET("/accounts/lookup", { params: { query: { accountNum } } }));
  return r.holderNameMasked ?? "";
};

export const listTransfers = async (q: { accountId?: string; status?: Transfer["status"]; page?: number; size?: number } = {}) =>
  ((await call(api.GET("/transfers", { params: { query: q } }))).items ?? []).map(toTransfer);

/** PIN은 본문으로만 보낸다. 같은 시도를 재전송할 때는 같은 idempotencyKey를 써야 중복 이체가 안 생긴다. */
export const createTransfer = async (body: { fromAccountId: string; toAccountNum: string; amount: number; memo?: string; pin: string }, idempotencyKey: string) =>
  toTransfer(await call(api.POST("/transfers", { params: { header: { "Idempotency-Key": idempotencyKey } }, body })));

export const getTransfer = async (transferId: string) =>
  toTransfer(await call(api.GET("/transfers/{transferId}", { params: { path: { transferId } } })));
