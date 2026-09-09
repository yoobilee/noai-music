# YouTube watch-page disclosure 추가 확인과 로컬 캐시

- 설계·확인일: 2026-09-09
- 범위: 데스크톱 YouTube 영상 카드의 video ID 기반 공식 disclosure 추가 확인
- 제품 필터: confirmed 결과만 hide/blur/mark 정책에 전달

## 조사 결과와 요청 위치

2026-09-09에 공개 disclosure 표본 `z8Dz-IFFFY4`을 로그인 정보나 저장 쿠키 없이 HTTPS로 요청했다. 응답은 200이었고 약 1.49 MB의 HTML 안에 `ytInitialData`, `videoPrimaryInfoRenderer`, `metadataBadgeRenderer`, `AI: Content was made with AI`, `howThisWasMadeSectionViewModel`과 공식 도움말 ID `15447836`이 함께 있었다. 구현한 HTML adapter와 기존 detector를 그 응답에 일회성으로 실행해 `detected: true`도 확인했다. 이 공개 표본은 구조 calibration 자료이며 영구 자동 테스트 oracle이 아니다.

요청은 content script가 아니라 MV3 background service worker에서 수행한다.

- 여러 탭과 카드의 동일 video ID 요청을 한곳에서 결합하고 동시성을 제한할 수 있다.
- 캐시 read/write와 네트워크 결과 저장을 같은 신뢰 경계에서 처리한다.
- content script가 임의 URL을 넘기지 못하게 11자리 video ID만 메시지로 받고 background가 URL을 조립한다.
- Chrome은 extension service worker의 cross-origin fetch에 host permission을 요구한다. 따라서 `https://www.youtube.com/*`만 추가한다.

참고:

