"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import { AppBar } from "@/components/AppBar";
import { StatusBadge } from "@/components/StatusBadge";
import { useStore } from "@/lib/store";
import { IS_LIVE } from "@/lib/api/mode";
import { errorMessage } from "@/lib/api/errors";
import { useAccount, useTransferLimits } from "@/lib/services/useAccount";
import { isPinInvalid, useAccountActions } from "@/lib/services/useAccountActions";
import { maskAccount, wonUnit } from "@/lib/format";
import { AccountState } from "../../_components/AccountState";
import { Frame, useToast } from "../../_components/Frame";
import { PinSheet } from "../../_components/PinSheet";
import css from "./manage.module.css";

const MAX_DAILY = 1_000_000;   // 기본 상한(개설 시 부여되는 한도)
const MAX_MONTHLY = 5_000_000;
const num = (v: string) => v.replace(/\D/g, "").slice(0, 9);
const fmt = (v: string) => (v ? Number(v).toLocaleString("ko-KR") : "");
const maskEmail = (e: string) => { const [a, b] = e.split("@"); return b ? `${a.slice(0, 2)}${"•".repeat(Math.max(2, a.length - 2))}@${b}` : e; };

export default function ManagePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useStore();
  const { account: acc, loading: accLoading, error: accError, notFound, refresh: refreshAcc } = useAccount(id);
  const { limits, refresh: refreshLimits } = useTransferLimits(id);
  const actions = useAccountActions();
  const { toast, showToast } = useToast();

  const [daily, setDaily] = useState<string | null>(null);   // null이면 현재 값을 보여줌
  const [monthly, setMonthly] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);

  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [codeErr, setCodeErr] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [released, setReleased] = useState(false);
  const [verificationId, setVerificationId] = useState(0);
  const [verified, setVerified] = useState(false);   // 인증번호 확인까지 끝나고 해제 호출만 남은 상태

  if (!acc) return <AccountState title="계좌 관리" loading={accLoading} error={accError} notFound={notFound} onRetry={() => void refreshAcc()} />;

  const active = acc.status === "ACTIVE";
  const dStr = daily ?? String(acc.dailyLimit);
  const mStr = monthly ?? String(acc.monthlyLimit);
  const dN = Number(dStr), mN = Number(mStr);
  // 한도 상한은 명세상 미정이라 live에서는 상한·단위를 화면에서 막지 않고 서버 응답(400 등)을 따른다.
  const dErr = !dStr || dN <= 0 ? "1일 한도를 입력해 주세요." : !IS_LIVE && dN > MAX_DAILY ? `1일 한도는 ${wonUnit(MAX_DAILY)}까지 정할 수 있어요.` : !IS_LIVE && dN % 10000 !== 0 ? "1만원 단위로 입력해 주세요." : "";
  const mErr = !mStr || mN <= 0 ? "1달 한도를 입력해 주세요." : !IS_LIVE && mN > MAX_MONTHLY ? `1달 한도는 ${wonUnit(MAX_MONTHLY)}까지 정할 수 있어요.` : !IS_LIVE && mN % 10000 !== 0 ? "1만원 단위로 입력해 주세요." : !dErr && dN > mN ? "1달 한도는 1일 한도보다 크거나 같아야 해요." : "";
  const changed = dN !== acc.dailyLimit || mN !== acc.monthlyLimit;

  const requestSave = () => {
    setTried(true);
    if (dErr || mErr) return;
    if (!changed) { showToast("바뀐 내용이 없어요"); return; }
    setPinOpen(true);
  };
  const onVerified = async (pin: string) => {
    if (saveLock.current) return;
    saveLock.current = true; setSaving(true);
    try {
      await actions.changeLimits(acc.id, dN, mN, pin);
      await Promise.all([refreshAcc(), refreshLimits()]);
      setDaily(null); setMonthly(null); setTried(false); setPinOpen(false);
      showToast("이체한도를 바꿨어요");
    } catch (e) {
      if (isPinInvalid(e)) throw e;           // 시트에서 흔들고 다시 입력받는다
      setPinOpen(false); showToast(errorMessage(e));
    } finally {
      saveLock.current = false; setSaving(false);
    }
  };

  const sendCode = async () => {
    try {
      setVerificationId(await actions.sendUnlockCode(user?.email ?? "")); setVerified(false);
      setSent(true); setCode(""); setCodeErr(""); showToast("인증번호를 이메일로 보냈어요");
    } catch (e) { showToast(errorMessage(e)); }
  };
  const verify = async () => {
    if (verifying) return;
    if (!/^\d{6}$/.test(code)) { setCodeErr("인증번호 6자리를 입력해 주세요."); return; }
    setVerifying(true);
    try {
      if (!verified) { await actions.verifyUnlockCode(verificationId, code); setVerified(true); }
      await actions.unlock(acc.id, verificationId);
      await refreshAcc();
      setReleased(true); setSent(false); setCode(""); setCodeErr("");
    } catch (e) { setCode(""); setCodeErr(errorMessage(e)); }
    finally { setVerifying(false); }
  };

  return (
    <Frame
      overlay={
        <>
          <PinSheet open={pinOpen} onClose={() => setPinOpen(false)} onVerified={onVerified} busy={saving} title="PIN으로 한도 변경 확인" desc={`1일 ${wonUnit(dN)} · 1달 ${wonUnit(mN)}으로 바꿔요.`} />
          {toast}
        </>
      }
    >
      <AppBar title="계좌 관리" />
      <div className="ian-screen__body" style={{ paddingBottom: 32 }}>
        <div className="ian-stack" style={{ gap: 6 }}>
          <div className="ian-row"><h1 className="ian-t-title1">{acc.alias}</h1><StatusBadge account={acc.status} /></div>
          <span className="ian-acct">{maskAccount(acc.number)}</span>
        </div>

        {acc.status === "CLOSED" && <div className="ian-notice"><div><b className="ian-notice__title">해지된 계좌예요</b>설정을 바꿀 수 없어요. 거래내역은 계좌 상세에서 볼 수 있어요.</div></div>}
        {acc.status === "SUSPENDED" && !released && <div className="ian-notice ian-notice--warn"><div><b className="ian-notice__title">거래가 중지된 계좌예요</b>아래에서 이메일 인증을 마치면 즐겨찾기와 한도를 바꿀 수 있어요.</div></div>}
        {released && <div className="ian-notice" role="status"><div><b className="ian-notice__title">거래중지를 풀었어요</b>이제 이체와 설정 변경을 할 수 있어요.</div></div>}

        {acc.status === "SUSPENDED" && !released && (
          <section className={css.section} aria-labelledby="rel-h">
            <div><b id="rel-h" className="ian-t-title2">거래중지 해제</b><p className="ian-t-caption" style={{ marginTop: 4 }}>통장 비밀번호를 여러 번 틀려 거래가 중지됐어요. 가입한 이메일({maskEmail(user?.email ?? "")})로 인증번호를 받아 본인 확인을 해 주세요.</p></div>
            {!sent ? (
              <button type="button" className="ian-btn ian-btn--primary ian-btn--block" onClick={() => void sendCode()}>인증번호 받기</button>
            ) : (
              <>
                <div className="ian-field">
                  <label className="ian-field__label" htmlFor="rel-code">인증번호 6자리</label>
                  <input id="rel-code" className={`ian-input ${css.code}`} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setCodeErr(""); }} aria-invalid={!!codeErr} aria-describedby={codeErr ? "rel-err" : "rel-hint"} />
                  {codeErr ? <span id="rel-err" className="ian-field__error" role="alert">{codeErr}</span> : <span id="rel-hint" className="ian-field__hint">{IS_LIVE ? "이메일로 받은 인증번호 6자리를 입력해 주세요." : "데모에서는 000000을 입력하면 통과해요."}</span>}
                </div>
                <div className="ian-row">
                  <button type="button" className="ian-btn ian-btn--outline" style={{ flex: 1 }} onClick={() => void sendCode()} disabled={verifying}>다시 받기</button>
                  <button type="button" className="ian-btn ian-btn--primary" style={{ flex: 2 }} onClick={() => void verify()} aria-busy={verifying} disabled={verifying}>{verifying ? "확인 중" : "해제하기"}</button>
                </div>
              </>
            )}
          </section>
        )}

        <section className={css.section} aria-labelledby="fav-h">
          <div className={css.switchRow}>
            <div><b id="fav-h">즐겨찾기</b><span className="ian-t-caption" style={{ display: "block" }}>켜면 홈 맨 위에 보여요.</span></div>
            <label className="ian-switch">
              <input type="checkbox" role="switch" checked={acc.favorite} disabled={!active} aria-labelledby="fav-h" onChange={async () => { try { await actions.setFavorite(acc.id, !acc.favorite); await refreshAcc(); showToast(acc.favorite ? "즐겨찾기를 해제했어요" : "즐겨찾기에 추가했어요"); } catch (e) { showToast(errorMessage(e)); } }} />
              <span className="ian-switch__track" /><span className="ian-switch__thumb" />
            </label>
          </div>
        </section>

        <section className={css.section} aria-labelledby="lim-h">
          <div><b id="lim-h" className="ian-t-title2">이체한도</b><p className="ian-t-caption" style={{ marginTop: 4 }}>오늘 {wonUnit(limits?.dailyUsed ?? 0)} · 이번 달 {wonUnit(limits?.monthlyUsed ?? 0)} 썼어요. {IS_LIVE ? "1일·1달 한도를 바꿀 수 있어요." : `기본 한도(일 ${wonUnit(MAX_DAILY)}·월 ${wonUnit(MAX_MONTHLY)}) 안에서 낮출 수 있어요.`}</p></div>
          <div className="ian-field">
            <label className="ian-field__label" htmlFor="lim-d">1일 한도(원)</label>
            <input id="lim-d" className="ian-input" inputMode="numeric" disabled={!active} value={fmt(dStr)} onChange={(e) => setDaily(num(e.target.value))} aria-invalid={tried && !!dErr} aria-describedby={tried && dErr ? "lim-d-err" : undefined} />
            {tried && dErr && <span id="lim-d-err" className="ian-field__error" role="alert">{dErr}</span>}
          </div>
          <div className="ian-field">
            <label className="ian-field__label" htmlFor="lim-m">1달 한도(원)</label>
            <input id="lim-m" className="ian-input" inputMode="numeric" disabled={!active} value={fmt(mStr)} onChange={(e) => setMonthly(num(e.target.value))} aria-invalid={tried && !!mErr} aria-describedby={tried && mErr ? "lim-m-err" : undefined} />
            {tried && mErr && <span id="lim-m-err" className="ian-field__error" role="alert">{mErr}</span>}
          </div>
          <button type="button" className="ian-btn ian-btn--primary ian-btn--block" disabled={!active || saving} aria-busy={saving} onClick={requestSave}>{saving ? "저장 중이에요" : "한도 변경"}</button>
          {!active && <p className="ian-t-caption">{acc.status === "SUSPENDED" ? "거래중지를 풀어야 한도를 바꿀 수 있어요." : "해지된 계좌는 한도를 바꿀 수 없어요."}</p>}
        </section>

        <div className="ian-menu">
          {acc.status === "CLOSED"
            ? <button type="button" className="ian-menu__item" disabled><span className="ian-menu__main">계좌 해지<span className="ian-menu__sub">이미 해지된 계좌예요</span></span></button>
            : <Link href={`/accounts/${acc.id}/close`} className="ian-menu__item" data-chev><span className="ian-menu__main">계좌 해지<span className="ian-menu__sub">해지 가능 여부부터 확인해요</span></span></Link>}
        </div>
      </div>
    </Frame>
  );
}
