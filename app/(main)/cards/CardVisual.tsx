import type { Card } from "@/lib/types";
import { CARD_STATUS_LABEL, won } from "@/lib/format";
import s from "./card.module.css";

// components.css의 ian-card는 해지를 CANCELED 코드로 스타일링한다
const VISUAL = { ACTIVE: "ACTIVE", SUSPENDED: "SUSPENDED", LOST: "LOST", REISSUED: "REISSUED", CLOSED: "CANCELED" } as const;

/** 10,000 단위면 "50만원", 아니면 "12,500원" */
export const limitLabel = (n: number) => (n >= 10000 && n % 10000 === 0 ? `${won(n / 10000)}만원` : `${won(n)}원`);

/** 체크카드 비주얼. 카드번호는 끝 4자리만 보여 준다. */
export function CardVisual({ card, alias }: { card: Card; alias: string }) {
  return (
    <div
      className="ian-card"
      data-status={VISUAL[card.status]}
      role="img"
      aria-label={`${card.name}, 끝 4자리 ${card.last4}, ${CARD_STATUS_LABEL[card.status]}, 연결 계좌 ${alias}`}
    >
      <div className="ian-row ian-row--between">
        <b>IAN 체크{card.network ? ` · ${card.network}` : ""}</b>
        <span className={`ian-badge ${s.tag} ${card.status === "LOST" ? s.tagLost : ""}`}>{CARD_STATUS_LABEL[card.status]}</span>
      </div>
      <div className="ian-card__num">•••• •••• •••• {card.last4}</div>
      <div className="ian-card__meta">
        <span>{alias} 연결{card.expiry ? ` · 유효 ${card.expiry}` : ""}</span>
        <span className="ian-num">일 한도 {limitLabel(card.dailyLimit)}</span>
      </div>
    </div>
  );
}
