"use client";
import { useCallback, useRef, useState } from "react";
import { IS_LIVE } from "@/lib/api/mode";
import { CHAT_MAX_CHARS, CHAT_MAX_MESSAGES, sendChat, type ChatAnswer, type ChatMessage } from "@/lib/api/assistant";
import { errorMessage } from "@/lib/api/errors";

export { CHAT_MAX_CHARS };
export interface ChatTurn extends ChatMessage { sources?: ChatAnswer["sources"]; grounded?: boolean }

// 키워드 매칭만 하는 데모 답변. 실제 답변 정확도와 무관하다.
const MOCK_REPLIES: [RegExp, string][] = [
  [/이체|송금/, "이체는 메뉴의 이체에서 받는 계좌와 금액을 입력하면 돼요. (데모 답변이에요)"],
  [/계좌.*(개설|만들)|통장/, "계좌 개설은 메뉴의 계좌 개설에서 상품을 고르고 약관에 동의하면 돼요. (데모 답변이에요)"],
  [/카드/, "체크카드는 메뉴의 카드에서 발급하고 관리할 수 있어요. (데모 답변이에요)"],
];
const MOCK_FALLBACK = "데모 모드라 준비된 답변이 적어요. 이체, 계좌 개설, 카드로 물어봐 주세요.";
const mockAnswer = (q: string): ChatAnswer => ({ answer: MOCK_REPLIES.find(([re]) => re.test(q))?.[1] ?? MOCK_FALLBACK, sources: [], grounded: false });

/** AI 도우미 대화. 이력은 이 훅의 상태에만 두고 저장하지 않는다. send는 실패해도 던지지 않고 error에 문구를 둔다. */
export function useAssistant() {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const turnsRef = useRef<ChatTurn[]>([]);

  const send = useCallback(async (text: string): Promise<boolean> => {
    const content = text.trim().slice(0, CHAT_MAX_CHARS);
    if (!content || busy.current) return false;
    busy.current = true; setSending(true); setError(null);
    const next: ChatTurn[] = [...turnsRef.current, { role: "user", content }];
    turnsRef.current = next; setTurns(next);
    try {
      const r = IS_LIVE
        ? await sendChat(next.slice(-CHAT_MAX_MESSAGES).map(({ role, content }) => ({ role, content: content.slice(0, CHAT_MAX_CHARS) })))
        : mockAnswer(content);
      turnsRef.current = [...next, { role: "assistant", content: r.answer, sources: r.sources, grounded: r.grounded }];
      setTurns(turnsRef.current);
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally { busy.current = false; setSending(false); }
  }, []);

  return { turns, sending, error, send };
}
