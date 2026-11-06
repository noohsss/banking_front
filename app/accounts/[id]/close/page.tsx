"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import { AppBar } from "@/components/AppBar";
import { errorMessage } from "@/lib/api/errors";
import { useAccount } from "@/lib/services/useAccount";
import { useCloseCheck } from "@/lib/services/useCloseCheck";
import { isPinInvalid, useAccountActions } from "@/lib/services/useAccountActions";
import { maskAccount, wonUnit } from "@/lib/format";
import { AccountState } from "../../_components/AccountState";
import { Frame } from "../../_components/Frame";
import { PinSheet } from "../../_components/PinSheet";

export default function CloseAccountPage() {
  const { id } = useParams<{ id: string }>();
  const { account: acc, loading: accLoading, error: accError, notFound, refresh: refreshAcc } = useAccount(id);
  const { check, loading: checkLoading, error: checkError, refresh: refreshCheck } = useCloseCheck(id);
  const actions = useAccountActions();
  const [closeErr, setCloseErr] = useState("");
  const [agree, setAgree] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ alias: string; number: string } | null>(null);
  const lock = useRef(false);

  if (!acc && !done) return <AccountState title="계좌 해지" loading={accLoading} error={accError} notFound={notFound} onRetry={() => void refreshAcc()} />;

  if (done) {
    return (
      <Frame>
        <AppBar title="계좌 해지" hideBack />
        <div className="ian-screen__body">
          <div className="ian-result" data-state="success">
            <div className="ian-result__mark" aria-hidden="true" />
            <h1 className="ian-t-title1" role="status">{done.alias} 계좌를<br />해지했어요</h1>
            <p className="ian-result__desc">{maskAccount(done.number)} 계좌는 더 이상 쓸 수 없어요. 해지 전 거래내역은 계속 조회할 수 있어요.</p>
          </div>
        </div>
        <div className="ian-screen__footer">
          <Link href={`/accounts/${id}`} className="ian-btn ian-btn--primary ian-btn--block">거래내역 조회</Link>
          <Link href="/home" className="ian-btn ian-btn--outline ian-btn--block">홈으로</Link>
        </div>
      </Frame>
    );
  }

  const a = acc!;

  const onVerified = async (pin: string) => {
    if (lock.current) return;          // 중복 해지 요청 차단
    lock.current = true; setBusy(true); setCloseErr("");
    try { await actions.closeAccount(a.id, pin); setDone({ alias: a.alias, number: a.number }); setPinOpen(false); }
    catch (e) {
      if (isPinInvalid(e)) throw e;     // 시트에서 흔들고 다시 입력받는다
      setPinOpen(false); setCloseErr(errorMessage(e)); void refreshCheck();   // 409 ACCOUNT_CLOSE_BLOCKED 등
    }
    finally { lock.current = false; setBusy(false); }
  };

  if (!check) {
    return <AccountState title="계좌 해지" loading={checkLoading} error={checkError} onRetry={() => void refreshCheck()} />;
  }

  if (!check.ok) {
    return (
      <Frame>
        <AppBar title="계좌 해지" />
        <div className="ian-screen__body">
          <h1 className="ian-t-title1">{a.alias}을(를)<br />해지할 수 없어요</h1>
          <div className="ian-stack" role="list" aria-label="해지 제한 사유">
            {(check.reasons.length ? check.reasons : ["지금은 해지할 수 없는 상태예요."]).map((r) => (
              <div key={r} role="listitem" className="ian-notice ian-notice--danger"><div>{r}</div></div>
            ))}
          </div>
          <div className="ian-menu">
            {a.status === "SUSPENDED" && <Link href={`/accounts/${a.id}/manage`} className="ian-menu__item" data-chev><span className="ian-menu__main">거래중지 해제하기<span className="ian-menu__sub">이메일 인증으로 풀어요</span></span></Link>}
            {a.balance > 0 && a.status !== "CLOSED" && <Link href={`/transfer?from=${a.id}`} className="ian-menu__item" data-chev><span className="ian-menu__main">잔액 이체하기<span className="ian-menu__sub">남은 {wonUnit(a.balance)}을 다른 계좌로 보내요</span></span></Link>}
            {check.hasCard && <Link href="/cards" className="ian-menu__item" data-chev><span className="ian-menu__main">체크카드 보기<span className="ian-menu__sub">연결된 카드가 있어요</span></span></Link>}
            {check.hasAuto && <Link href="/auto-transfers" className="ian-menu__item" data-chev><span className="ian-menu__main">자동이체 보기<span className="ian-menu__sub">연결된 자동이체가 있어요</span></span></Link>}
            <Link href={`/accounts/${a.id}`} className="ian-menu__item" data-chev><span className="ian-menu__main">거래내역 보기<span className="ian-menu__sub">해지 후에도 볼 수 있어요</span></span></Link>
          </div>
        </div>
        <div className="ian-screen__footer">
          <p className="ian-t-caption">조건을 모두 채우면 해지할 수 있어요.</p>
          <button type="button" className="ian-btn ian-btn--danger ian-btn--block" disabled>계좌 해지</button>
        </div>
      </Frame>
    );
  }

  return (
    <Frame overlay={<PinSheet open={pinOpen} onClose={() => setPinOpen(false)} onVerified={onVerified} busy={busy} title="PIN으로 해지 확인" desc={`${a.alias} 계좌를 해지해요. 되돌릴 수 없어요.`} />}>
      <AppBar title="계좌 해지" />
      <div className="ian-screen__body">
        <h1 className="ian-t-title1">{a.alias}을(를)<br />해지할까요?</h1>
        {closeErr && <div className="ian-notice ian-notice--danger" role="alert"><div><b className="ian-notice__title">해지하지 못했어요</b>{closeErr}</div></div>}
        <div className="ian-notice ian-notice--danger">
          <div><b className="ian-notice__title">해지하면 되돌릴 수 없어요</b>해지한 계좌는 다시 쓸 수 없어요. 해지 전 거래내역은 계속 조회할 수 있어요.</div>
        </div>
        <dl className="ian-receipt" style={{ margin: 0 }}>
          <div className="ian-receipt__rows" style={{ borderTop: 0, paddingTop: 0 }}>
            <div className="ian-receipt__row"><dt>계좌</dt><dd>{a.alias} {maskAccount(a.number)}</dd></div>
            <div className="ian-receipt__row"><dt>잔액</dt><dd className="ian-num">{wonUnit(a.balance)}</dd></div>
            <div className="ian-receipt__row"><dt>연결된 서비스</dt><dd>없음</dd></div>
          </div>
        </dl>
        <label className="ian-check">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>위 내용을 확인했고, 해지하면 되돌릴 수 없다는 점에 동의해요.</span>
        </label>
      </div>
      <div className="ian-screen__footer">
        <button type="button" className="ian-btn ian-btn--danger ian-btn--block" disabled={!agree} onClick={() => setPinOpen(true)}>계좌 해지</button>
        <button type="button" className="ian-btn ian-btn--ghost ian-btn--block" onClick={() => history.back()}>취소</button>
      </div>
    </Frame>
  );
}
