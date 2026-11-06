"use client";
import { useCallback, useEffect, useState } from "react";
import { IS_LIVE } from "@/lib/api/mode";
import { listTerms, type TermItem } from "@/lib/api/auth";
import { errorMessage } from "@/lib/api/errors";

export type { TermItem };

/** mock 약관(기존 하드코딩 3개 + 본문 샘플). id는 가입 요청에 쓰이지 않는다. */
const MOCK_TERMS: TermItem[] = [
  { id: 1, title: "전자금융거래 이용약관", required: true, content: "제1조(목적) 이 약관은 IAN Bank가 제공하는 전자금융거래 서비스의 이용 조건과 절차, 회사와 이용자의 권리·의무를 정하는 것을 목적으로 합니다.\n제2조(거래 지시) 이용자는 본인 확인 절차를 거쳐 이체 등 거래를 지시할 수 있으며, 회사는 지시 내용대로 처리합니다. (데모용 샘플 문구입니다.)" },
  { id: 2, title: "개인정보 수집·이용 동의", required: true, content: "수집 항목: 이름, 이메일, 휴대폰 번호, 생년월일(선택), 아이디.\n이용 목적: 회원 가입 및 본인 확인, 금융 서비스 제공.\n보유 기간: 회원 탈퇴 시까지(관계 법령에 따라 보존이 필요한 경우 해당 기간). (데모용 샘플 문구입니다.)" },
  { id: 3, title: "마케팅 정보 수신", required: false, content: "이벤트·혜택 등 마케팅 정보를 이메일·문자로 받는 데 동의합니다. 동의하지 않아도 서비스 이용에는 제한이 없으며, 언제든 철회할 수 있습니다. (데모용 샘플 문구입니다.)" },
];

/** 가입 약관. live는 GET /terms?category=SIGNUP, mock은 고정 목록. */
export function useTerms(): { data: TermItem[]; loading: boolean; error: string | null; refresh: () => Promise<void> } {
  const [data, setData] = useState<TermItem[]>(IS_LIVE ? [] : MOCK_TERMS);
  const [loading, setLoading] = useState(IS_LIVE);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => listTerms("SIGNUP").then(setData, (e) => setError(errorMessage(e))).finally(() => setLoading(false)), []);
  const refresh = useCallback(async () => { if (!IS_LIVE) return; setLoading(true); setError(null); await load(); }, [load]);
  useEffect(() => { if (IS_LIVE) load(); }, [load]);
  return { data, loading, error, refresh };
}
