import type { AppState } from "./types";

const t = (s: string) => `2026-${s}:00+09:00`;

export const SEED_PIN = "123456";
export const SEED_LOGIN = { id: "minsu", pw: "ian1234!" };

export const seedState = (): AppState => ({
  user: null,
  members: [],
  accounts: [
    { id: "a1", number: "123-4567-8901", product: "IAN 입출금통장", alias: "생활비", balance: 1284500, status: "ACTIVE", favorite: true, dailyLimit: 1000000, monthlyLimit: 5000000, openedAt: t("03-02T10:12"), rate: 0.1 },
    { id: "a2", number: "123-4567-2234", product: "IAN 입출금통장", alias: "월세 통장", balance: 12400, status: "SUSPENDED", favorite: false, dailyLimit: 1000000, monthlyLimit: 5000000, openedAt: t("06-18T14:03"), rate: 0.1 },
    { id: "a3", number: "123-4567-7780", product: "IAN 입출금통장", alias: "여행 모으기", balance: 0, status: "ACTIVE", favorite: false, dailyLimit: 1000000, monthlyLimit: 5000000, openedAt: t("09-01T09:30"), rate: 0.1 },
  ],
  txs: [
    { id: "t1", accountId: "a1", at: t("11-04T18:21"), type: "OUT", amount: 12500, balanceAfter: 1284500, counterparty: "스타벅스 강남점", memo: "", kind: "카드결제" },
    { id: "t2", accountId: "a1", at: t("11-03T20:40"), type: "OUT", amount: 50000, balanceAfter: 1297000, counterparty: "엄마", memo: "용돈", kind: "이체" },
    { id: "t3", accountId: "a1", at: t("11-02T09:02"), type: "IN", amount: 1200000, balanceAfter: 1347000, counterparty: "(주)멀티캠퍼스", memo: "10월 급여", kind: "입금" },
    { id: "t4", accountId: "a1", at: t("11-01T08:00"), type: "OUT", amount: 450000, balanceAfter: 147000, counterparty: "월세 통장", memo: "월세", kind: "자동이체" },
    { id: "t5", accountId: "a1", at: t("10-29T13:15"), type: "OUT", amount: 8900, balanceAfter: 597000, counterparty: "GS25 역삼점", memo: "", kind: "카드결제" },
    { id: "t6", accountId: "a1", at: t("10-27T19:45"), type: "IN", amount: 30000, balanceAfter: 605900, counterparty: "현우", memo: "점심값", kind: "입금" },
    { id: "t7", accountId: "a1", at: t("10-22T12:30"), type: "OUT", amount: 15000, balanceAfter: 575900, counterparty: "지우", memo: "", kind: "이체" },
    { id: "t8", accountId: "a2", at: t("11-01T08:00"), type: "IN", amount: 450000, balanceAfter: 12400, counterparty: "생활비", memo: "월세", kind: "입금" },
  ],
  cards: [
    { id: "c1", accountId: "a1", last4: "4821", name: "IAN 체크카드", status: "ACTIVE", dailyLimit: 500000, overseas: false, issuedAt: t("03-05T11:00") },
  ],
  payments: [
    { id: "p1", cardId: "c1", merchant: "스타벅스 강남점", amount: 12500, requestedAt: t("11-04T18:21"), completedAt: t("11-04T18:21") },
    { id: "p2", cardId: "c1", merchant: "GS25 역삼점", amount: 8900, requestedAt: t("10-29T13:15"), completedAt: t("10-29T13:15") },
    { id: "p3", cardId: "c1", merchant: "배달의민족", amount: 23800, requestedAt: t("10-25T20:02"), completedAt: t("10-25T20:03") },
  ],
  recipients: [
    { id: "r1", alias: "엄마", number: "110-2345-6789", name: "김영숙", favorite: true },
    { id: "r2", alias: "현우", number: "110-9876-5432", name: "박현우", favorite: true },
    { id: "r3", alias: "지우", number: "110-1122-3344", name: "이지우", favorite: false },
  ],
  transfers: [],
  autos: [
    { id: "au1", fromId: "a1", toNumber: "123-4567-2234", toName: "월세 통장", amount: 450000, cycle: "MONTHLY", runDay: "1", startDate: "2026-03-01", active: true },
  ],
});

/** 수취 계좌 조회용 가짜 서비스 계좌 (본 서비스 계좌만 이체 가능) */
export const SERVICE_DIRECTORY: Record<string, string> = {
  "110-2345-6789": "김영숙",
  "110-9876-5432": "박현우",
  "110-1122-3344": "이지우",
  "123-4567-2234": "김민수",
  "123-4567-7780": "김민수",
  "110-5555-0001": "최서연",
};
