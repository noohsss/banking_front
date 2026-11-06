"use client";
import Link from "next/link";
import { AppBar } from "@/components/AppBar";
import { useAccounts } from "@/lib/services/useAccounts";
import { useCards } from "@/lib/services/useCards";
import { CardVisual } from "./CardVisual";
import s from "./card.module.css";

/** SCR-008 카드 목록 */
export default function CardsPage() {
  const { cards, loading, error, refresh } = useCards();
  const { accounts } = useAccounts();
  const alias = (id: string) => accounts.find((a) => a.id === id)?.alias ?? "연결 계좌";
  const inactive = (st: string) => st === "REISSUED" || st === "CLOSED";
  const sorted = [...cards.filter((c) => !inactive(c.status)), ...cards.filter((c) => inactive(c.status))];

  return (
    <>
      <AppBar title="카드" hideBack />
      <div className="ian-screen__body">
        {loading ? (
          <p className="ian-t-caption" role="status">카드를 불러오고 있어요</p>
        ) : error ? (
          <div className="ian-empty" role="alert">
            <b className="ian-t-title2">카드를 불러오지 못했어요</b>
            <span className="ian-t-caption">{error}</span>
            <button className="ian-btn ian-btn--primary ian-btn--sm" onClick={() => void refresh()}>다시 시도</button>
          </div>
        ) : sorted.length === 0 ? (
          <div className="ian-empty">
            <b className="ian-t-title2">아직 체크카드가 없어요</b>
            <span className="ian-t-caption">내 계좌에 연결해서 바로 쓸 수 있는 체크카드를 발급해 보세요.</span>
            <Link href="/cards/new" className="ian-btn ian-btn--primary ian-btn--sm">체크카드 발급받기</Link>
          </div>
        ) : (
          <>
            <ul className={s.list} aria-label="내 체크카드">
              {sorted.map((c) => (
                <li key={c.id} className={inactive(c.status) ? s.dim : undefined}>
                  <Link href={`/cards/${c.id}`} className={s.item} aria-label={`${c.name} 끝 4자리 ${c.last4}, 상세 보기`}>
                    <CardVisual card={c} alias={alias(c.accountId)} />
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/cards/new" className="ian-btn ian-btn--soft ian-btn--block">체크카드 새로 발급받기</Link>
          </>
        )}
      </div>
    </>
  );
}
