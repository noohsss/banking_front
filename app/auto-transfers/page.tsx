"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AppBar } from "@/components/AppBar";
import { Sheet } from "@/components/Sheet";
import { useAccounts } from "@/lib/services/useAccounts";
import { useAutoTransfers } from "@/lib/services/useAutoTransfers";
import { useTransfer } from "@/lib/services/useTransfer";
import { IS_LIVE } from "@/lib/api/mode";
import { errorMessage } from "@/lib/api/errors";
import { maskAccount, won, wonUnit } from "@/lib/format";
import type { AutoTransfer } from "@/lib/types";

const ACCOUNT_RE = /^\d{3}-\d{4}-\d{4}$/;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"]; // runDay(매주)는 이 한 글자로 저장
const MONTH_DAYS = Array.from({ length: 28 }, (_, i) => String(i + 1));

const formatNumber = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return [d.slice(0, 3), d.slice(3, 7), d.slice(7, 11)].filter(Boolean).join("-");
};

const pad = (n: number) => String(n).padStart(2, "0");
const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (k: string) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const fmtKey = (k: string) => { const d = parseKey(k); return `${d.getMonth() + 1}월 ${d.getDate()}일(${WEEKDAYS[d.getDay()]})`; };

/** 오늘 이후(오늘 포함) 첫 실행일. 종료일이 지났으면 null */
function nextRun(a: Pick<AutoTransfer, "cycle" | "runDay" | "startDate" | "endDate">, todayKey: string): string | null {
  const base = a.startDate > todayKey ? a.startDate : todayKey;
  const d = parseKey(base);
  if (a.cycle === "WEEKLY") {
    const idx = WEEKDAYS.indexOf(a.runDay);
    while (d.getDay() !== idx) d.setDate(d.getDate() + 1);
  } else {
    const day = Number(a.runDay);
    if (d.getDate() > day) { d.setMonth(d.getMonth() + 1, 1); }
    d.setDate(day);
  }
  const k = toKey(d);
  return a.endDate && k > a.endDate ? null : k;
}

const scheduleText = (a: Pick<AutoTransfer, "cycle" | "runDay">) => (a.cycle === "WEEKLY" ? `매주 ${a.runDay}요일` : `매월 ${a.runDay}일`);

type View = "list" | "form" | "done";

