import { api, call, type components } from "./client";
import { tokenStore } from "./token";
import { mapUser } from "./users";
import type { User } from "../types";

export type Purpose = components["schemas"]["VerificationPurpose"];
export interface TermItem { id: number; title: string; content: string; required: boolean }

export const listTerms = async (category: components["schemas"]["TermCategory"] = "SIGNUP"): Promise<TermItem[]> => {
  const r = await call(api.GET("/terms", { params: { query: { category } } }));
  return (r.items ?? []).map((t) => ({ id: t.id ?? 0, title: t.title ?? "", content: t.content ?? "", required: !!t.required }));
};

export const sendEmailVerification = async (email: string, purpose: Purpose): Promise<number> => {
  const r = await call(api.POST("/auth/email-verifications", { body: { email, purpose } }));
  return r.verificationId ?? 0;
};
export const verifyEmailCode = async (verificationId: number, code: string): Promise<void> => {
  await call(api.POST("/auth/email-verifications/{verificationId}/verify", { params: { path: { verificationId } }, body: { code } }));
};

export interface SignupBody {
  name: string; email: string; phone: string; birth?: string; loginId: string;
  password: string; pin: string; verificationId: number; agreements: { termId: number; agreed: boolean }[];
}
export const signup = async (b: SignupBody): Promise<User> =>
  mapUser(await call(api.POST("/auth/signup", { body: {
    userName: b.name, email: b.email, phoneNum: b.phone, birth: b.birth, loginId: b.loginId,
    password: b.password, passwordConfirm: b.password, pin: b.pin, pinConfirm: b.pin,
    verificationId: b.verificationId, agreements: b.agreements,
  } })));

/** 성공하면 access token을 보관하고 User를 돌려준다. */
const finish = (r: { accessToken?: string; user?: components["schemas"]["User"] }): User => {
  if (r.accessToken) tokenStore.set(r.accessToken);
  return mapUser(r.user ?? {});
};
export const login = async (loginId: string, password: string) => finish(await call(api.POST("/auth/login", { body: { loginId, password } })));
export const loginWithPin = async (loginId: string, pin: string) => finish(await call(api.POST("/auth/login/pin", { body: { loginId, pin } })));

export const logout = async (): Promise<void> => { await call(api.POST("/auth/logout")); };

export const resetPassword = async (loginId: string, verificationId: number, newPassword: string): Promise<void> => {
  await call(api.POST("/auth/password-reset", { body: { loginId, verificationId, newPassword } }));
};
