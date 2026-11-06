"use client";
import { useEffect } from "react";

/** 하단 시트. 앱 셸(.shell, position: relative) 안에서 열린다. */
export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: React.ReactNode; label: string }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="ian-scrim" onClick={onClose} />
      <div className="ian-sheet" role="dialog" aria-modal="true" aria-label={label}>
        <div className="ian-sheet__grip" />
        {children}
      </div>
    </>
  );
}
