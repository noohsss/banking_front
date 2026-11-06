"use client";
import { useState } from "react";
import { PinPad } from "@/components/PinPad";
import { Sheet } from "@/components/Sheet";
import { useStore } from "@/lib/store";
import { SheetBody } from "./Frame";

function Body({ title, desc, busy, onVerified, onClose }: { title: string; desc: string; busy?: boolean; onVerified: () => void; onClose: () => void }) {
  const { checkPin } = useStore();
  const [err, setErr] = useState(false);
  const done = (pin: string) => {
    if (checkPin(pin)) { onVerified(); return; }
    setErr(true);
    setTimeout(() => setErr(false), 700);
  };
  return (
    <SheetBody>
      <div>
        <div className="ian-t-title2">{title}</div>
        <p className="ian-t-caption" style={{ marginTop: 4 }}>{desc}</p>
      </div>
      {busy ? (
        <p className="ian-t-body" role="status" style={{ textAlign: "center", padding: "var(--ian-s-8) 0" }}>처리 중이에요. 잠시만 기다려 주세요.</p>
      ) : (
        <PinPad onComplete={done} error={err} label={err ? "PIN이 맞지 않아요. 다시 입력해 주세요." : "PIN 6자리를 입력해 주세요"} />
      )}
      <button type="button" className="ian-btn ian-btn--outline ian-btn--block" onClick={onClose} disabled={busy}>취소</button>
    </SheetBody>
  );
}

/** PIN 확인 시트. 시트가 닫히면 입력 상태도 사라진다(PIN은 저장하지 않음). */
export function PinSheet({ open, onClose, onVerified, title, desc, busy }: { open: boolean; onClose: () => void; onVerified: () => void; title: string; desc: string; busy?: boolean }) {
  return (
    <Sheet open={open} onClose={busy ? () => {} : onClose} label={title}>
      <Body title={title} desc={desc} busy={busy} onVerified={onVerified} onClose={onClose} />
    </Sheet>
  );
}
