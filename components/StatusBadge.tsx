import type { AccountStatus, CardStatus, TransferStatus } from "@/lib/types";
import { ACCOUNT_STATUS_LABEL, CARD_STATUS_LABEL, TRANSFER_STATUS_LABEL } from "@/lib/format";

const A = { ACTIVE: "ok", SUSPENDED: "warn", CLOSED: "muted" } as const;
const C = { ACTIVE: "ok", SUSPENDED: "warn", LOST: "danger", REISSUED: "info", CLOSED: "muted" } as const;
const T = { PENDING: "warn", SUCCESS: "ok", FAILED: "danger" } as const;

/** 상태는 색만으로 구분하지 않고 모양(점/마름모/네모/빈 원)+문구로 함께 표시한다 */
export function StatusBadge(p: { account: AccountStatus } | { card: CardStatus } | { transfer: TransferStatus }) {
  if ("account" in p) return <span className={`ian-badge ian-badge--${A[p.account]}`}>{ACCOUNT_STATUS_LABEL[p.account]}</span>;
  if ("card" in p) return <span className={`ian-badge ian-badge--${C[p.card]}`}>{CARD_STATUS_LABEL[p.card]}</span>;
  return <span className={`ian-badge ian-badge--${T[p.transfer]}`}>{TRANSFER_STATUS_LABEL[p.transfer]}</span>;
}
