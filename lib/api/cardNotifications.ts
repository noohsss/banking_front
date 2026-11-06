import { api, call } from "./client";
import type { CardAlert } from "@/lib/types";

/** 명세에 type 필터가 없어서 최근 100건을 받아 CARD_PAYMENT 만 거른다. 알림에는 cardId 가 없다. */
export async function listCardPaymentAlerts(): Promise<CardAlert[]> {
  const r = await call(api.GET("/notifications", { params: { query: { page: 0, size: 100 } } }));
  return (r.items ?? [])
    .filter((n) => n.type === "CARD_PAYMENT")
    .map((n) => ({ id: String(n.id ?? ""), text: n.message ?? "", at: n.createdAt ?? "", unread: !n.readAt }));
}

export const readNotification = async (id: string) => { await call(api.POST("/notifications/{notificationId}/read", { params: { path: { notificationId: Number(id) } } })); };
