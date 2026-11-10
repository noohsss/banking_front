"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppBar } from "@/components/AppBar";
import { CHAT_MAX_CHARS, modeAvailable, useAssistant, type ChatMode, type ChatTurn } from "@/lib/services/useAssistant";
import { spendingDelta } from "@/lib/assistantUtil";
import { maskAccount, won, wonUnit } from "@/lib/format";
import s from "./assistant.module.css";

const SOURCE_LABEL = { TERM: "약관", PRODUCT: "상품", FAQ: "FAQ" } as const;

const MODES: { id: ChatMode; label: string; placeholder: string; hint: string }[] = [
  { id: "KNOWLEDGE", label: "약관·상품 질문", placeholder: "예: 체크카드 분실하면 어떻게 해요?", hint: "약관·상품·자주 묻는 질문을 바탕으로 답해요." },
  { id: "SPENDING", label: "소비 분석", placeholder: "이번 달 얼마 썼어?", hint: "내 거래 내역을 기간별로 모아 보여 줘요. 예: 이번 달 얼마 썼어?" },
  { id: "TRANSFER", label: "이체 도와줘", placeholder: "홍길동 계좌 110-1234-5678에 5만원 보내줘", hint: "이체 초안만 만들어 줘요. 실제 이체는 이체 화면에서 PIN과 통장 비밀번호를 직접 입력해야 해요." },
];
const PERIOD_LABEL = { THIS_MONTH: "이번 달", LAST_MONTH: "지난달", LAST_30_DAYS: "최근 30일", LAST_3_MONTHS: "최근 3개월" } as const;

