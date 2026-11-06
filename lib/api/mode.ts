/**
 * 데이터 소스 모드.
 *  - "mock": 브라우저 localStorage 기반 데모 저장소(lib/store.tsx). 백엔드 없이 동작. (기본값)
 *  - "live": docs/api/openapi.yaml 의 REST API 호출.
 * 백엔드가 준비되면 NEXT_PUBLIC_API_MODE=live 와 NEXT_PUBLIC_API_BASE_URL 만 바꾸면 된다.
 */
export const API_MODE: "mock" | "live" = process.env.NEXT_PUBLIC_API_MODE === "live" ? "live" : "mock";
export const IS_LIVE = API_MODE === "live";
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api/v1";
