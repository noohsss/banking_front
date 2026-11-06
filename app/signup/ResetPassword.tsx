"use client";
import { useRef, useState } from "react";
import { Sheet } from "@/components/Sheet";
import { useAuth } from "@/lib/services/useAuth";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { TextField, checkEmail, checkPw } from "./fields";

/** live 전용 비밀번호 재설정: 이메일 인증(RESET_PW) → 새 비밀번호. 로그인 화면·메뉴 공용. */
export function ResetPassword({ open, onClose, loginId: fixedId, email: fixedEmail }: { open: boolean; onClose: () => void; loginId?: string; email?: string }) {
  const { sendEmailCode, verifyEmailCode, resetPassword } = useAuth();
  const [f, setF] = useState({ loginId: fixedId ?? "", email: fixedEmail ?? "", code: "", pw: "", pw2: "" });
  const [vid, setVid] = useState<number | null>(null);
  const [verified, setVerified] = useState(false);
  const [done, setDone] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const set = (k: keyof typeof f, v: string) => { setF((p) => ({ ...p, [k]: v })); setErrs((e) => ({ ...e, [k]: "" })); };
  const run = async (key: string, fn: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    try { await fn(); } catch (e) { setErrs((x) => ({ ...x, [key]: e instanceof ApiError && e.fields[key] ? e.fields[key] : errorMessage(e) })); }
    busyRef.current = false; setBusy(false);
  };

  const send = () => {
    if (!f.loginId.trim()) { setErrs((x) => ({ ...x, loginId: "아이디를 입력해 주세요." })); return; }
    const e = checkEmail(f.email); if (e) { setErrs((x) => ({ ...x, email: e })); return; }
    run("email", async () => { setVid(await sendEmailCode(f.email.trim(), "RESET_PW")); setVerified(false); });
  };
  const verify = () => {
    if (!/^\d{6}$/.test(f.code)) { setErrs((x) => ({ ...x, code: "인증번호 6자리를 숫자로 입력해 주세요." })); return; }
    run("code", async () => { await verifyEmailCode(vid!, f.code); setVerified(true); });
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const er = { pw: checkPw(f.pw), pw2: f.pw === f.pw2 ? "" : "비밀번호가 서로 달라요. 다시 확인해 주세요." };
    if (er.pw || er.pw2) { setErrs(er); return; }
    run("pw", async () => { await resetPassword(f.loginId.trim(), vid!, f.pw); setDone(true); });
  };

  return (
    <Sheet open={open} onClose={onClose} label="비밀번호 재설정">
      <form className="ian-stack" onSubmit={submit} noValidate style={{ gap: "var(--ian-s-4)" }} aria-busy={busy}>
        <h2 className="ian-t-title2" style={{ margin: 0 }}>비밀번호 재설정</h2>
        {done ? (
          <>
            <div className="ian-notice" role="status"><div>비밀번호를 바꿨어요. 새 비밀번호로 로그인해 주세요.</div></div>
            <button type="button" className="ian-btn ian-btn--primary ian-btn--block" onClick={onClose}>확인</button>
          </>
        ) : (
          <>
            {!fixedId && <TextField id="rp-id" label="아이디" value={f.loginId} onChange={(e) => set("loginId", e.target.value.toLowerCase())} autoCapitalize="none" spellCheck={false} autoComplete="username" disabled={verified} error={errs.loginId} />}
            <div className="ian-field">
              <label className="ian-field__label" htmlFor="rp-email">가입한 이메일</label>
              <div className="ian-field--inline">
                <input id="rp-email" className="ian-input" type="email" inputMode="email" autoComplete="email" value={f.email} readOnly={!!fixedEmail} disabled={verified} aria-invalid={errs.email ? true : undefined}
                  onChange={(e) => { set("email", e.target.value); setVid(null); }} />
                <button type="button" className="ian-btn ian-btn--soft" onClick={send} disabled={busy || verified}>{vid !== null ? "다시 받기" : "인증번호 받기"}</button>
              </div>
              {errs.email && <span className="ian-field__error" role="alert">{errs.email}</span>}
            </div>
            {vid !== null && (
              <div className="ian-field">
                <label className="ian-field__label" htmlFor="rp-code">인증번호 6자리</label>
                <div className="ian-field--inline">
                  <input id="rp-code" className="ian-input ian-num" inputMode="numeric" maxLength={6} autoComplete="one-time-code" value={f.code} disabled={verified} aria-invalid={errs.code ? true : undefined}
                    onChange={(e) => set("code", e.target.value.replace(/\D/g, ""))} />
                  <button type="button" className="ian-btn ian-btn--soft" onClick={verify} disabled={busy || verified}>확인</button>
                </div>
                {verified ? <span className="ian-badge ian-badge--ok" role="status" style={{ justifySelf: "start" }}>✓ 이메일 인증 완료</span> : errs.code && <span className="ian-field__error" role="alert">{errs.code}</span>}
              </div>
            )}
            {verified && (
              <>
                <TextField id="rp-pw" label="새 비밀번호" type="password" autoComplete="new-password" value={f.pw} onChange={(e) => set("pw", e.target.value)} hint="8자 이상, 영문·숫자·특수문자를 모두 넣어 주세요." error={errs.pw} />
                <TextField id="rp-pw2" label="새 비밀번호 확인" type="password" autoComplete="new-password" value={f.pw2} onChange={(e) => set("pw2", e.target.value)} error={errs.pw2} />
              </>
            )}
            <div className="ian-row"><button type="button" className="ian-btn ian-btn--outline" style={{ flex: 1 }} onClick={onClose}>취소</button><button type="submit" className="ian-btn ian-btn--primary" style={{ flex: 2 }} disabled={busy || !verified}>{busy ? "처리하고 있어요" : "비밀번호 바꾸기"}</button></div>
          </>
        )}
      </form>
    </Sheet>
  );
}
