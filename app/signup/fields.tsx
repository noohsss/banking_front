"use client";
import type { InputHTMLAttributes } from "react";

/** label + 입력 + 힌트/오류(aria 연결). 로그인·가입·메뉴 화면 공용 */
export function TextField({ id, label, error, hint, required, ...rest }: { id: string; label: string; error?: string; hint?: string; required?: boolean } & InputHTMLAttributes<HTMLInputElement>) {
  const ids = [hint ? `${id}-hint` : "", error ? `${id}-err` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className="ian-field">
      <label className="ian-field__label" htmlFor={id}>{label}{required && <span className="ian-req" aria-hidden="true">*</span>}</label>
      <input id={id} className="ian-input" aria-invalid={error ? true : undefined} aria-describedby={ids} aria-required={required || undefined} {...rest} />
      {hint && !error && <span id={`${id}-hint`} className="ian-field__hint">{hint}</span>}
      {error && <span id={`${id}-err`} className="ian-field__error" role="alert">{error}</span>}
    </div>
  );
}

export const checkName = (v: string) => (v.trim().length >= 2 ? "" : "이름을 2자 이상 입력해 주세요.");
export const checkEmail = (v: string) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? "" : "이메일 형식을 확인해 주세요. 예: name@example.com");
export const checkPhone = (v: string) => (/^01\d{8,9}$/.test(v.replace(/-/g, "")) ? "" : "휴대폰 번호를 숫자 10~11자리로 입력해 주세요.");
export const fmtPhone = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}` : `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
};
