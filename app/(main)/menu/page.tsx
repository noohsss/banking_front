"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { AppBar } from "@/components/AppBar";
import { PinPad } from "@/components/PinPad";
import { Sheet } from "@/components/Sheet";
import { TextField, checkEmail, checkName, checkPhone, fmtPhone } from "../../signup/fields";

type Panel = null | "edit" | "reset" | "withdraw";
const CONFIRM_TEXT = "탈퇴합니다";

const LINKS = [
  { href: "/accounts/new", main: "계좌 개설", sub: "입출금통장을 새로 만들어요" },
  { href: "/transfer", main: "이체", sub: "받는 분과 금액을 입력해요" },
  { href: "/auto-transfers", main: "자동이체", sub: "정해진 날 자동으로 보내요" },
  { href: "/cards", main: "카드", sub: "체크카드 발급과 관리" },
];

export default function MenuPage() {
  const { user, updateUser, checkPin, logout, withdraw } = useStore();
  const [panel, setPanel] = useState<Panel>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [phase, setPhase] = useState<"confirm" | "pin">("confirm");
  const [typed, setTyped] = useState("");
  const [pinErr, setPinErr] = useState("");
  const busy = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => { const t = timers.current; return () => t.forEach(clearTimeout); }, []);

  if (!user) return null;

  const close = () => { setPanel(null); setPhase("confirm"); setTyped(""); setPinErr(""); busy.current = false; };
  const openEdit = () => { setForm({ name: user.name, email: user.email, phone: user.phone }); setErrs({}); setPanel("edit"); };
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const er = { name: checkName(form.name), email: checkEmail(form.email), phone: checkPhone(form.phone) };
    if (Object.values(er).some(Boolean)) { setErrs(er); return; }
    updateUser({ name: form.name.trim(), email: form.email.trim(), phone: form.phone });
    setSaved(true); close();
  };
  const onPin = (pin: string) => {
    if (busy.current) return;
    if (!checkPin(pin)) {
      setPinErr("PIN이 맞지 않아요. 다시 눌러 주세요.");
      timers.current.push(setTimeout(() => setPinErr(""), 900));
      return;
    }
    busy.current = true;
    withdraw();
  };

  const rows: [string, string][] = [["이름", user.name], ["아이디", user.loginId], ["이메일", user.email], ["휴대폰", user.phone], ...(user.birth ? [["생년월일", user.birth] as [string, string]] : [])];

  return (
    <>
      <AppBar title="전체" hideBack />
      <div className="ian-screen__body">
        <section className="ian-stack" aria-labelledby="mine">
          <div className="ian-section-head"><h2 id="mine" className="ian-t-title2" style={{ margin: 0 }}>내 정보</h2><button type="button" className="ian-btn ian-btn--soft ian-btn--sm" onClick={openEdit}>정보 변경</button></div>
          <div className="ian-card">
            <dl className="ian-stack" style={{ margin: 0 }}>
              {rows.map(([k, v]) => (
                <div key={k} className="ian-row ian-row--between"><dt className="ian-t-caption">{k}</dt><dd style={{ margin: 0, fontWeight: 700 }}>{v}</dd></div>
              ))}
            </dl>
          </div>
          {saved && <div className="ian-notice" role="status"><div>정보를 바꿨어요.</div></div>}
        </section>

        <nav aria-label="서비스 바로가기">
          <div className="ian-menu">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="ian-menu__item" data-chev>
                <span className="ian-menu__main">{l.main}<span className="ian-menu__sub">{l.sub}</span></span>
              </Link>
            ))}
          </div>
        </nav>

        <section aria-labelledby="acct">
          <h2 id="acct" className="ian-t-title2" style={{ margin: "0 0 var(--ian-s-3)" }}>계정 관리</h2>
          <div className="ian-menu">
            <button type="button" className="ian-menu__item" data-chev onClick={() => setPanel("reset")}><span className="ian-menu__main">비밀번호 재설정<span className="ian-menu__sub">재설정 방법을 안내해 드려요</span></span></button>
            <button type="button" className="ian-menu__item" onClick={logout}><span className="ian-menu__main">로그아웃</span></button>
            <button type="button" className="ian-menu__item" data-chev onClick={() => setPanel("withdraw")} style={{ color: "var(--ian-danger)" }}><span className="ian-menu__main">회원 탈퇴<span className="ian-menu__sub">되돌릴 수 없어요</span></span></button>
          </div>
        </section>
      </div>

      <Sheet open={panel === "edit"} onClose={close} label="정보 변경">
        <form className="ian-stack" onSubmit={save} noValidate style={{ gap: "var(--ian-s-4)" }}>
          <h2 className="ian-t-title2" style={{ margin: 0 }}>정보를 바꿔요</h2>
          <TextField id="ed-name" label="이름" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" error={errs.name} />
          <TextField id="ed-email" label="이메일" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" error={errs.email} />
          <TextField id="ed-phone" label="휴대폰 번호" inputMode="numeric" value={form.phone} onChange={(e) => setForm({ ...form, phone: fmtPhone(e.target.value) })} autoComplete="tel" error={errs.phone} />
          <div className="ian-row"><button type="button" className="ian-btn ian-btn--outline" style={{ flex: 1 }} onClick={close}>취소</button><button type="submit" className="ian-btn ian-btn--primary" style={{ flex: 2 }}>저장</button></div>
        </form>
      </Sheet>

      <Sheet open={panel === "reset"} onClose={close} label="비밀번호 재설정 안내">
        <div className="ian-stack" style={{ gap: "var(--ian-s-4)" }}>
          <h2 className="ian-t-title2" style={{ margin: 0 }}>비밀번호 재설정</h2>
          <div className="ian-notice"><div>로그아웃한 뒤 로그인 화면의 &lsquo;비밀번호 재설정&rsquo;에서 이메일 인증을 거쳐 바꿀 수 있어요. 이 데모에서는 아직 열리지 않았어요.</div></div>
          <button type="button" className="ian-btn ian-btn--primary ian-btn--block" onClick={close}>확인</button>
        </div>
      </Sheet>

      <Sheet open={panel === "withdraw"} onClose={close} label="회원 탈퇴">
        {phase === "confirm" ? (
          <div className="ian-stack" style={{ gap: "var(--ian-s-4)" }}>
            <h2 className="ian-t-title2" style={{ margin: 0 }}>정말 탈퇴할까요?</h2>
            <div className="ian-notice ian-notice--danger"><div><b className="ian-notice__title">탈퇴하면 되돌릴 수 없어요</b>계좌, 카드, 이체 내역을 더 이상 볼 수 없어요. 잔액이 있거나 이용 중인 자동이체·카드는 먼저 정리해 주세요. 탈퇴할 수 있는 조건은 정해지는 대로 안내해 드려요.</div></div>
            <TextField id="wd-confirm" label={`계속하려면 “${CONFIRM_TEXT}”를 입력해 주세요`} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            <div className="ian-row"><button type="button" className="ian-btn ian-btn--outline" style={{ flex: 1 }} onClick={close}>취소</button><button type="button" className="ian-btn ian-btn--danger" style={{ flex: 2 }} disabled={typed.trim() !== CONFIRM_TEXT} onClick={() => setPhase("pin")}>PIN으로 확인</button></div>
          </div>
        ) : (
          <div className="ian-stack" style={{ alignItems: "center", gap: "var(--ian-s-4)" }}>
            <h2 className="ian-t-title2" style={{ margin: 0 }}>PIN을 눌러 탈퇴를 마쳐요</h2>
            <PinPad key={pinErr ? "e" : "n"} onComplete={onPin} error={!!pinErr} label={pinErr || "PIN 6자리를 입력해 주세요"} />
            <button type="button" className="ian-btn ian-btn--outline" onClick={close}>취소</button>
          </div>
        )}
      </Sheet>
    </>
  );
}
