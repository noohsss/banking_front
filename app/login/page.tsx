"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/services/useAuth";
import { IS_LIVE } from "@/lib/api/mode";
import { errorMessage } from "@/lib/api/errors";
import { PinPad } from "@/components/PinPad";
import { TextField } from "../signup/fields";
import { ResetPassword } from "../signup/ResetPassword";
import s from "./login.module.css";

type Mode = "pw" | "pin";

export default function LoginPage() {
  const router = useRouter();
  const { login, loginWithPin, user } = useAuth();
  const [mode, setMode] = useState<Mode>("pw");
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [pinId, setPinId] = useState("");
  const [err, setErr] = useState("");
  const [pinErr, setPinErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const busyRef = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => { const t = timers.current; return () => t.forEach(clearTimeout); }, []);
  useEffect(() => { if (user) router.replace("/home"); }, [user, router]);

  // mock은 기존처럼 짧은 지연으로 처리 중 상태를 보여 준다. live는 실제 응답 시간이 지연이다.
  const wait = (ms: number) => (IS_LIVE ? Promise.resolve() : new Promise<void>((res) => { timers.current.push(setTimeout(res, ms)); }));
  const later = (fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)); };
  const start = () => { if (busyRef.current) return false; busyRef.current = true; setBusy(true); return true; };
  const end = () => { busyRef.current = false; setBusy(false); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busyRef.current) return;
    if (!id.trim() || !pw) { setErr("아이디와 비밀번호를 모두 입력해 주세요."); return; }
    setErr(""); start();
    await wait(350);
    try { await login(id.trim(), pw); router.replace("/home"); }
    catch (x) { setErr(errorMessage(x) || "로그인하지 못했어요. 잠시 후 다시 시도해 주세요."); end(); }
  };

  const onPin = async (pin: string) => {
    if (IS_LIVE && !pinId.trim()) { setPinErr("아이디를 먼저 입력해 주세요."); later(() => setPinErr(""), 900); return; }
    if (!start()) return;
    await wait(250);
    try { await loginWithPin(pinId.trim(), pin); router.replace("/home"); }
    catch (x) { setPinErr(errorMessage(x)); later(() => { setPinErr(""); end(); }, 900); }
  };

  return (
    <div className="ian-screen">
      <div className="ian-screen__body">
        <div className={s.brand}>
          <div className={s.mark} aria-hidden="true">I</div>
          <h1 className={`${s.name} ian-num`}>IAN bank</h1>
          <p className="ian-t-caption" style={{ margin: 0 }}>쉽고 안전한 모바일 뱅킹</p>
        </div>

        <div className="ian-segmented" role="group" aria-label="로그인 방법">
          <button type="button" className="ian-segmented__opt" aria-pressed={mode === "pw"} onClick={() => setMode("pw")}>아이디로 로그인</button>
          <button type="button" className="ian-segmented__opt" aria-pressed={mode === "pin"} onClick={() => setMode("pin")}>PIN으로 로그인</button>
        </div>

        {mode === "pw" ? (
          <form className="ian-stack" onSubmit={submit} noValidate style={{ gap: "var(--ian-s-5)" }}>
            <TextField id="login-id" label="아이디" value={id} onChange={(e) => { setId(e.target.value); setErr(""); }} autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="아이디를 입력해 주세요" />
            <TextField id="login-pw" label="비밀번호" type="password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} autoComplete="current-password" placeholder="비밀번호를 입력해 주세요" error={err} />
            <button type="submit" className="ian-btn ian-btn--primary ian-btn--block" disabled={busy} aria-busy={busy}>{busy ? "확인하고 있어요" : "로그인"}</button>
          </form>
        ) : (
          <div className={s.pin}>
            {IS_LIVE && <TextField id="login-pin-id" label="아이디" value={pinId} onChange={(e) => setPinId(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="아이디를 입력해 주세요" />}
            <p className="ian-t-body" style={{ margin: 0, textAlign: "center" }}>가입할 때 만든 PIN 6자리를 눌러 주세요.</p>
            <PinPad key={pinErr ? "e" : "n"} onComplete={onPin} error={!!pinErr} label={pinErr || "PIN 6자리를 입력해 주세요"} />
          </div>
        )}

        <div className={s.links}>
          <Link href="/signup">회원가입</Link>
          <span className={s.sep} aria-hidden="true" />
          <button type="button" aria-expanded={resetOpen} aria-controls={IS_LIVE ? undefined : "reset-note"} onClick={() => setResetOpen((v) => !v)}>비밀번호 재설정</button>
        </div>
        {IS_LIVE && resetOpen && <ResetPassword open onClose={() => setResetOpen(false)} />}
        {!IS_LIVE && resetOpen && (
          <div id="reset-note" className="ian-notice"><div><b className="ian-notice__title">비밀번호 재설정은 준비 중이에요</b>이메일 인증으로 새 비밀번호를 만드는 기능은 아직 열리지 않았어요. 지금은 데모 계정(minsu)으로 체험해 보세요.</div></div>
        )}
      </div>
    </div>
  );
}
