import { api, call, type components } from "./client";
import type { Recipient } from "@/lib/types";

type ApiFav = components["schemas"]["FavoriteRecipient"];
type ApiRecent = components["schemas"]["RecentRecipient"];

export const toFavorite = (f: ApiFav): Recipient => ({
  id: String(f.id ?? ""), alias: f.alias || f.holderName || "", number: f.accountNum ?? "", name: f.holderName ?? "", favorite: true,
});

/** 최근 이체 계좌. favoriteId가 있으면 자주 쓰는 계좌로도 등록된 상태. */
export const toRecent = (r: ApiRecent): Recipient => ({
  id: r.favoriteId != null ? String(r.favoriteId) : "", alias: r.alias || r.holderNameMasked || "", number: r.accountNum ?? "", name: r.holderNameMasked ?? "", favorite: r.favoriteId != null,
});

export const listRecentRecipients = async (limit = 10) =>
  ((await call(api.GET("/transfers/recent-recipients", { params: { query: { limit } } }))).items ?? []).map(toRecent);

export const listFavoriteRecipients = async () =>
  ((await call(api.GET("/favorite-recipients"))).items ?? []).map(toFavorite);

export const createFavoriteRecipient = async (accountNum: string, alias?: string) =>
  toFavorite(await call(api.POST("/favorite-recipients", { body: { accountNum, alias: alias || undefined } })));

export const updateFavoriteRecipient = async (id: string, alias: string) =>
  toFavorite(await call(api.PATCH("/favorite-recipients/{favoriteId}", { params: { path: { favoriteId: Number(id) } }, body: { alias } })));

export const deleteFavoriteRecipient = async (id: string) => {
  await call(api.DELETE("/favorite-recipients/{favoriteId}", { params: { path: { favoriteId: Number(id) } } }));
};
