@AGENTS.md

# IAN Bank 웹 프런트 (web/)

모바일 웹뱅킹(Next.js 16 App Router, TypeScript). 이 폴더가 git 저장소 루트이고 `main`에 푸시하면 Vercel이 production으로 자동 배포한다.
기획·명세·디자인 원본은 저장소 밖 상위 폴더에 있다: `../docs/`(기획서·도메인·API 명세), `../design-system/`(토큰·컴포넌트 시안, DESIGN.md).

## 0. 작업 원칙

- 요청받은 범위만 고친다. 범위 밖 리팩터링·의존성 추가·설정 변경은 먼저 묻는다.
- 명세에 없는 동작을 임의로 확정하지 않는다. 어긋나면 구현을 멈추고 `docs/api-integration-notes.md`에 적고 보고한다.
- 되돌리기 어렵거나 밖으로 나가는 작업(푸시, 병합, 배포, 저장소·Vercel 설정 변경, 원격 주소 변경)은 사용자가 말했을 때만 한다. 한 번의 승인을 다른 작업으로 넓히지 않는다.
- 검증하지 않은 것을 "됐다"고 하지 않는다. 실행해 본 것과 코드만 본 것을 구분해서 보고한다.

## 1. 명령어

```bash
export PATH=/opt/homebrew/bin:$PATH   # 이 Mac은 Node가 Homebrew 경로에만 있다
npm run dev            # 개발 서버 (기본 3000, mock 모드)
npx tsc --noEmit       # 타입 검사
npx eslint app lib components
npm run build          # 프로덕션 빌드. dev 서버와 .next를 같이 쓰므로 dev를 먼저 끈다
npm run api:types      # lib/api/openapi.yaml → lib/api/schema.d.ts 재생성
```

## 2. 구조

| 위치 | 역할 |
|---|---|
| `app/styles/{tokens,components,app}.css` | 디자인 토큰, `ian-` 컴포넌트 CSS, 앱 셸. 전역으로 한 번만 import(`app/layout.tsx`) |
| `app/(main)/` | 하단 메뉴(Dock)가 붙는 탭 화면: home, cards, menu |
| `app/{login,signup,accounts,transfer,auto-transfers,cards}` | 하단 메뉴 없는 흐름 화면 |
| `components/` | 공용 UI: AppBar, Dock, PinPad, Sheet, StatusBadge, Stepper |
| `lib/types.ts`, `lib/format.ts` | UI 타입, 금액·마스킹·상태 라벨 포맷 |
| `lib/store.tsx`, `lib/seed.ts` | mock 모드의 데모 저장소(localStorage)와 시드. live 모드에서는 인증(user·토큰)만 쓴다 |
| `lib/api/` | `schema.d.ts`(생성물, 직접 수정 금지), `client.ts`, `errors.ts`, `token.ts`, `mode.ts`, 도메인별 API 함수와 매퍼 |
| `lib/services/use*.ts` | 화면이 쓰는 데이터 훅. mock/live 분기는 여기서만 한다 |
| `docs/` | 이 저장소 안의 메모. `api-integration-notes.md` = 명세와 화면이 어긋난 항목 |

## 3. 데이터 계층 규칙 (가장 중요)

