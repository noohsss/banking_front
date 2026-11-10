import { call } from "./client";
import { API_BASE_URL } from "./mode";
import { tokenStore, fireUnauthorized } from "./token";

// 계약 수동 타입. openapi.yaml 교체 후 schema.d.ts 타입으로 바꾼다. (schema.d.ts는 생성물이라 손대지 않는다)
export type ChatRole = "user" | "assistant";
export interface ChatMessage { role: ChatRole; content: string }
export interface ChatSource { source: "TERM" | "PRODUCT" | "FAQ"; ref: string; title: string }
export type ChatMode = "KNOWLEDGE" | "SPENDING" | "TRANSFER";
export interface InsightCategory { category: string; amount: number; count: number }
export interface Insight {
  period: "THIS_MONTH" | "LAST_MONTH" | "LAST_30_DAYS" | "LAST_3_MONTHS";
  fromDate: string; toDate: string; totalOut: number; totalIn: number; previousTotalOut: number; byCategory: InsightCategory[];
}
export interface TransferDraft { fromAccountId: string; fromAccountLabel: string; toAccountNum: string; toHolderNameMasked: string; amount: number; memo: string | null }
export interface ChatAnswer { answer: string; sources: ChatSource[]; grounded: boolean; insight?: Insight | null; draft?: TransferDraft | null }

export const CHAT_MAX_MESSAGES = 10;
export const CHAT_MAX_CHARS = 500;

export const sendChat = (mode: ChatMode, messages: ChatMessage[]): Promise<ChatAnswer> =>
  call<ChatAnswer>((async () => {
    const t = tokenStore.get();
    const response = await fetch(`${API_BASE_URL}/assistant/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify({ mode, messages }),
    });
    if (response.status === 401) fireUnauthorized();
    const body = await response.json().catch(() => undefined);
    return response.ok ? { data: body, response } : { error: body, response };
  })());