export default function AutoTransfersPage() {
  const { accounts, loading: accLoading, error: accError, refresh: refreshAccounts } = useAccounts();
  const { autos, loading: autosLoading, error: autosError, refresh: refreshAutos, add, cancel, toggle } = useAutoTransfers();
  const { lookup: lookupRecipient } = useTransfer();
  const usable = useMemo(() => accounts.filter((a) => a.status === "ACTIVE"), [accounts]);
  const todayKey = toKey(new Date());
  const tomorrowKey = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return toKey(d); })();

  const [view, setView] = useState<View>("list");
  const [created, setCreated] = useState<AutoTransfer | null>(null);

  // 폼 상태
  const [fromId, setFromId] = useState("");
  const [number, setNumber] = useState("");
  const [name, setName] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [amountText, setAmountText] = useState("");
  const [cycle, setCycle] = useState<"WEEKLY" | "MONTHLY">("MONTHLY");
  const [runDay, setRunDay] = useState("1");
  const [start, setStart] = useState(tomorrowKey);
  const [end, setEnd] = useState("");
  const [tried, setTried] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [busy, setBusy] = useState(false);
  const lookupFor = useRef("");
  const [confirmId, setConfirmId] = useState<string | null>(null); // live: 해지 확인
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [listError, setListError] = useState("");

  const openForm = () => {
    setFromId((usable.find((a) => a.id === fromId) ?? usable[0])?.id ?? "");
    setNumber(""); setName(null); setLookupError(""); setAmountText(""); setCycle("MONTHLY"); setRunDay("1"); setStart(tomorrowKey); setEnd(""); setTried(false); setSubmitError(""); lookupFor.current = "";
    setView("form");
  };

  const from = accounts.find((a) => a.id === fromId);
  const amount = Number(amountText || 0);

  const lookup = async () => {
    const num = number;
    lookupFor.current = num;
    if (!ACCOUNT_RE.test(num)) { setName(null); setLookupError("계좌번호 11자리를 000-0000-0000 모양으로 입력해 주세요."); return; }
    let n: string | null;
    try { n = await lookupRecipient(num); } catch (e) {
      if (lookupFor.current === num) { setName(null); setLookupError(errorMessage(e)); }
      return;
    }
    if (lookupFor.current !== num) return;
    if (!n) { setName(null); setLookupError("IAN Bank에서 확인되지 않는 계좌예요. 번호를 다시 확인해 주세요."); return; }
    setLookupError(""); setName(n);
  };

  const errors = {
    from: from ? "" : "출금 계좌를 선택해 주세요.",
    to: from && number === from.number ? "출금 계좌와 같은 계좌예요. 다른 계좌번호를 입력해 주세요." : lookupError || (!name ? "수취인 확인을 눌러 받는 분을 확인해 주세요." : ""),
    amount: !(amount > 0) ? "금액을 입력해 주세요." : from && amount > from.dailyLimit ? `1일 이체한도 ${wonUnit(from.dailyLimit)}보다 커요. 금액을 줄여 주세요.` : "",
    start: !start ? "시작일을 선택해 주세요." : start < tomorrowKey ? "시작일은 내일부터 골라 주세요." : "",
    end: end && end < start ? "종료일은 시작일 이후로 골라 주세요." : "",
  };
  const valid = !Object.values(errors).some(Boolean);
  const show = (k: keyof typeof errors) => (tried || (k === "to" && !!lookupError) ? errors[k] : "");

  const submit = async () => {
    setTried(true);
    if (!valid || !from || !name || busy) return;
    setBusy(true); setSubmitError("");
    try {
      const au = await add({ fromId: from.id, toNumber: number, toName: name, amount, cycle, runDay, startDate: start, endDate: end || undefined });
      setCreated(au);
      setView("done");
    } catch (e) { setSubmitError(errorMessage(e)); } finally { setBusy(false); }
  };

  // ───────── 등록 결과 ─────────
  if (view === "done" && created) {
    const src = accounts.find((a) => a.id === created.fromId);
    const nr = nextRun(created, todayKey);
    return (
      <div className="ian-screen">
        <AppBar title="자동이체" hideBack />
        <div className="ian-screen__body">
          <div className="ian-result" data-state="success" role="status">
            <div className="ian-result__mark" aria-hidden="true" />
            <div className="ian-t-title1">자동이체를<br />등록했어요</div>
            <div className="ian-result__desc">등록했어요. 실행일에 이체되고, 그때 한도를 다시 확인해요.</div>
          </div>
          <div className="ian-notice"><div><b className="ian-notice__title">아직 송금되지 않았어요</b>지금은 등록만 끝났어요. 돈은 아래 실행일이 되면 나가요.</div></div>
          <div className="ian-receipt">
            <dl className="ian-receipt__rows">
              <div className="ian-receipt__row"><dt>출금 계좌</dt><dd>{src?.alias} {src ? maskAccount(src.number) : ""}</dd></div>
              <div className="ian-receipt__row"><dt>받는 분</dt><dd>{created.toName} {maskAccount(created.toNumber)}</dd></div>
              <div className="ian-receipt__row"><dt>주기</dt><dd>{scheduleText(created)}</dd></div>
              <div className="ian-receipt__row"><dt>첫 실행일</dt><dd>{nr ? fmtKey(nr) : "실행일 없음"}</dd></div>
              <div className="ian-receipt__row"><dt>종료일</dt><dd>{created.endDate ? fmtKey(created.endDate) : "정하지 않음"}</dd></div>
              <div className="ian-receipt__row ian-receipt__row--total"><dt>1회 금액</dt><dd>{wonUnit(created.amount)}</dd></div>
            </dl>
          </div>
        </div>
        <div className="ian-screen__footer">
          <button className="ian-btn ian-btn--primary ian-btn--block" onClick={() => setView("list")}>자동이체 목록 보기</button>
        </div>
      </div>
    );
  }

  // ───────── 등록 폼 ─────────
  if (view === "form") {
    return (
      <div className="ian-screen">
        <AppBar title="자동이체 등록" onBack={() => setView("list")} />
        <div className="ian-screen__body" style={{ paddingBottom: 24 }}>
          {usable.length === 0 ? (
            <div className="ian-empty"><b className="ian-t-title2">출금할 계좌가 없어요</b><span className="ian-t-caption">정상 상태의 입출금 계좌가 있어야 등록할 수 있어요.</span></div>
          ) : (
            <>
              <div className="ian-notice"><div>등록해도 바로 송금되지 않아요. 실행일에 이체되고, 그때 잔액과 한도를 다시 확인해요.</div></div>
              {submitError && <div className="ian-notice ian-notice--danger" role="alert"><div>{submitError}</div></div>}

              <div className="ian-field">
                <span className="ian-field__label" id="af-from">출금 계좌</span>
                <div className="ian-quick" role="group" aria-labelledby="af-from">
                  {usable.map((a) => (
                    <button key={a.id} type="button" className="ian-chip" style={{ minHeight: 48 }} aria-pressed={a.id === fromId} onClick={() => setFromId(a.id)}>{a.alias} {maskAccount(a.number)}</button>
                  ))}
                </div>
                {show("from") && <span className="ian-field__error" role="alert">{show("from")}</span>}
              </div>

              <div className="ian-field">
                <label className="ian-field__label" htmlFor="af-to">받는 계좌번호</label>
                <div className="ian-field--inline">
                  <input id="af-to" className="ian-input" inputMode="numeric" autoComplete="off" placeholder="000-0000-0000" value={number}
                    aria-invalid={show("to") ? true : undefined} aria-describedby="af-to-msg"
                    onChange={(e) => { lookupFor.current = ""; setNumber(formatNumber(e.target.value)); setName(null); setLookupError(""); }}
                    onKeyDown={(e) => { if (e.key === "Enter") void lookup(); }} />
                  <button type="button" className="ian-btn ian-btn--soft" style={{ minHeight: 56 }} onClick={() => void lookup()}>수취인 확인</button>
                </div>
                {show("to")
                  ? <span id="af-to-msg" className="ian-field__error" role="alert">{show("to")}</span>
                  : <span id="af-to-msg" className="ian-field__hint" role="status">{name ? <b>✓ 예금주 {name}님 · {maskAccount(number)}</b> : "IAN Bank 계좌로만 보낼 수 있어요."}</span>}
              </div>

              <div className="ian-field">
                <label className="ian-field__label" htmlFor="af-amount">1회 이체 금액</label>
                <input id="af-amount" className="ian-input ian-num" inputMode="numeric" autoComplete="off" placeholder="0" value={amountText ? won(amount) : ""}
                  aria-invalid={show("amount") ? true : undefined} aria-describedby="af-amount-msg"
                  onChange={(e) => setAmountText(e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 12))} />
                {show("amount")
                  ? <span id="af-amount-msg" className="ian-field__error" role="alert">{show("amount")}</span>
                  : <span id="af-amount-msg" className="ian-field__hint">원 단위로 입력해 주세요.{from ? ` 1일 이체한도는 ${wonUnit(from.dailyLimit)}예요.` : ""}</span>}
              </div>

              <div className="ian-field">
                <span className="ian-field__label" id="af-cycle">주기</span>
                <div className="ian-segmented" role="group" aria-labelledby="af-cycle">
                  <button type="button" className="ian-segmented__opt" aria-pressed={cycle === "MONTHLY"} style={{ minHeight: 48 }} onClick={() => { setCycle("MONTHLY"); setRunDay("1"); }}>매월</button>
                  <button type="button" className="ian-segmented__opt" aria-pressed={cycle === "WEEKLY"} style={{ minHeight: 48 }} onClick={() => { setCycle("WEEKLY"); setRunDay("월"); }}>매주</button>
                </div>
              </div>

              <div className="ian-field">
                <span className="ian-field__label" id="af-day">{cycle === "WEEKLY" ? "실행 요일" : "실행일 (1~28일)"}</span>
                <div className="ian-quick" role="group" aria-labelledby="af-day">
                  {(cycle === "WEEKLY" ? WEEKDAYS.slice(1).concat(WEEKDAYS[0]) : MONTH_DAYS).map((d) => (
                    <button key={d} type="button" className="ian-chip" style={{ minHeight: 48, minWidth: 48, justifyContent: "center" }} aria-pressed={runDay === d} onClick={() => setRunDay(d)}>{cycle === "WEEKLY" ? d : `${d}일`}</button>
                  ))}
                </div>
                <span className="ian-field__hint">{cycle === "MONTHLY" ? "29~31일은 말일 처리가 달라서 28일까지만 고를 수 있어요." : `${runDay}요일마다 이체해요.`}</span>
              </div>

              <div className="ian-field">
                <label className="ian-field__label" htmlFor="af-start">시작일</label>
                <input id="af-start" className="ian-input" type="date" min={tomorrowKey} value={start}
                  aria-invalid={show("start") ? true : undefined} aria-describedby={show("start") ? "af-start-err" : undefined}
                  onChange={(e) => setStart(e.target.value)} />
                {show("start") && <span id="af-start-err" className="ian-field__error" role="alert">{show("start")}</span>}
              </div>

              <div className="ian-field">
                <label className="ian-field__label" htmlFor="af-end">종료일 (선택)</label>
                <input id="af-end" className="ian-input" type="date" min={start || tomorrowKey} value={end}
                  aria-invalid={show("end") ? true : undefined} aria-describedby={show("end") ? "af-end-err" : "af-end-hint"}
                  onChange={(e) => setEnd(e.target.value)} />
                {show("end")
                  ? <span id="af-end-err" className="ian-field__error" role="alert">{show("end")}</span>
                  : <span id="af-end-hint" className="ian-field__hint">비워 두면 해지하거나 끌 때까지 계속돼요.</span>}
              </div>
            </>
          )}
        </div>
        {usable.length > 0 && (
          <div className="ian-screen__footer ian-row">
            <button type="button" className="ian-btn ian-btn--outline" style={{ flex: 1 }} onClick={() => setView("list")}>취소</button>
            <button type="button" className="ian-btn ian-btn--primary" style={{ flex: 2 }} disabled={busy} onClick={() => void submit()}>{busy ? "등록하고 있어요" : "등록하기"}</button>
          </div>
        )}
      </div>
    );
  }

  // ───────── 목록 ─────────
  const loadError = autos.length === 0 && (autosError || (accounts.length === 0 && accError));
  if (loadError || (autos.length === 0 && (autosLoading || (accLoading && accounts.length === 0)))) {
    return (
      <div className="ian-screen">
        <AppBar title="자동이체" />
        <div className="ian-screen__body">
          <div className="ian-empty" role={loadError ? "alert" : "status"}>
            <b className="ian-t-title2">{loadError ? "자동이체를 불러오지 못했어요" : "자동이체를 불러오고 있어요"}</b>
            {loadError && <><span className="ian-t-caption">{autosError || accError}</span><button type="button" className="ian-btn ian-btn--primary ian-btn--sm" onClick={() => { void refreshAutos(); void refreshAccounts(); }}>다시 시도</button></>}
          </div>
        </div>
      </div>
    );
  }

  const doCancel = async () => {
    const id = confirmId;
    if (!id) return;
    setConfirmId(null); setCancelling(id); setListError("");
    try { await cancel(id); } catch (e) { setListError(errorMessage(e)); } finally { setCancelling(null); }
  };
  const confirming = autos.find((a) => a.id === confirmId);

  return (
    <div className="ian-screen">
      <AppBar title="자동이체" />
      <div className="ian-screen__body">
        {listError && <div className="ian-notice ian-notice--danger" role="alert"><div>{listError}</div></div>}
        {autos.length === 0 ? (
          <div className="ian-empty">
            <b className="ian-t-title2">등록된 자동이체가 없어요</b>
            <span className="ian-t-caption">월세나 용돈처럼 정해진 날 보내는 돈을 등록해 두세요.</span>
            <button className="ian-btn ian-btn--primary ian-btn--sm" onClick={openForm}>자동이체 등록하기</button>
          </div>
        ) : (
          <>
            <div className="ian-notice"><div>자동이체는 실행일에 이체되고, 그때 잔액과 한도를 다시 확인해요.</div></div>
            <div className="ian-stack" role="list">
              {autos.map((a) => {
                const src = accounts.find((x) => x.id === a.fromId);
                const nr = !a.active ? null : a.nextRunDate !== undefined ? a.nextRunDate : nextRun(a, todayKey);
                const ended = a.endDate && a.endDate < todayKey;
                return (
                  <div key={a.id} role="listitem" className="ian-tile ian-tile--wide" style={{ minHeight: 0, opacity: a.active ? 1 : 0.8 }}>
                    <div className="ian-row ian-row--between">
                      <div style={{ minWidth: 0 }}>
                        <b>{a.toName || maskAccount(a.toNumber)}</b>
                        <div className="ian-t-caption">{src?.alias ?? "출금 계좌"} {src ? maskAccount(src.number) : ""} → {maskAccount(a.toNumber)}</div>
                      </div>
                      {IS_LIVE ? (
                        // 명세에는 일시정지·재개가 없고 해지(DELETE)만 있다. 해지하면 되돌릴 수 없다.
                        a.active
                          ? <button type="button" className="ian-btn ian-btn--outline ian-btn--sm" disabled={cancelling === a.id} onClick={() => setConfirmId(a.id)}>해지</button>
                          : <span className="ian-t-caption" style={{ fontWeight: 700 }}>{a.status === "ENDED" ? "종료됨" : "해지됨"}</span>
                      ) : (
                        <label className="ian-row" style={{ gap: 8, minHeight: 48 }}>
                          <span className="ian-t-caption" style={{ fontWeight: 700 }}>{a.active ? "켜짐" : "꺼짐"}</span>
                          <span className="ian-switch">
                            <input type="checkbox" role="switch" aria-label={`${a.toName} 자동이체`} checked={a.active} onChange={() => toggle(a.id)} />
                            <span className="ian-switch__track" /><span className="ian-switch__thumb" />
                          </span>
                        </label>
                      )}
                    </div>
                    <div className="ian-t-amount ian-num">{won(a.amount)}<span className="ian-unit">원</span></div>
                    <div className="ian-t-caption">
                      {scheduleText(a)} ·{" "}
                      {!a.active ? (IS_LIVE ? "실행하지 않아요" : "꺼져 있어서 실행하지 않아요") : ended ? "종료됐어요" : nr ? `다음 실행 ${fmtKey(nr)}` : "남은 실행일이 없어요"}
                      {a.endDate ? ` · ${fmtKey(a.endDate)}까지` : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
      {autos.length > 0 && (
        <div className="ian-screen__footer ian-stack">
          <button className="ian-btn ian-btn--primary ian-btn--block" onClick={openForm}>자동이체 등록하기</button>
          <Link href="/home" className="ian-btn ian-btn--ghost ian-btn--block">홈으로</Link>
        </div>
      )}
      <Sheet open={!!confirming} onClose={() => setConfirmId(null)} label="자동이체 해지 확인">
        <div className="ian-t-title2">{confirming?.toName || (confirming ? maskAccount(confirming.toNumber) : "")} 자동이체를<br />해지할까요?</div>
        <div className="ian-t-caption">해지하면 더 이상 이체되지 않고, 다시 켤 수 없어요. 필요하면 새로 등록해 주세요.</div>
        <div className="ian-row">
          <button type="button" className="ian-btn ian-btn--outline" style={{ flex: 1 }} onClick={() => setConfirmId(null)}>취소</button>
          <button type="button" className="ian-btn ian-btn--primary" style={{ flex: 2 }} onClick={() => void doCancel()}>해지하기</button>
        </div>
      </Sheet>
    </div>
  );
}
