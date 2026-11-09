import { call } from "./client";
import { API_BASE_URL } from "./mode";
import { tokenStore, fireUnauthorized } from "./token";

// 계약 수동 타입. openapi.yaml 교체 후 schema.d.ts 타입으로 바꾼다. (schema.d.ts는 생성물이라 손대지 않는다)
export type ChatRole = "user" | "assistant";
export interface ChatMessage { role: ChatRole; content: string }
export interface ChatSource { source: "TERM" | "PRODUCT" | "FAQ"; ref: string; title: string }
export interface ChatAnswer { answer: string; sources: ChatSource[]; grounded: boolean }

export const CHAT_MAX_MESSAGES = 10;
export const CHAT_MAX_CHARS = 500;

export const sendChat = (messages: ChatMessage[]): Promise<ChatAnswer> =>
  call<ChatAnswer>((async () => {
    const t = tokenStore.get();
    const response = await fetch(`${API_BASE_URL}/assistant/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify({ messages }),
    });
    if (response.status === 401) fireUnauthorized();
    const body = await response.json().catch(() => undefined);
    return response.ok ? { data: body, response } : { error: body, response };
  })());
