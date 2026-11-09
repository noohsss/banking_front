import { api, call, newIdempotencyKey, type components } from "./client";
import type { Account } from "../types";

type S = components["schemas"];

/** 목록(AccountSummary)은 마스킹 번호만 온다. 한도·개설일·금리는 상세/한도 API에서 채운다(여기선 0/""). */
export const mapSummary = (a: S["AccountSummary"]): Account => ({
  id: a.id ?? "", number: a.accountNumMasked ?? "", product: a.productName ?? "", alias: a.nickname || a.productName || "", balance: a.balance ?? 0,
  status: a.status ?? "ACTIVE", favorite: !!a.isFavorite, dailyLimit: 0, monthlyLimit: 0, openedAt: "", rate: 0,
});

/** 상세(Account)는 전체 계좌번호를 준다 → 복사 버튼은 이 번호를 써야 한다. */
export const mapAccount = (a: S["Account"]): Account => ({
  id: a.id ?? "", number: a.accountNum ?? "", product: a.product?.productName ?? "", alias: a.nickname || a.product?.productName || "", balance: a.balance ?? 0,
  status: a.status ?? "ACTIVE", favorite: !!a.isFavorite, dailyLimit: a.dailyLimit ?? 0, monthlyLimit: a.monthLimit ?? 0, openedAt: a.createdAt ?? "", rate: a.product?.interestRate ?? 0,
});

export interface AccountProduct { id: number; name: string; rate: number; description: string }
export const listAccountProducts = async (): Promise<AccountProduct[]> => {
  const r = await call(api.GET("/account-products"));
  return (r.items ?? []).map((p) => ({ id: p.id ?? 0, name: p.productName ?? "", rate: p.interestRate ?? 0, description: p.description ?? "" }));
};

export const listAccounts = async (): Promise<Account[]> => (await call(api.GET("/accounts"))).items?.map(mapSummary) ?? [];
export const getAccount = async (accountId: string): Promise<Account> => mapAccount(await call(api.GET("/accounts/{accountId}", { params: { path: { accountId } } })));

export interface OpenAccountInput {
  productId: number; accountPassword: string; nickname?: string;
  openingInfo: { purpose: string; [k: string]: unknown };
  agreements: { termId: number; agreed: boolean }[];
}
/** 통장 비밀번호는 본문으로만 보낸다. 재시도(같은 시도)는 같은 키를 넘길 것. */
export const openAccount = async (i: OpenAccountInput, idempotencyKey = newIdempotencyKey()): Promise<Account> =>
  mapAccount(await call(api.POST("/accounts", {
    params: { header: { "Idempotency-Key": idempotencyKey } },
    body: { productId: i.productId, accountPassword: i.accountPassword, accountPasswordConfirm: i.accountPassword, nickname: i.nickname || undefined, openingInfo: i.openingInfo, agreements: i.agreements },
  })));

export const updateAccount = async (accountId: string, p: { nickname?: string; isFavorite?: boolean }): Promise<Account> =>
  mapAccount(await call(api.PATCH("/accounts/{accountId}", { params: { path: { accountId } }, body: p })));

export interface TransferLimits { dailyLimit: number; monthlyLimit: number; dailyUsed: number; monthlyUsed: number; dailyRemaining: number; monthlyRemaining: number }
const mapLimits = (l: S["TransferLimits"]): TransferLimits => ({
  dailyLimit: l.dailyLimit ?? 0, monthlyLimit: l.monthLimit ?? 0, dailyUsed: l.dailyUsed ?? 0, monthlyUsed: l.monthUsed ?? 0,
  dailyRemaining: l.dailyRemaining ?? 0, monthlyRemaining: l.monthRemaining ?? 0,
});
export const getTransferLimits = async (accountId: string): Promise<TransferLimits> =>
  mapLimits(await call(api.GET("/accounts/{accountId}/limits", { params: { path: { accountId } } })));
/** PIN은 본문으로 보낸다. 틀리면 403 PIN_INVALID. */
export const updateTransferLimits = async (accountId: string, dailyLimit: number, monthlyLimit: number, pin: string): Promise<TransferLimits> =>
  mapLimits(await call(api.PUT("/accounts/{accountId}/limits", { params: { path: { accountId } }, body: { dailyLimit, monthLimit: monthlyLimit, pin } })));

export const unlockAccount = async (accountId: string, verificationId: number): Promise<Account> =>
  mapAccount(await call(api.POST("/accounts/{accountId}/unlock", { params: { path: { accountId } }, body: { verificationId } })));

export interface CloseEligibility { eligible: boolean; reasons: string[]; hasCard: boolean; hasAuto: boolean }
export const getCloseEligibility = async (accountId: string): Promise<CloseEligibility> => {
  const r = await call(api.GET("/accounts/{accountId}/close-eligibility", { params: { path: { accountId } } }));
  return { eligible: !!r.eligible, reasons: r.reasons ?? [], hasCard: !!r.hasActiveCard, hasAuto: !!r.hasActiveAutoTransfer };
};
export const closeAccount = async (accountId: string, pin: string, idempotencyKey = newIdempotencyKey()): Promise<Account> =>
  mapAccount(await call(api.POST("/accounts/{accountId}/close", { params: { path: { accountId }, header: { "Idempotency-Key": idempotencyKey } }, body: { pin } })));

export type StatementStatus = "접수됨" | "발송완료" | "실패";
export interface StatementRequest { id: string; from: string; to: string; email: string; status: StatementStatus }
const STATEMENT_LABEL: Record<S["StatementStatus"], StatementStatus> = { REQUESTED: "접수됨", SENT: "발송완료", FAILED: "실패" };
const mapStatement = (s: S["StatementRequest"]): StatementRequest => ({ id: String(s.id ?? ""), from: s.fromDate ?? "", to: s.toDate ?? "", email: s.email ?? "", status: STATEMENT_LABEL[s.status ?? "REQUESTED"] });
export const listStatementRequests = async (accountId: string, page = 0, size = 20): Promise<StatementRequest[]> =>
  (await call(api.GET("/accounts/{accountId}/statement-requests", { params: { path: { accountId }, query: { page, size } } }))).items?.map(mapStatement) ?? [];
export const createStatementRequest = async (accountId: string, fromDate: string, toDate: string): Promise<StatementRequest> =>
  mapStatement(await call(api.POST("/accounts/{accountId}/statement-requests", { params: { path: { accountId } }, body: { fromDate, toDate } })));