function InsightCard({ insight: i }: { insight: NonNullable<ChatTurn["insight"]> }) {
  const { diff, pct } = spendingDelta(i.totalOut, i.previousTotalOut);
  const max = Math.max(1, ...i.byCategory.map((c) => c.amount));
  const delta = diff === 0 ? "직전 기간과 같아요" : `직전 기간보다 ${wonUnit(Math.abs(diff))}${pct != null ? ` (${Math.abs(pct)}%)` : ""} ${diff > 0 ? "늘었어요" : "줄었어요"}`;
  return (
    <section className={s.card} aria-label="소비 요약">
      <h3 className={s.cardTitle}>{PERIOD_LABEL[i.period]} 소비 <span className={s.cardSub}>{i.fromDate} ~ {i.toDate}</span></h3>
      <dl className={s.kv}>
        <div><dt>총 지출</dt><dd className="ian-num">{wonUnit(i.totalOut)}</dd></div>
        <div><dt>총 수입</dt><dd className="ian-num">{wonUnit(i.totalIn)}</dd></div>
      </dl>
      <p className={s.delta}>{delta}</p>
      {i.byCategory.length === 0 ? <p className={s.cardSub}>이 기간에 지출 내역이 없어요.</p> : (
        <ul className={s.bars} aria-label="카테고리별 지출">
          {i.byCategory.map((c) => (
            <li key={c.category} className={s.barRow}>
              <span className={s.barLabel}>{c.category}</span>
              <span className={s.track} aria-hidden="true"><span className={s.fill} style={{ width: `${Math.max(2, Math.round((c.amount / max) * 100))}%` }} /></span>
              <span className={`${s.barAmt} ian-num`}>{won(c.amount)}원 · {c.count}건</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DraftCard({ draft: d, onOpen }: { draft: NonNullable<ChatTurn["draft"]>; onOpen: () => void }) {
  return (
    <section className={s.card} aria-label="이체 초안">
      <h3 className={s.cardTitle}>이체 초안</h3>
      <dl className={s.list2}>
        <div><dt>출금 계좌</dt><dd>{d.fromAccountLabel}</dd></div>
        <div><dt>받는 분</dt><dd>{d.toHolderNameMasked} · {maskAccount(d.toAccountNum)}</dd></div>
        <div><dt>금액</dt><dd className="ian-num">{wonUnit(d.amount)}</dd></div>
        {d.memo && <div><dt>메모</dt><dd>{d.memo}</dd></div>}
      </dl>
      <p className={s.cardSub}>PIN과 통장 비밀번호는 이체 화면에서 직접 입력해요</p>
      <button type="button" className="ian-btn ian-btn--primary" onClick={onOpen}>이체 화면에서 확인하기</button>
    </section>
  );
}

export default function AssistantPage() {
  const router = useRouter();
  const { mode, setMode, turns, sending, error, send, handOffDraft } = useAssistant();
  const cur = MODES.find((m) => m.id === mode)!;
  const available = modeAvailable(mode);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView?.({ block: "end" }); }, [turns, sending, error]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim() || sending || !available) return;
    const q = text; setText("");
    // 실패하면 입력을 되돌려 다시 보낼 수 있게 한다
    if (!(await send(q))) setText((cur) => cur || q);
  };

  return (
    <div className="ian-screen">
      <AppBar title="AI 도우미" />
      <div className="ian-screen__body">
        <div role="group" aria-label="도우미 기능" className={s.chips}>
          {MODES.map((m) => (
            <button key={m.id} type="button" className="ian-chip" style={{ minHeight: 48 }} aria-pressed={m.id === mode} onClick={() => { setMode(m.id); setText(""); }}>{m.label}</button>
          ))}
        </div>
        {!available && <div className="ian-notice" role="status"><div>데모 모드에서는 쓸 수 없어요</div></div>}
        <div className="ian-notice"><div>{cur.hint} 중요한 내용은 출처와 약관 원문으로 꼭 확인해 주세요. 질문은 외부 AI 서비스로 전달되니 계좌번호·비밀번호·실명 같은 개인정보는 입력하지 마세요.</div></div>
        <div className={s.list} role="log" aria-live="polite" aria-label="대화">
          {turns.map((t, i) => (
            <div key={i} className={`${s.row} ${t.role === "user" ? s.mine : s.theirs}`}>
              <p className={s.bubble}><span className={s.sr}>{t.role === "user" ? "내 질문: " : "도우미 답변: "}</span>{t.content}</p>
              {t.insight && <InsightCard insight={t.insight} />}
              {t.draft && <DraftCard draft={t.draft} onOpen={() => { if (handOffDraft(t.draft!)) router.push("/transfer"); }} />}
              {!!t.sources?.length && (
                <ul className={s.sources} aria-label="출처">
                  {t.sources.map((x) => <li key={x.ref} className={s.source}>{SOURCE_LABEL[x.source]} · {x.title}</li>)}
                </ul>
              )}
            </div>
          ))}
          {sending && <div className={`${s.row} ${s.theirs}`}><p className={s.bubble} role="status" aria-busy="true">답변을 찾고 있어요…</p></div>}
        </div>
        {error && <div className="ian-notice ian-notice--danger" role="alert"><div>{error}</div></div>}
        {/* 하단 입력창(약 170px)에 가려지지 않게 끝 지점을 그 높이만큼 위로 맞춘다 */}
        <div ref={endRef} style={{ scrollMarginBottom: 184 }} />
      </div>
      <form className="ian-screen__footer" onSubmit={submit}>
        <div className="ian-field">
          <label className="ian-field__label" htmlFor="chat-q">궁금한 점을 물어보세요</label>
          <div className="ian-field--inline">
            <input id="chat-q" className="ian-input" value={text} maxLength={CHAT_MAX_CHARS} onChange={(e) => setText(e.target.value)} placeholder={cur.placeholder} disabled={!available} autoComplete="off" enterKeyHint="send" aria-describedby="chat-count" />
            <button type="submit" className="ian-btn ian-btn--primary" disabled={!text.trim() || sending || !available} aria-busy={sending}>보내기</button>
          </div>
          <span id="chat-count" className={`ian-field__hint ${s.count}`}>{text.length}/{CHAT_MAX_CHARS}</span>
        </div>
      </form>
    </div>
  );
}
