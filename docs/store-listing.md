# Chrome Web Store listing

- 현재 공개 버전: 1.1.0
- 상태: 1.1.0 공개 / 설치 가능
- 공개 URL: https://chromewebstore.google.com/detail/noai/eiddibmnpcdbgdmeoipniomddiboikkf

## 1.1.0 공개 listing

아래 짧은 설명과 상세 설명은 Chrome Web Store에 공개된 1.1.0 listing 기준이다.

확장 프로그램 패키지 요약은 Store Dashboard에서 직접 수정하는 listing 필드가 아니며 locale과 manifest에서 관리한다.

- 한국어 패키지 요약: YouTube와 YouTube Music에서 공식 AI·변경 표시가 있는 콘텐츠를 필터링합니다.
- English package summary: Filter officially labeled AI or altered content on YouTube and YouTube Music.

## 공통 제품 정보

- Brand: **NoAI**
- English display name: **NoAI — AI-Labeled Music Filter**
- Korean display name: **NoAI — AI 표시 음악 필터**
- Tagline: **Block AI music on YouTube. Skip it on YouTube Music.**
- 단일 목적: YouTube가 공식적으로 AI 또는 변경 콘텐츠라고 표시한 콘텐츠와 사용자가 직접 지정한 정확한 식별 정보에 사용자의 필터 설정을 적용한다.
- 지원 사이트: `https://www.youtube.com/*`, `https://music.youtube.com/*`
- 카테고리: Chrome Web Store 공개 등록정보에서 관리
- Privacy policy URL: https://github.com/yoobilee/noai-music/blob/main/docs/privacy.md
- Support URL: `https://github.com/yoobilee/noai-music/issues`

## 한국어

### 짧은 설명

YouTube에서 공식적으로 AI 또는 변경 콘텐츠로 표시된 콘텐츠를 숨기거나 흐리고, YouTube Music에서는 자동으로 건너뜁니다.

### 상세 설명

NoAI는 YouTube가 공식적으로 AI 또는 변경 콘텐츠라고 표시한 콘텐츠를 사용자가 원하는 방식으로 관리하도록 돕는 브라우저 확장 프로그램입니다.

주요 기능:

- 필터 대상을 음악만 또는 모든 AI 표시 콘텐츠 중 선택
- 지원되는 YouTube와 YouTube Music 목록에서 숨기기, 흐리기 또는 표시만 하기
- YouTube Music에서 대상 콘텐츠 자동 건너뛰기
- 콘텐츠 및 아티스트 허용 목록
- 원하는 콘텐츠, 아티스트, 채널 직접 차단
- 한국어와 영어 지원(브라우저 언어에 맞춰 자동 선택하거나 직접 변경)

'음악만'을 선택하면 YouTube가 Music 카테고리로 분류한 콘텐츠에만 AI 표시 필터를 적용합니다. 다른 카테고리이거나 확인할 수 없는 항목을 음악이라고 추측해서 필터링하지 않습니다.

'AI 표시 콘텐츠 전체'를 선택하면 NoAI가 지원하는 영역에서 YouTube가 공식적으로 AI 또는 변경 콘텐츠라고 표시한 콘텐츠 전체에 필터를 적용합니다.

NoAI는 자체 AI 판별기를 사용하지 않으며 제목, 채널명이나 음원 특징만으로 AI 사용 여부를 추측하지 않습니다. 또한 YouTube의 공식 표시가 있다는 사실만으로 해당 음악이나 콘텐츠 자체가 AI로 생성됐다고 단정하지 않습니다.

직접 차단은 AI 판정이 아니라 사용자가 만든 규칙입니다. 허용 목록에 추가한 콘텐츠나 아티스트는 직접 차단 및 공식 표시보다 우선하여 그대로 이용할 수 있습니다. 페이지 구조, 공식 표시 근거나 정확한 식별 정보를 확인할 수 없으면 추측해서 차단하지 않습니다.

별도 NoAI 사용자 계정이 없으며 광고를 표시하거나 사용 분석 및 사용 통계를 수집하지 않습니다. 설정, 사용자 규칙과 공식 표시 확인에 필요한 최소 정보는 사용자의 브라우저에 저장됩니다.

카드에서 공식 표시를 직접 확인할 수 없는 경우, NoAI는 해당 영상 ID의 공개 YouTube 영상 페이지를 추가로 확인할 수 있습니다. 이 요청에는 Google 계정 인증 정보를 포함하지 않습니다.

YouTube와 YouTube Music의 화면 구조나 공식 표시 형식이 바뀌면 일부 지원 영역이 일시적으로 동작하지 않을 수 있습니다.

## English

### Short description

Hide, blur, or mark officially AI/altered-labeled YouTube content and auto-skip it on YouTube Music.

### Detailed description

NoAI helps you manage content that YouTube officially labels as AI or altered, using the filtering mode you choose.

Key features:

- Choose whether filtering applies only to content categorized as Music by YouTube or to all supported AI-labeled content
- Hide, blur, or mark supported YouTube and YouTube Music list items
- Auto-skip matching content during YouTube Music playback
- Content and artist allowlists
- Direct block rules for content, artists, and channels
- Korean and English UI with automatic browser-language detection or manual language selection

With Music only selected, NoAI applies AI-label filtering only to content categorized as Music by YouTube. It does not guess that content is music when the category is different or cannot be confirmed.

With All AI-labeled content selected, NoAI applies filtering to supported content that YouTube officially labels as AI or altered.

NoAI does not use its own AI model and does not infer AI use from titles, channel names, or audio characteristics. An official YouTube disclosure does not by itself prove that the music or content was AI-generated.

