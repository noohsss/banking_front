"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/services/useAuth";
import { useTerms } from "@/lib/services/useTerms";
import { IS_LIVE } from "@/lib/api/mode";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { Sheet } from "@/components/Sheet";
import { AppBar } from "@/components/AppBar";
import { PinPad } from "@/components/PinPad";
import { Stepper } from "@/components/Stepper";
import { TextField, checkEmail, checkId, checkName, checkPhone, checkPw, fmtPhone } from "./fields";

const TOTAL = 5;
const TITLES = ["약관에 동의해 주세요", "기본 정보를 알려 주세요", "로그인에 쓸 아이디와 비밀번호를 만들어 주세요", "PIN 6자리를 만들어 주세요", "PIN을 한 번 더 눌러 주세요"];

// 서버 오류 필드명 → [입력 키, 단계]
const FIELD_MAP: Record<string, [string, number]> = {
  userName: ["name", 1], email: ["email", 1], phoneNum: ["phone", 1], birth: ["birth", 1], verificationId: ["code", 1],
  loginId: ["loginId", 2], password: ["pw", 2], passwordConfirm: ["pw2", 2], pin: ["pin", 3], pinConfirm: ["pin", 3],
};
const CODE_MAP: Record<string, [string, number]> = {
  DUPLICATE_LOGIN_ID: ["loginId", 2], DUPLICATE_EMAIL: ["email", 1], DUPLICATE_PHONE: ["phone", 1], VERIFICATION_REQUIRED: ["code", 1], VERIFICATION_FAILED: ["code", 1], TERMS_NOT_AGREED: ["terms", 0],
};

