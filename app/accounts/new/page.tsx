"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { AppBar } from "@/components/AppBar";
import { Stepper } from "@/components/Stepper";
import { Sheet } from "@/components/Sheet";
import { IS_LIVE } from "@/lib/api/mode";
import { errorMessage } from "@/lib/api/errors";
import { useOpenAccount } from "@/lib/services/useOpenAccount";
import { wonUnit } from "@/lib/format";
import type { Account } from "@/lib/types";
import { Frame, SheetBody, useToast } from "../_components/Frame";
import { CopyNumber } from "../_components/CopyNumber";
import css from "./new.module.css";

const STEPS = ["상품 안내", "약관 동의", "통장 비밀번호", "목적·거래정보"];
const PURPOSES = ["급여·생활비", "저축·모으기", "용돈·소액 거래", "사업·부수입", "기타"];
const SOURCES = ["근로소득", "사업소득", "용돈·가족 지원", "기타"];
const DEFAULT_DAILY = 1_000_000;
const DEFAULT_MONTHLY = 5_000_000;
const digits = (v: string) => v.replace(/\D/g, "").slice(0, 4);

export default function NewAccountPage() {
  const { product, terms: TERMS, loading: infoLoading, error: infoError, retry, open } = useOpenAccount();
  const [step, setStep] = useState(0);
  const [agree, setAgree] = useState<Record<string, boolean>>({});
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [alias, setAlias] = useState("");
  const [purpose, setPurpose] = useState("");
  const [source, setSource] = useState("");
  const [tried, setTried] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [failMsg, setFailMsg] = useState("");
  const [created, setCreated] = useState<Account | null>(null);
  const lock = useRef(false);
  const { toast, showToast } = useToast();

  const reqOk = TERMS.filter((t) => t.req).every((t) => agree[t.id]);
  const allOn = TERMS.every((t) => agree[t.id]);
  const pwErr = !/^\d{4}$/.test(pw) ? "숫자 4자리를 입력해 주세요." : "";
  const pw2Err = !pwErr && pw2 !== pw ? "비밀번호가 서로 달라요. 같은 숫자를 다시 입력해 주세요." : !/^\d{4}$/.test(pw2) ? "비밀번호를 한 번 더 입력해 주세요." : "";
  const infoErr = { purpose: purpose ? "" : "개설 목적을 골라 주세요.", source: source ? "" : "자금 출처를 골라 주세요." };

  const back = () => { setTried(false); if (step === 0) history.back(); else setStep(step - 1); };
  const next = () => {
    if (step === 0 && IS_LIVE && (infoLoading || !product || !TERMS.length)) return;   // 상품·약관을 받아야 진행
    if (step === 1 && !reqOk) { setTried(true); return; }
    if (step === 2 && (pwErr || pw2Err)) { setTried(true); return; }
    if (step === 3) { if (infoErr.purpose || infoErr.source) { setTried(true); return; } setFailed(false); setConfirmOpen(true); return; }
    setTried(false); setStep(step + 1);
  };

  const submit = async () => {
    if (lock.current) return;          // 중복 신청 차단
    lock.current = true; setBusy(true); setFailed(false);
    try {
      const acc = await open({ alias: alias.trim(), password: pw, purpose, fundSource: source, agreed: agree });
      setPw(""); setPw2("");
      setCreated(acc); setConfirmOpen(false);
    } catch (e) {
      setFailMsg(IS_LIVE ? errorMessage(e) : "");
      setFailed(true);
    } finally {
      lock.current = false; setBusy(false);
    }
  };

  // ---- 완료 ----
  if (created) {
    return (
      <Frame overlay={toast}>
        <AppBar title="계좌 개설" hideBack />
        <div className="ian-screen__body">
          <div className="ian-result" data-state="success">
            <div className="ian-result__mark" aria-hidden="true" />
            <h1 className="ian-t-title1" role="status">{created.alias} 계좌를<br />열었어요</h1>
            <p className="ian-result__desc">이제 이체와 카드 결제에 쓸 수 있어요.</p>
          </div>
          <dl className="ian-receipt" style={{ margin: 0 }}>
            <div className="ian-receipt__rows" style={{ borderTop: 0, paddingTop: 0 }}>
              <div className="ian-receipt__row"><dt>신규 계좌번호</dt><dd><CopyNumber number={created.number} onResult={(ok) => showToast(ok ? "계좌번호를 복사했어요" : "복사하지 못했어요. 다시 시도해 주세요")} /></dd></div>
              <div className="ian-receipt__row"><dt>상품</dt><dd>{created.product}</dd></div>
              <div className="ian-receipt__row"><dt>기본 1일 한도</dt><dd className="ian-num">{wonUnit(created.dailyLimit)}</dd></div>
              <div className="ian-receipt__row"><dt>기본 1달 한도</dt><dd className="ian-num">{wonUnit(created.monthlyLimit)}</dd></div>
            </div>
          </dl>
          <p className="ian-t-caption">한도는 계좌 관리에서 PIN을 확인하고 바꿀 수 있어요.</p>
        </div>
        <div className="ian-screen__footer">
          <Link href={`/cards/new?account=${created.id}`} className="ian-btn ian-btn--primary ian-btn--block">체크카드 신청</Link>
          <Link href="/home" className="ian-btn ian-btn--outline ian-btn--block">홈으로</Link>
        </div>
      </Frame>
    );
  }

  const stepCta = step === 0 ? "신청하기" : step === 3 ? "최종 확인" : "다음";

  return (
    <Frame
      overlay={
        <>
          <Sheet open={confirmOpen} onClose={() => { if (!busy) setConfirmOpen(false); }} label="계좌 개설 최종 확인">
            <SheetBody>
              <div className="ian-t-title2">이 내용으로 계좌를 열까요?</div>
              <div className="ian-receipt">
                <dl className="ian-receipt__rows" style={{ borderTop: 0, paddingTop: 0, margin: 0 }}>
                  <div className="ian-receipt__row"><dt>상품</dt><dd>IAN 입출금통장</dd></div>
                  <div className="ian-receipt__row"><dt>계좌 별칭</dt><dd>{alias.trim() || "입출금통장"}</dd></div>
                  <div className="ian-receipt__row"><dt>개설 목적</dt><dd>{purpose}</dd></div>
                  <div className="ian-receipt__row"><dt>자금 출처</dt><dd>{source}</dd></div>
                  <div className="ian-receipt__row"><dt>통장 비밀번호</dt><dd>••••</dd></div>
                  {!IS_LIVE && <div className="ian-receipt__row"><dt>기본 한도</dt><dd className="ian-num">일 {wonUnit(DEFAULT_DAILY)} · 월 {wonUnit(DEFAULT_MONTHLY)}</dd></div>}
                </dl>
              </div>
              {failed && (
                <div className="ian-notice ian-notice--danger" role="alert"><div><b className="ian-notice__title">계좌를 열지 못했어요</b>{failMsg || "일시적인 문제예요."} 입력한 내용은 그대로 있으니 다시 시도해 주세요.</div></div>
              )}
              <div className="ian-row">
                <button type="button" className="ian-btn ian-btn--outline" style={{ flex: 1 }} onClick={() => setConfirmOpen(false)} disabled={busy}>수정하기</button>
                <button type="button" className="ian-btn ian-btn--primary" style={{ flex: 2 }} onClick={() => void submit()} aria-busy={busy} disabled={busy}>{busy ? "여는 중이에요" : failed ? "다시 시도" : "계좌 개설하기"}</button>
              </div>
            </SheetBody>
          </Sheet>
          {toast}
        </>
      }
    >
      <AppBar title="계좌 개설" onBack={back} />
      <div className="ian-screen__body" style={{ paddingBottom: 24 }}>
        <Stepper total={STEPS.length} current={step} />
        <p className="ian-t-caption" aria-live="polite">{step + 1}/{STEPS.length} · {STEPS[step]}</p>

        {step === 0 && (
          <>
            <h1 className="ian-t-title1">수수료 없는<br />입출금통장을 열어요</h1>
            <div className="ian-tile ian-tile--tint" style={{ minHeight: 0 }}>
              <b className="ian-t-title2">{product?.name ?? "IAN 입출금통장"}</b>
              <div className={css.rate}><span className="ian-t-caption">연 금리</span><span className="ian-t-amount">{product ? product.rate : "-"}<span className="ian-unit">%</span></span></div>
              <p className="ian-tile__sub">{(IS_LIVE && product?.description) || "월급 받기, 생활비 쓰기, 이체와 체크카드 연결까지 한 통장으로 쓸 수 있어요. 가입 조건 없이 누구나 열 수 있어요."}</p>
            </div>
            {!IS_LIVE && (
              <ul className="ian-t-caption" style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 4 }}>
                <li>개설 즉시 1일 100만원, 1달 500만원까지 이체할 수 있어요.</li>
                <li>한도는 개설 뒤 계좌 관리에서 바꿀 수 있어요.</li>
              </ul>
            )}
            {infoError && (
              <div className="ian-notice ian-notice--danger" role="alert">
                <div><b className="ian-notice__title">상품 정보를 불러오지 못했어요</b>{infoError}
                  <div style={{ marginTop: "var(--ian-s-3)" }}><button type="button" className="ian-btn ian-btn--danger-soft ian-btn--sm" onClick={() => void retry()}>다시 불러오기</button></div>
                </div>
              </div>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="ian-t-title1">약관을 확인하고<br />동의해 주세요</h1>
            <div className={css.termBox}>
              <label className={`ian-check ${css.termAll}`}>
                <input type="checkbox" checked={allOn} onChange={(e) => setAgree(Object.fromEntries(TERMS.map((t) => [t.id, e.target.checked])))} />
                <b>전체 동의</b>
              </label>
              {TERMS.map((t) => (
                <label key={t.id} className="ian-check">
                  <input type="checkbox" checked={!!agree[t.id]} onChange={(e) => setAgree({ ...agree, [t.id]: e.target.checked })} aria-describedby={tried && t.req && !agree[t.id] ? "terms-err" : undefined} />
                  <span><span className={`ian-check__tag ${t.req ? "" : "ian-check__tag--opt"}`}>{t.req ? "필수" : "선택"}</span>{t.label}{t.content && <details onClick={(e) => e.stopPropagation()}><summary className="ian-t-micro">내용 보기</summary><span className="ian-t-micro" style={{ whiteSpace: "pre-wrap" }}>{t.content}</span></details>}</span>
                </label>
              ))}
            </div>
            {infoError && <span className="ian-field__error" role="alert">약관을 불러오지 못했어요. 상품 안내에서 다시 불러와 주세요.</span>}
            {tried && !reqOk && <span id="terms-err" className="ian-field__error" role="alert">필수 약관에 모두 동의해야 계좌를 열 수 있어요.</span>}
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="ian-t-title1">통장 비밀번호<br />숫자 4자리를 정해요</h1>
            <div className="ian-field">
              <label className="ian-field__label" htmlFor="pw1">통장 비밀번호<span className="ian-req">*</span></label>
              <input id="pw1" className={`ian-input ${css.pwInput}`} type="password" inputMode="numeric" autoComplete="new-password" maxLength={4} value={pw} onChange={(e) => setPw(digits(e.target.value))} aria-invalid={tried && !!pwErr} aria-describedby={tried && pwErr ? "pw1-err" : "pw1-hint"} />
              {tried && pwErr ? <span id="pw1-err" className="ian-field__error" role="alert">{pwErr}</span> : <span id="pw1-hint" className="ian-field__hint">연속되거나 생일 같은 쉬운 숫자는 피해 주세요.</span>}
            </div>
            <div className="ian-field">
              <label className="ian-field__label" htmlFor="pw2">비밀번호 확인<span className="ian-req">*</span></label>
              <input id="pw2" className={`ian-input ${css.pwInput}`} type="password" inputMode="numeric" autoComplete="new-password" maxLength={4} value={pw2} onChange={(e) => setPw2(digits(e.target.value))} aria-invalid={tried && !!pw2Err} aria-describedby={tried && pw2Err ? "pw2-err" : undefined} />
              {tried && pw2Err && <span id="pw2-err" className="ian-field__error" role="alert">{pw2Err}</span>}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="ian-t-title1">어떻게 쓸 계좌인지<br />알려 주세요</h1>
            <div className="ian-field">
              <label className="ian-field__label" htmlFor="alias">계좌 별칭 (선택)</label>
              <input id="alias" className="ian-input" maxLength={20} placeholder="예: 생활비" value={alias} onChange={(e) => setAlias(e.target.value)} aria-describedby="alias-hint" />
              <span id="alias-hint" className="ian-field__hint">비워 두면 &apos;입출금통장&apos;으로 만들어요.</span>
            </div>
            <fieldset className={css.fieldset} aria-describedby={tried && infoErr.purpose ? "purpose-err" : undefined}>
              <legend className={css.legend}>개설 목적<span className="ian-req">*</span></legend>
              <div className={css.chips}>{PURPOSES.map((p) => <button key={p} type="button" className="ian-chip" aria-pressed={purpose === p} onClick={() => setPurpose(p)}>{p}</button>)}</div>
              {tried && infoErr.purpose && <span id="purpose-err" className="ian-field__error" role="alert">{infoErr.purpose}</span>}
            </fieldset>
            <fieldset className={css.fieldset} aria-describedby={tried && infoErr.source ? "source-err" : undefined}>
              <legend className={css.legend}>주된 자금 출처<span className="ian-req">*</span></legend>
              <div className={css.chips}>{SOURCES.map((p) => <button key={p} type="button" className="ian-chip" aria-pressed={source === p} onClick={() => setSource(p)}>{p}</button>)}</div>
              {tried && infoErr.source && <span id="source-err" className="ian-field__error" role="alert">{infoErr.source}</span>}
            </fieldset>
            <p className="ian-t-caption">금융거래 확인을 위해 필요한 정보예요. 입력한 내용은 다음 화면에서 한 번 더 확인해요.</p>
          </>
        )}
      </div>
      <div className="ian-screen__footer">
        <button type="button" className="ian-btn ian-btn--primary ian-btn--block" onClick={next} aria-disabled={(step === 1 && !reqOk) || (step === 0 && IS_LIVE && (infoLoading || !product || !TERMS.length)) ? true : undefined}>{stepCta}</button>
        {step === 0 && <p className="ian-t-micro" style={{ textAlign: "center" }}>계좌번호는 개설 후에 발급돼요.</p>}
      </div>
    </Frame>
  );
}