- 화면 컴포넌트는 `useStore()`나 `lib/api/*`를 직접 부르지 않고 `lib/services/use*.ts` 훅만 쓴다. (`useStore`는 인증·가드와 서비스 훅 내부에서만 쓴다.)
- 훅은 `IS_LIVE`(`NEXT_PUBLIC_API_MODE === "live"`)로 분기한다. **기본은 mock이고, mock 동작은 바꾸지 않는다.** 백엔드가 없는 지금 Vercel 데모가 mock으로 돌기 때문이다.
- 훅은 UI 타입(`lib/types.ts`)만 돌려준다. API 스키마 타입과 변환(매퍼)은 `lib/api/` 안에 둔다.
- 변경 동작은 async로 만들고 실패하면 `ApiError`를 그대로 던진다. 화면은 `errorMessage(e)`로 문구를 만든다. 조회 훅은 `{ data, loading, error, refresh }` 형태이고 로딩·오류 상태를 반드시 그린다.
- 계약 훅 `useAccounts()`의 반환 `{ accounts, loading, error, refresh }`는 이체·카드 화면이 공유하므로 바꾸지 않는다.
- 이체 등 중복 제출이 위험한 요청은 시도마다 `Idempotency-Key`를 한 번 만들고, 같은 시도의 재전송에는 같은 키를 쓴다.
- PIN은 사전 검증 API가 없다. live에서는 최종 요청 본문에 실어 보내고 403 `PIN_INVALID`면 PIN 단계에서 다시 입력받는다. PIN·비밀번호·인증번호는 `console`, 로그, URL, localStorage에 남기지 않는다.
- 명세의 미해결 정책(잠금 기준, 인증번호 만료·시도 횟수, 토큰 만료, 월말 처리 등)은 임의로 정하지 말고 서버 응답을 따른다.

## 4. 구현 규칙

### Next.js 16
- 이 버전은 기존 지식과 다르다. 라우팅·`params`·`searchParams`·metadata·캐싱을 만지기 전에 `node_modules/next/dist/docs/`에서 해당 문서를 읽는다. (`params`는 Promise일 수 있어 `use(params)`로 푼다.)
- `useSearchParams`는 `<Suspense>`로 감싼다.
- `next.config.ts`의 Cache Components·부분 프리페치는 의도적으로 껐다(클라이언트 상태 중심 앱). 켜지 않는다.
- 화면은 `'use client'`로 만들어도 된다. 서버 컴포넌트로 옮길 이유가 있을 때만 옮긴다.

### 디자인 시스템
- 색·간격·글자는 `var(--ian-*)` 토큰만 쓴다. 하드코딩한 색·px 값을 새로 만들지 않는다. 마크업은 기존 `ian-` 클래스를 먼저 쓰고, 부족하면 해당 화면 폴더의 `*.module.css`에 토큰으로만 추가한다.
- 아이덴티티는 네이비 + 밝은 파랑. 포인트색은 노랑(`--ian-sun`)·민트(`--ian-mint`)·라벤더(`--ian-violet`)만 한두 군데에 쓴다. **핑크 금지.**
- 빨강은 오류·분실·해지 위험 전용, 거래중지·정지는 `--ian-warning`. 입금은 파랑 `+`, 출금은 잉크 `−`.
- 금액·숫자는 `ian-num`(Sora). 다크 모드는 토큰만으로 대응한다(색을 직접 박지 않는다).
- **금지**: 생체인증 UI, 밀어서 확인(slide-to-confirm), 은행 선택 UI(수취는 IAN Bank 계좌만).
- 되돌릴 수 없는 동작(해지·분실·탈퇴)은 최종 확인 문구 + danger 버튼 + PIN을 모두 거친다.
- 계좌·카드 번호는 `maskAccount`/끝 4자리만 노출. 복사 버튼만 전체 번호를 쓰고, 전체 번호는 계좌 상세 응답에서만 온다.
- 접수/등록과 실제 완료를 문구로 구분한다("등록했어요", "송금 완료"). 결과가 불확실하면 "결과 확인 중"으로 보여 주고 재시도를 유도하지 않는다.
- 상태는 색만으로 구분하지 않는다(`StatusBadge`처럼 모양+문구). 모든 입력은 label과 오류 문구를 aria로 연결하고, 포커스가 보여야 하고, 터치 영역은 48px 이상.
- 문구는 해요체·능동·구체적으로. 오류 문구는 원인과 다음 행동을 말한다.

## 5. 검증 (끝났다고 말하기 전에)

