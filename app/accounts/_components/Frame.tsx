"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import css from "./frame.module.css";

/** 스크롤 영역(children)과 오버레이(Sheet·Toast)를 분리한 화면 프레임 */
export function Frame({ children, overlay }: { children: React.ReactNode; overlay?: React.ReactNode }) {
  return (
    <div className={`ian-screen ${css.frame}`}>
      <div className={css.scroll}>{children}</div>
      {overlay}
    </div>
  );
}

/** 시트 안쪽 내용이 길어도 스크롤되게 감싼다 */
export function SheetBody({ children }: { children: React.ReactNode }) {
  return <div className={css.sheetBody}>{children}</div>;
}

export function useToast() {
  const [msg, setMsg] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const show = useCallback((m: string) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(""), 2600);
  }, []);
  const node = msg ? (
    <div className={css.toast}><div className="ian-toast" role="status"><span className="ian-toast__mark" aria-hidden="true">✓</span>{msg}</div></div>
  ) : null;
  return { toast: node, showToast: show };
}
