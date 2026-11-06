"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { IS_LIVE } from "@/lib/api/mode";
import { useAccounts } from "@/lib/services/useAccounts";
import { useTransferLimits } from "@/lib/services/useAccount";
import { maskAccount, wonUnit, won } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import type { Account } from "@/lib/types";
import css from "./home.module.css";

type Phase = "loading" | "ok" | "error";

function Balance({ n, big }: { n: number; big?: boolean }) {
  return <div className={big ? "ian-t-hero" : "ian-t-amount"}>{won(n)}<span className="ian-unit">원</span></div>;
}

export default function HomePage() {
  const s = useStore();
  const { accounts, loading: aLoading, error: aError, refresh } = useAccounts();
  // mock: 로딩 표시만 짧게 흉내 낸다. live: 실제 loading/error를 쓴다.
  const [mockPhase, setMockPhase] = useState<Phase>("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (IS_LIVE) return;
    const t = setTimeout(() => setMockPhase("ok"), 350);
    return () => clearTimeout(t);
  }, [attempt]);

  const phase: Phase = IS_LIVE ? (aLoading ? "loading" : aError ? "error" : "ok") : mockPhase;
  const retry = () => { if (IS_LIVE) { void refresh(); return; } setMockPhase("loading"); setAttempt((a) => a + 1); };

  const sorted = useMemo<Account[]>(() => {
    const rank = (a: Account) => (a.status === "CLOSED" ? 2 : a.favorite ? 0 : 1);
    return [...accounts].sort((a, b) => rank(a) - rank(b));
  }, [accounts]);

  const main = sorted.find((a) => a.status !== "CLOSED") ?? sorted[0];
  const rest = sorted.filter((a) => a.id !== main?.id);
  const { limits } = useTransferLimits(main?.id);

  // 카드·자동이체는 다른 도메인이라 live에서는 개수 대신 안내 문구만 쓴다.
  const cardCount = !IS_LIVE && main ? s.cards.filter((c) => c.accountId === main.id && c.status !== "CLOSED" && c.status !== "REISSUED").length : 0;
  const autoCount = !IS_LIVE && main ? s.autos.filter((x) => x.fromId === main.id && x.active).length : 0;
  const dailyLimit = limits?.dailyLimit ?? 0;
  const used = limits?.dailyUsed ?? 0;
  const left = Math.max(0, dailyLimit - used);
  const pct = dailyLimit > 0 ? Math.min(100, Math.round((used / dailyLimit) * 100)) : 0;

  return (
    <>
      <div className="ian-appbar ian-appbar--left">
        <h1 className={css.greet}>{s.user ? `안녕하세요, ${s.user.name}님` : "안녕하세요"}</h1>
        <Link href="/accounts/new" className="ian-iconbtn" aria-label="계좌 개설">+</Link>
      </div>
      <div className="ian-screen__body">
        {phase === "loading" && (
          <div className="ian-stack" role="status" aria-label="계좌를 불러오는 중이에요">
            <div className={`ian-skel ${css.skelHero}`} />
            <div className="ian-bento"><div className={`ian-skel ${css.skelTile}`} /><div className={`ian-skel ${css.skelTile}`} /></div>
            <div className={`ian-skel ${css.skelRow}`} />
          </div>
        )}

        {phase === "error" && (
          <div className="ian-notice ian-notice--danger" role="alert">
            <div>
              <b className="ian-notice__title">계좌를 불러오지 못했어요</b>
              {IS_LIVE && aError ? aError : "네트워크 상태를 확인하고 다시 시도해 주세요."}
              <div style={{ marginTop: "var(--ian-s-3)" }}><button type="button" className="ian-btn ian-btn--danger-soft ian-btn--sm" onClick={retry}>다시 불러오기</button></div>
            </div>
          </div>
        )}

        {phase === "ok" && !main && (
          <div className="ian-empty">
            <div className="ian-t-title2">아직 계좌가 없어요</div>
            <p className="ian-t-caption">입출금 계좌를 열면 이체와 카드를 바로 쓸 수 있어요. 3분이면 끝나요.</p>
            <Link href="/accounts/new" className="ian-btn ian-btn--primary">계좌 개설하기</Link>
          </div>
        )}

        {phase === "ok" && main && (
          <>
            <div className="ian-bento">
              <Link
                href={`/accounts/${main.id}`}
                className={`ian-tile ian-tile--wide ${css.heroTile} ${main.status === "CLOSED" ? "" : "ian-tile--brand"}`}
                data-status={main.status === "ACTIVE" ? undefined : main.status}
                aria-label={`${main.alias} 계좌 상세 보기`}
              >
                <div className={css.row}>
                  <span className={css.alias}>{main.favorite && <span aria-hidden="true">★</span>}{main.alias}{main.favorite && <span className="ian-sr">즐겨찾기</span>}</span>
                  {main.status !== "ACTIVE" && <StatusBadge account={main.status} />}
                </div>
                <div>
                  <Balance n={main.balance} big />
                  <div className="ian-acct" style={{ marginTop: 8 }}>{maskAccount(main.number)}</div>
                </div>
              </Link>

              <Link href="/transfer" className="ian-tile ian-tile--accent">
                <span className="ian-t-title2">이체</span><span className="ian-tile__sub">받는 분과 금액 입력</span>
              </Link>
              <Link href={`/accounts/${main.id}`} className="ian-tile ian-tile--tint">
                <span className="ian-t-title2">거래내역</span><span className="ian-tile__sub">3개월 · 전체</span>
              </Link>
              <Link href="/cards" className="ian-tile ian-tile--ink">
                <span className="ian-t-title2">카드</span><span className="ian-tile__sub">{IS_LIVE ? "카드 신청·관리" : cardCount > 0 ? `체크카드 ${cardCount}장` : "체크카드 신청하기"}</span>
              </Link>
              <Link href="/auto-transfers" className="ian-tile ian-tile--sun">
                <span className="ian-t-title2">자동이체</span><span className="ian-tile__sub">{IS_LIVE ? "자동이체 관리" : autoCount > 0 ? `실행 예정 ${autoCount}건` : "등록된 자동이체 없음"}</span>
              </Link>

              {main.status === "ACTIVE" ? (
                <div className="ian-tile ian-tile--wide" style={{ minHeight: 0 }}>
                  <div className="ian-row ian-row--between"><b>오늘 쓸 수 있는 한도</b><span className="ian-t-caption">{wonUnit(left)} 남음</span></div>
                  <div className="ian-meter" data-level={pct >= 80 ? "high" : undefined}>
                    <div className="ian-meter__bar" role="meter" aria-label="오늘 이체한도 사용률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                      <i style={{ "--v": `${pct}%` } as React.CSSProperties} />
                    </div>
                    <div className="ian-row ian-row--between ian-t-micro"><span>사용 {wonUnit(used)}</span><span>1일 {wonUnit(dailyLimit)}</span></div>
                  </div>
                </div>
              ) : (
                <div className="ian-notice ian-notice--warn ian-tile--wide">
                  <div>
                    <b className="ian-notice__title">{main.status === "SUSPENDED" ? "거래가 중지된 계좌예요" : "해지된 계좌예요"}</b>
                    {main.status === "SUSPENDED" ? "계좌 관리에서 이메일 인증으로 해제할 수 있어요." : "거래내역은 계속 조회할 수 있어요."}
                  </div>
                </div>
              )}
            </div>

            {rest.length > 0 && (
              <section aria-labelledby="home-others">
                <div className="ian-section-head"><b id="home-others" className="ian-t-title2">다른 계좌</b><span className="ian-t-caption">{rest.length}개</span></div>
                <div className="ian-stack">
                  {rest.map((a) => (
                    <Link key={a.id} href={`/accounts/${a.id}`} className={`ian-tile ian-tile--wide ${css.listTile}`} data-status={a.status === "ACTIVE" ? undefined : a.status} aria-label={`${a.alias} 계좌 상세 보기`}>
                      <div className={css.row}>
                        <span className={css.alias}>{a.favorite && <span aria-hidden="true">★</span>}{a.alias}{a.favorite && <span className="ian-sr">즐겨찾기</span>}</span>
                        {a.status !== "ACTIVE" && <StatusBadge account={a.status} />}
                      </div>
                      <div className={css.row}>
                        <span className="ian-acct">{maskAccount(a.number)}</span>
                        <Balance n={a.balance} />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <Link href="/accounts/new" className="ian-btn ian-btn--soft ian-btn--block">+ 새 계좌 개설</Link>
          </>
        )}
      </div>
    </>
  );
}
