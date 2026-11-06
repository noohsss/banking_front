"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { IS_LIVE } from "@/lib/api/mode";
import { createFavoriteRecipient, deleteFavoriteRecipient, listFavoriteRecipients, listRecentRecipients, updateFavoriteRecipient } from "@/lib/api/recipients";
import { errorMessage } from "@/lib/api/errors";
import { uid } from "@/lib/format";
import type { Recipient } from "@/lib/types";

/** 이체 화면의 "최근·자주 쓰는 계좌" 한 칸. favorite이면 id는 즐겨찾기 id. */
export interface Person { number: string; label: string; name: string; favorite: boolean; id?: string }

// mock: lib/store.tsx를 건드리지 않고, 처음 보낸 계좌의 즐겨찾기는 이 키에 따로 저장한다.
const EXTRA_KEY = "ian-bank-extra-favorites-v1";
const loadExtras = (): Recipient[] => { try { return JSON.parse(localStorage.getItem(EXTRA_KEY) ?? "[]"); } catch { return []; } };

/**
 * 최근 이체 계좌 + 자주 쓰는 계좌.
 * toggleFavorite(number, name): 등록 ↔ 해제. 처음 보내는(저장소에 없는) 계좌도 등록된다. 반환값은 토글 후 즐겨찾기 여부. 실패하면 ApiError.
 * rename: 별칭 변경.
 */
export function useRecipients() {
  const store = useStore();
  const [extras, setExtras] = useState<Recipient[]>(loadExtras);
  const [favs, setFavs] = useState<Recipient[]>([]);
  const [recent, setRecent] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(IS_LIVE);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback((): Promise<void> => {
    if (!IS_LIVE) return Promise.resolve();
    return Promise.all([listFavoriteRecipients(), listRecentRecipients(10)]).then(
      ([f, r]) => { setFavs(f); setRecent(r); setError(null); },
      (e) => setError(errorMessage(e)),
    ).then(() => setLoading(false));
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const saveExtras = (next: Recipient[]) => { setExtras(next); try { localStorage.setItem(EXTRA_KEY, JSON.stringify(next)); } catch {} };

  const people = useMemo<Person[]>(() => {
    const toPerson = (r: Recipient): Person => ({ number: r.number, label: r.alias, name: r.name, favorite: r.favorite, id: r.id });
    if (IS_LIVE) {
      const list = favs.map(toPerson);
      const known = new Set(list.map((p) => p.number));
      for (const r of recent) {
        if (known.has(r.number) || list.length - favs.length >= 5) continue;
        known.add(r.number);
        list.push({ number: r.number, label: r.name, name: r.name, favorite: false });
      }
      return list;
    }
    const favList = [...store.recipients, ...extras].sort((a, b) => Number(b.favorite) - Number(a.favorite)).map(toPerson);
    const known = new Set(favList.map((f) => f.number));
    const rec: Person[] = [];
    for (const t of store.transfers) {
      if (t.status === "FAILED" || known.has(t.toNumber)) continue;
      known.add(t.toNumber);
      rec.push({ number: t.toNumber, label: t.toName, name: t.toName, favorite: false });
      if (rec.length >= 5) break;
    }
    return [...favList, ...rec];
  }, [favs, recent, extras, store.recipients, store.transfers]);

  const toggleFavorite = async (number: string, name: string): Promise<boolean> => {
    if (IS_LIVE) {
      const cur = favs.find((f) => f.number === number);
      if (cur) await deleteFavoriteRecipient(cur.id); else await createFavoriteRecipient(number);
      await refresh();
      return !cur;
    }
    const r = store.recipients.find((x) => x.number === number);
    if (r) { store.toggleRecipientFavorite(r.id); return !r.favorite; }
    if (extras.some((x) => x.number === number)) { saveExtras(extras.filter((x) => x.number !== number)); return false; }
    saveExtras([...extras, { id: uid("rx"), alias: name, number, name, favorite: true }]);
    return true;
  };

  const rename = async (id: string, alias: string) => {
    if (IS_LIVE) { await updateFavoriteRecipient(id, alias); await refresh(); return; }
    saveExtras(extras.map((x) => (x.id === id ? { ...x, alias } : x)));
  };

  return { people, loading, error, refresh, toggleFavorite, rename };
}