- [Chrome extension의 cross-origin network request](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)
- [Chrome permission 선언과 host permission](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)
- [Chrome storage.local](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [WXT manifest 설정](https://wxt.dev/guide/essentials/config/manifest.html)

## 보안·개인정보 경계

- URL은 항상 `https://www.youtube.com/watch?v=VIDEO_ID&hl=en` 형식으로 background 내부에서 만든다.
- message sender는 동일 extension ID와 `https://www.youtube.com` origin인지 확인한다.
- fetch는 `credentials: 'omit'`과 `referrerPolicy: 'no-referrer'`를 사용한다.
- `cookies`, `history`, `tabs`, `identity`, `webRequest`, `<all_urls>` 권한을 추가하지 않는다.
- YouTube Data API, 별도 서버, telemetry와 analytics를 사용하지 않는다.
- 응답 HTML은 저장하거나 DOM에 넣거나 실행하지 않는다. 최대 5 MB까지만 받아 JSON data를 `JSON.parse`한다.

로그인하지 않은 공개 watch 응답이 consent, challenge, 지역 제한 또는 다른 불완전 페이지를 반환하면 정상 watch 구조가 없으므로 `unknown-or-error`로 처리한다. 로그인 세션을 사용해 이를 우회하지 않는다.

## 요청 제어

- 같은 service worker 실행 중 동일 video ID 요청은 하나의 Promise로 결합한다.
- 실제 fetch 동시성은 2개, 대기 queue는 20개로 제한한다.
- queue가 가득 차면 해당 요청은 `queue-full` unknown이며 영구 음성 판정으로 저장하지 않는다.
- 각 fetch timeout은 8초이며 자동 retry는 없다.
- 4xx/5xx, network 오류, timeout, HTML이 아닌 응답, 다른 URL redirect와 5 MB 초과 응답은 `unknown-or-error`다.
- content script도 route 안에서 진행 중인 video ID별 Promise를 공유하고 완료 즉시 map에서 제거한다. SPA route가 바뀌면 route map을 버리고 이전 응답이 새 카드에 적용되지 않게 route/video key를 비교한다.

## HTML adapter와 detector 재사용

`watchPageHtml.ts`는 실제 DOM adapter와 별도의 YouTube adapter다. 알려진 `ytInitialData` assignment에서 균형 잡힌 JSON 객체를 추출하며 script를 실행하지 않는다.

1. `videoPrimaryInfoRenderer`가 없으면 watch page로 확인할 수 없어 unknown이다.
2. metadata badge는 현재 영상의 primary renderer 아래만 읽는다. 추천 영상의 badge는 보지 않는다.
3. 설명 evidence는 최상위 `engagementPanels` 아래의 `howThisWasMadeSectionViewModel`만 읽는다.
4. DOM adapter와 HTML adapter는 동일한 영어·한국어 exact-label, 공식 도움말 URL과 description profile 함수를 사용한다.
5. 두 adapter 모두 구조화 evidence만 기존 순수 detector에 넘긴다.

제목, 설명, 채널명이나 AI 키워드 자체는 판정 입력이 아니다. 알 수 없는 공식 component는 indeterminate evidence와 unknown 결과를 만들며 `not-detected`로 낮추지 않는다.

## 캐시 계약

`storage.local`의 단일 `youtubeDisclosureCacheV1` 객체에 schema version 1과 최대 500개 항목을 저장한다.

| 상태 | TTL | 이유 |
|---|---:|---|
| `confirmed` | 7일 | 확인된 공식 evidence의 반복 조회를 줄임 |
| `not-detected` | 12시간 | 표시 부재와 YouTube 응답 구조 변화를 더 빨리 재확인 |
| `unknown-or-error` | 5분 | 오류를 false로 영구화하지 않고 일시적 폭주만 완화 |

항목에는 video ID, 상태, 최소 evidence(`source`, kind, 정규화 문구, confidence, 위치/type), `checkedAt`, `expiresAt`, 필요한 경우 오류 범주만 둔다. 전체 URL, 제목, 채널명, 검색어, 원본 HTML과 계정 정보는 저장하지 않는다. 만료 항목은 read/write 때 제거하고 500개를 넘으면 가장 오래 확인한 항목부터 제거한다. schema version이 다르거나 항목이 손상되면 cache miss로 처리한다.

## 필터 정책 전달

공식 disclosure가 카드 DOM에 직접 있으면 추가 확인하지 않고 기존 detector 결과를 사용한다. 그렇지 않으면 watch-page lookup 결과를 필터 policy에 전달한다. policy는 `confirmed`와 공식 evidence가 함께 있을 때만 설정된 hide/blur/mark를 적용하고, 나머지 상태는 DOM을 변경하지 않는다. watch-page 본문 candidate는 fetch하거나 필터하지 않는다. checking, not-detected와 unknown 개발 badge는 기본 사용자 화면에서 제거했다.

## 비식별 fixture와 테스트

`watch-page-data.disclosed.html`, `watch-page-data.ordinary.html`, `watch-page-data.unknown.html`은 공개 응답에서 확인한 renderer 관계만 보존한다. 제목, 채널, 계정, 추천, 댓글, tracking과 시청 기록은 포함하지 않는다.

Vitest는 HTML parser의 양성·음성·불완전 구조, 공식 영역 밖 유사 evidence, fetch 오류/timeout, URL 고정과 credential 제외, 요청 dedupe/concurrency/queue, cache hit/miss, TTL/schema와 오류 상태를 검증한다. Playwright는 fixture card 두 개의 동일 ID가 한 번만 요청되는지, 양성·음성 상태와 새로고침 후 `storage.local` cache hit을 검증한다. 실제 youtube.com 네트워크는 CI 성공 조건이 아니다.

## Chrome 수동 검증 절차

1. `npm run build` 후 `.output/chrome-mv3`를 Chrome 확장 관리 화면에서 unpacked로 로드한다.
2. service worker DevTools Network에서 요청이 `www.youtube.com/watch`, HTTPS, 동시 최대 2개인지 확인한다.
3. 홈 또는 검색에서 공개 disclosure 표본 카드가 보이면 선택한 hide/blur/mark가 적용되는지 확인한다.
4. 일반 카드와 unknown 결과의 콘텐츠가 숨겨지거나 흐려지지 않는지 확인한다.
5. 요청 header에 Cookie가 없고 cache 객체에 URL·제목·채널·검색어가 없는지 확인한다.
6. 같은 video ID가 여러 카드에 있으면 watch 요청이 한 번인지 확인한다.
7. 새로고침 뒤 같은 카드가 cache source 결과를 사용해 추가 요청이 줄어드는지 확인한다.
8. 오프라인 또는 요청 차단 상태에서 unknown으로 표시되고 5분 뒤에만 다시 확인 가능한지 확인한다.
9. SPA 이동과 뒤로가기에서 이전 route의 늦은 응답이 새 카드에 적용되지 않는지 확인한다.

추천 결과에 공개 표본 카드가 나타나지 않으면 live E2E를 만들거나 추천을 조작하지 않는다. fixture E2E와 위 재현 절차를 분리해 기록한다.

이번 작업 환경에서는 자동화용 실제 Chrome 연결을 사용할 수 없어 위 수동 절차를 수행하지 못했다. 공개 HTML의 일회성 parser calibration과 bundled Chromium fixture E2E는 통과했지만 실제 Chrome의 추천 화면 확인을 대신하지 않는다.

## 현재 한계

- 로그인 없는 공개 HTML에 필요한 initial data가 없는 지역·연령·consent·challenge 페이지는 unknown이다.
- 현재 확인한 영어/한국어 disclosure 구조만 확정한다. fetch는 `hl=en`을 사용하지만 YouTube가 이를 보장하지 않으면 unknown이 될 수 있다.
- YouTube가 assignment 이름, primary renderer, engagement panel 또는 공식 문구를 바꾸면 unknown이 늘어날 수 있다.
- MV3 worker가 종료되면 in-flight dedupe와 queue는 초기화된다. 완료된 결과만 `storage.local`에서 복구한다.
- 20개를 넘는 대기 요청은 이번 route에서 unknown으로 표시될 수 있으며 자동 retry하지 않는다.
- hide/blur/mark는 구현됐지만 allow/block과 자동 skip은 구현하지 않는다.
- Shorts와 YouTube Music은 이번 범위에 포함하지 않는다.
