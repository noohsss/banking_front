"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppBar } from "@/components/AppBar";
import { PinPad } from "@/components/PinPad";
import { Sheet } from "@/components/Sheet";
import { Stepper } from "@/components/Stepper";
import { useAccounts } from "@/lib/services/useAccounts";
import { useRecipients } from "@/lib/services/useRecipients";
import { useTransfer, type SendInput } from "@/lib/services/useTransfer";
import { IS_LIVE } from "@/lib/api/mode";
import { newIdempotencyKey } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { maskAccount, won, wonUnit } from "@/lib/format";
import type { Transfer } from "@/lib/types";

type Step = "form" | "pin" | "run" | "result";
type Result =
  | { kind: "success"; transfer: Transfer; balanceAfter: number }
  | { kind: "failed"; message: string }
  | { kind: "pending"; transferId?: string };

const ACCOUNT_RE = /^\d{3}-\d{4}-\d{4}$/;
const MAX_PIN_FAILS = 5;

/** 숫자만 남기고 000-0000-0000 모양으로 */
const formatNumber = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return [d.slice(0, 3), d.slice(3, 7), d.slice(7, 11)].filter(Boolean).join("-");
};

export default function TransferPage() {
  return (
    <Suspense fallback={null}>
      <TransferFlow />
    </Suspense>
  );
}

function TransferFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const { accounts, loading: accLoading, error: accError, refresh: refreshAccounts } = useAccounts();

  const usable = useMemo(() => accounts.filter((a) => a.status === "ACTIVE"), [accounts]);
  const fromParam = params.get("from");

  const [step, setStep] = useState<Step>("form");
  const [fromSel, setFromId] = useState<string | null>(null);
  // 선택 전(또는 live에서 계좌가 늦게 도착한 경우)에는 쿼리의 from → 첫 계좌 순
  const fromId = fromSel ?? (usable.find((a) => a.id === fromParam) ?? usable[0])?.id ?? "";
  const tr = useTransfer(fromId);
  const { people, toggleFavorite, refresh: refreshRecipients } = useRecipients();
  const [number, setNumber] = useState("");
  const [verifiedName, setVerifiedName] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [amountText, setAmountText] = useState("");
  const [memo, setMemo] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pinError, setPinError] = useState(false);
  const [pinFails, setPinFails] = useState(0);
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [toast, setToast] = useState("");
  const [checking, setChecking] = useState(false);
  const running = useRef(false); // 중복 실행 차단
  // 한 번의 이체 시도 = 키 하나. 응답을 못 받았을 때(pending) 같은 키·같은 내용으로만 재전송한다. 확정되면(성공·실패·PIN 오류) 비운다.
  const attempt = useRef<SendInput | null>(null);
  const lookupFor = useRef(""); // 늦게 도착한 수취인 확인 응답 무시용
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => { const t = timers.current; return () => t.forEach(clearTimeout); }, []);

  const from = accounts.find((a) => a.id === fromId);
  const amount = Number(amountText || 0);

  const lim = tr.limits;
  const usedToday = lim?.usedToday ?? 0;
  const leftToday = lim ? Math.max(0, lim.dailyLimit - lim.usedToday) : 0;
  const leftMonth = lim ? Math.max(0, lim.monthlyLimit - lim.usedMonth) : 0;
  const dailyPct = lim && lim.dailyLimit > 0 ? Math.min(100, Math.round((usedToday / lim.dailyLimit) * 100)) : 0;

  let amountError = "";
  if (from && amount > 0) {
    if (amount > from.balance) amountError = `잔액 ${wonUnit(from.balance)}보다 커요. 금액을 줄여 주세요.`;
    else if (!lim) amountError = ""; // live에서 한도를 못 불러왔으면 서버 검증(422)에 맡긴다
    else if (amount > leftToday) amountError = `오늘 남은 이체한도 ${wonUnit(leftToday)}보다 커요. 금액을 줄여 주세요.`;
    else if (amount > leftMonth) amountError = `이번 달 남은 이체한도 ${wonUnit(leftMonth)}보다 커요. 금액을 줄여 주세요.`;
  }
  const selfError = from && number === from.number ? "출금 계좌와 같은 계좌예요. 다른 계좌번호를 입력해 주세요." : "";
  const numberError = selfError || lookupError;
  const canNext = !!from && !!verifiedName && !selfError && amount > 0 && !amountError;
  const favPerson = people.find((p) => p.number === number);

  const pickNumber = (v: string) => {
    lookupFor.current = "";
    setNumber(v);
    setVerifiedName(null);
    setLookupError("");
  };
  const lookup = async (n = number) => {
    lookupFor.current = n;
    if (!ACCOUNT_RE.test(n)) { setVerifiedName(null); setLookupError("계좌번호 11자리를 000-0000-0000 모양으로 입력해 주세요."); return; }
    let name: string | null;
    try { name = await tr.lookup(n); } catch (e) {
      if (lookupFor.current === n) { setVerifiedName(null); setLookupError(errorMessage(e)); }
      return;
    }
    if (lookupFor.current !== n) return;
    if (!name) { setVerifiedName(null); setLookupError("IAN Bank에서 확인되지 않는 계좌예요. 번호를 다시 확인해 주세요. 다른 은행 계좌로는 보낼 수 없어요."); return; }
    setLookupError(""); setVerifiedName(name);
  };
  const pickPerson = (n: string) => { setNumber(n); setVerifiedName(null); setLookupError(""); void lookup(n); };
  const addAmount = (n: number) => setAmountText(String(Math.min(999999999999, amount + n)));

  const flash = (m: string) => { setToast(m); timers.current.push(setTimeout(() => setToast(""), 2200)); };

  const reset = () => {
    running.current = false; attempt.current = null;
    setResult(null); setStep("form"); setNumber(""); setVerifiedName(null); setLookupError(""); setAmountText(""); setMemo(""); setPinFails(0); setPinError(false);
  };

  // 서버 응답(status)을 결과 화면으로. PENDING은 실패로 단정하지 않고 "결과 확인 중"으로 둔다.
  const apply = (t: Transfer, balanceAfter: number) => {
    if (t.status === "PENDING") { setResult({ kind: "pending", transferId: t.id }); return; }
    attempt.current = null;
    if (t.status === "SUCCESS") { setResult({ kind: "success", transfer: t, balanceAfter }); void refreshAccounts(); void refreshRecipients(); return; }
    running.current = false;
    setResult({ kind: "failed", message: t.failReason || "이체하지 못했어요. 잠시 후 다시 시도해 주세요." });
  };

  /** 네트워크 오류·5xx는 처리 여부를 알 수 없으므로 pending, 그 밖의 4xx는 처리되지 않은 실패 */
  const onSendError = (e: unknown) => {
    if (e instanceof ApiError && e.is("PIN_INVALID")) {
      attempt.current = null; running.current = false;
      setStep("pin"); setPinError(true);
      timers.current.push(setTimeout(() => setPinError(false), 700));
      return;
    }
    if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
      attempt.current = null; running.current = false;
      setResult({ kind: "failed", message: errorMessage(e) });
    } else setResult({ kind: "pending" });
    setStep("result");
  };

  const onPin = async (pin: string) => {
    if (running.current || !from || !verifiedName) return;
    if (!tr.checkPin(pin)) {
      const n = pinFails + 1;
      setPinFails(n);
      setPinError(true);
      timers.current.push(setTimeout(() => {
        setPinError(false);
        if (n >= MAX_PIN_FAILS) { setStep("form"); setNotice(`PIN을 ${MAX_PIN_FAILS}번 틀려서 이체를 멈췄어요. 내용을 확인하고 다시 시작해 주세요.`); setPinFails(0); }
      }, 700));
      return;
    }
    running.current = true;
    setStep("run");
    const input: SendInput = { fromId: from.id, toNumber: number, amount, memo: memo.trim(), pin, key: newIdempotencyKey() };
    attempt.current = input;
    const balanceAfter = from.balance - amount;
    if (!IS_LIVE) await new Promise<void>((r) => timers.current.push(setTimeout(r, 900))); // 데모용 가짜 지연
    try { apply(await tr.send(input), balanceAfter); setStep("result"); } catch (e) { onSendError(e); }
  };

  // 결과 확인: id가 있으면 조회, 없으면(응답 유실) 같은 키로 재전송 — 서버가 기존 결과를 돌려준다
  const recheck = async () => {
    if (result?.kind !== "pending" || checking || !from) return;
    setChecking(true);
    const balanceAfter = from.balance - amount;
    try {
      apply(result.transferId ? await tr.check(result.transferId) : await tr.send(attempt.current!), balanceAfter);
    } catch (e) {
      if (result.transferId) flash("아직 확인하지 못했어요. 잠시 후 다시 확인해 주세요.");
      else onSendError(e);
    } finally { setChecking(false); }
  };
  const recheckRef = useRef(recheck);
  useEffect(() => { recheckRef.current = recheck; });
  const pendingId = result?.kind === "pending" ? result.transferId : undefined;
  useEffect(() => {
    // 처리중(PENDING)이면 3초마다 최대 10번 자동 확인
    if (!IS_LIVE || !pendingId) return;
    let n = 0;
    const t = setInterval(() => { if (++n > 10) clearInterval(t); else void recheckRef.current(); }, 3000);
    return () => clearInterval(t);
  }, [pendingId]);

  // ───────── 결과 ─────────
  if (step === "run") {
    return (
      <div className="ian-screen">
        <AppBar title="이체" hideBack />
        <div className="ian-screen__body" role="status" aria-live="polite">
          <div className="ian-result" data-state="pending">
            <div className="ian-result__mark" aria-hidden="true" />
            <div className="ian-t-title1">보내고 있어요</div>
            <div className="ian-result__desc">화면을 닫거나 다시 누르지 말고 잠시만 기다려 주세요.</div>
          </div>
        </div>
      </div>
    );
  }

  if (step === "result" && result) {
    return (
      <div className="ian-screen">
        <AppBar title="이체" hideBack />
        <div className="ian-screen__body">
          {result.kind === "success" && (
            <>
              <div className="ian-result" data-state="success" role="status">
                <div className="ian-result__mark" aria-hidden="true" />
                <div className="ian-t-title1">{result.transfer.toName}님에게<br />{wonUnit(result.transfer.amount)}을 보냈어요</div>
                <div className="ian-result__desc">이체가 완료됐어요. 거래내역에서 확인할 수 있어요.</div>
              </div>
              <div className="ian-receipt">
                <dl className="ian-receipt__rows">
                  <div className="ian-receipt__row"><dt>받는 분</dt><dd>{result.transfer.toName} {maskAccount(result.transfer.toNumber)}</dd></div>
                  <div className="ian-receipt__row"><dt>출금 계좌</dt><dd>{from?.alias} {from ? maskAccount(from.number) : ""}</dd></div>
                  {result.transfer.memo && <div className="ian-receipt__row"><dt>메모</dt><dd>{result.transfer.memo}</dd></div>}
                  <div className="ian-receipt__row"><dt>이체 후 잔액</dt><dd className="ian-num">{wonUnit(result.balanceAfter)}</dd></div>
                  <div className="ian-receipt__row ian-receipt__row--total"><dt>보낸 금액</dt><dd>{wonUnit(result.transfer.amount)}</dd></div>
                </dl>
              </div>
            </>
          )}
          {result.kind === "failed" && (
            <>
              <div className="ian-result" data-state="failed" role="alert">
                <div className="ian-result__mark" aria-hidden="true" />
                <div className="ian-t-title1">이체하지 못했어요</div>
                <div className="ian-result__desc">{result.message}</div>
              </div>
              <div className="ian-notice"><div>돈은 빠져나가지 않았어요. 내용을 고쳐서 다시 보낼 수 있어요.</div></div>
            </>
          )}
          {result.kind === "pending" && (
            <>
              <div className="ian-result" data-state="pending" role="status">
                <div className="ian-result__mark" aria-hidden="true" />
                <div className="ian-t-title1">결과를 확인하고 있어요</div>
                <div className="ian-result__desc">다시 보내지 말고 잠시 기다려 주세요. 먼저 거래내역에서 출금 여부를 확인해 주세요.</div>
              </div>
              <div className="ian-notice ian-notice--warn"><div><b className="ian-notice__title">같은 이체를 또 하면 두 번 나갈 수 있어요</b>처리가 끝나면 거래내역에 반영돼요.</div></div>
            </>
          )}
        </div>
        <div className="ian-screen__footer ian-stack">
          {result.kind === "failed" && <button className="ian-btn ian-btn--primary ian-btn--block" onClick={() => { running.current = false; setResult(null); setStep("form"); }}>내용 고쳐서 다시 보내기</button>}
          {result.kind === "success" && <button className="ian-btn ian-btn--outline ian-btn--block" onClick={reset}>다른 곳에 또 보내기</button>}
          {result.kind === "pending" && IS_LIVE && <button className="ian-btn ian-btn--outline ian-btn--block" disabled={checking} onClick={() => void recheck()}>{checking ? "확인하고 있어요" : "결과 다시 확인"}</button>}
          <Link href="/home" className="ian-btn ian-btn--primary ian-btn--block">{result.kind === "pending" ? "홈에서 거래내역 확인" : "홈으로"}</Link>
        </div>
      </div>
    );
  }

  // ───────── PIN ─────────
  if (step === "pin") {
    return (
      <div className="ian-screen">
        <AppBar title="" onBack={() => { setPinError(false); setStep("form"); }} />
        <div className="ian-screen__body">
          <Stepper total={3} current={2} />
          <div className="ian-t-title1">PIN 6자리를<br />입력해 주세요</div>
          <div className="ian-t-caption">{verifiedName}님에게 {wonUnit(amount)}을 보내요.</div>
        </div>
        <div style={{ paddingBottom: 40 }}>
          <PinPad onComplete={onPin} error={pinError} label={pinError ? `PIN이 맞지 않아요. 다시 입력해 주세요.${IS_LIVE ? "" : ` (${pinFails}/${MAX_PIN_FAILS})`}` : "PIN 6자리를 입력해 주세요"} />
        </div>
      </div>
    );
  }

  // ───────── 입력 ─────────
  if (usable.length === 0 && (accLoading || accError)) {
    return (
      <div className="ian-screen">
        <AppBar title="이체" onBack={() => router.back()} />
        <div className="ian-screen__body">
          <div className="ian-empty" role={accError ? "alert" : "status"}>
            <b className="ian-t-title2">{accError ? "계좌를 불러오지 못했어요" : "계좌를 불러오고 있어요"}</b>
            {accError && <><span className="ian-t-caption">{accError}</span><button type="button" className="ian-btn ian-btn--primary ian-btn--sm" onClick={() => void refreshAccounts()}>다시 시도</button></>}
          </div>
        </div>
      </div>
    );
  }

  if (usable.length === 0) {
    return (
      <div className="ian-screen">
        <AppBar title="이체" onBack={() => router.back()} />
        <div className="ian-screen__body">
          <div className="ian-empty">
            <b className="ian-t-title2">이체할 수 있는 계좌가 없어요</b>
            <span className="ian-t-caption">정상 상태의 입출금 계좌가 있어야 보낼 수 있어요. 거래중지 계좌는 계좌 관리에서 해제해 주세요.</span>
            <Link href="/home" className="ian-btn ian-btn--primary ian-btn--sm">홈으로</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ian-screen">
      <AppBar title="이체" />
      <div className="ian-screen__body" style={{ paddingBottom: 24 }}>
        <Stepper total={3} current={0} />
        {notice && <div className="ian-notice ian-notice--danger" role="alert"><div>{notice}</div></div>}

        <div className="ian-field">
          <span className="ian-field__label" id="from-label">출금 계좌</span>
          <div className="ian-quick" role="group" aria-labelledby="from-label">
            {usable.map((a) => (
              <button key={a.id} type="button" className="ian-chip" style={{ minHeight: 48 }} aria-pressed={a.id === fromId} onClick={() => { setFromId(a.id); setPinFails(0); }}>{a.alias} {maskAccount(a.number)}</button>
            ))}
          </div>
          {from && <span className="ian-field__hint">잔액 <span className="ian-num">{wonUnit(from.balance)}</span></span>}
        </div>

        <div>
          <div className="ian-section-head"><b className="ian-t-title2">누구에게</b></div>
          {people.length > 0 && (
            <div className="ian-rail" role="group" aria-label="최근·자주 쓰는 계좌">
              {people.map((p) => (
                <button key={p.number} type="button" className="ian-person" aria-pressed={p.number === number} aria-label={`${p.label}${p.favorite ? ", 즐겨찾기" : ""} ${maskAccount(p.number)}`} style={{ minHeight: 48 }} onClick={() => pickPerson(p.number)}>
                  <span className="ian-avatar">{p.label.slice(0, 1)}</span>{p.favorite ? "★ " : ""}{p.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="ian-field">
          <label className="ian-field__label" htmlFor="to-number">받는 계좌번호</label>
          <div className="ian-field--inline">
            <input id="to-number" className="ian-input" inputMode="numeric" autoComplete="off" placeholder="000-0000-0000" value={number}
              aria-invalid={numberError ? true : undefined} aria-describedby={numberError ? "to-error" : "to-hint"}
              onChange={(e) => pickNumber(formatNumber(e.target.value))} onKeyDown={(e) => { if (e.key === "Enter") void lookup(); }} />
            <button type="button" className="ian-btn ian-btn--soft" style={{ minHeight: 56 }} onClick={() => void lookup()}>수취인 확인</button>
          </div>
          {numberError
            ? <span id="to-error" className="ian-field__error" role="alert">{numberError}</span>
            : verifiedName
              ? (
                <span id="to-hint" className="ian-field__hint" role="status">
                  <b>✓ 예금주 {verifiedName}님</b> · {maskAccount(number)}
                  <button type="button" className="ian-star" aria-pressed={!!favPerson?.favorite} aria-label={`${verifiedName} 자주 쓰는 계좌 즐겨찾기`}
                    onClick={() => { toggleFavorite(number, verifiedName).then((on) => flash(on ? "즐겨찾기에 추가했어요" : "즐겨찾기에서 뺐어요"), (e) => flash(errorMessage(e))); }}>
                    {favPerson?.favorite ? "★" : "☆"}
                  </button>
                </span>
              )
              : <span id="to-hint" className="ian-field__hint">IAN Bank 계좌로만 보낼 수 있어요. 번호를 넣고 수취인 확인을 눌러 주세요.</span>}
        </div>

        <div>
          <label className="ian-t-caption" htmlFor="amount">보낼 금액</label>
          <div className="ian-amount" data-invalid={amountError ? "true" : undefined}>
            <div className="ian-amount__line">
              <input id="amount" className="ian-amount__input" inputMode="numeric" autoComplete="off" placeholder="0" value={amountText ? won(amount) : ""}
                aria-invalid={amountError ? true : undefined} aria-describedby={amountError ? "amount-error" : "limit-meter"}
                onChange={(e) => setAmountText(e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 12))} />
              <span className="ian-amount__unit">원</span>
            </div>
            {amountError && <span id="amount-error" className="ian-field__error" role="alert">{amountError}</span>}
          </div>
          <div className="ian-quick" role="group" aria-label="빠른 금액">
            <button type="button" className="ian-chip" style={{ minHeight: 48 }} onClick={() => addAmount(10000)}>+1만</button>
            <button type="button" className="ian-chip" style={{ minHeight: 48 }} onClick={() => addAmount(50000)}>+5만</button>
            <button type="button" className="ian-chip" style={{ minHeight: 48 }} onClick={() => addAmount(100000)}>+10만</button>
            <button type="button" className="ian-chip" style={{ minHeight: 48 }} onClick={() => from && setAmountText(String(from.balance))}>전액</button>
          </div>
        </div>

        {from && lim && (
          <div className="ian-tile ian-tile--wide" style={{ minHeight: 0 }} id="limit-meter">
            <div className="ian-row ian-row--between"><b>오늘 쓸 수 있는 한도</b><span className="ian-t-caption">{wonUnit(leftToday)} 남음</span></div>
            <div className="ian-meter" data-level={dailyPct >= 80 ? "high" : undefined}>
              <div className="ian-meter__bar" role="img" aria-label={`1일 한도 ${wonUnit(lim.dailyLimit)} 중 ${dailyPct}% 사용`}><i style={{ "--v": `${dailyPct}%` } as React.CSSProperties} /></div>
              <div className="ian-row ian-row--between ian-t-micro"><span>사용 {wonUnit(usedToday)}</span><span>1일 {wonUnit(lim.dailyLimit)}</span></div>
              <div className="ian-t-micro">이번 달 {wonUnit(leftMonth)} 남음 (한 달 {wonUnit(lim.monthlyLimit)})</div>
            </div>
          </div>
        )}

        <div className="ian-field">
          <label className="ian-field__label" htmlFor="memo">메모 (선택)</label>
          <input id="memo" className="ian-input" maxLength={20} placeholder="받는 분에게 보여요" value={memo} aria-describedby="memo-hint" onChange={(e) => setMemo(e.target.value)} />
          <span id="memo-hint" className="ian-field__hint">최대 20자까지 쓸 수 있어요. {memo.length}/20</span>
        </div>
      </div>
      <div className="ian-screen__footer">
        <button type="button" className="ian-btn ian-btn--primary ian-btn--block" disabled={!canNext} onClick={() => { setNotice(""); setConfirmOpen(true); }}>다음</button>
      </div>
      {toast && <div className="ian-toast" role="status"><span className="ian-toast__mark">✓</span>{toast}</div>}

      <Sheet open={confirmOpen} onClose={() => setConfirmOpen(false)} label="이체 최종 확인">
        <div className="ian-t-title2">{verifiedName}님에게<br />{wonUnit(amount)}을 보낼까요?</div>
        <div className="ian-receipt">
          <div className="ian-receipt__who"><span className="ian-avatar">{verifiedName?.slice(0, 1)}</span><div><b>{verifiedName}</b><div className="ian-t-caption">{maskAccount(number)}</div></div></div>
          <dl className="ian-receipt__rows">
            <div className="ian-receipt__row"><dt>출금 계좌</dt><dd>{from?.alias} {from ? maskAccount(from.number) : ""}</dd></div>
            {memo.trim() && <div className="ian-receipt__row"><dt>메모</dt><dd>{memo.trim()}</dd></div>}
            <div className="ian-receipt__row"><dt>이체 수수료</dt><dd>없음</dd></div>
            <div className="ian-receipt__row"><dt>이체 후 잔액</dt><dd className="ian-num">{from ? wonUnit(from.balance - amount) : ""}</dd></div>
            <div className="ian-receipt__row ian-receipt__row--total"><dt>보낼 금액</dt><dd>{wonUnit(amount)}</dd></div>
          </dl>
        </div>
        <div className="ian-row">
          <button type="button" className="ian-btn ian-btn--outline" style={{ flex: 1 }} onClick={() => setConfirmOpen(false)}>취소</button>
          <button type="button" className="ian-btn ian-btn--primary" style={{ flex: 2 }} onClick={() => { setConfirmOpen(false); setPinFails(0); setPinError(false); setStep("pin"); }}>PIN으로 확인</button>
        </div>
      </Sheet>
    </div>
  );
}
