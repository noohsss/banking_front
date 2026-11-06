"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { AppBar } from "@/components/AppBar";
import { PinPad } from "@/components/PinPad";
import { Stepper } from "@/components/Stepper";
import { TextField, checkEmail, checkName, checkPhone, fmtPhone } from "./fields";

const TOTAL = 5;
const TITLES = ["약관에 동의해 주세요", "기본 정보를 알려 주세요", "로그인에 쓸 아이디와 비밀번호를 만들어 주세요", "PIN 6자리를 만들어 주세요", "PIN을 한 번 더 눌러 주세요"];
const TERMS = [
  { key: "t1", label: "전자금융거래 이용약관", required: true },
  { key: "t2", label: "개인정보 수집·이용 동의", required: true },
  { key: "t3", label: "마케팅 정보 수신", required: false },
] as const;
type TermKey = (typeof TERMS)[number]["key"];

const checkId = (v: string) => (/^[a-z0-9]{4,16}$/.test(v) ? "" : "아이디는 영문 소문자와 숫자 4~16자로 만들어 주세요.");
const checkPw = (v: string) => (v.length >= 8 && /[A-Za-z]/.test(v) && /\d/.test(v) && /[^A-Za-z0-9]/.test(v) ? "" : "비밀번호는 8자 이상, 영문·숫자·특수문자를 모두 넣어 주세요.");

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useStore();
  const [step, setStep] = useState(0);
  const [terms, setTerms] = useState<Record<TermKey, boolean>>({ t1: false, t2: false, t3: false });
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
  const allReq = terms.t1 && terms.t2;
  const allOn = allReq && terms.t3;
  const toggleAll = () => { const v = !allOn; setTerms({ t1: v, t2: v, t3: v }); };

  const sendCode = () => {
    const e = checkEmail(f.email);
    if (e) { setErrs((x) => ({ ...x, email: e })); return; }
    setSent(true); setVerified(false);
  };
  const verify = () => {
    if (/^\d{6}$/.test(f.code)) { setVerified(true); setErrs((x) => ({ ...x, code: "" })); }
    else setErrs((x) => ({ ...x, code: "인증번호 6자리를 숫자로 입력해 주세요." }));
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
    setPin1(pin); setStep(4);
  };
  const onPin2 = (pin: string) => {
    if (busyRef.current) return;
    if (pin !== pin1) { setPinErr("PIN이 서로 달라요. 다시 눌러 주세요."); later(() => setPinErr(""), 900); return; }
    busyRef.current = true; setBusy(true);
    later(() => {
      const r = signup({ loginId: f.loginId, name: f.name.trim(), email: f.email.trim(), phone: f.phone, birth: f.birth || undefined, password: f.pw, pin });
      if (r.ok) { router.replace("/login"); return; }
      busyRef.current = false; setBusy(false);
      setErrs({ loginId: r.message ?? "가입하지 못했어요. 아이디를 바꿔서 다시 시도해 주세요." });
      setPin1(""); setStep(2);
    }, 400);
  };

  const back = () => { if (busy) return; if (step === 0) router.back(); else { setPinErr(""); setStep(step - 1); } };

  return (
    <div className="ian-screen">
      <AppBar title="회원가입" onBack={back} />
      <div className="ian-screen__body">
        <Stepper total={TOTAL} current={step} />
        <h1 className="ian-t-title1" style={{ margin: 0 }}>{TITLES[step]}</h1>

        {step === 0 && (
          <div className="ian-stack" role="group" aria-label="약관 동의">
            <label className="ian-check"><input type="checkbox" checked={allOn} onChange={toggleAll} /><span><b>전체 동의</b></span></label>
            <hr style={{ border: 0, borderTop: "1px solid var(--ian-fill)", margin: 0, width: "100%" }} />
            {TERMS.map((t) => (
              <label key={t.key} className="ian-check">
                <input type="checkbox" checked={terms[t.key]} onChange={() => setTerms((p) => ({ ...p, [t.key]: !p[t.key] }))} />
                <span><span className={`ian-check__tag${t.required ? "" : " ian-check__tag--opt"}`}>{t.required ? "필수" : "선택"}</span>{t.label}</span>
              </label>
            ))}
            {!allReq && <span className="ian-field__hint">필수 약관 2개에 동의하면 다음으로 갈 수 있어요.</span>}
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
                <button type="button" className="ian-btn ian-btn--soft" onClick={sendCode} disabled={verified}>{sent ? "다시 받기" : "인증번호 받기"}</button>
              </div>
              {errs.email ? <span id="su-email-err" className="ian-field__error" role="alert">{errs.email}</span> : <span id="su-email-hint" className="ian-field__hint">인증번호를 이메일로 보내 드려요. 데모에서는 아무 숫자 6자리나 000000을 입력하세요.</span>}
            </div>
            {sent && (
              <div className="ian-field">
                <label className="ian-field__label" htmlFor="su-code">인증번호 6자리</label>
                <div className="ian-field--inline">
                  <input id="su-code" className="ian-input ian-num" inputMode="numeric" maxLength={6} autoComplete="one-time-code" value={f.code} disabled={verified} aria-invalid={errs.code ? true : undefined} aria-describedby={errs.code ? "su-code-err" : undefined}
                    onChange={(e) => set("code", e.target.value.replace(/\D/g, ""))} />
                  <button type="button" className="ian-btn ian-btn--soft" onClick={verify} disabled={verified}>확인</button>
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

        {step === 3 && <div className="ian-stack" style={{ alignItems: "center" }}><PinPad key={pinErr ? "e" : "n"} onComplete={onPin1} error={!!pinErr} label={pinErr || "이체할 때 쓰는 PIN이에요. 6자리를 눌러 주세요"} /></div>}
        {step === 4 && <div className="ian-stack" style={{ alignItems: "center" }} aria-busy={busy}><PinPad key={pinErr ? "e" : "n"} onComplete={onPin2} error={!!pinErr} label={busy ? "가입하고 있어요" : pinErr || "방금 만든 PIN을 한 번 더 눌러 주세요"} /></div>}
      </div>

      {step < 3 && (
        <div className="ian-screen__footer">
          <button type="button" className="ian-btn ian-btn--primary ian-btn--block" onClick={next} disabled={step === 0 && !allReq}>다음</button>
        </div>
      )}
    </div>
  );
}
