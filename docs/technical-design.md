# NoAI 1.0 기술 설계

- 상태: 기술 기반 확정, YouTube 공식 disclosure 감지와 영상 카드 video ID 추출 vertical slice 구현
- 기준일: 2026-09-09
- 대상: 데스크톱 Chrome, Edge, Whale의 현재 안정 버전

## 1. 기술 선택

### 최종 스택

| 영역 | 선택 | 근거 |
|---|---|---|
| 확장 플랫폼 | Manifest V3 | Chrome과 Whale의 현재 확장 플랫폼이며, 이벤트 기반 service worker와 패키지 내부 코드 실행 원칙을 따른다. |
| 언어 | TypeScript 5.9 | DOM 어댑터, 판정 결과, 필터 정책과 저장 스키마의 경계를 타입으로 고정한다. TypeScript 7은 현재 ESLint 생태계의 지원 범위를 벗어나 선택하지 않았다. |
| 빌드 프레임워크 | WXT 0.21 | MV3 manifest 생성, 파일 기반 entrypoint, TypeScript, React, 다중 브라우저 빌드와 테스트 도구 통합을 제공한다. |
| UI | React 19 | popup과 options처럼 상태 기반 UI가 필요한 확장 페이지에만 사용한다. content script의 탐색·판정·필터 핵심에는 사용하지 않는다. |
| 단위 테스트 | Vitest 5 + WXT Vitest plugin | WXT alias와 확장 API 테스트 환경을 그대로 사용하며 빠른 순수 로직 검증에 적합하다. |
| E2E | Playwright 1.63 | 빌드된 Chromium 확장을 persistent context에 로드해 manifest와 확장 페이지를 검증한다. |
| 정적 검증 | ESLint 10 + typescript-eslint | TypeScript와 React Hooks의 기본 오류를 최소 구성으로 검사한다. |
| 패키지 관리 | npm + `package-lock.json` | 요청된 단일 패키지 관리 도구이며 CI에서 `npm ci`로 재현할 수 있다. |

WXT 공식 문서는 현재 React 모듈, MV3 대상 빌드, `srcDir`, manifest 생성, Vitest plugin과 Playwright 경로를 직접 안내한다. 원시 Vite 구성보다 확장 프로그램 고유의 entrypoint와 manifest 연결을 수작업으로 유지할 부분이 적다. 반면 WXT 생성 결과가 배포 계약이므로 버전 갱신 때마다 생성된 manifest와 산출물을 검증해야 하며, WXT 전용 자동 import는 entrypoint 바깥 핵심 로직으로 확산하지 않는다.

참고:

