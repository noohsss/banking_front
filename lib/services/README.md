# services — 화면이 쓰는 데이터 계층

화면은 `useStore()`(모의 저장소)를 직접 쓰지 않고 `lib/services/use*.ts` 훅을 쓴다.
각 훅은 `lib/api/mode.ts`의 `IS_LIVE`로 분기한다.

- mock: 기존 `lib/store.tsx` 로직 그대로(백엔드 없이 데모 동작, 기본값)
- live: `lib/api/<도메인>.ts`의 타입 붙은 API 호출. 응답은 `lib/types.ts`(UI 타입)로 변환해 돌려준다.

규칙
- 훅의 반환은 UI 타입(`lib/types.ts`)만 노출한다. API 스키마 타입은 `lib/api/` 안에서만 쓴다.
- 변경 동작은 async 함수로 돌려주고, 실패하면 `ApiError`를 그대로 던진다. 화면은 `errorMessage(e)`로 문구를 만든다.
- 목록·상세 조회는 `{ data, loading, error, refresh }` 형태. 로딩·오류 상태를 화면에서 반드시 그린다.
- PIN은 live에서 최종 요청 본문에 실어 보낸다(사전 검증 API 없음). 틀리면 403 `PIN_INVALID`.
