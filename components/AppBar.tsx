"use client";
import { useRouter } from "next/navigation";

/** 뒤로가기 + 가운데 제목. right는 우측 슬롯(아이콘 버튼 등) */
export function AppBar({ title = "", right, onBack, hideBack }: { title?: string; right?: React.ReactNode; onBack?: () => void; hideBack?: boolean }) {
  const router = useRouter();
  return (
    <div className="ian-appbar">
      {hideBack ? <span /> : <button className="ian-iconbtn" aria-label="뒤로" onClick={onBack ?? (() => router.back())}>←</button>}
      <span className="ian-appbar__title">{title}</span>
      {right ?? <span />}
    </div>
  );
}
