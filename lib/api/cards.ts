import { api, call, type components } from "./client";
import type { Card, CardPayment, CardStatus } from "@/lib/types";

type ApiCard = components["schemas"]["Card"];
type ApiPayment = components["schemas"]["CardPayment"];

const STATUS: Record<NonNullable<ApiCard["status"]>, CardStatus> = { ACTIVE: "ACTIVE", SUSPENDED: "SUSPENDED", LOST: "LOST", REISSUED: "REISSUED", CANCELED: "CLOSED" };

/** 카드번호는 끝 4자리만 내려온다. 재발급 후속 카드(replacedBy)는 목록에서 이어 붙인다(toCards). */
export const toCard = (c: ApiCard): Card => ({
  id: c.id ?? "",
  accountId: c.accountId ?? "",
  last4: c.cardNumLast4 ?? "",
  name: "IAN 체크카드",
  status: STATUS[c.status ?? "ACTIVE"] ?? "ACTIVE",
  dailyLimit: c.dailyLimit ?? 0,
  overseas: c.overseasEnabled ?? false,
  issuedAt: c.createdAt ?? "",
  network: c.cardNetwork,
  expiry: c.expiryDate,
});

/** reissuedFromId 는 새 카드 쪽에만 있어서, 이전 카드의 replacedBy 를 거꾸로 채운다. */
export const toCards = (items: ApiCard[]): Card[] =>
  items.map((c) => ({ ...toCard(c), replacedBy: items.find((n) => n.reissuedFromId === c.id)?.id }));

export const toPayment = (cardId: string, p: ApiPayment): CardPayment => ({
  id: String(p.id ?? ""), cardId, merchant: p.place ?? "", amount: p.amount ?? 0, requestedAt: p.requestAt ?? "", completedAt: p.completeAt ?? undefined,
});

export const listCards = async () => toCards((await call(api.GET("/cards"))).items ?? []);

export const getCard = async (cardId: string) => toCard(await call(api.GET("/cards/{cardId}", { params: { path: { cardId } } })));

export const issueCard = async (body: { accountId: string; dailyLimit: number; overseasEnabled: boolean }, idempotencyKey: string) =>
  toCard(await call(api.POST("/cards", { params: { header: { "Idempotency-Key": idempotencyKey } }, body })));

export const updateCardSettings = async (cardId: string, body: { dailyLimit?: number; overseasEnabled?: boolean }) =>
  toCard(await call(api.PATCH("/cards/{cardId}", { params: { path: { cardId } }, body })));

export async function listCardPayments(cardId: string, page: number, size = 20) {
  const r = await call(api.GET("/cards/{cardId}/payments", { params: { path: { cardId }, query: { page, size } } }));
  return { items: (r.items ?? []).map((p) => toPayment(cardId, p)), total: r.totalElements ?? 0 };
}

export const suspendCard = async (cardId: string) => toCard(await call(api.POST("/cards/{cardId}/suspend", { params: { path: { cardId } } })));

// 명세상 요청 본문이 없다(PIN 필드 없음).
export const reportCardLost = async (cardId: string, idempotencyKey: string) =>
  toCard(await call(api.POST("/cards/{cardId}/report-lost", { params: { path: { cardId }, header: { "Idempotency-Key": idempotencyKey } } })));

export const reissueCard = async (cardId: string, idempotencyKey: string) =>
  toCard(await call(api.POST("/cards/{cardId}/reissue", { params: { path: { cardId }, header: { "Idempotency-Key": idempotencyKey } } })));
