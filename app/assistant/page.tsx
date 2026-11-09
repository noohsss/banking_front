"use client";
import { useEffect, useRef, useState } from "react";
import { AppBar } from "@/components/AppBar";
import { CHAT_MAX_CHARS, useAssistant } from "@/lib/services/useAssistant";
import s from "./assistant.module.css";

const SOURCE_LABEL = { TERM: "약관", PRODUCT: "상품", FAQ: "FAQ" } as const;

export default function AssistantPage() {
  const { turns, sending, error, send } = useAssistant();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView?.({ block: "end" }); }, [turns, sending, error]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim() || sending) return;
    const q = text; setText("");
    // 실패하면 입력을 되돌려 다시 보낼 수 있게 한다
    if (!(await send(q))) setText((cur) => cur || q);
  };

  return (
    <div className="ian-screen">
      <AppBar title="AI 도우미" />
      <div className="ian-screen__body">
        <div className="ian-notice"><div>약관·상품·자주 묻는 질문을 바탕으로 답해요. 중요한 내용은 출처와 약관 원문으로 꼭 확인해 주세요. 질문은 외부 AI 서비스로 전달되니 계좌번호·비밀번호·실명 같은 개인정보는 입력하지 마세요.</div></div>
        <div className={s.list} role="log" aria-live="polite" aria-label="대화">
          {turns.map((t, i) => (
            <div key={i} className={`${s.row} ${t.role === "user" ? s.mine : s.theirs}`}>
              <p className={s.bubble}><span className={s.sr}>{t.role === "user" ? "내 질문: " : "도우미 답변: "}</span>{t.content}</p>
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
        <div ref={endRef} />
      </div>
      <form className="ian-screen__footer" onSubmit={submit}>
        <div className="ian-field">
          <label className="ian-field__label" htmlFor="chat-q">궁금한 점을 물어보세요</label>
          <div className="ian-field--inline">
            <input id="chat-q" className="ian-input" value={text} maxLength={CHAT_MAX_CHARS} onChange={(e) => setText(e.target.value)} autoComplete="off" enterKeyHint="send" aria-describedby="chat-count" />
            <button type="submit" className="ian-btn ian-btn--primary" disabled={!text.trim() || sending} aria-busy={sending}>보내기</button>
          </div>
          <span id="chat-count" className={`ian-field__hint ${s.count}`}>{text.length}/{CHAT_MAX_CHARS}</span>
        </div>
      </form>
    </div>
  );
}
