"use client";
import { maskAccount } from "@/lib/format";

/** 마스킹된 번호를 보여 주고, 복사 버튼은 전체 번호를 복사한다 */
export function CopyNumber({ number, onResult }: { number: string; onResult: (ok: boolean) => void }) {
  const copy = async () => {
    try { await navigator.clipboard.writeText(number); onResult(true); } catch { onResult(false); }
  };
  return (
    <span className="ian-acct">
      <span aria-label={`계좌번호 ${maskAccount(number)}`}>{maskAccount(number)}</span>
      <button type="button" className="ian-acct__copy" style={{ minHeight: 40 }} onClick={copy} aria-label="계좌번호 전체 복사">복사</button>
    </span>
  );
}
