# Chrome Web Store listing 초안

- 대상 버전: 0.9.0
- 상태: 제출 문구 초안. 실제 Dashboard 입력과 asset 업로드는 사람 검증 후 진행한다.

## 공통 제품 정보

- 이름: **NoAI**
- Tagline: **Block AI music on YouTube. Skip it on YouTube Music.**
- 단일 목적: YouTube가 공식적으로 AI 또는 변경 콘텐츠로 표시한 음악 콘텐츠와 사용자가 직접 지정한 exact identity에 사용자의 필터 설정을 적용한다.
- 지원 사이트: `https://www.youtube.com/*`, `https://music.youtube.com/*`
- 권장 카테고리: TODO — 제출 시 Chrome Web Store의 현재 카테고리 목록에서 사람이 선택
- Privacy policy URL: TODO — 공개 저장소의 `docs/privacy.md`를 안정적인 HTTPS URL로 제공한 뒤 Dashboard에 입력
- Support URL: `https://github.com/yoobilee/noai-music/issues`

## 한국어

### 짧은 설명

YouTube 공식 AI·변경 표시 콘텐츠를 숨기거나 흐리고, YouTube Music에서 자동으로 건너뜁니다.

### 상세 설명

NoAI는 YouTube가 공식적으로 AI 또는 변경 콘텐츠로 표시한 음악 콘텐츠를 사용자가 선택한 방식으로 관리하는 브라우저 확장 프로그램입니다.

주요 기능:

- YouTube와 YouTube Music 목록에서 숨기기, 흐리기 또는 이유만 표시
- YouTube Music 현재 재생곡 자동 건너뛰기
- 곡·아티스트 허용 목록
- exact video ID, UC channel ID 또는 YouTube `@handle` 기반 직접 차단 목록
- 설정과 사용자 규칙의 브라우저 로컬 저장
- 한국어와 영어 UI

NoAI는 자체 AI 모델, 제목, 채널명이나 음원 특징으로 AI 여부를 추측하지 않습니다. 공식 표시가 있다는 이유만으로 음악 자체가 AI 생성됐다고 단정하지 않습니다. 사용자가 직접 차단한 항목은 AI 판정이 아닌 사용자 규칙이며, 허용 목록이 직접 차단과 공식 표시보다 우선합니다.

페이지 구조나 identity를 확인할 수 없으면 추측해서 차단하지 않습니다. YouTube와 YouTube Music의 UI 변경에 따라 일부 surface가 일시적으로 지원되지 않을 수 있습니다.

## English

### Short description

Hide, blur, or mark officially AI/altered-labeled YouTube content and auto-skip it on YouTube Music.

### Detailed description

NoAI lets you manage music content that YouTube officially labels as AI or altered content, using the filtering mode you choose.

Key features:

- Hide, blur, or mark supported YouTube and YouTube Music list items
- Auto-skip matching tracks during YouTube Music playback
- Track and artist allowlists
- Direct block rules using exact video IDs, UC channel IDs, or YouTube `@handles`
- Local browser storage for settings and user rules
- Korean and English UI

NoAI does not use its own AI model and does not infer AI use from titles, channel names, or audio characteristics. An official disclosure does not by itself prove that the music was AI-generated. Direct blocks are user-defined rules, not AI detections. Allowlist rules take priority over direct blocks and official disclosures.

If NoAI cannot confirm the page structure or identity, it does not guess and block the item. YouTube UI changes may temporarily make a supported surface unavailable.

## 개인정보 요약 / Privacy summary

- 별도 NoAI 서버, 사용자 계정, analytics, telemetry 또는 광고가 없다.
- 설정, 사용자가 직접 추가한 exact identity와 최소 disclosure cache는 `storage.local`에 보관한다.
- 시청·청취 기록, Google 계정 정보나 사용자 목록을 개발자 또는 제3자에게 전송하지 않는다.
- 공식 표시 추가 확인을 위해 public YouTube watch page를 `credentials: omit`으로 요청할 수 있다.
- 상세 내용은 [개인정보 처리방침 초안](privacy.md)에 기록한다.

