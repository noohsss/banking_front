import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./schema";
import { API_BASE_URL } from "./mode";
import { ApiError, type ApiErrorBody } from "./errors";
import { fireUnauthorized, tokenStore } from "./token";

/**
 * 타입이 붙은 fetch 클라이언트. 경로·파라미터·응답 타입은 openapi.yaml(→ schema.d.ts)에서 온다.
 * 스키마 갱신: `npm run api:types`
 */
export const api = createClient<paths>({ baseUrl: API_BASE_URL });

const auth: Middleware = {
  onRequest({ request }) {
    const t = tokenStore.get();
    if (t) request.headers.set("Authorization", `Bearer ${t}`);
    return request;
  },
  onResponse({ response, request }) {
    // 로그인·가입 요청의 401(자격 증명 오류)은 세션 만료가 아니므로 제외
    if (response.status === 401 && !/\/auth\/(login|signup)/.test(new URL(request.url).pathname)) fireUnauthorized();
    return response;
  },
};
api.use(auth);

type Result<T> = { data?: T; error?: unknown; response: Response };

/**
 * openapi-fetch 결과를 풀어서 성공이면 data, 실패면 ApiError를 던진다.
 * 204처럼 본문이 없는 성공은 undefined를 돌려준다.
 */
export async function call<T>(p: Promise<Result<T>>): Promise<T> {
  let r: Result<T>;
  try { r = await p; } catch { throw new ApiError(0, "NETWORK", ""); }
  if (r.response.ok) return r.data as T;
  const b = (r.error ?? {}) as Partial<ApiErrorBody>;
  throw new ApiError(r.response.status, b.code ?? "UNKNOWN", b.message ?? "", (b.fieldErrors ?? []).map((f) => ({ field: f.field ?? "", reason: f.reason ?? "" })), b.reasons ?? []);
}

/** 이체처럼 중복 제출을 막아야 하는 요청용 키. 같은 시도를 재전송할 때는 같은 키를 다시 써야 한다. */
export const newIdempotencyKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export type { components, paths } from "./schema";