Direct blocks are user-defined rules, not AI detections. Allowed content and artists take priority over direct blocks and official disclosures. If NoAI cannot confirm the page structure, official disclosure, or exact identity, it does not guess and block the item.

NoAI does not require an account and does not display ads or collect analytics or usage telemetry. Settings, user-defined rules, and the minimum information needed to cache disclosure checks are stored locally in your browser.

When an official disclosure is not directly available on a supported card, NoAI may check the public YouTube watch page for that video ID. These requests do not include Google account credentials.

YouTube and YouTube Music UI or disclosure-format changes may temporarily make some supported surfaces unavailable.

## 개인정보 요약 / Privacy summary

- 별도 NoAI 서버나 사용자 계정이 없으며 광고, 맞춤형 광고, 사용 분석 및 사용 통계 수집을 하지 않는다.
- 설정, 사용자가 직접 추가한 정확한 식별 정보와 공식 표시 확인용 최소 캐시는 `storage.local`에 보관하며 NoAI 개발자 서버나 별도의 제3자 서비스로 전송·공유·판매하지 않는다.
- 단, 공식 표시를 추가로 확인하기 위해 해당 영상 ID의 공개 YouTube 영상 페이지를 `credentials: omit`으로 YouTube에 요청할 수 있다.
- 상세 내용은 [개인정보 처리방침](privacy.md)에 기록한다.

Chrome Web Store는 로컬 처리도 공개 대상이 될 수 있으며 Store Dashboard의 개인정보 보호 관련 입력과 공개 정책이 일치해야 한다. 변경 시 [공식 Privacy practices 안내](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)를 기준으로 다시 확인한다.

## 권한 설명 / Permission justifications

### `storage`

필터 설정, 사용자가 명시적으로 만든 허용·차단 규칙과 반복 요청을 줄이는 공식 표시 확인용 최소 캐시를 사용자의 브라우저에 로컬 저장한다. Chrome 동기화나 NoAI 서버에는 저장하지 않는다.

### `https://www.youtube.com/*` 호스트 권한

카드에 공식 표시가 직접 보이지 않을 때 백그라운드 스크립트가 검증된 영상 ID의 공개 YouTube 영상 페이지를 요청해 공식 표시를 추가 확인하는 데 사용한다. 별도 서버 전송이나 일반 방문 기록 수집 용도가 아니다. YouTube 카드에 필터를 적용하는 정적 주입 범위는 이 항목과 별도로 `content_scripts.matches`에도 선언된다.

### `https://music.youtube.com/*`의 `content_scripts.matches`

YouTube와 YouTube Music의 지원되는 카드·목록 항목과 재생 영역에서 로컬 설정을 적용하도록 두 HTTPS 출처를 `content_scripts.matches`에 선언한다. YouTube Music 출처는 별도 `host_permissions`가 아니며 백그라운드 스크립트의 영상 페이지 요청 범위를 music.youtube.com으로 확대하지 않는다.

### 원격 코드

사용하지 않는다. React와 모든 실행 코드는 확장 프로그램 패키지에 포함되며 원격 스크립트, `eval` 또는 원격 실행 로직을 사용하지 않는다.

## 알려진 한계

- 실제 Chrome 전체 수동 매트릭스와 Edge·Whale 수동 검증이 남아 있다.
- YouTube Music Premium이 필요한 실시간 자동 건너뛰기 재생 검증은 해당 환경에서 별도로 수행해야 한다.
- YouTube/YTM DOM 또는 공식 표시 형식이 바뀌면 확인할 수 없는 항목은 추측해서 처리하지 않는다.
- 채널 `@handle`은 UC ID보다 변경 가능성이 높으며 핸들이 바뀌면 기존 규칙이 더 이상 일치하지 않을 수 있다.
- Firefox는 현재 지원하지 않는다.

## 이미지와 스크린샷 준비

Chrome 공식 문서는 현재 다음 이미지 자료를 안내한다.

- 확장 프로그램 패키지 안의 128×128 PNG 아이콘
- Chrome 관리 화면과 플랫폼 표시를 위한 16×16, 32×32, 48×48 아이콘 권장
- 440×280 소형 홍보 이미지
- 최소 1개, 최대 5개의 1280×800 또는 640×400 스크린샷

출처: [확장 프로그램 아이콘 안내](https://developer.chrome.com/docs/extensions/develop/ui/configure-icons), [Chrome Web Store 이미지 요구사항](https://developer.chrome.com/docs/webstore/images). Store Dashboard 요구사항은 등록정보 이미지를 변경할 때 다시 확인한다.

현재 저장소에는 사용자 승인된 16/32/48/128 PNG 아이콘 세트가 있고 확장 프로그램 manifest와 패키지에 포함된다. Store 홍보 이미지와 실제 스크린샷은 Chrome Web Store Dashboard에서 관리하며, 아래 목록은 향후 이미지 갱신 시 참고한다.

1. 팝업 기본 화면
2. YouTube Blur 또는 Mark 적용 화면
3. 허용·차단 목록을 펼친 팝업
4. 설정 관리 화면
5. 가능한 경우 YouTube Music 자동 건너뛰기 설정 또는 실제 동작 화면
6. 텍스트 의존이 적고 밝거나 어두운 배경에서 식별 가능한 440×280 홍보 이미지

스크린샷은 실제 확장 프로그램과 실제 지원 화면을 캡처하며 가짜 YouTube UI나 아직 검증하지 않은 동작을 사용하지 않는다. 한국어와 영어 등록정보에는 필요한 경우 언어별 스크린샷을 별도로 준비한다.