1. `npx tsc --noEmit` 오류 0
2. `npx eslint app lib components` 오류 0 (경고는 이유를 달아 처리). 규칙 끄기(`eslint-disable`)는 줄 단위로, 이유를 `--` 뒤에 적는다.
3. `npm run build` 통과 (dev 서버를 끈 뒤)
4. UI를 바꿨다면 dev 서버를 띄워 브라우저에서 직접 확인한다. 데모 계정: `minsu` / `ian1234!`, PIN `123456`, 이메일 인증번호 `000000`. 바꾼 화면의 정상 흐름과 오류·빈 상태 하나씩, 콘솔 오류 확인. 모바일 폭(375px)과 다크 모드도 본다.
5. API 연동을 바꿨다면 `NEXT_PUBLIC_API_MODE=live`로도 띄워, 백엔드가 꺼진 상태에서 화면이 깨지지 않고 오류 안내가 뜨는지 확인한다. 실서버 호출은 백엔드가 준비되기 전에는 검증 불가임을 보고에 적는다.
6. 확인하지 못한 것은 보고에서 빼지 말고 "확인 못 함"으로 적는다.

## 6. Git·커밋

- **`main`에 직접 커밋하지 않는다.** `feat/…`, `fix/…`, `chore/…`, `docs/…` 브랜치를 만들어 작업하고 PR로 합친다. `main` 푸시 = production 자동 배포다.
- 커밋은 논리 단위로 쪼갠다. 메시지는 Conventional Commits 형식, 한국어로: `type: 요약(명령형, 50자 안팎)` + 빈 줄 + 왜 바꿨는지. type은 `feat, fix, refactor, style, docs, chore, test, build`.
- 커밋 전에 5절의 1~3을 통과시킨다. `.env*`, 토큰, 비밀값, `node_modules`, `.next`는 커밋하지 않는다(`.env.example`만 예외).
- `git add -A` 전에 `git status`로 의도하지 않은 파일이 없는지 본다. 생성물 `lib/api/schema.d.ts`는 `openapi.yaml`과 같이 커밋한다.
- 사용자가 요청할 때만 커밋·푸시·병합한다. 푸시·병합·강제 푸시(`--force`)·브랜치 삭제·기본 브랜치 변경·원격 주소 변경은 각각 따로 확인받는다.
- 커밋·PR에 붙이는 공동 작성자 문구는 사용자 설정(전역 CLAUDE.md, 하네스 안내)을 따른다. 이 파일에서 따로 정하지 않는다.
- 저장소 이름이 `banking_front`로 바뀌었다. 로컬 `origin`은 옛 이름을 가리키지만 GitHub가 이어 준다(바꾸려면 사용자에게 확인).

## 7. API 명세 변경 대응

- 원본은 `../docs/api/openapi.yaml`이다. 변경되면 `lib/api/openapi.yaml`을 교체하고 `npm run api:types` → `npx tsc --noEmit`으로 깨지는 곳을 찾아 매퍼·훅을 고친다.
- 어긋남은 `docs/api-integration-notes.md`의 표에 항목과 고칠 파일 위치를 같이 적는다. 닫힌 항목은 지운다.

## 8. 병렬 작업 (서브에이전트)

- 도메인(인증·계좌·이체·카드)별로 파일 소유권을 나눠 맡긴다. 맡은 폴더 밖 수정은 금지하고, 공통 파일(`lib/store.tsx`, `lib/types.ts`, `components/`, 공통 CSS)은 한 명만 고치거나 메인이 고친다. `lib/types.ts`는 선택 필드 추가만 허용.
- 공유 계약(예: `useAccounts` 반환 형태)은 먼저 스텁으로 만들어 두고 그 형태를 지킨다.
- 에이전트 보고는 사실 확인 전까지 결과로 취급하지 않는다. 합친 뒤 5절 검증을 메인이 다시 돌린다.

## 9. 보안·공개 범위

- 이 저장소는 공개다. 실제 계정·키·토큰·개인정보를 넣지 않는다. 데모 로그인 정보는 이미 소스에 있는 가짜 값이다.
- 보안 설정(Vercel 배포 보호, GitHub 저장소 설정, 권한)은 사용자가 요청할 때만 바꾼다.
- 브라우저 확인 중 입력한 테스트 값은 데모 값만 쓴다.
