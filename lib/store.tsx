"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Account, AppState, AutoTransfer, Card, Recipient, Transfer, Tx, User } from "./types";
import { seedState, SEED_LOGIN, SEED_PIN, SERVICE_DIRECTORY } from "./seed";
import { uid } from "./format";

type Action =
  | { type: "hydrate"; state: AppState }
  | { type: "login"; user: User }
  | { type: "logout" }
  | { type: "patch"; fn: (s: AppState) => AppState };

const reducer = (s: AppState, a: Action): AppState => {
  switch (a.type) {
    case "hydrate": return a.state;
    case "login": return { ...s, user: a.user };
    case "logout": return { ...s, user: null };
    case "patch": return a.fn(s);
  }
};

const KEY = "ian-bank-state-v1";
const PUBLIC = ["/login", "/signup"];

export interface TransferInput { fromId: string; toNumber: string; amount: number; memo: string; }
export type TransferResult =
  | { ok: true; transfer: Transfer }
  | { ok: false; code: "BALANCE" | "STATUS" | "DAILY" | "MONTHLY" | "RECIPIENT" | "AMOUNT"; message: string };

interface Store extends AppState {
  ready: boolean;
  // 인증
  login: (id: string, pw: string) => { ok: boolean; message?: string };
  loginWithPin: (pin: string) => { ok: boolean; message?: string };
  checkPin: (pin: string) => boolean;          // 데모 PIN 123456
  signup: (u: Omit<User, "id"> & { pin: string; password: string }) => { ok: boolean; message?: string };
  logout: () => void;
  withdraw: () => void;                        // 회원 탈퇴: 가입 회원 정보를 지우고 로그아웃
  updateUser: (patch: Partial<User>) => void;
  // 계좌
  getAccount: (id: string) => Account | undefined;
  openAccount: (alias: string) => Account;
  toggleFavorite: (id: string) => void;
  setLimits: (id: string, daily: number, monthly: number) => void;
  releaseSuspension: (id: string) => void;
  canClose: (id: string) => { ok: boolean; reasons: string[] };
  closeAccount: (id: string) => void;
  usedToday: (id: string) => number;
  usedMonth: (id: string) => number;
  // 이체
  lookupRecipient: (number: string) => string | null;
  transfer: (i: TransferInput) => TransferResult;
  toggleRecipientFavorite: (id: string) => void;
  addAuto: (a: Omit<AutoTransfer, "id" | "active">) => AutoTransfer;
  toggleAuto: (id: string) => void;
  // 카드
  issueCard: (accountId: string, dailyLimit: number, overseas: boolean) => Card;
  patchCard: (id: string, patch: Partial<Card>) => void;
  reissueCard: (id: string) => Card;
}

const Ctx = createContext<Store | null>(null);
export const useStore = () => { const c = useContext(Ctx); if (!c) throw new Error("StoreProvider 없음"); return c; };

