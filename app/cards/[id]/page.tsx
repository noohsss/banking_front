"use client";
import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AppBar } from "@/components/AppBar";
import { PinPad } from "@/components/PinPad";
import { Sheet } from "@/components/Sheet";
import { useStore } from "@/lib/store";
import { fmtDate, fmtDay, fmtTime, dayKey, won, wonUnit } from "@/lib/format";
import { CardVisual } from "@/app/(main)/cards/CardVisual";
import s from "./detail.module.css";

type Kind = "limit" | "lost" | "suspend" | "resume" | "reissue";
const MAX_LIMIT = 1000000;

const limitError = (text: string): string | null => {
  if (!text) return "바꿀 한도를 입력해 주세요.";
  const n = Number(text);
  if (!Number.isInteger(n) || n < 1) return "1원 이상의 금액을 입력해 주세요.";
  if (n > MAX_LIMIT) return "한도는 최대 1,000,000원까지 정할 수 있어요. 금액을 줄여 주세요.";
  return null;
};

/** SCR-011 카드 상세·관리 (이 Next.js 버전에서 params는 Promise라서 use()로 푼다) */
export default function CardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { cards, accounts, payments, checkPin, patchCard, reissueCard } = useStore();
  const card = cards.find((c) => c.id === id);
  const alias = accounts.find((a) => a.id === card?.accountId)?.alias ?? "연결 계좌";

  const [sheet, setSheet] = useState<Kind | null>(null);
  const [step, setStep] = useState<"form" | "pin">("form");
  const [limitText, setLimitText] = useState("");
  const [limitErr, setLimitErr] = useState<string | null>(null);
  const [pinError, setPinError] = useState(false);
  const [notice, setNotice] = useState<{ text: string; href?: string; link?: string } | null>(null);
  const [hl, setHl] = useState<string | null>(null);
  const busy = useRef(false);

  // 시트는 앱 셸 맨 아래에 붙으므로 열릴 때 화면 아래로 내려서 보이게 한다
  useEffect(() => { if (sheet) window.scrollTo({ top: document.documentElement.scrollHeight }); }, [sheet, step]);

  if (!card) {
    return (
      <div className="ian-screen">
        <AppBar title="카드 상세" />
        <div className="ian-screen__body">
          <div className="ian-empty">
            <b className="ian-t-title2">카드를 찾을 수 없어요</b>
            <span className="ian-t-caption">삭제됐거나 내 카드가 아닌 주소예요. 카드 목록에서 다시 선택해 주세요.</span>
            <Link href="/cards" className="ian-btn ian-btn--primary ian-btn--sm">카드 목록으로</Link>
          </div>
        </div>
      </div>
    );
  }

  const st = card.status;
  const canEdit = st === "ACTIVE" || st === "SUSPENDED";
  const canLost = canEdit;
  const canReissue = st === "ACTIVE" || st === "SUSPENDED" || st === "LOST";
  const myPays = payments.filter((p) => p.cardId === card.id).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  const recent = myPays.slice(0, 3);
  const days = [...new Set(myPays.map((p) => dayKey(p.requestedAt)))];

  const open = (k: Kind) => { setSheet(k); setStep("form"); setPinError(false); setLimitErr(null); setLimitText(String(card.dailyLimit)); };
  const close = () => setSheet(null);

  const finish = (kind: Kind) => {
    if (busy.current) return; busy.current = true;
    if (kind === "limit") { patchCard(card.id, { dailyLimit: Number(limitText) }); setNotice({ text: `일일 사용한도를 ${wonUnit(Number(limitText))}으로 바꿨어요.` }); }
    if (kind === "lost") { patchCard(card.id, { status: "LOST" }); setNotice({ text: "분실 신고를 접수했어요. 이 카드는 더 이상 쓸 수 없어요." }); }
    if (kind === "suspend") { patchCard(card.id, { status: "SUSPENDED" }); setNotice({ text: "카드를 정지했어요. 정지를 풀 때까지 결제할 수 없어요." }); }
    if (kind === "resume") { patchCard(card.id, { status: "ACTIVE" }); setNotice({ text: "정지를 풀었어요. 다시 결제할 수 있어요." }); }
    if (kind === "reissue") { const nc = reissueCard(card.id); setNotice({ text: "새 카드를 발급했어요. 이 카드는 재발급됨으로 바뀌었어요.", href: `/cards/${nc.id}`, link: "새 카드 보기" }); }
    close(); busy.current = false;
  };

  const onPin = (pin: string) => {
    if (!sheet) return;
    if (!checkPin(pin)) { setPinError(true); setTimeout(() => setPinError(false), 700); return; }
    finish(sheet);
  };

  const nextLimit = () => { const e = limitError(limitText); setLimitErr(e); if (!e) setStep("pin"); };
  const showPay = (pid: string) => { setHl(pid); document.getElementById(`pay-${pid}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); };

  const noticeBox = {
    SUSPENDED: <div className="ian-notice ian-notice--warn"><div><b className="ian-notice__title">정지된 카드예요</b>정지를 풀기 전에는 결제할 수 없어요. 한도와 해외결제는 바꿀 수 있어요.</div></div>,
    LOST: <div className="ian-notice ian-notice--danger"><div><b className="ian-notice__title">분실 신고된 카드예요</b>결제와 설정 변경이 모두 막혀 있어요. 새 카드가 필요하면 재발급을 신청해 주세요.</div></div>,
    REISSUED: <div className="ian-notice"><div><b className="ian-notice__title">재발급되어 쓸 수 없는 카드예요</b>설정을 바꿀 수 없어요. 새 카드를 사용해 주세요.{card.replacedBy && <> <Link href={`/cards/${card.replacedBy}`} className="ian-link">새 카드 보기</Link></>}</div></div>,
    CLOSED: <div className="ian-notice"><div><b className="ian-notice__title">해지된 카드예요</b>설정을 바꿀 수 없어요. 사용내역은 계속 볼 수 있어요.</div></div>,
    ACTIVE: null,
  }[st];

  return (
    <div className="ian-screen">
      <AppBar title="카드 상세" />
      <div className="ian-screen__body">
        <CardVisual card={card} alias={alias} />

        <div className={s.live} role="status" aria-live="polite">
          {notice && <div className="ian-notice"><div>{notice.text}{notice.href && <> <Link href={notice.href} className="ian-link">{notice.link}</Link></>}</div></div>}
        </div>
        {noticeBox}

        <section aria-labelledby="set-h">
          <div className="ian-section-head"><h2 id="set-h" className="ian-t-title2">카드 설정</h2></div>
          <div className="ian-menu">
            {canEdit ? (
              <button className="ian-menu__item" data-chev onClick={() => open("limit")}>
                <span className="ian-menu__main">일일 사용한도<span className="ian-menu__sub ian-num">{wonUnit(card.dailyLimit)} · 눌러서 변경</span></span>
              </button>
            ) : (
              <div className={`ian-menu__item ${s.static}`}><span className="ian-menu__main">일일 사용한도<span className="ian-menu__sub ian-num">{wonUnit(card.dailyLimit)}</span></span></div>
            )}
            {canEdit ? (
              <label className="ian-menu__item">
                <span className="ian-menu__main">해외결제<span className="ian-menu__sub" id="ov-sub">{card.overseas ? "켜짐 · 해외 가맹점에서 결제돼요" : "꺼짐 · 해외 가맹점 결제가 막혀 있어요"}</span></span>
                <span className="ian-switch">
                  <input type="checkbox" role="switch" aria-label="해외결제" aria-describedby="ov-sub" checked={card.overseas}
                    onChange={(e) => { patchCard(card.id, { overseas: e.target.checked }); setNotice({ text: e.target.checked ? "해외결제를 켰어요." : "해외결제를 껐어요." }); }} />
                  <span className="ian-switch__track" /><span className="ian-switch__thumb" />
                </span>
              </label>
            ) : (
              <div className={`ian-menu__item ${s.static}`}><span className="ian-menu__main">해외결제<span className="ian-menu__sub">{card.overseas ? "켜짐" : "꺼짐"} · 이 상태에서는 바꿀 수 없어요</span></span></div>
            )}
          </div>
        </section>

        {(canEdit || canReissue) && (
          <section aria-labelledby="act-h">
            <div className="ian-section-head"><h2 id="act-h" className="ian-t-title2">카드 관리</h2></div>
            <div className={s.actions}>
              {st === "ACTIVE" && <button className="ian-btn ian-btn--soft ian-btn--block" onClick={() => open("suspend")}>카드 정지</button>}
              {st === "SUSPENDED" && <button className="ian-btn ian-btn--primary ian-btn--block" onClick={() => open("resume")}>정지 해제</button>}
              {canReissue && <button className="ian-btn ian-btn--soft ian-btn--block" onClick={() => open("reissue")}>재발급 신청</button>}
              {canLost && <button className="ian-btn ian-btn--danger-soft ian-btn--block" onClick={() => open("lost")}>분실 신고</button>}
            </div>
          </section>
        )}

        <section aria-labelledby="al-h">
          <div className="ian-section-head"><h2 id="al-h" className="ian-t-title2">결제 알림</h2><span className="ian-t-caption">최근 3건</span></div>
          {recent.length === 0 ? (
            <div className="ian-empty"><b>새 결제 알림이 없어요</b><span className="ian-t-caption">카드를 쓰면 여기에 알려 드려요.</span></div>
          ) : (
            <div className="ian-menu">
              {recent.map((p) => (
                <button key={p.id} className="ian-menu__item" data-chev onClick={() => showPay(p.id)}>
                  <span className="ian-menu__main">
                    {p.completedAt ? `${p.merchant}에서 ${wonUnit(p.amount)} 결제했어요` : `${p.merchant} ${wonUnit(p.amount)} 결제를 처리하고 있어요`}
                    <span className="ian-menu__sub ian-num">{fmtDate(p.requestedAt)} {fmtTime(p.requestedAt)}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="his-h">
          <div className="ian-section-head"><h2 id="his-h" className="ian-t-title2">사용내역</h2></div>
          {myPays.length === 0 ? (
            <div className="ian-empty"><b>사용내역이 아직 없어요</b><span className="ian-t-caption">카드로 결제하면 가맹점과 금액이 쌓여요.</span></div>
          ) : (
            <div className="ian-timeline" role="list">
              {days.map((d) => (
                <div key={d} style={{ display: "contents" }}>
                  <div className="ian-timeline__day">{fmtDay(d)}</div>
                  {myPays.filter((p) => dayKey(p.requestedAt) === d).map((p) => (
                    <div key={p.id} id={`pay-${p.id}`} role="listitem" className={`ian-tx ${s.pay} ${hl === p.id ? s.hl : ""}`} data-dir="OUT">
                      <span className="ian-tx__icon" aria-hidden="true">−</span>
                      <span className="ian-tx__who">{p.merchant}</span>
                      <span className="ian-tx__amt">{won(p.amount)}원</span>
                      <span className="ian-tx__meta ian-num">
                        {p.completedAt
                          ? `요청 ${fmtTime(p.requestedAt)} · 완료 ${fmtTime(p.completedAt)}`
                          : <><span className="ian-badge ian-badge--warn">처리중</span> 요청 {fmtTime(p.requestedAt)}</>}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <Sheet open={sheet !== null} onClose={close} label={sheet === "limit" ? "일일 사용한도 변경" : sheet === "lost" ? "분실 신고" : sheet === "suspend" ? "카드 정지" : sheet === "resume" ? "정지 해제" : "재발급 신청"}>
        {sheet === "limit" && step === "form" && (
          <>
            <h2 className={`ian-t-title2 ${s.sheetTitle}`}>일일 사용한도 변경</h2>
            <div className="ian-field">
              <label className="ian-field__label" htmlFor="new-limit">바꿀 한도</label>
              <div className={s.limitWrap}>
                <input id="new-limit" className={`ian-input ${s.limitInput}`} inputMode="numeric" autoComplete="off"
                  value={limitText ? won(Number(limitText) || 0) : ""}
                  aria-invalid={limitErr ? true : undefined} aria-describedby={limitErr ? "new-limit-err" : "new-limit-hint"}
                  onChange={(e) => { const v = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 9); setLimitText(v); if (limitErr) setLimitErr(limitError(v)); }} />
                <span className={s.won} aria-hidden="true">원</span>
              </div>
              {limitErr ? <span id="new-limit-err" className="ian-field__error" role="alert">{limitErr}</span> : <span id="new-limit-hint" className="ian-field__hint">지금은 {wonUnit(card.dailyLimit)}이에요. 최대 1,000,000원까지 정할 수 있어요.</span>}
            </div>
            <button className="ian-btn ian-btn--primary ian-btn--block" onClick={nextLimit}>PIN으로 확인하기</button>
          </>
        )}
        {sheet === "lost" && step === "form" && (
          <>
            <h2 className={`ian-t-title2 ${s.sheetTitle}`}>끝 4자리 {card.last4} 카드를 분실 신고할까요?</h2>
            <div className="ian-notice ian-notice--danger"><div><b className="ian-notice__title">신고하면 되돌릴 수 없어요</b>이 카드는 바로 결제가 막히고 다시 쓸 수 없어요. 새 카드는 재발급으로 받을 수 있어요.</div></div>
            <button className="ian-btn ian-btn--danger ian-btn--block" onClick={() => setStep("pin")}>분실 신고하기</button>
            <button className="ian-btn ian-btn--soft ian-btn--block" onClick={close}>취소</button>
          </>
        )}
        {(sheet === "suspend" || sheet === "resume" || sheet === "reissue") && (
          <>
            <h2 className={`ian-t-title2 ${s.sheetTitle}`}>{sheet === "suspend" ? "카드를 정지할까요?" : sheet === "resume" ? "정지를 풀까요?" : "새 카드를 재발급할까요?"}</h2>
            <p className="ian-t-caption">
              {sheet === "suspend" && "정지하는 동안 결제할 수 없어요. 언제든지 정지를 풀 수 있어요."}
              {sheet === "resume" && "풀면 바로 다시 결제할 수 있어요."}
              {sheet === "reissue" && "새 카드번호가 만들어지고 지금 카드는 재발급됨으로 바뀌어 더 이상 쓸 수 없어요. 한도와 해외결제 설정은 그대로 이어져요."}
            </p>
            <button className="ian-btn ian-btn--primary ian-btn--block" onClick={() => finish(sheet)}>{sheet === "suspend" ? "카드 정지하기" : sheet === "resume" ? "정지 해제하기" : "재발급 신청하기"}</button>
            <button className="ian-btn ian-btn--soft ian-btn--block" onClick={close}>취소</button>
          </>
        )}
        {step === "pin" && sheet && (
          <>
            <h2 className={`ian-t-title2 ${s.sheetTitle}`}>PIN을 입력해 주세요</h2>
            <p className="ian-t-caption">{sheet === "limit" ? `일일 사용한도를 ${wonUnit(Number(limitText))}으로 바꿔요.` : "분실 신고를 접수해요."}</p>
            <PinPad onComplete={onPin} error={pinError} label={pinError ? "PIN이 맞지 않아요. 다시 입력해 주세요." : "PIN 6자리를 입력해 주세요"} />
            <button className="ian-btn ian-btn--soft ian-btn--block" onClick={() => setStep("form")}>이전으로</button>
          </>
        )}
      </Sheet>
    </div>
  );
}
