import type { NextConfig } from "next";

// 데모 앱: 상태를 브라우저(localStorage)에 두는 클라이언트 중심 앱이라
// Cache Components·부분 프리페치(즉시 탐색 검증)는 끈다.
//
// API_PROXY_TARGET(서버 전용 환경변수)을 주면 /api/v1/* 요청을 그 백엔드로 넘긴다.
// 백엔드에 CORS 설정이 없어도 브라우저가 같은 출처로만 호출하므로 동작한다.
//   예) API_PROXY_TARGET=http://localhost:8080  NEXT_PUBLIC_API_BASE_URL=/api/v1  NEXT_PUBLIC_API_MODE=live
const target = process.env.API_PROXY_TARGET;

const nextConfig: NextConfig = {
  async rewrites() {
    return target ? [{ source: "/api/v1/:path*", destination: `${target.replace(/\/$/, "")}/api/v1/:path*` }] : [];
  },
};

export default nextConfig;
