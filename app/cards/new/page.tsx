"use client";
import { Suspense, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppBar } from "@/components/AppBar";
import { Stepper } from "@/components/Stepper";
import { useAccounts } from "@/lib/services/useAccounts";
import { useIssueCard } from "@/lib/services/useCards";
import { ApiError, errorMessage } from "@/lib/api/errors";
import type { Card } from "@/lib/types";
import { maskAccount, won, wonUnit } from "@/lib/format";
import { CardVisual } from "@/app/(main)/cards/CardVisual";
import s from "./new.module.css";

const DEFAULT_LIMIT = 500000;
const MAX_LIMIT = 1000000;

const limitError = (text: string): string | null => {
  if (!text) return "일일 사용한도를 입력해 주세요.";
  const n = Number(text);
  if (!Number.isInteger(n) || n < 1) return "1원 이상의 금액을 입력해 주세요.";
  if (n > MAX_LIMIT) return "한도는 최대 1,000,000원까지 정할 수 있어요. 금액을 줄여 주세요.";
  return null;
};

function IssueForm() {
  const { accounts, loading, error, refresh } = useAccounts();
  const issueCard = useIssueCard();
  const query = useSearchParams().get("account");
  const active = accounts.filter((a) => a.status === "ACTIVE");

  const [step, setStep] = useState<"form" | "confirm" | "done">("form");
  const [picked, setPicked] = useState<string | null>(null);
  const [limitText, setLimitText] = useState(String(DEFAULT_LIMIT));
  const [limitErr, setLimitErr] = useState<string | null>(null);
  const [overseas, setOverseas] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [issued, setIssued] = useState<Card | null>(null);
  const busyRef = useRef(false);

  const accountId = picked ?? (query && active.some((a) => a.id === query) ? query : active.length === 1 ? active[0].id : null);
  const account = active.find((a) => a.id === accountId);

  const next = () => {
    const e = limitError(limitText);
    setLimitErr(e);
    if (!e && account) setStep("confirm");
  };

  const submit = async () => {
    if (busyRef.current || !account) return;
    busyRef.current = true; setBusy(true); setSubmitErr(null);
    try {
      const fresh = active.find((a) => a.id === account.id);
      if (!fresh) {
        setSubmitErr("연결하려는 계좌가 정상 상태가 아니에요. 다른 계좌를 선택해 주세요.");
        setStep("form"); setPicked(null);
      } else {
        setIssued(await issueCard({ accountId: account.id, dailyLimit: Number(limitText), overseas }));
        setStep("done");
      }
    } catch (e) {
      setSubmitErr(errorMessage(e));
      if (e instanceof ApiError && e.is("ACCOUNT_STATE_NOT_ALLOWED")) { setStep("form"); setPicked(null); void refresh(); }
    } finally { busyRef.current = false; setBusy(false); }
  };

  if (step === "done") {
    const card = issued;
    const resultId = issued?.id;
    return (
      <div className="ian-screen">
        <AppBar title="체크카드 발급" hideBack />
        <div className="ian-screen__body">
          <div className="ian-result" data-state="success">
            <div className="ian-result__mark" aria-hidden="true" />
            <h1 className="ian-t-title1" tabIndex={-1} ref={(el) => el?.focus()}>체크카드를 발급했어요</h1>
            <p className="ian-result__desc">바로 사용할 수 있어요. 카드는 {account?.alias ?? "선택한 계좌"}에 연결됐어요.</p>
          </div>
          {card && <CardVisual card={card} alias={account?.alias ?? "연결 계좌"} />}
        </div>
        <div className="ian-screen__footer">
          <Link href={`/cards/${resultId}`} className="ian-btn ian-btn--primary ian-btn--block">카드 확인하기</Link>
          <Link href="/cards" className="ian-btn ian-btn--soft ian-btn--block">카드 목록 보기</Link>
        </div>
      </div>
    );
  }

  if (loading || error) {
    return (
      <div className="ian-screen">
        <AppBar title="체크카드 발급" />
        <div className="ian-screen__body">
          {loading ? <p className="ian-t-caption" role="status">계좌를 불러오고 있어요</p> : (
            <div className="ian-empty" role="alert">
              <b className="ian-t-title2">계좌를 불러오지 못했어요</b>
              <span className="ian-t-caption">{error}</span>
              <button className="ian-btn ian-btn--primary ian-btn--sm" onClick={() => void refresh()}>다시 시도</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (active.length === 0) {
    return (
      <div className="ian-screen">
        <AppBar title="체크카드 발급" />
        <div className="ian-screen__body">
          <div className="ian-empty">
            <b className="ian-t-title2">카드를 연결할 계좌가 없어요</b>
            <span className="ian-t-caption">체크카드는 정상 상태의 입출금 계좌에만 연결할 수 있어요. 계좌를 먼저 개설해 주세요.</span>
            <Link href="/accounts/new" className="ian-btn ian-btn--primary ian-btn--sm">계좌 개설하기</Link>
          </div>
        </div>
      </div>
    );
  }

  if (step === "confirm" && account) {
    return (
      <div className="ian-screen">
        <AppBar title="발급 신청 확인" onBack={() => setStep("form")} />
        <div className="ian-screen__body">
          <Stepper total={2} current={1} />
          <div>
            <h1 className="ian-t-title1">이 내용으로 발급할까요?</h1>
            <p className="ian-t-caption" style={{ marginTop: 4 }}>신청하면 바로 카드가 만들어져요.</p>
          </div>
          <div className="ian-receipt">
            <dl className="ian-receipt__rows" style={{ borderTop: 0, paddingTop: 0 }}>
              <div className="ian-receipt__row"><dt>연결 계좌</dt><dd>{account.alias}<br /><span className="ian-num ian-t-caption">{maskAccount(account.number)}</span></dd></div>
              <div className="ian-receipt__row"><dt>카드 종류</dt><dd>IAN 체크카드</dd></div>
              <div className="ian-receipt__row"><dt>해외결제</dt><dd>{overseas ? "허용" : "허용 안 함"}</dd></div>
              <div className="ian-receipt__row ian-receipt__row--total"><dt>일일 사용한도</dt><dd>{wonUnit(Number(limitText))}</dd></div>
            </dl>
          </div>
          <p className="ian-t-caption">카드번호는 발급 후 끝 4자리만 보여요.</p>
          {submitErr && <div className="ian-notice ian-notice--danger" role="alert"><div>{submitErr}</div></div>}
        </div>
        <div className="ian-screen__footer">
          <button className="ian-btn ian-btn--primary ian-btn--block" onClick={submit} aria-busy={busy} aria-disabled={busy}>{busy ? "발급하고 있어요" : "발급 신청하기"}</button>
          <button className="ian-btn ian-btn--soft ian-btn--block" onClick={() => setStep("form")} disabled={busy}>수정하기</button>
        </div>
      </div>
    );
  }

  const limitNum = Number(limitText);
  return (
    <div className="ian-screen">
      <AppBar title="체크카드 발급" />
      <div className="ian-screen__body">
        <Stepper total={2} current={0} />
        <h1 className="ian-t-title1">카드를 연결할 계좌와 한도를 정해 주세요</h1>
        {submitErr && <div className="ian-notice ian-notice--danger" role="alert"><div>{submitErr}</div></div>}

        <section aria-labelledby="acc-h" className="ian-stack">
          <h2 id="acc-h" className="ian-field__label">연결 계좌<span className="ian-req" aria-hidden="true">*</span></h2>
          <div className={s.opts} role="radiogroup" aria-labelledby="acc-h">
            {active.map((a) => (
              <button
                key={a.id} type="button" role="radio" aria-checked={a.id === accountId}
                className={`ian-menu__item ${s.opt}`} onClick={() => setPicked(a.id)}
              >
                <span className={s.optMark} aria-hidden="true" />
                <span className="ian-menu__main">{a.alias}<span className="ian-menu__sub ian-num">{maskAccount(a.number)} · 잔액 {wonUnit(a.balance)}</span></span>
                {a.id === accountId && <span className="ian-sr">선택됨</span>}
              </button>
            ))}
          </div>
        </section>

        <div className="ian-field">
          <label className="ian-field__label" htmlFor="limit">일일 사용한도<span className="ian-req" aria-hidden="true">*</span></label>
          <div className={s.limitWrap}>
            <input
              id="limit" className={`ian-input ${s.limitInput}`} inputMode="numeric" autoComplete="off"
              value={limitText ? won(Number(limitText) || 0) : ""} placeholder="500,000"
              aria-invalid={limitErr ? true : undefined} aria-describedby={limitErr ? "limit-err" : "limit-hint"}
              onChange={(e) => { const v = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 9); setLimitText(v); if (limitErr) setLimitErr(limitError(v)); }}
              onBlur={() => setLimitErr(limitError(limitText))}
            />
            <span className={s.won} aria-hidden="true">원</span>
          </div>
          {limitErr ? <span id="limit-err" className="ian-field__error" role="alert">{limitErr}</span> : <span id="limit-hint" className="ian-field__hint">기본 500,000원, 최대 1,000,000원까지 정할 수 있어요.</span>}
          <div className="ian-quick" role="group" aria-label="한도 빠른 선택">
            {[300000, 500000, 1000000].map((v) => (
              <button key={v} type="button" className="ian-chip" aria-pressed={limitNum === v} onClick={() => { setLimitText(String(v)); setLimitErr(null); }}>{won(v / 10000)}만원</button>
            ))}
          </div>
        </div>

        <label className={`ian-row ian-row--between ${s.fixedRow}`}>
          <span className={s.grow}>
            <span className="ian-t-body" style={{ fontWeight: 700 }}>해외결제 허용</span>
            <span className="ian-t-caption" style={{ display: "block" }} id="ov-hint">{overseas ? "해외 가맹점에서도 결제돼요." : "지금은 해외 가맹점 결제가 막혀 있어요."}</span>
          </span>
          <span className="ian-switch">
            <input type="checkbox" role="switch" checked={overseas} onChange={(e) => setOverseas(e.target.checked)} aria-describedby="ov-hint" aria-label="해외결제 허용" />
            <span className="ian-switch__track" /><span className="ian-switch__thumb" />
          </span>
        </label>
      </div>
      <div className="ian-screen__footer">
        <button className="ian-btn ian-btn--primary ian-btn--block" onClick={next} disabled={!account}>{account ? "다음" : "연결 계좌를 선택해 주세요"}</button>
      </div>
    </div>
  );
}

/** SCR-012 체크카드 발급 */
export default function NewCardPage() {
  return <Suspense fallback={null}><IssueForm /></Suspense>;
}
