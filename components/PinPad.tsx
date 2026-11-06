"use client";
import { useEffect, useState } from "react";

/**
 * PIN 6자리 입력(점 + 원형 키패드). 6자리가 차면 onComplete(pin) 호출.
 * error가 true면 점이 흔들리고 빨강이 되며, 다음 입력 때 자동으로 비워진다.
 * 생체인증은 지원하지 않는다(기획 범위 밖).
 */
export function PinPad({ onComplete, error, label = "PIN 6자리를 입력해 주세요" }: { onComplete: (pin: string) => void; error?: boolean; label?: string }) {
  const [pin, setPin] = useState("");
  useEffect(() => { if (error) { const t = setTimeout(() => setPin(""), 400); return () => clearTimeout(t); } }, [error]);
  const press = (d: string) => {
    if (error) return;
    setPin((p) => {
      if (p.length >= 6) return p;
      const n = p + d;
      if (n.length === 6) setTimeout(() => onComplete(n), 120);
      return n;
    });
  };
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
  return (
    <>
      <div className="ian-pin" role="group" aria-label={`PIN ${pin.length}자리 입력됨`} data-error={error ? "true" : undefined}>
        {Array.from({ length: 6 }, (_, i) => <i key={i} className="ian-pin__dot" data-filled={i < pin.length ? "true" : undefined} />)}
      </div>
      <p className="ian-t-caption" style={{ textAlign: "center", color: error ? "var(--ian-danger)" : "var(--ian-ink-3)" }} role={error ? "alert" : undefined}>{label}</p>
      <div className="ian-keypad" role="group" aria-label="숫자 키패드">
        {keys.map((k) => <button key={k} type="button" className="ian-keypad__key" onClick={() => press(k)}>{k}</button>)}
        <span />
        <button type="button" className="ian-keypad__key" onClick={() => press("0")}>0</button>
        <button type="button" className="ian-keypad__key ian-keypad__key--fn" aria-label="지우기" onClick={() => setPin((p) => p.slice(0, -1))}>지움</button>
      </div>
    </>
  );
}
