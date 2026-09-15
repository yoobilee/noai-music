# NoAI

> Block AI music on YouTube. Skip it on YouTube Music.

NoAI는 YouTube와 YouTube Music에서 YouTube가 공식적으로 AI 또는 변경 콘텐츠로 표시한 항목을 숨기거나 흐리거나 표시하고, YouTube Music에서는 자동으로 건너뛸 수 있게 하는 오픈소스 브라우저 확장 프로그램입니다.

NoAI는 자체 AI detector를 사용하지 않으며 제목, 채널명이나 음원 특징으로 AI 여부를 추측하지 않습니다. 공식 표시가 있다는 사실과 음악 자체가 AI 생성됐다는 주장은 다릅니다. NoAI는 확인된 표시 이상의 의미를 단정하지 않으며, 표시나 identity를 확인할 수 없으면 추측해서 차단하지 않습니다.

## 핵심 기능

- YouTube 공식 AI·변경 콘텐츠 표시 기반 필터링
- 숨기기, 흐리기, 표시만 모드와 필터 이유 표시
- YouTube 홈·검색·관련 영상·재생목록 카드 필터링
- YouTube Music 검색·앨범·플레이리스트·아티스트 목록 필터링
- YouTube Music 현재 재생곡 자동 건너뛰기
- 곡·아티스트 허용 목록
- 곡·아티스트·채널 직접 차단 목록
- popup과 options의 한국어·영어 설정 및 목록 관리

## 판정 원칙

- YouTube가 제공하는 공식 AI·변경 콘텐츠 표시를 가장 신뢰도 높은 판정 근거로 사용합니다.
- 공식 evidence가 확인된 항목만 기존 disclosure 정책으로 필터링합니다.
- 조회 오류, 알 수 없는 표시, 손상된 evidence나 ambiguous identity는 필터링 근거로 사용하지 않습니다.
- 직접 차단은 AI 판정이 아니라 사용자가 명시적으로 저장한 로컬 규칙입니다.

## 지원 범위

### YouTube

- 홈, 검색, 관련 영상과 재생목록의 지원되는 영상 카드
- 채널 metadata가 없는 채널 `Videos` 탭의 exact route identity fallback
- 곡 video ID, 채널 UC ID와 exact `@handle` 직접 차단

### YouTube Music

- 검색, 앨범, 플레이리스트와 아티스트의 지원되는 track row
- 현재 재생곡 identity와 자동 건너뛰기
- 곡 video ID와 확인된 아티스트 UC ID 사용자 규칙

YouTube와 YouTube Music의 DOM이 변경되어 확인된 selector나 identity를 얻을 수 없으면 fail-closed로 아무 항목도 추측해 처리하지 않습니다.

## 사용자 규칙

규칙 우선순위는 다음과 같습니다.

```text
allowlist > direct blocklist > official disclosure
```

- 허용 목록에 있는 곡이나 아티스트는 직접 차단 또는 공식 표시가 있어도 필터링하거나 건너뛰지 않습니다.
- 직접 차단 목록은 공식 표시나 lookup 결과와 관계없이 exact identity가 일치할 때 적용합니다.
- 사용자 규칙이 없을 때만 기존 공식 disclosure 정책을 적용합니다.

## 개인정보와 권한

NoAI는 별도 서버나 계정을 운영하지 않으며 analytics와 telemetry를 사용하지 않습니다. 설정, 사용자가 직접 추가한 허용·차단 identity와 최소 disclosure cache는 브라우저의 `storage.local`에 저장되며, NoAI 개발자 서버나 별도의 제3자 서비스로 전송·공유·판매되지 않습니다.

단, 공식 표시를 추가로 확인할 때 background가 해당 video ID의 공개 YouTube watch page를 `credentials: omit`으로 요청할 수 있습니다. 요청은 YouTube에만 전송되며 NoAI 운영자나 별도 외부 API로 전송되지 않습니다.

현재 생성 manifest의 권한은 다음과 같습니다.

- `storage`: 설정, 사용자 규칙과 최소 판정 cache를 로컬에 저장
- `https://www.youtube.com/*` host permission: background에서 검증된 video ID의 공개 watch page를 확인
- YouTube·YouTube Music content-script matches: 각 사이트의 지원 카드·row와 player에 로컬 설정을 적용

자세한 내용은 [개인정보 처리방침 초안](docs/privacy.md)을 참고하세요.

## 현재 상태

- 현재 버전: **0.9.0**
- 상태: **1.0 release candidate**
- 우선 검증 대상: desktop Chrome
- Edge와 Whale: Chromium 호환 대상이며 1.0 전에 실제 브라우저 수동 검증 필요
- Firefox: 1.0 이후 검토

자동 검증은 비식별 fixture와 bundled Chromium을 사용합니다. Live YouTube DOM, Chrome popup, Edge·Whale과 YouTube Music Premium 재생은 [릴리스 체크리스트](docs/release-checklist.md)에 따라 별도로 확인해야 합니다.

## 설치와 개발

Node.js 22.13 이상과 npm이 필요합니다.

```sh
npm install
npm run dev
```

production build와 zip은 다음 위치에 생성됩니다.

```sh
npm run build
npm run zip
```

- unpacked extension: `.output/chrome-mv3`
- 배포 zip: `.output/noai-music-0.9.0-chrome.zip`

전체 자동 검증:

```sh
npm run verify:all
```

## 문서

- [기술 설계](docs/technical-design.md)
- [YouTube disclosure 감지](docs/youtube-disclosure-detection.md)
- [YouTube 카드 필터링](docs/youtube-card-filtering.md)
- [YouTube Music identity](docs/youtube-music-identity.md)
- [YouTube Music 카드 필터링](docs/youtube-music-card-filtering.md)
- [YouTube Music 자동 건너뛰기](docs/youtube-music-auto-skip.md)
- [허용 목록](docs/allowlist.md)
- [직접 차단 목록](docs/blocklist.md)
- [Chrome Web Store listing 초안](docs/store-listing.md)
- [0.9.0 → 1.0.0 릴리스 체크리스트](docs/release-checklist.md)

## 라이선스

[MIT License](LICENSE)
