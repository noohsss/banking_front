"use client";
import Link from "next/link";
import { AppBar } from "@/components/AppBar";
import { Frame } from "./Frame";

/** 계좌를 아직 못 보여줄 때(불러오는 중·조회 실패·없음)의 공통 화면 */
export function AccountState({ title, loading, error, notFound, onRetry }: { title: string; loading?: boolean; error?: string | null; notFound?: boolean; onRetry?: () => void }) {
  return (
    <Frame>
      <AppBar title={title} />
      <div className="ian-screen__body">
        {loading ? (
          <div className="ian-stack" role="status" aria-label="계좌를 불러오는 중이에요"><div className="ian-skel" style={{ height: 120 }} /><div className="ian-skel" style={{ height: 64 }} /></div>
        ) : error && !notFound ? (
          <div className="ian-notice ian-notice--danger" role="alert">
            <div>
              <b className="ian-notice__title">계좌를 불러오지 못했어요</b>{error}
              {onRetry && <div style={{ marginTop: "var(--ian-s-3)" }}><button type="button" className="ian-btn ian-btn--danger-soft ian-btn--sm" onClick={onRetry}>다시 불러오기</button></div>}
            </div>
          </div>
        ) : (
          <div className="ian-empty" role="alert">
            <div className="ian-t-title2">계좌를 찾을 수 없어요</div>
            <p className="ian-t-caption">없는 계좌이거나 내 계좌가 아니에요. 홈에서 계좌를 다시 골라 주세요.</p>
            <Link href="/home" className="ian-btn ian-btn--primary">홈으로</Link>
          </div>
        )}
      </div>
    </Frame>
  );
}
