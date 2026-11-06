import type { Metadata, Viewport } from "next";
import "./styles/tokens.css";
import "./styles/components.css";
import "./styles/app.css";
import { StoreProvider } from "@/lib/store";

export const metadata: Metadata = { title: "IAN Bank", description: "IAN Bank 모바일 인터넷뱅킹" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#243b7a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700;800&display=swap" />
      </head>
      <body>
        <div className="shell-outer ian-app">
          <div className="shell">
            <StoreProvider>{children}</StoreProvider>
          </div>
        </div>
      </body>
    </html>
  );
}