Chrome Web Store는 로컬 처리도 공개 대상이 될 수 있으며 Dashboard의 Privacy practices와 공개 정책이 일치해야 한다. 제출 시 [공식 Privacy practices 안내](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)를 기준으로 다시 확인한다.

## 권한 설명 / Permission justifications

### `storage`

필터 설정, 사용자가 명시적으로 만든 허용·차단 규칙과 반복 요청을 줄이는 최소 disclosure cache를 사용자의 브라우저에 로컬 저장한다. Chrome sync나 NoAI 서버에는 저장하지 않는다.

### `https://www.youtube.com/*` host permission

카드에 공식 표시가 직접 보이지 않을 때 background가 검증된 video ID의 public YouTube watch page를 요청해 disclosure를 추가 확인하는 데 사용한다. 별도 서버 전송이나 일반 browsing history 수집 용도가 아니다. YouTube 카드에 필터를 적용하는 정적 주입 범위는 이 항목과 별도로 `content_scripts.matches`에도 선언된다.

### `https://music.youtube.com/*` content-script match

YouTube와 YouTube Music의 지원되는 카드·목록 row와 player bar에서 로컬 설정을 적용하도록 두 HTTPS origin을 `content_scripts.matches`에 선언한다. YouTube Music origin은 별도 `host_permissions`가 아니며 background watch-page 요청 범위를 music.youtube.com으로 확대하지 않는다.

### Remote code

사용하지 않는다. React와 모든 실행 코드는 extension package에 번들되며 원격 script, `eval` 또는 원격 실행 로직을 사용하지 않는다.

## 알려진 한계

- 0.9.0은 1.0 release candidate이며 실제 Chrome·Edge·Whale 최종 수동 검증이 남아 있다.
- YouTube Music Premium이 필요한 live auto-skip 재생 검증은 해당 환경에서 별도로 수행해야 한다.
- YouTube/YTM DOM 또는 공식 disclosure 형식이 바뀌면 확인할 수 없는 항목은 fail-closed로 처리한다.
- 채널 `@handle`은 UC ID보다 변경 가능성이 높으며 handle 변경 시 기존 exact rule이 더 이상 일치하지 않을 수 있다.
- Firefox는 1.0 범위가 아니다.

## 이미지와 screenshot 준비

Chrome 공식 문서는 현재 다음 asset을 안내한다.

- extension package 안의 128×128 PNG icon
- Chrome 관리 화면과 플랫폼 표시를 위한 16×16, 32×32, 48×48 icon 권장
- 440×280 small promotional image
- 최소 1개, 최대 5개의 1280×800 또는 640×400 screenshot

출처: [Extension icon 안내](https://developer.chrome.com/docs/extensions/develop/ui/configure-icons), [Chrome Web Store 이미지 요구사항](https://developer.chrome.com/docs/webstore/images). Dashboard 요구사항은 제출 시점에 다시 확인한다.

현재 저장소에는 확정된 NoAI icon 또는 store promotional asset이 없다. 임의 디자인을 추가하지 않았으며 다음 항목은 제출 전 TODO다.

1. popup 기본 화면
2. YouTube Blur 또는 Mark 적용 화면
3. 허용·차단 목록을 펼친 popup
4. options 관리 화면
5. 가능한 경우 YouTube Music 자동 건너뛰기 설정 또는 실제 동작 화면
6. 사용자 승인된 16/32/48/128 PNG icon set
7. 텍스트 의존이 적고 light/dark 배경에서 식별 가능한 440×280 promotional image

Screenshot은 실제 extension과 실제 지원 화면을 캡처하며 가짜 YouTube UI나 아직 검증하지 않은 동작을 사용하지 않는다. 한국어와 영어 listing에는 필요한 경우 locale별 screenshot을 별도로 준비한다.