export default function SignupPage() {
  const router = useRouter();
  const { signup, sendEmailCode, verifyEmailCode } = useAuth();
  const { data: terms, loading: termsLoading, error: termsError, refresh: reloadTerms } = useTerms();
  const [step, setStep] = useState(0);
  const [agreed, setAgreed] = useState<Record<number, boolean>>({});
  const [viewTerm, setViewTerm] = useState<number | null>(null);
  const [vid, setVid] = useState(0);
  const [f, setF] = useState({ name: "", email: "", phone: "", birth: "", code: "", loginId: "", pw: "", pw2: "" });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [pin1, setPin1] = useState("");
  const [pinErr, setPinErr] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => { const t = timers.current; return () => t.forEach(clearTimeout); }, []);
  const later = (fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)); };

  const set = (k: keyof typeof f, v: string) => { setF((p) => ({ ...p, [k]: v })); setErrs((e) => ({ ...e, [k]: "" })); };
  const reqCount = terms.filter((t) => t.required).length;
  const allReq = terms.length > 0 && terms.every((t) => !t.required || agreed[t.id]);
  const allOn = terms.length > 0 && terms.every((t) => agreed[t.id]);
  const toggleAll = () => { const v = !allOn; setAgreed(Object.fromEntries(terms.map((t) => [t.id, v]))); };
  const viewed = terms.find((t) => t.id === viewTerm);

  const guard = async (key: string, fn: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    try { await fn(); } catch (e) { setErrs((x) => ({ ...x, [key]: e instanceof ApiError && e.fields[key] ? e.fields[key] : errorMessage(e) })); }
    busyRef.current = false; setBusy(false);
  };
  const sendCode = () => {
    const e = checkEmail(f.email);
    if (e) { setErrs((x) => ({ ...x, email: e })); return; }
    guard("email", async () => { setVid(await sendEmailCode(f.email.trim(), "SIGNUP")); setSent(true); setVerified(false); });
  };
  const verify = () => {
    if (!/^\d{6}$/.test(f.code)) { setErrs((x) => ({ ...x, code: "인증번호 6자리를 숫자로 입력해 주세요." })); return; }
    guard("code", async () => { await verifyEmailCode(vid, f.code); setVerified(true); setErrs((x) => ({ ...x, code: "" })); });
  };

  const next = () => {
    const e: Record<string, string> = {};
    if (step === 1) {
      e.name = checkName(f.name); e.email = checkEmail(f.email); e.phone = checkPhone(f.phone);
      if (!e.email && !verified) e.code = sent ? "인증번호를 입력하고 확인을 눌러 주세요." : "이메일 인증번호를 먼저 받아 주세요.";
    }
    if (step === 2) {
      e.loginId = checkId(f.loginId); e.pw = checkPw(f.pw);
      if (!e.pw && f.pw !== f.pw2) e.pw2 = "비밀번호가 서로 달라요. 다시 확인해 주세요.";
    }
    if (Object.values(e).some(Boolean)) { setErrs(e); return; }
    setErrs({}); setStep((s) => s + 1);
  };

  const onPin1 = (pin: string) => {
    if (/^(\d)\1{5}$/.test(pin)) { setPinErr("같은 숫자만 반복한 PIN은 쓸 수 없어요."); later(() => setPinErr(""), 900); return; }
    setPin1(pin); setErrs({}); setStep(4);
  };
  const onPin2 = async (pin: string) => {
    if (busyRef.current) return;
    if (pin !== pin1) { setPinErr("PIN이 서로 달라요. 다시 눌러 주세요."); later(() => setPinErr(""), 900); return; }
    busyRef.current = true; setBusy(true);
    if (!IS_LIVE) await new Promise<void>((res) => later(res, 400));
    try {
      await signup({ loginId: f.loginId, name: f.name.trim(), email: f.email.trim(), phone: f.phone, birth: f.birth || undefined, password: f.pw, pin, verificationId: vid, agreements: terms.map((t) => ({ termId: t.id, agreed: !!agreed[t.id] })) });
      router.replace("/login");
    } catch (x) {
      busyRef.current = false; setBusy(false);
      const next: Record<string, string> = {};
      let target = 3;
      if (x instanceof ApiError) {
        for (const fe of x.fieldErrors) { const m = FIELD_MAP[fe.field]; if (m) { next[m[0]] = fe.reason; target = Math.min(target, m[1]); } }
        const c = CODE_MAP[x.code];
        if (c && !Object.keys(next).length) { next[c[0]] = errorMessage(x); target = c[1]; }
        if (x.code === "VERIFICATION_REQUIRED" || x.code === "VERIFICATION_FAILED") setVerified(false);
      }
      if (!Object.keys(next).length) next.form = errorMessage(x);
      else if (next.terms) next.form = next.terms;
      setErrs(next); setPin1(""); setStep(target);
    }
  };

  const back = () => { if (busy) return; if (step === 0) router.back(); else { setPinErr(""); setStep(step - 1); } };

  return (
    <div className="ian-screen">
      <AppBar title="회원가입" onBack={back} />
      <div className="ian-screen__body">
        <Stepper total={TOTAL} current={step} />
        <h1 className="ian-t-title1" style={{ margin: 0 }}>{TITLES[step]}</h1>

        {errs.form && <div className="ian-notice ian-notice--danger" role="alert"><div>{errs.form}</div></div>}

        {step === 0 && (
          <div className="ian-stack" role="group" aria-label="약관 동의">
            {termsLoading && <p className="ian-t-body" role="status" style={{ margin: 0 }}>약관을 불러오고 있어요</p>}
            {termsError && <div className="ian-notice ian-notice--danger" role="alert"><div>{termsError}</div><button type="button" className="ian-btn ian-btn--soft ian-btn--sm" onClick={reloadTerms}>다시 불러오기</button></div>}
            {terms.length > 0 && (
              <>
                <label className="ian-check"><input type="checkbox" checked={allOn} onChange={toggleAll} /><span><b>전체 동의</b></span></label>
                <hr style={{ border: 0, borderTop: "1px solid var(--ian-fill)", margin: 0, width: "100%" }} />
                {terms.map((t) => (
                  <div key={t.id} className="ian-row ian-row--between">
                    <label className="ian-check">
                      <input type="checkbox" checked={!!agreed[t.id]} onChange={() => setAgreed((p) => ({ ...p, [t.id]: !p[t.id] }))} />
                      <span><span className={`ian-check__tag${t.required ? "" : " ian-check__tag--opt"}`}>{t.required ? "필수" : "선택"}</span>{t.title}</span>
                    </label>
                    <button type="button" className="ian-btn ian-btn--soft ian-btn--sm" onClick={() => setViewTerm(t.id)} aria-label={`${t.title} 내용 보기`}>보기</button>
                  </div>
                ))}
                {!allReq && <span className="ian-field__hint">필수 약관 {reqCount}개에 동의하면 다음으로 갈 수 있어요.</span>}
              </>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="ian-stack" style={{ gap: "var(--ian-s-5)" }}>
            <TextField id="su-name" label="이름" required value={f.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" error={errs.name} />
            <div className="ian-field">
              <label className="ian-field__label" htmlFor="su-email">이메일<span className="ian-req" aria-hidden="true">*</span></label>
              <div className="ian-field--inline">
                <input id="su-email" className="ian-input" type="email" inputMode="email" autoComplete="email" placeholder="name@example.com" value={f.email} aria-required="true" aria-invalid={errs.email ? true : undefined} aria-describedby={errs.email ? "su-email-err" : "su-email-hint"} disabled={verified}
                  onChange={(e) => { set("email", e.target.value); setSent(false); setVerified(false); }} />
                <button type="button" className="ian-btn ian-btn--soft" onClick={sendCode} disabled={verified || busy}>{sent ? "다시 받기" : "인증번호 받기"}</button>
              </div>
              {errs.email ? <span id="su-email-err" className="ian-field__error" role="alert">{errs.email}</span> : <span id="su-email-hint" className="ian-field__hint">인증번호를 이메일로 보내 드려요.{IS_LIVE ? "" : " 데모에서는 아무 숫자 6자리나 000000을 입력하세요."}</span>}
            </div>
            {sent && (
              <div className="ian-field">
                <label className="ian-field__label" htmlFor="su-code">인증번호 6자리</label>
                <div className="ian-field--inline">
                  <input id="su-code" className="ian-input ian-num" inputMode="numeric" maxLength={6} autoComplete="one-time-code" value={f.code} disabled={verified} aria-invalid={errs.code ? true : undefined} aria-describedby={errs.code ? "su-code-err" : undefined}
                    onChange={(e) => set("code", e.target.value.replace(/\D/g, ""))} />
                  <button type="button" className="ian-btn ian-btn--soft" onClick={verify} disabled={verified || busy}>확인</button>
                </div>
                {verified ? <span className="ian-badge ian-badge--ok" role="status" style={{ justifySelf: "start" }}>✓ 이메일 인증 완료</span> : errs.code && <span id="su-code-err" className="ian-field__error" role="alert">{errs.code}</span>}
              </div>
            )}
            {!sent && errs.code && <span className="ian-field__error" role="alert">{errs.code}</span>}
            <TextField id="su-phone" label="휴대폰 번호" required inputMode="numeric" autoComplete="tel" placeholder="010-0000-0000" value={f.phone} onChange={(e) => set("phone", fmtPhone(e.target.value))} error={errs.phone} />
            <TextField id="su-birth" label="생년월일 (선택)" type="date" max={new Date().toISOString().slice(0, 10)} value={f.birth} onChange={(e) => set("birth", e.target.value)} autoComplete="bday" />
          </div>
        )}

        {step === 2 && (
          <div className="ian-stack" style={{ gap: "var(--ian-s-5)" }}>
            <TextField id="su-id" label="아이디" required autoCapitalize="none" spellCheck={false} autoComplete="username" value={f.loginId} onChange={(e) => set("loginId", e.target.value.toLowerCase())} hint="영문 소문자와 숫자 4~16자" error={errs.loginId} />
            <TextField id="su-pw" label="비밀번호" required type="password" autoComplete="new-password" value={f.pw} onChange={(e) => set("pw", e.target.value)} hint="8자 이상, 영문·숫자·특수문자를 모두 넣어 주세요." error={errs.pw} />
            <TextField id="su-pw2" label="비밀번호 확인" required type="password" autoComplete="new-password" value={f.pw2} onChange={(e) => set("pw2", e.target.value)} error={errs.pw2} />
          </div>
        )}

        {step === 3 && errs.pin && <span className="ian-field__error" role="alert">{errs.pin}</span>}
        {step === 3 && <div className="ian-stack" style={{ alignItems: "center" }}><PinPad key={pinErr ? "e" : "n"} onComplete={onPin1} error={!!pinErr} label={pinErr || "이체할 때 쓰는 PIN이에요. 6자리를 눌러 주세요"} /></div>}
        {step === 4 && <div className="ian-stack" style={{ alignItems: "center" }} aria-busy={busy}><PinPad key={pinErr ? "e" : "n"} onComplete={onPin2} error={!!pinErr} label={busy ? "가입하고 있어요" : pinErr || "방금 만든 PIN을 한 번 더 눌러 주세요"} /></div>}
      </div>

      <Sheet open={!!viewed} onClose={() => setViewTerm(null)} label={viewed?.title ?? "약관"}>
        {viewed && (
          <div className="ian-stack" style={{ gap: "var(--ian-s-4)" }}>
            <h2 className="ian-t-title2" style={{ margin: 0 }}>{viewed.title}</h2>
            <div className="ian-t-body" style={{ whiteSpace: "pre-wrap", maxHeight: "50vh", overflowY: "auto" }}>{viewed.content}</div>
            <button type="button" className="ian-btn ian-btn--primary ian-btn--block" onClick={() => setViewTerm(null)}>확인</button>
          </div>
        )}
      </Sheet>

      {step < 3 && (
        <div className="ian-screen__footer">
          <button type="button" className="ian-btn ian-btn--primary ian-btn--block" onClick={next} disabled={step === 0 && !allReq}>다음</button>
        </div>
      )}
    </div>
  );
}
