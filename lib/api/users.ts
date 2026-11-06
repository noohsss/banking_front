import { api, call, type components } from "./client";
import type { User } from "../types";

type ApiUser = components["schemas"]["User"];

/** API User → UI User (userName→name, phoneNum→phone). */
export const mapUser = (u: ApiUser): User => ({
  id: u.id ?? "", loginId: u.loginId ?? "", name: u.userName ?? "", email: u.email ?? "", phone: u.phoneNum ?? "", birth: u.birth ?? undefined,
});

export const getMe = async (): Promise<User> => mapUser(await call(api.GET("/users/me")));

export const updateMe = async (p: { name?: string; phone?: string; birth?: string }): Promise<User> =>
  mapUser(await call(api.PATCH("/users/me", { body: { userName: p.name, phoneNum: p.phone, birth: p.birth } })));

/** PIN은 본문으로만 보낸다. 틀리면 403 PIN_INVALID. */
export const withdrawMe = async (pin: string): Promise<void> => { await call(api.DELETE("/users/me", { body: { pin } })); };

export interface LoginHistory { id: number; ip: string; userAgent: string; success: boolean; at: string }
export const listLoginHistories = async (page = 0, size = 20): Promise<LoginHistory[]> => {
  const r = await call(api.GET("/users/me/login-histories", { params: { query: { page, size } } }));
  return (r.items ?? []).map((h) => ({ id: h.id ?? 0, ip: h.ip ?? "", userAgent: h.userAgent ?? "", success: !!h.success, at: h.createdAt ?? "" }));
};

export interface AppNotification { id: number; type: string; message: string; read: boolean; at: string }
const mapNoti = (n: components["schemas"]["Notification"]): AppNotification => ({ id: n.id ?? 0, type: n.type ?? "", message: n.message ?? "", read: !!n.readAt, at: n.createdAt ?? "" });
export const listNotifications = async (unreadOnly = false, page = 0, size = 20): Promise<AppNotification[]> => {
  const r = await call(api.GET("/notifications", { params: { query: { unreadOnly, page, size } } }));
  return (r.items ?? []).map(mapNoti);
};
export const readNotification = async (id: number): Promise<AppNotification> =>
  mapNoti(await call(api.POST("/notifications/{notificationId}/read", { params: { path: { notificationId: id } } })));