const NOW = () => new Date().toISOString();
const sameDay = (a: string, b: string) => a.slice(0, 10) === b.slice(0, 10);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, seedState);
  const [ready, setReady] = useState(false);
  const stateRef = useRef(state); stateRef.current = state;
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) dispatch({ type: "hydrate", state: JSON.parse(raw) }); } catch {}
    setReady(true);
  }, []);
  useEffect(() => { if (ready) { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} } }, [state, ready]);
  useEffect(() => {
    if (ready && !state.user && !PUBLIC.includes(pathname)) router.replace("/login");
  }, [ready, state.user, pathname, router]);

  const patch = useCallback((fn: (s: AppState) => AppState) => dispatch({ type: "patch", fn }), []);

  const store = useMemo<Store>(() => {
    const s = () => stateRef.current;
    const usedSince = (id: string, pred: (iso: string) => boolean) =>
      s().transfers.filter((t) => t.fromId === id && t.status !== "FAILED" && pred(t.at)).reduce((n, t) => n + t.amount, 0);
    const usedToday = (id: string) => usedSince(id, (at) => sameDay(at, NOW()));
    const usedMonth = (id: string) => usedSince(id, (at) => at.slice(0, 7) === NOW().slice(0, 7));

    return {
      ...s(), ready,
      login: (id, pw) => {
        if (id === SEED_LOGIN.id && pw === SEED_LOGIN.pw) {
          dispatch({ type: "login", user: { id: "u1", loginId: id, name: "김민수", email: "minsu@ian.bank", phone: "010-1234-5678", birth: "1998-05-14" } });
          return { ok: true };
        }
        const m = s().members.find((u) => u.loginId === id && u.password === pw);
        if (m) { const { password: _p, pin: _n, ...user } = m; dispatch({ type: "login", user }); return { ok: true }; }
        return { ok: false, message: "아이디 또는 비밀번호가 맞지 않아요." };
      },
      loginWithPin: (pin) => {
        const m = s().members.find((u) => u.pin === pin);
        if (m) { const { password: _p, pin: _n, ...user } = m; dispatch({ type: "login", user }); return { ok: true }; }
        if (pin !== SEED_PIN) return { ok: false, message: "PIN이 맞지 않아요." };
        dispatch({ type: "login", user: { id: "u1", loginId: SEED_LOGIN.id, name: "김민수", email: "minsu@ian.bank", phone: "010-1234-5678", birth: "1998-05-14" } });
        return { ok: true };
      },
      checkPin: (pin) => pin === SEED_PIN || s().members.some((m) => m.id === s().user?.id && m.pin === pin),
      signup: (u) => {
        if (u.loginId === SEED_LOGIN.id || s().members.some((m) => m.loginId === u.loginId)) return { ok: false, message: "이미 사용 중인 아이디예요." };
        patch((st) => ({ ...st, members: [...st.members, { id: uid("u"), ...u }] }));
        return { ok: true };
      },
      logout: () => { dispatch({ type: "logout" }); router.replace("/login"); },
      withdraw: () => {
        const id = s().user?.id;
        patch((st) => ({ ...st, members: st.members.filter((m) => m.id !== id), user: null }));
        router.replace("/login");
      },
      updateUser: (p) => patch((st) => (st.user ? { ...st, user: { ...st.user, ...p } } : st)),

      getAccount: (id) => s().accounts.find((a) => a.id === id),
      openAccount: (alias) => {
        const n = String(Math.floor(1000 + Math.random() * 9000));
        const acc: Account = { id: uid("a"), number: `123-4567-${n}`, product: "IAN 입출금통장", alias: alias || "입출금통장", balance: 0, status: "ACTIVE", favorite: false, dailyLimit: 1000000, monthlyLimit: 5000000, openedAt: NOW(), rate: 0.1 };
        patch((st) => ({ ...st, accounts: [...st.accounts, acc] }));
        return acc;
      },
      toggleFavorite: (id) => patch((st) => ({ ...st, accounts: st.accounts.map((a) => (a.id === id ? { ...a, favorite: !a.favorite } : a)) })),
      setLimits: (id, daily, monthly) => patch((st) => ({ ...st, accounts: st.accounts.map((a) => (a.id === id ? { ...a, dailyLimit: daily, monthlyLimit: monthly } : a)) })),
      releaseSuspension: (id) => patch((st) => ({ ...st, accounts: st.accounts.map((a) => (a.id === id && a.status === "SUSPENDED" ? { ...a, status: "ACTIVE" } : a)) })),
      canClose: (id) => {
        const a = s().accounts.find((x) => x.id === id); const reasons: string[] = [];
        if (!a) return { ok: false, reasons: ["계좌를 찾을 수 없어요."] };
        if (a.status === "CLOSED") reasons.push("이미 해지된 계좌예요.");
        if (a.status === "SUSPENDED") reasons.push("거래중지 상태예요. 해제 후 해지할 수 있어요.");
        if (a.balance > 0) reasons.push("잔액이 남아 있어요. 잔액을 모두 이체한 뒤 해지해 주세요.");
        if (s().cards.some((c) => c.accountId === id && c.status !== "CLOSED" && c.status !== "REISSUED")) reasons.push("연결된 체크카드가 있어요.");
        if (s().autos.some((x) => (x.fromId === id || x.toNumber === a.number) && x.active)) reasons.push("연결된 자동이체가 있어요.");
        return { ok: reasons.length === 0, reasons };
      },
      closeAccount: (id) => patch((st) => ({ ...st, accounts: st.accounts.map((a) => (a.id === id ? { ...a, status: "CLOSED" } : a)) })),
      usedToday, usedMonth,

      lookupRecipient: (number) => {
        const r = s().recipients.find((x) => x.number === number)?.name;
        return r ?? SERVICE_DIRECTORY[number] ?? null;
      },
      transfer: (i) => {
        const from = s().accounts.find((a) => a.id === i.fromId);
        const name = SERVICE_DIRECTORY[i.toNumber] ?? s().recipients.find((r) => r.number === i.toNumber)?.name;
        if (!from) return { ok: false, code: "STATUS", message: "출금 계좌를 찾을 수 없어요." };
        if (!name) return { ok: false, code: "RECIPIENT", message: "IAN Bank에서 확인되는 계좌만 받을 수 있어요." };
        if (!(i.amount > 0)) return { ok: false, code: "AMOUNT", message: "금액을 입력해 주세요." };
        if (from.status !== "ACTIVE") return { ok: false, code: "STATUS", message: "거래중지 또는 해지된 계좌에서는 이체할 수 없어요." };
        if (from.balance < i.amount) return { ok: false, code: "BALANCE", message: "잔액이 부족해요." };
        if (usedToday(from.id) + i.amount > from.dailyLimit) return { ok: false, code: "DAILY", message: "하루 이체한도를 넘어요." };
        if (usedMonth(from.id) + i.amount > from.monthlyLimit) return { ok: false, code: "MONTHLY", message: "한 달 이체한도를 넘어요." };
        const at = NOW();
        const tr: Transfer = { id: uid("tr"), fromId: from.id, toNumber: i.toNumber, toName: name, amount: i.amount, memo: i.memo, at, status: "SUCCESS" };
        const balanceAfter = from.balance - i.amount;
        const tx: Tx = { id: uid("t"), accountId: from.id, at, type: "OUT", amount: i.amount, balanceAfter, counterparty: name, memo: i.memo, kind: "이체" };
        patch((st) => {
          const target = st.accounts.find((a) => a.number === i.toNumber);
          const txs = [tx, ...st.txs];
          if (target) txs.unshift({ id: uid("t"), accountId: target.id, at, type: "IN", amount: i.amount, balanceAfter: target.balance + i.amount, counterparty: from.alias, memo: i.memo, kind: "입금" });
          return {
            ...st, transfers: [tr, ...st.transfers], txs,
            accounts: st.accounts.map((a) => a.id === from.id ? { ...a, balance: balanceAfter } : a.number === i.toNumber ? { ...a, balance: a.balance + i.amount } : a),
          };
        });
        return { ok: true, transfer: tr };
      },
      toggleRecipientFavorite: (id) => patch((st) => ({ ...st, recipients: st.recipients.map((r: Recipient) => (r.id === id ? { ...r, favorite: !r.favorite } : r)) })),
      addAuto: (a) => {
        const au: AutoTransfer = { ...a, id: uid("au"), active: true };
        patch((st) => ({ ...st, autos: [au, ...st.autos] }));
        return au;
      },
      toggleAuto: (id) => patch((st) => ({ ...st, autos: st.autos.map((x) => (x.id === id ? { ...x, active: !x.active } : x)) })),

      issueCard: (accountId, dailyLimit, overseas) => {
        const c: Card = { id: uid("c"), accountId, last4: String(Math.floor(1000 + Math.random() * 9000)), name: "IAN 체크카드", status: "ACTIVE", dailyLimit, overseas, issuedAt: NOW() };
        patch((st) => ({ ...st, cards: [...st.cards, c] }));
        return c;
      },
      patchCard: (id, p) => patch((st) => ({ ...st, cards: st.cards.map((c) => (c.id === id ? { ...c, ...p } : c)) })),
      reissueCard: (id) => {
        const old = s().cards.find((c) => c.id === id)!;
        const nc: Card = { ...old, id: uid("c"), last4: String(Math.floor(1000 + Math.random() * 9000)), status: "ACTIVE", issuedAt: NOW(), replacedBy: undefined };
        patch((st) => ({ ...st, cards: [...st.cards.map((c) => (c.id === id ? { ...c, status: "REISSUED" as const, replacedBy: nc.id } : c)), nc] }));
        return nc;
      },
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, ready, patch, router]);

  if (!ready) return null;
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
