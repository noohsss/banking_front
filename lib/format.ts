export const won = (n: number) => n.toLocaleString("ko-KR");
export const wonUnit = (n: number) => `${won(n)}원`;
export const signed = (type: "IN" | "OUT", n: number) => `${type === "IN" ? "+" : "−"}${won(n)}원`;

/** 123-4567-8901 → 123-••••-8901 */
export const maskAccount = (num: string) => {
  const p = num.split("-");
  return p.length === 3 ? `${p[0]}-••••-${p[2]}` : num;
};
export const last4 = (num: string) => num.slice(-4);

const d = (iso: string) => new Date(iso);
export const fmtDate = (iso: string) => { const x = d(iso); return `${x.getFullYear()}.${String(x.getMonth() + 1).padStart(2, "0")}.${String(x.getDate()).padStart(2, "0")}`; };
export const fmtTime = (iso: string) => { const x = d(iso); return `${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`; };
export const fmtDay = (iso: string) => { const x = d(iso); return `${x.getMonth() + 1}월 ${x.getDate()}일`; };
export const dayKey = (iso: string) => iso.slice(0, 10);
export const uid = (p = "id") => `${p}_${Math.random().toString(36).slice(2, 9)}`;

export const ACCOUNT_STATUS_LABEL = { ACTIVE: "정상", SUSPENDED: "거래중지", CLOSED: "해지" } as const;
export const CARD_STATUS_LABEL = { ACTIVE: "정상", SUSPENDED: "정지", LOST: "분실", REISSUED: "재발급됨", CLOSED: "해지" } as const;
export const TRANSFER_STATUS_LABEL = { PENDING: "처리중", SUCCESS: "완료", FAILED: "실패" } as const;
