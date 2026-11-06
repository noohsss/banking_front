import { Dock } from "@/components/Dock";

/** 하단 메뉴가 붙는 탭 화면: /home /cards /menu */
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (<><div className="ian-screen">{children}</div><Dock /><div style={{ height: 16 }} /></>);
}
