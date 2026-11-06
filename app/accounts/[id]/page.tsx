"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppBar } from "@/components/AppBar";
import { Sheet } from "@/components/Sheet";
import { StatusBadge } from "@/components/StatusBadge";
import { useStore } from "@/lib/store";
import { IS_LIVE } from "@/lib/api/mode";
import { errorMessage } from "@/lib/api/errors";
import { useAccount, useTransferLimits } from "@/lib/services/useAccount";
import { useTransactions } from "@/lib/services/useTransactions";
import { useStatements, type StatementRequest } from "@/lib/services/useStatements";
import { fmtDate, fmtDay, fmtTime, signed, won, wonUnit } from "@/lib/format";
import type { Tx } from "@/lib/types";
import { AccountState } from "../_components/AccountState";
import { Frame, SheetBody, useToast } from "../_components/Frame";
import { CopyNumber } from "../_components/CopyNumber";
import css from "./detail.module.css";

type PeriodKey = "1m" | "3m" | "6m" | "1y" | "custom";
const PERIODS: { k: PeriodKey; l: string; m?: number }[] = [
  { k: "1m", l: "1개월", m: 1 }, { k: "3m", l: "3개월", m: 3 }, { k: "6m", l: "6개월", m: 6 }, { k: "1y", l: "1년", m: 12 }, { k: "custom", l: "직접 입력" },
];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const monthsAgo = (now: Date, m: number) => { const d = new Date(now); d.setMonth(d.getMonth() - m); d.setHours(0, 0, 0, 0); return d; };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const onlyNum = (v: string) => v.replace(/\D/g, "").slice(0, 12);
const fmtNum = (v: string) => (v ? Number(v).toLocaleString("ko-KR") : "");

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useStore();
  const { account: acc, loading: accLoading, error: accError, notFound, refresh: refreshAcc } = useAccount(id);
  const { limits } = useTransferLimits(id);
  const [now] = useState(() => new Date());
  const { toast, showToast } = useToast();

  // mock: 로딩 표시만 짧게 흉내 낸다. live: 훅의 실제 loading을 쓴다.
  const [mockLoading, setMockLoading] = useState(!IS_LIVE);
  useEffect(() => { if (IS_LIVE) return; const t = setTimeout(() => setMockLoading(false), 300); return () => clearTimeout(t); }, []);

  // 조회 조건 (기본: 3개월 · 전체 · 최신순)
  const [period, setPeriod] = useState<PeriodKey>("3m");
  const [from, setFrom] = useState(iso(monthsAgo(now, 3)));
  const [to, setTo] = useState(iso(now));
  const [dir, setDir] = useState<"ALL" | "IN" | "OUT">("ALL");
  const [sort, setSort] = useState<"desc" | "asc">("desc");
  const [q, setQ] = useState("");
  const [more, setMore] = useState(false);
  const [minA, setMinA] = useState("");
  const [maxA, setMaxA] = useState("");

  const [selected, setSelected] = useState<Tx | null>(null);

  // 다운로드 신청
  const [dlOpen, setDlOpen] = useState(false);
  const [dlFrom, setDlFrom] = useState(iso(monthsAgo(now, 3)));
  const [dlTo, setDlTo] = useState(iso(now));
  const [dlEmail, setDlEmail] = useState("");
  const [dlTried, setDlTried] = useState(false);
  const [dlDone, setDlDone] = useState<StatementRequest | null>(null);
  const [dlBusy, setDlBusy] = useState(false);
  const [dlFail, setDlFail] = useState("");
  const { requests: reqs, request: requestStatement, refresh: refreshStatements } = useStatements(id);

  const range = useMemo(() => {
    const p = PERIODS.find((x) => x.k === period);
    if (p?.m) return { start: monthsAgo(now, p.m), end: now, error: "" };
    if (!from || !to) return { start: now, end: now, error: "시작일과 종료일을 모두 입력해 주세요." };
    const s = new Date(`${from}T00:00:00`); const e = new Date(`${to}T23:59:59`);
    if (s > e) return { start: s, end: e, error: "시작일이 종료일보다 늦어요. 날짜를 다시 골라 주세요." };
    return { start: s, end: e, error: "" };
  }, [period, from, to, now]);

  const minN = minA ? Number(minA) : null;
  const maxN = maxA ? Number(maxA) : null;
  const amountErr = minN !== null && maxN !== null && minN > maxN ? "최소 금액이 최대 금액보다 커요. 금액 범위를 다시 입력해 주세요." : "";
  const filterErr = range.error || amountErr;

  const hasFilter = !!q || dir !== "ALL" || !!minA || !!maxA || period !== "3m";
  const tx = useTransactions(id, { start: range.start, end: range.end, dir, sort, q, min: minN, max: maxN, enabled: !filterErr });
  const list = tx.items;
  const loading = IS_LIVE ? tx.loading : mockLoading;
  // 필터를 건 live 조회는 "거래가 있긴 한데 조건에 안 맞음"으로 안내한다
  const anyTx = IS_LIVE ? hasFilter : tx.hasAny;

  const groups = useMemo(() => {
    const m = new Map<string, Tx[]>();
    list.forEach((t) => { const k = fmtDate(t.at); m.set(k, [...(m.get(k) ?? []), t]); });
    return [...m.entries()];
  }, [list]);

  const dayLabel = (t: Tx) => {
    const today = fmtDate(now.toISOString()); const y = new Date(now); y.setDate(y.getDate() - 1);
    const k = fmtDate(t.at);
    return k === today ? "오늘" : k === fmtDate(y.toISOString()) ? "어제" : fmtDay(t.at);
  };

  const reset = () => { setPeriod("3m"); setDir("ALL"); setSort("desc"); setQ(""); setMinA(""); setMaxA(""); };

  if (!acc) return <AccountState title="계좌" loading={accLoading} error={accError} notFound={notFound} onRetry={() => void refreshAcc()} />;

  const canTransfer = acc.status === "ACTIVE";
  const reason = acc.status === "SUSPENDED" ? "거래중지 상태라 이체할 수 없어요. 계좌 관리에서 이메일 인증으로 해제해 주세요." : acc.status === "CLOSED" ? "해지된 계좌라 이체할 수 없어요. 거래내역은 계속 볼 수 있어요." : "";
  const dUsed = limits?.dailyUsed ?? 0, mUsed = limits?.monthlyUsed ?? 0;
  const dPct = Math.min(100, Math.round((dUsed / Math.max(1, acc.dailyLimit)) * 100));

  // 다운로드 검증
  const dlErr = {
    range: !dlFrom || !dlTo ? "신청 기간을 모두 입력해 주세요." : dlFrom > dlTo ? "시작일이 종료일보다 늦어요. 날짜를 다시 골라 주세요." : dlTo > iso(now) ? "종료일은 오늘 이전으로 골라 주세요." : "",
    email: !dlEmail.trim() ? "받을 이메일을 입력해 주세요." : !EMAIL.test(dlEmail.trim()) ? "이메일 형식이 맞지 않아요. 예: name@example.com" : "",
  };
  const openDl = () => { setDlEmail(user?.email ?? ""); setDlTried(false); setDlDone(null); setDlFail(""); void refreshStatements(); setDlOpen(true); };
  const submitDl = async () => {
    setDlTried(true);
    if (dlErr.range || dlErr.email || dlBusy) return;
    setDlBusy(true); setDlFail("");
    try { setDlDone(await requestStatement(dlFrom, dlTo, dlEmail.trim())); }
    catch (e) { setDlFail(errorMessage(e)); }
    finally { setDlBusy(false); }
  };

  return (
    <Frame
      overlay={
        <>
          <Sheet open={!!selected} onClose={() => setSelected(null)} label="거래 상세">
            {selected && (
              <SheetBody>
                <div>
                  <div className="ian-t-caption">{selected.type === "IN" ? "입금" : "출금"} · {selected.kind}</div>
                  <div className="ian-t-amount" style={{ color: selected.type === "IN" ? "var(--ian-money-in)" : "var(--ian-money-out)" }}>{signed(selected.type, selected.amount)}</div>
                </div>
                <dl className="ian-receipt" style={{ margin: 0 }}>
                  <div className="ian-receipt__rows" style={{ borderTop: 0, paddingTop: 0 }}>
                    <div className="ian-receipt__row"><dt>거래일시</dt><dd className="ian-num">{fmtDate(selected.at)} {fmtTime(selected.at)}</dd></div>
                    <div className="ian-receipt__row"><dt>{selected.type === "IN" ? "보낸 분" : "받는 분"}</dt><dd>{selected.counterparty}</dd></div>
                    <div className="ian-receipt__row"><dt>적요·메모</dt><dd>{selected.memo || "없음"}</dd></div>
                    <div className="ian-receipt__row"><dt>거래 후 잔액</dt><dd className="ian-num">{wonUnit(selected.balanceAfter)}</dd></div>
                    <div className="ian-receipt__row"><dt>거래번호</dt><dd className="ian-num">{selected.id}</dd></div>
                  </div>
                </dl>
                <button type="button" className="ian-btn ian-btn--primary ian-btn--block" onClick={() => setSelected(null)}>닫기</button>
              </SheetBody>
            )}
          </Sheet>

          <Sheet open={dlOpen} onClose={() => setDlOpen(false)} label="거래내역 다운로드 신청">
            <SheetBody>
              {dlDone ? (
                <>
                  <div className="ian-result" data-state="pending" style={{ padding: "var(--ian-s-4) 0 0" }}>
                    <div className="ian-result__mark" aria-hidden="true" />
                    <div className="ian-t-title2" role="status">신청이 접수됐어요</div>
                    <p className="ian-result__desc">아직 보내기 전이에요. <b>{dlDone.email}</b>로 발송이 끝나면 &apos;발송완료&apos;로 바뀌어요. 신청 내역에서 확인해 주세요.</p>
                  </div>
                  <button type="button" className="ian-btn ian-btn--primary ian-btn--block" onClick={() => setDlOpen(false)}>확인</button>
                </>
              ) : (
                <>
                  <div className="ian-t-title2">거래내역을 이메일로 받아요</div>
                  <div className={css.dates}>
                    <div className="ian-field">
                      <label className="ian-field__label" htmlFor="dl-from">시작일</label>
                      <input id="dl-from" type="date" className="ian-input" value={dlFrom} max={iso(now)} onChange={(e) => setDlFrom(e.target.value)} aria-invalid={dlTried && !!dlErr.range} aria-describedby={dlTried && dlErr.range ? "dl-range-err" : undefined} />
                    </div>
                    <div className="ian-field">
                      <label className="ian-field__label" htmlFor="dl-to">종료일</label>
                      <input id="dl-to" type="date" className="ian-input" value={dlTo} max={iso(now)} onChange={(e) => setDlTo(e.target.value)} aria-invalid={dlTried && !!dlErr.range} aria-describedby={dlTried && dlErr.range ? "dl-range-err" : undefined} />
                    </div>
                  </div>
                  {dlTried && dlErr.range && <span id="dl-range-err" className="ian-field__error" role="alert">{dlErr.range}</span>}
                  <div className="ian-field">
                    <label className="ian-field__label" htmlFor="dl-email">받을 이메일<span className="ian-req">*</span></label>
                    <input id="dl-email" type="email" inputMode="email" autoComplete="email" className="ian-input" value={dlEmail} onChange={(e) => setDlEmail(e.target.value)} aria-invalid={dlTried && !!dlErr.email} aria-describedby={dlTried && dlErr.email ? "dl-email-err" : "dl-email-hint"} />
                    {dlTried && dlErr.email ? <span id="dl-email-err" className="ian-field__error" role="alert">{dlErr.email}</span> : <span id="dl-email-hint" className="ian-field__hint">신청하면 접수 상태로 시작해요. 발송이 끝나야 메일함에서 받아볼 수 있어요.</span>}
                  </div>
                  {dlFail && <div className="ian-notice ian-notice--danger" role="alert"><div>{dlFail}</div></div>}
                  <div className="ian-row">
                    <button type="button" className="ian-btn ian-btn--outline" style={{ flex: 1 }} onClick={() => setDlOpen(false)}>취소</button>
                    <button type="button" className="ian-btn ian-btn--primary" style={{ flex: 2 }} onClick={() => void submitDl()} aria-busy={dlBusy} disabled={dlBusy}>{dlBusy ? "신청 중이에요" : "신청하기"}</button>
                  </div>
                </>
              )}
            </SheetBody>
          </Sheet>
          {toast}
        </>
      }
    >
      <AppBar title={acc.alias} />
      <div className="ian-screen__body" style={{ paddingBottom: 32 }}>
        {/* 요약 */}
        <section className="ian-stack" aria-label="계좌 요약" style={{ gap: 10 }}>
          <div className={css.meta}>
            <StatusBadge account={acc.status} />
            <span className="ian-t-caption">{acc.product}</span>
          </div>
          <div className="ian-t-hero" aria-label={`잔액 ${wonUnit(acc.balance)}`}>{won(acc.balance)}<span className="ian-unit">원</span></div>
          <CopyNumber number={acc.number} onResult={(ok) => showToast(ok ? "계좌번호를 복사했어요" : "복사하지 못했어요. 다시 시도해 주세요")} />
        </section>

        <div className="ian-tile" style={{ minHeight: 0 }}>
          <div className="ian-row ian-row--between"><b>이체한도</b><span className="ian-t-caption">오늘 {wonUnit(Math.max(0, acc.dailyLimit - dUsed))} 남음</span></div>
          <div className="ian-meter" data-level={dPct >= 80 ? "high" : undefined}>
            <div className="ian-meter__bar" role="meter" aria-label="오늘 이체한도 사용률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={dPct}><i style={{ "--v": `${dPct}%` } as React.CSSProperties} /></div>
            <div className="ian-row ian-row--between ian-t-micro"><span>오늘 사용 {wonUnit(dUsed)}</span><span>1일 {wonUnit(acc.dailyLimit)}</span></div>
            <div className="ian-row ian-row--between ian-t-micro"><span>이번 달 사용 {wonUnit(mUsed)}</span><span>1달 {wonUnit(acc.monthlyLimit)}</span></div>
          </div>
        </div>

        <div className="ian-stack">
          <div className={css.actions}>
            {canTransfer
              ? <Link href={`/transfer?from=${acc.id}`} className="ian-btn ian-btn--primary">이체</Link>
              : <button type="button" className="ian-btn ian-btn--primary" disabled aria-describedby="transfer-reason">이체</button>}
            <Link href={`/accounts/${acc.id}/manage`} className="ian-btn ian-btn--outline">관리</Link>
          </div>
          {!canTransfer && <div id="transfer-reason" className={`ian-notice ${acc.status === "SUSPENDED" ? "ian-notice--warn" : ""}`}><div>{reason}</div></div>}
        </div>

        {/* 조회 조건 */}
        <section className={css.filters} aria-label="거래내역 조회 조건">
          <div className="ian-field">
            <label className="ian-field__label ian-sr" htmlFor="tx-q">거래 검색</label>
            <input id="tx-q" type="search" className="ian-input" placeholder={IS_LIVE ? "상대방 이름으로 검색" : "상대방, 메모, 금액으로 검색"} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className={css.chips} role="group" aria-label="조회 기간">
            {PERIODS.map((p) => <button key={p.k} type="button" className="ian-chip" aria-pressed={period === p.k} onClick={() => setPeriod(p.k)}>{p.l}</button>)}
          </div>
          {period === "custom" && (
            <div className={css.dates}>
              <div className="ian-field"><label className="ian-field__label" htmlFor="f-from">시작일</label><input id="f-from" type="date" className="ian-input" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-invalid={!!range.error} aria-describedby={range.error ? "filter-err" : undefined} /></div>
              <div className="ian-field"><label className="ian-field__label" htmlFor="f-to">종료일</label><input id="f-to" type="date" className="ian-input" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-invalid={!!range.error} aria-describedby={range.error ? "filter-err" : undefined} /></div>
            </div>
          )}
          <div className="ian-segmented" role="group" aria-label="입출금 구분">
            {([["ALL", "전체"], ["IN", "입금"], ["OUT", "출금"]] as const).map(([k, l]) => <button key={k} type="button" className="ian-segmented__opt" aria-pressed={dir === k} onClick={() => setDir(k)}>{l}</button>)}
          </div>
          <div className="ian-row ian-row--between">
            <div className="ian-segmented" role="group" aria-label="정렬" style={{ flex: 1 }}>
              {([["desc", "최신순"], ["asc", "오래된순"]] as const).map(([k, l]) => <button key={k} type="button" className="ian-segmented__opt" aria-pressed={sort === k} onClick={() => setSort(k)}>{l}</button>)}
            </div>
            <button type="button" className="ian-btn ian-btn--ghost" aria-expanded={more} aria-controls="more-panel" onClick={() => setMore(!more)}>금액 범위 {more ? "접기" : "열기"}</button>
          </div>
          {more && (
            <div id="more-panel" className={css.panel}>
              <div className={css.dates}>
                <div className="ian-field"><label className="ian-field__label" htmlFor="a-min">최소 금액(원)</label><input id="a-min" inputMode="numeric" className="ian-input" value={fmtNum(minA)} onChange={(e) => setMinA(onlyNum(e.target.value))} aria-invalid={!!amountErr} aria-describedby={amountErr ? "filter-err" : undefined} /></div>
                <div className="ian-field"><label className="ian-field__label" htmlFor="a-max">최대 금액(원)</label><input id="a-max" inputMode="numeric" className="ian-input" value={fmtNum(maxA)} onChange={(e) => setMaxA(onlyNum(e.target.value))} aria-invalid={!!amountErr} aria-describedby={amountErr ? "filter-err" : undefined} /></div>
              </div>
            </div>
          )}
          {filterErr && <span id="filter-err" className="ian-field__error" role="alert">{filterErr}</span>}
        </section>

        {/* 거래 목록 */}
        <section aria-label="거래내역">
          <div className={css.count} style={{ marginBottom: "var(--ian-s-3)" }}>
            <b className="ian-t-title2">거래내역</b>
            <span className="ian-t-caption" aria-live="polite">{loading ? "" : filterErr ? "" : `${IS_LIVE ? tx.total : list.length}건`}</span>
          </div>
          {loading ? (
            <div className="ian-stack" role="status" aria-label="거래내역을 불러오는 중이에요">
              {[0, 1, 2, 3].map((i) => <div key={i} className={`ian-skel ${css.skel}`} />)}
            </div>
          ) : filterErr ? null : tx.error && list.length === 0 ? (
            <div className="ian-notice ian-notice--danger" role="alert">
              <div>
                <b className="ian-notice__title">거래내역을 불러오지 못했어요</b>{tx.error}
                <div style={{ marginTop: "var(--ian-s-3)" }}><button type="button" className="ian-btn ian-btn--danger-soft ian-btn--sm" onClick={() => void tx.refresh()}>다시 불러오기</button></div>
              </div>
            </div>
          ) : list.length === 0 ? (
            <div className="ian-empty">
              {anyTx ? (
                <>
                  <div className="ian-t-title2">조건에 맞는 거래가 없어요</div>
                  <p className="ian-t-caption">기간을 넓히거나 검색어·금액 범위를 바꿔 보세요.</p>
                  {hasFilter && <button type="button" className="ian-btn ian-btn--soft ian-btn--sm" onClick={reset}>조건 초기화</button>}
                </>
              ) : (
                <>
                  <div className="ian-t-title2">아직 거래내역이 없어요</div>
                  <p className="ian-t-caption">{canTransfer ? "입금이나 이체가 생기면 여기에 보여요." : "이 계좌는 새 거래가 생기지 않아요."}</p>
                </>
              )}
            </div>
          ) : (
            <div className="ian-timeline">
              {groups.map(([k, items]) => (
                <div key={k} style={{ display: "contents" }}>
                  <div className="ian-timeline__day">{dayLabel(items[0])}</div>
                  {items.map((t) => (
                    <button key={t.id} type="button" className="ian-tx" data-dir={t.type} onClick={() => setSelected(t)} aria-label={`${t.counterparty}, ${t.type === "IN" ? "입금" : "출금"} ${won(t.amount)}원, 거래 후 잔액 ${won(t.balanceAfter)}원. 상세 보기`}>
                      <span className="ian-tx__icon" aria-hidden="true">{t.type === "IN" ? "+" : "−"}</span>
                      <span className="ian-tx__who">{t.counterparty}</span>
                      <span className="ian-tx__amt">{signed(t.type, t.amount)}</span>
                      <span className="ian-tx__meta">{t.kind} · {fmtTime(t.at)}{t.memo ? ` · ${t.memo}` : ""}</span>
                      <span className="ian-tx__bal">{wonUnit(t.balanceAfter)}</span>
                    </button>
                  ))}
                </div>
              ))}
              {IS_LIVE && tx.hasMore && (
                <button type="button" className="ian-btn ian-btn--soft ian-btn--block" onClick={() => void tx.loadMore()} disabled={tx.loadingMore} aria-busy={tx.loadingMore}>{tx.loadingMore ? "불러오는 중이에요" : "더 보기"}</button>
              )}
              {tx.error && <span className="ian-field__error" role="alert">{tx.error}</span>}
            </div>
          )}
        </section>

        {/* 다운로드 */}
        <section className="ian-stack" aria-label="거래내역 다운로드">
          <button type="button" className="ian-btn ian-btn--soft ian-btn--block" onClick={openDl}>거래내역 이메일로 받기</button>
          {reqs.length > 0 && (
            <div className="ian-stack" style={{ gap: 8 }}>
              <b className="ian-t-caption">신청 내역</b>
              {reqs.map((r) => (
                <div key={r.id} className={css.reqRow}>
                  <span className="ian-t-caption">{r.from} ~ {r.to}<br />{r.email}</span>
                  <span className={`ian-badge ${r.status === "발송완료" ? "ian-badge--ok" : r.status === "실패" ? "ian-badge--danger" : "ian-badge--warn"}`} role="status">{r.status}</span>
                </div>
              ))}
              <p className="ian-t-micro">접수됨은 신청만 끝난 상태예요. 발송완료가 되면 메일을 보냈다는 뜻이고, 실패면 다시 신청해 주세요.</p>
            </div>
          )}
        </section>
      </div>
    </Frame>
  );
}
