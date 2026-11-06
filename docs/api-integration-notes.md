# API 연동 메모: 명세와 화면이 어긋나서 백엔드와 확정해야 할 것

기준: `docs/api/openapi.yaml` (v0.1.0) · 작성일: 2026-11-06
연동 방식: 화면은 `lib/services/use*.ts` 훅을 쓰고, `NEXT_PUBLIC_API_MODE=live`일 때만 실제 API를 호출한다(기본 mock).
상태: 실서버 호출은 아직 검증하지 못했다. 백엔드 확정 후 아래 항목을 하나씩 닫는다.

## 확정이 필요한 항목

- **PIN**: 사전 검증 API가 없어서 live에서는 최종 요청에 PIN을 실어 보내고, 틀리면 403(`PIN_INVALID`)으로 받는다. 카드 분실 신고와 한도 변경에는 PIN 필드 자체가 없어서 live에서는 PIN 단계를 건너뛴다.
- **카드**: 정지 해제 API가 없어서 live에서는 해당 버튼을 숨긴다. 결제 알림에 `cardId`가 없어 카드별이 아닌 전체 결제 알림이 보인다.
- **자동이체**: 일시정지·재개가 없어 live에서는 스위치 대신 "해지" 버튼을 쓴다. 응답에 수취인 이름도 없다.
- **계좌**: 계좌 목록에는 한도·금리·개설일이 없어서 한도는 별도 조회로 받는다. 개설 요청의 `openingInfo.fundSource`는 임의로 정한 키다. 거래내역 검색은 live에서 상대방 이름만 된다.
- **회원**: PIN 로그인이 `loginId`를 요구해서 live에서만 아이디 입력란이 생긴다. 이메일 변경 API가 없어 live에서는 읽기 전용이다.
- **미해결 정책**: 잠금 기준, 인증번호 만료, 토큰 만료·리프레시, 월말 처리 등은 임의로 정하지 않고 서버 응답을 따르게 했다.

## 코드에서 고칠 위치 (명세가 확정되면)

| 항목 | 위치 |
|---|---|
| 카드 PIN·정지 해제·알림 | `lib/services/useCard.ts`, `app/cards/[id]/page.tsx`(`afterForm`), `lib/api/cardNotifications.ts` |
| 자동이체 해지·수취인 이름 | `lib/api/autoTransfers.ts`, `lib/services/useAutoTransfers.ts`, `app/auto-transfers/page.tsx` |
| 계좌 한도·개설 `openingInfo` | `lib/api/accounts.ts`, `lib/services/useOpenAccount.ts`, `lib/services/useAccounts.ts` |
| 거래내역 검색 | `lib/services/useTransactions.ts`, `app/accounts/[id]/page.tsx` |
| PIN 로그인·이메일 변경 | `lib/services/useAuth.ts`, `app/login/page.tsx`, `app/(main)/menu/page.tsx` |
| 스키마 갱신 | `npm run api:types` (`lib/api/openapi.yaml` 교체 후) |
