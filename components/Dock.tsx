"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/home", label: "홈", icon: "⌂" },
  { href: "/transfer", label: "이체", icon: "⇄" },
  { href: "/cards", label: "카드", icon: "▭" },
  { href: "/assistant", label: "도우미", icon: "✦" },
  { href: "/menu", label: "전체", icon: "≡" },
];

export function Dock() {
  const path = usePathname();
  return (
    <nav className="ian-dock" aria-label="하단 메뉴">
      {ITEMS.map((i) => (
        <Link key={i.href} href={i.href} className="ian-dock__item" aria-current={path === i.href || path.startsWith(i.href + "/") ? "page" : undefined}>
          <span aria-hidden="true">{i.icon}</span>{i.label}
        </Link>
      ))}
    </nav>
  );
}
