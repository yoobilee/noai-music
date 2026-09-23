# NoAI

> Block AI music on YouTube. Skip it on YouTube Music.

[English](README.md)

NoAI는 YouTube가 공식적으로 AI 또는 변경 콘텐츠로 표시한 음악을 사용자가 원하는 방식으로 관리할 수 있게 돕는 오픈소스 브라우저 확장 프로그램입니다.

제품 브랜드는 계속 **NoAI**입니다. 0.9.1부터 확장 프로그램의 외부 표시 이름은 영어에서 **NoAI — AI-Labeled Music Filter**, 한국어에서 **NoAI — AI 표시 음악 필터**를 사용합니다.

NoAI는 음악이 AI로 생성됐는지 추측하지 않습니다. 확인된 YouTube 공식 표시와 사용자가 직접 지정한 exact identity만 사용하며, 필요한 근거나 identity를 확인할 수 없으면 아무 항목도 추측해서 처리하지 않습니다.

## 핵심 기능

- YouTube가 공식적으로 AI 또는 변경 콘텐츠로 표시한 항목을 숨기기, 흐리기 또는 표시만 처리
- YouTube Music에서 해당 곡 자동 건너뛰기
- 지원되는 YouTube Music track row와 queue item 필터링
- 곡·아티스트 허용 목록
- 곡·아티스트·채널 직접 차단
- 브라우저 언어 자동 감지 또는 직접 선택이 가능한 한국어·영어 UI
- 광고, analytics, telemetry 없음

## 동작 및 판정 원칙

NoAI는 YouTube가 제공하는 공식 AI·변경 콘텐츠 표시를 주요 판정 근거로 사용합니다.

- 자체 AI detector를 사용하지 않습니다.
- 제목, 채널명이나 음원 특징으로 AI 사용 여부를 추측하지 않습니다.
- 공식 표시가 있다는 사실만으로 음악 자체가 AI 생성됐다고 단정하지 않습니다. NoAI는 실제로 확인한 표시 이상의 의미를 주장하지 않습니다.
- 페이지 구조, identity 또는 disclosure evidence를 확인할 수 없으면 추측하지 않고 해당 항목을 그대로 둡니다.
- 직접 차단은 AI 판정이 아니라 사용자가 만든 규칙입니다.

## 지원 범위

### YouTube

- 홈, 검색, 관련 영상과 재생목록의 지원되는 영상 카드
- 카드 metadata가 없는 경우 exact route identity fallback을 사용하는 지원되는 채널 `Videos` 카드
- exact video ID 규칙
- UC channel ID 규칙
- exact YouTube `@handle` 직접 차단 규칙

### YouTube Music

- 검색, 앨범, 플레이리스트와 아티스트 화면의 지원되는 track row
- exact video ID가 확인된 queue item
- 현재 재생곡 identity와 자동 건너뛰기
- 곡 허용·차단 규칙
- 안정적인 아티스트 identity를 확인할 수 있는 경우의 아티스트 허용·차단 규칙

Queue의 아티스트 identity는 추측하지 않습니다. 지원 renderer에서 확인된 identity를 제공하지 않으면 해당 항목을 변경하지 않습니다.

## 사용자 규칙

사용자 규칙의 우선순위는 다음과 같습니다.

```text
allowlist > direct blocklist > official disclosure
```

- 허용된 곡이나 아티스트는 직접 차단 또는 공식 표시와 동시에 일치해도 필터링하거나 건너뛰지 않습니다.
- 직접 차단은 disclosure lookup 결과와 관계없이 exact 곡·아티스트·채널 identity가 일치할 때 적용됩니다.
- 더 높은 우선순위의 사용자 규칙이 없을 때만 공식 disclosure 정책을 적용합니다.

## 설치

### Chrome Web Store

NoAI 0.9.1은 [Chrome Web Store](https://chromewebstore.google.com/detail/noai/eiddibmnpcdbgdmeoipniomddiboikkf)에서 공개되어 설치할 수 있습니다.

### GitHub Release

[NoAI v0.9.1 Release](https://github.com/yoobilee/noai-music/releases/tag/v0.9.1)에서 Chrome 확장 프로그램 ZIP을 받을 수 있습니다. 스토어 설치 대신 ZIP을 압축 해제한 뒤 Chrome 개발자 모드에서 압축 해제된 확장 프로그램을 불러올 수도 있습니다.

개발용 빌드를 사용하려면 아래 개발 절차를 실행하고 `.output/chrome-mv3`를 unpacked extension으로 불러오세요.

## 개인정보와 권한

- 별도 NoAI 사용자 계정 없음
- NoAI 개발자 데이터 수집 서버 없음
- 광고, analytics, telemetry 없음
- 설정, 허용·차단 규칙과 최소 disclosure cache는 `storage.local`에 저장
- Chrome Sync 사용 안 함
- 로컬 설정, 규칙과 cache를 NoAI 개발자 서버로 전송하지 않음
- 공식 disclosure 확인을 위해 해당 video ID의 공개 YouTube watch page를 `credentials: omit`, `referrerPolicy: no-referrer`로 요청할 수 있음
- `tabs`, `activeTab`, `history`, `cookies`, `identity`, `<all_urls>` 권한 사용 안 함

전체 데이터 처리 내용은 [개인정보 처리방침](docs/privacy.md)을 참고하세요.

## 브라우저 지원과 현재 상태

- 현재 버전: **0.9.1**
- 최신 GitHub Release: [v0.9.1](https://github.com/yoobilee/noai-music/releases/tag/v0.9.1)
- Chrome Web Store: **[0.9.1 공개 / 설치 가능](https://chromewebstore.google.com/detail/noai/eiddibmnpcdbgdmeoipniomddiboikkf)**
- 우선 검증 대상: desktop Chrome 현재 안정 버전
- Edge와 Whale: Chromium 호환 대상이며 브라우저별 최종 수동 검증 필요
- Firefox: 1.0 범위에 포함하지 않으며 이후 검토 가능

자동 회귀 검증은 비식별 fixture와 bundled Chromium을 사용합니다. 실제 브라우저와 YouTube Music Premium 검증 항목은 [릴리스 체크리스트](docs/release-checklist.md)에서 관리합니다.

## 개발

필요 환경:

- Node.js 22.13.0 이상
- npm

```sh
npm install
npm run dev
npm run build
npm run zip
npm run verify:all
```

빌드 결과:

- unpacked Chrome extension: `.output/chrome-mv3`
- 준비된 release ZIP: `.output/noai-music-0.9.1-chrome.zip`

## 문서

- [기술 설계](docs/technical-design.md)
- [YouTube disclosure 감지](docs/youtube-disclosure-detection.md)
- [YouTube 카드 필터링](docs/youtube-card-filtering.md)
- [YouTube Music identity](docs/youtube-music-identity.md)
- [YouTube Music 카드 필터링](docs/youtube-music-card-filtering.md)
- [YouTube Music 자동 건너뛰기](docs/youtube-music-auto-skip.md)
- [허용 목록](docs/allowlist.md)
- [직접 차단 목록](docs/blocklist.md)
- [개인정보 처리방침](docs/privacy.md)
- [Chrome Web Store listing](docs/store-listing.md)
- [0.9.1 공개 상태 및 1.0.0 체크리스트](docs/release-checklist.md)

## 라이선스

[MIT License](LICENSE)