- [WXT 설치와 TypeScript 템플릿](https://wxt.dev/guide/installation)
- [WXT 프로젝트 구조와 `srcDir`](https://wxt.dev/guide/essentials/project-structure)
- [WXT manifest 생성](https://wxt.dev/guide/essentials/config/manifest.html)
- [WXT 브라우저·MV3 대상 빌드](https://wxt.dev/guide/essentials/target-different-browsers)
- [WXT Vitest 지원](https://wxt.dev/guide/essentials/unit-testing)
- [WXT Playwright 안내](https://wxt.dev/guide/essentials/e2e-testing.html)

## 2. Manifest V3와 배포 적합성

소스 저장소에 수동 `manifest.json`을 두지 않는다. `wxt.config.ts`의 공통 설정과 entrypoint 정의로 WXT가 `.output/chrome-mv3/manifest.json`을 생성한다.

현재 manifest 계약은 다음과 같다.

| 항목 | 설계 |
|---|---|
| `manifest_version` | `3`으로 고정 |
| 이름·설명 | `__MSG_*__`와 `default_locale: en`을 사용하고 영어·한국어 locale을 번들에 포함 |
| background | MV3 service worker. 설치·업데이트 시 저장 스키마 migration과 extension context 사이 메시지 조정만 담당 |
| action | popup entrypoint에서 생성 |
| options | options entrypoint에서 생성 |
| content scripts | YouTube와 YouTube Music을 별도 정적 entrypoint로 선언하고 isolated world에서 `document_idle`에 실행 |
| 원격 코드 | 사용하지 않음. React 등 실행 코드는 모두 패키지에 번들 |
| CSP | WXT의 MV3 기본값을 유지하고 CDN script, `eval`, 원격 실행 코드를 추가하지 않음 |

Chrome Web Store 관점에서 MV3, 자체 포함 코드와 최소 권한 구조에 맞는다. 다만 현재 뼈대는 제출 가능한 제품이 아니다. 생성 manifest에는 아직 `icons`가 없으며 Chrome Web Store가 요구하는 128×128 PNG도 포함하지 않았다. 실제 기능, 브랜드 확정 후 제작한 아이콘과 스토어 자산, 개인정보 처리 설명, 지원 URL, 최종 권한 사유와 수동 브라우저 검증은 출시 전에 별도로 완료해야 한다.

참고:

- [Chrome Manifest V3 개요](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
- [Chrome Web Store MV3 추가 요구사항](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements)
- [Chrome Web Store 최소 권한 정책](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
- [Chrome Web Store 이미지 요구사항](https://developer.chrome.com/docs/webstore/images)

## 3. 권한 설계

### Extension permission

현재 필요한 권한은 `storage` 하나다. 설정과 사용자가 직접 만든 허용·차단 목록을 `storage.local`에 저장하기 위해 사용한다.

다음 권한은 1.0 현재 구조에 필요하지 않아 요청하지 않는다.

- `tabs`, `history`, `cookies`, `identity`: 계정이나 브라우징 기록에 접근하지 않는다.
- `activeTab`, `scripting`: 대상 사이트가 고정되어 정적 content script로 충분하다.
- `webNavigation`: SPA 전환은 content script 내부의 페이지 신호와 DOM 관찰로 처리한다.
- `webRequest`, `declarativeNetRequest`: 네트워크 요청을 차단하거나 변경하지 않는다.
- `unlimitedStorage`: 설정과 규칙 목록은 기본 local quota 안에서 제한한다.

### 사이트 접근 범위

별도 `host_permissions`는 선언하지 않는다. 네트워크 요청, programmatic injection이나 민감한 tab 속성 접근이 없기 때문이다. 정적 content script의 `matches`만 다음 두 origin으로 제한한다.

- `https://www.youtube.com/*`
- `https://music.youtube.com/*`

`<all_urls>`, `*.youtube.com`, `m.youtube.com`, `youtu.be`는 요청하지 않는다. 지원 surface가 늘어날 때는 실제 기능과 테스트를 함께 추가한 뒤 권한을 넓힌다. Chrome은 `content_scripts.matches`도 사이트 접근 권한 범주로 취급하므로 스토어 설명에서 두 사이트에 필요한 이유를 명확히 알린다.

참고:

- [Chrome content script 정적 선언](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [Chrome 권한 선언](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)
- [Chrome storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)

## 4. 브라우저 지원

하나의 WXT `chrome-mv3` production 빌드를 공통 Chromium 산출물로 사용한다.

| 브라우저 | 1.0 방침 | 확인 범위 |
|---|---|---|
| Chrome | 1차 개발·Chrome Web Store 배포 대상 | 자동 Chromium E2E와 안정 버전 수동 검증 |
| Edge | 같은 MV3 산출물 사용, 필요하면 스토어 metadata만 분리 | 안정 버전 sideload, popup/options/content script/storage 수동 검증 |
| Whale | 같은 MV3 산출물 사용, Chrome Web Store 또는 Whale Store 배포 검토 | 안정 버전 sideload, YouTube/YouTube Music과 API 동작 수동 검증 |
| Firefox | 1.0 제외 | WXT가 지원하더라도 Firefox 빌드·코드는 이번 범위에 추가하지 않음 |

Edge 공식 문서는 Chrome의 지원 API와 manifest key가 대체로 코드 호환된다고 설명하지만 API 차이가 있을 수 있어 실제 Edge 검증을 요구한다. Whale 공식 문서는 MV3와 대부분의 Chrome 확장 호환을 안내하지만 Chrome 전용 기능은 다르게 동작할 수 있다고 명시한다. 따라서 공통 산출물은 유지하되 “Chromium 기반”만으로 호환을 통과 처리하지 않는다. 현재 사용하는 기능은 정적 content script, MV3 service worker, action/options, i18n과 `storage.local`로 제한한다.

참고:

- [Microsoft Edge의 Chrome 확장 이식 안내](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/port-chrome-extension)
- [Whale 확장앱 기본 구조와 MV3](https://developers.whale.naver.com/getting_started/anatomy_1/)
- [Whale의 Chrome 확장 호환 안내](https://help.whale.naver.com/ko/desktop/store/)

최소 지원 버전은 실제 기능과 브라우저 매트릭스 검증 뒤 1.0 출시 전에 확정한다. 자동 Playwright 검증은 번들 Chromium을 사용하며 Edge와 Whale의 수동 검증을 대체하지 않는다.

## 5. 런타임 책임 분리

| 영역 | 책임 | 하지 않는 일 |
|---|---|---|
| YouTube content script | 어댑터 시작, 페이지·DOM 변경 전달, 설정 snapshot에 따른 표시 적용 | 계정 조회, 원격 전송, 자체 AI 추측 |
| YouTube Music content script | YouTube Music 어댑터 시작, 목록 표시와 현재 곡 변경 전달, 최종 결정에 따른 skip | 장기 상태 보관, 네트워크 차단 |
| background service worker | 저장 schema migration, 설정·목록 접근 조정, context 사이 메시지 계약 | DOM 접근, 영구 in-memory 상태 가정 |
| popup | 전체 ON/OFF, 현재 mode와 상태의 빠른 제어 | 복잡한 목록 편집 |
| options | 필터 mode, 허용·차단 목록, 언어와 설명 관리 | 페이지 DOM 직접 접근 |
| adapters | 사이트별 selector, DOM 탐색, 공식 표시 evidence 추출, DOM 표현·player 제어 | evidence 의미 판정, 사용자 정책 우선순위 결정 |
| detection | adapter가 넘긴 구조화 evidence를 공식 표시 규칙과 비교해 판정 | DOM query, 오디오 분석, 제목 기반 추측 |
| filtering | 판정 결과와 사용자 설정·규칙을 조합해 순수 `FilterDecision` 생성 | DOM 변경, 저장 API 호출 |
| storage | versioned 설정과 사용자 목록 read/write/migration | 시청·청취 기록 저장, 서버 동기화 |

MV3 service worker는 필요할 때만 실행되므로 메모리에 영구 상태가 남는다고 가정하지 않는다. content script가 페이지 DOM을 다루고, background는 재시작되어도 복구 가능한 저장·메시지 작업만 담당한다.

## 6. 디렉터리 구조

```text
src/
  entrypoints/
    background.ts
    youtube.content.ts
    youtube-music.content.ts
    popup/
    options/
  adapters/
    contracts.ts
    youtube/
    youtube-music/
  detection/
    contracts.ts
  filtering/
    contracts.ts
  storage/
    contracts.ts
  shared/
    sites.ts
  ui/
    ScaffoldPage.tsx
  public/
    _locales/
      en/messages.json
      ko/messages.json
tests/
  unit/
  e2e/
docs/
  technical-design.md
```

WXT의 `srcDir: src`를 사용한다. entrypoint 관련 파일만 `src/entrypoints`에 두고, 재사용 가능한 핵심 로직은 entrypoint 밖에 둔다. WXT 자동 import에 핵심 도메인 코드가 의존하지 않게 해 Vitest에서 브라우저나 DOM 없이 불러올 수 있도록 한다.

## 7. DOM 어댑터와 SPA 관찰

YouTube와 YouTube Music은 각각 별도 `SiteAdapter` 구현을 갖는다. selector, surface별 container 탐색, 공식 표시 위치, player 제어는 해당 어댑터 밖에 작성하지 않는다. 공통 코드는 DOM element가 아니라 `MediaCandidateSnapshot`과 `OfficialDisclosureEvidence`만 받는다.

페이지 감지는 다음 순서로 설계한다.

1. content script가 `document_idle`에 시작하며 현재 route를 한 번 처리한다.
2. 각 어댑터가 관찰된 YouTube navigation event를 빠른 신호로 사용할 수 있다. 이 이벤트는 공개 API가 아니므로 단독 근거로 삼지 않는다.
3. `MutationObserver`가 페이지의 `childList/subtree` 변경에서 추가된 root만 수집한다.
4. mutation batch는 `requestAnimationFrame` 단위로 합쳐 같은 DOM을 반복 탐색하지 않는다.
5. 매 batch에서 `location.href`로 만든 route key를 비교해 SPA 이동 누락을 보완한다.
6. `WeakMap<Element, AppliedState>`로 같은 candidate와 결정을 중복 적용하지 않는다.
7. route 변경 시 route-scoped cache와 observer 상태를 정리하고, WXT content script context가 invalidated되면 모든 listener와 observer를 해제한다.

history 메서드 monkey patch, 고빈도 polling과 매 mutation 전체 문서 재탐색은 기본 전략으로 사용하지 않는다. 실제 DOM 조사가 끝난 뒤 필요한 event와 selector를 fixture 테스트로 고정한다.

영상 단위의 video ID는 adapter 내부 DOM 탐색과 DOM 없는 순수 URL parser를 분리한다. 제목 링크, 썸네일 링크, 일반 링크 순으로 확인하며 같은 우선순위에서 서로 다른 유효 ID가 나오면 추출하지 않는다. 지원 URL과 surface별 조사 결과는 [`youtube-video-id-extraction.md`](youtube-video-id-extraction.md)에 기록한다.

## 8. 판정과 필터 정책

어댑터는 공식 UI에서 확인한 문구, 위치와 대상 candidate를 evidence로 구조화한다. detector는 알려진 공식 표시 규칙만 평가한다.

- `official-disclosure-found`: 공식 표시 evidence가 확인됨
- `no-official-disclosure`: 조사한 surface에서 공식 표시를 찾지 못함. “AI가 아님”을 의미하지 않는다.
- `indeterminate`: DOM 변경, 누락된 식별자나 알 수 없는 표시로 판단할 수 없음

`indeterminate`는 자동 차단하지 않는다. 원문 HTML, 음원 특징, 제목·채널명 추측은 판정 입력으로 사용하지 않는다.

filtering은 DOM과 무관한 순수 정책으로 구현한다. 기본 우선순위는 다음 원칙으로 고정한다.

1. 전체 필터 OFF면 변경하지 않는다.
2. 사용자 규칙은 대상 구체성(`track` > `artist` > `channel`)이 높은 것을 우선한다.
3. 같은 대상·구체성의 충돌은 allow를 우선해 사용자가 오탐을 복구할 수 있게 한다.
4. 사용자 block이 있으면 선택한 mode로 필터한다.
5. 공식 표시 판정이 있고 allow가 없으면 선택한 mode로 필터한다.
6. 그 외와 판정 불가는 변경하지 않는다.

`show` mode는 콘텐츠를 제거하지 않고 이유 표시만 제공한다. YouTube Music 자동 skip은 동일한 최종 정책 결정을 사용하며, track key와 cooldown으로 같은 곡을 반복 skip하지 않게 한다.

## 9. 저장과 캐시

지속 데이터는 `storage.local`만 사용한다. `storage.sync`는 Google 계정 기반 동기화를 만들 수 있으므로 1.0에서 사용하지 않는다.

- `settings`: schema version, 전체 활성화, mode, locale
- `rules`: 사용자가 만든 allow/block entity 목록
- entity: site, `track | artist | channel`, 가능한 경우 YouTube의 안정 ID, 사용자 확인용 label

저장 schema에는 version을 두고 background 시작 시 순수 migration 함수를 거친다. 쓰기는 전체 객체 덮어쓰기보다 단일 저장소 계층에서 검증·정규화한 뒤 수행한다. 목록 상한과 중복 제거 규칙은 실제 목록 기능 구현 때 확정한다.

판정 캐시는 저장소에 남기지 않고 content script 메모리에만 둔다. `(site, contentId, evidence fingerprint, detector version)`을 key로 사용하고 route 변경, TTL 만료, element 제거 또는 extension reload 때 폐기한다. 원문 DOM, 시청·청취 이력과 Google 계정 정보는 캐시에 저장하지 않는다.

## 10. 테스트 전략

### 현재 기반 검증

- ESLint: TypeScript와 React Hooks 정적 검사
- Type Check: WXT가 생성한 tsconfig를 확장한 strict TypeScript 검사
- Vitest: content script site 범위가 두 HTTPS origin에서 넓어지지 않는지 검사
- WXT Build: `chrome-mv3` manifest와 전체 entrypoint 생성 확인
- Playwright: 생성 manifest의 MV3·권한·site 범위와 popup/options 로드 smoke test

`npm run verify`는 Lint, Type Check, Vitest와 production build를 실행한다. `npm run verify:all`은 같은 검증에 Playwright extension smoke test까지 이어서 실행하는 로컬 전체 검증 진입점이다.

### 기능 구현 시 추가

- detection/filtering/storage migration은 DOM 없는 table-driven unit test로 정상·판정 불가·충돌 경계를 검증한다.
- adapter는 개인정보를 제거한 작은 HTML fixture를 surface·언어별로 두고 selector와 evidence 추출 contract를 검증한다.
- 실제 YouTube 네트워크에 의존하는 검사는 기본 CI에 넣지 않는다. UI 변경과 로그인 상태 때문에 생기는 간헐성을 fixture test와 수동 호환성 검사로 분리한다.
- Chrome, Edge, Whale에서 logged-out/logged-in, 한국어/영어, 홈·검색·관련·재생목록과 YouTube Music player를 수동 확인한다.
- 자동 접근성 검사와 별도로 popup/options/이유 표시의 키보드, focus, 확대와 대비를 수동 확인한다.

현재 첫 vertical slice에서는 `happy-dom`으로 비식별 HTML fixture를 읽어 adapter를 단위 검증한다. Playwright는 같은 fixture를 `youtube.com` URL에 응답하도록 가로채 빌드된 content script가 확정 대상에 개발 배지를 한 번만 추가하고 일반 카드와 유사 문구 카드에는 추가하지 않는지 확인한다. 실제 YouTube 네트워크는 이 자동 테스트의 입력이나 성공 조건이 아니다.

Playwright 공식 문서에 따라 확장 E2E는 bundled Chromium persistent context를 사용한다. Chrome과 Edge 자체는 sideload CLI flag 제한이 있으므로 자동 테스트 결과만으로 Edge·Whale 호환을 선언하지 않는다.

참고: [Playwright Chrome extension 테스트](https://playwright.dev/docs/chrome-extensions)

## 11. 구현된 첫 YouTube disclosure slice

YouTube adapter는 페이지에 이미 렌더링된 영상 단위에서 다음 두 종류의 공식 근거만 구조화한다.

- `ytd-badge-supported-renderer` 또는 `yt-badge-view-model` 아래의 확인된 영어·한국어 AI 접근성 레이블
- `how-this-was-made-section-view-model` 안에서 YouTube 도움말 문서 `15447836` 링크와 확인된 disclosure 제목·본문이 함께 있는 경우

adapter가 반환하는 evidence에는 `source`, `kind`, `matchedText`, `confidence`, `location`과 `evidenceType`만 포함하며 DOM을 detector에 전달하지 않는다. detector는 `confirmed`인 `made-with-ai` 또는 `altered-or-synthetic-content`만 `detected: true`로 판정한다. 알 수 없는 구조와 유사 문구는 판정하지 않는다.

content script는 `MutationObserver`가 받은 추가·제거 노드와 관련 속성 변경만 `requestAnimationFrame` 단위로 묶어 처리한다. `yt-navigate-finish`에서는 route key를 갱신하고 드물게 전체 문서를 다시 확인한다. 처리 결과는 `WeakMap`에만 두며 extension context가 무효화되면 observer, navigation listener와 예약된 frame을 해제한다.

판정된 영상 단위에는 `NoAI: AI disclosure detected`라는 작은 개발용 배지만 붙인다. 중복 DOM 속성과 `WeakMap` fingerprint를 함께 확인하며 콘텐츠를 숨기거나 흐리거나 재생을 제어하지 않는다.

조사 근거, fixture 출처와 현재 지원 한계는 [`youtube-disclosure-detection.md`](youtube-disclosure-detection.md)에 기록한다.

## 12. 아직 구현하지 않는 것

- 홈·검색·관련·재생목록 카드의 watch 페이지 disclosure 추가 조회
- YouTube Music selector와 adapter 구현
- 확인되지 않은 언어·표시 변형
- 필터 정책 함수와 DOM hide/blur/reason UI
- 자동 skip
- 저장 read/write/migration 구현
- popup/options 제품 UI와 최종 디자인
- 라이브 YouTube E2E와 브라우저별 수동 검증
- 스토어 제출과 자동 배포

다음 단계는 실제 Chrome에서 홈·검색·관련·재생목록 카드의 video ID 추출과 현재 watch-page disclosure selector를 함께 수동 검증하고 차이를 fixture에 반영하는 것이다. 그 검증 뒤 카드별 추가 확인을 어떤 최소 권한·비용 구조로 수행할지 별도 설계한다. DOM 필터링과 자동 skip은 카드 판정 경로가 확정된 다음에 연결한다.
