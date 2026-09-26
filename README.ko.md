# NoAI

> YouTube의 AI 음악을 차단하고 YouTube Music에서 자동으로 건너뜁니다.

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Install-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/noai/eiddibmnpcdbgdmeoipniomddiboikkf)
[![GitHub Release](https://img.shields.io/github/v/release/yoobilee/noai-music?display_name=release&label=GitHub%20Release)](https://github.com/yoobilee/noai-music/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[English](README.md)

NoAI는 YouTube가 공식적으로 AI 또는 변경된 콘텐츠라고 표시한 항목을 필터링하는 오픈소스 브라우저 확장 프로그램입니다.

**음악만**을 선택하면 YouTube가 Music 카테고리로 분류한 콘텐츠에 집중하고, **AI 표시 콘텐츠 전체**를 선택하면 지원되는 모든 공식 표시 콘텐츠를 필터링합니다. YouTube Music에서는 정책에 해당하는 콘텐츠를 재생 중 자동으로 건너뛸 수도 있습니다.

NoAI는 자체 AI 탐지기를 사용하지 않으며 제목, 채널명, 썸네일 또는 오디오 특성으로 AI 여부를 추측하지 않습니다.

## NoAI를 만든 이유

일반적인 YouTube와 YouTube Music 탐색 화면에 AI 생성 음악이 점점 더 많이 섞이고 있습니다.

NoAI는 AI 생성 여부를 추측하는 대신 YouTube의 공식 표시와 구조화된 메타데이터만 사용하는 보수적인 방식을 택합니다.

필요한 근거를 확인할 수 없으면 해당 콘텐츠를 변경하지 않습니다.

## 기능

- **음악만 또는 AI 표시 콘텐츠 전체**

  YouTube가 Music 카테고리로 분류한 콘텐츠에만 필터를 적용할지, 지원되는 모든 AI 표시 콘텐츠에 적용할지 선택합니다.

- **숨김, 흐림 또는 표시**

  하나의 고정된 방식 대신 정책에 해당하는 콘텐츠를 어떻게 보여줄지 선택합니다.

- **YouTube Music 자동 건너뛰기**

  재생 중 정책에 해당하는 콘텐츠를 다음 항목으로 자동으로 넘깁니다.

- **허용 및 차단 규칙**

  원하는 콘텐츠와 아티스트는 유지하고, 특정 콘텐츠·아티스트·채널은 직접 차단할 수 있습니다. 허용 규칙은 직접 차단보다 우선합니다.

- **추측하지 않는 판정**

  자체 AI 탐지기 대신 YouTube의 공식 표시와 구조화된 메타데이터를 사용합니다.

- **개인정보 보호를 고려한 설계**

  광고, 분석 도구, 원격 측정 또는 NoAI 계정이 없습니다.

## 작동 방식

NoAI는 YouTube의 공식 AI 또는 변경 콘텐츠 표시를 주된 판정 근거로 사용합니다.

**음악만**을 선택하면 YouTube가 Music 카테고리로 분류한 콘텐츠에만 필터를 적용합니다. **AI 표시 콘텐츠 전체**를 선택하면 지원되는 모든 콘텐츠에 같은 공식 표시 정책을 적용합니다.

NoAI는 의도적으로 보수적인 원칙을 따릅니다.

- 자체 AI 모델을 사용하지 않음
- 제목이나 채널명 기반 휴리스틱을 사용하지 않음
- 오디오 특성으로 추측하지 않음
- 확인할 수 없거나 판정이 불가능한 항목은 변경하지 않음

공식 표시는 YouTube가 해당 콘텐츠를 AI 또는 변경 콘텐츠로 표시했다는 뜻입니다. 음악 자체가 전부 AI로 생성되었다는 의미는 아닐 수 있습니다.

## 설치

### Chrome Web Store

[Chrome Web Store에서 NoAI 설치](https://chromewebstore.google.com/detail/noai/eiddibmnpcdbgdmeoipniomddiboikkf)

스토어에서 설치하면 브라우저를 통해 업데이트를 받을 수 있습니다.

### GitHub Releases

[GitHub Releases에서 최신 패키지 빌드 다운로드](https://github.com/yoobilee/noai-music/releases)

ZIP의 압축을 풀고 `chrome://extensions`에서 개발자 모드를 켠 다음 **압축해제된 확장 프로그램을 로드합니다**를 선택해 해당 디렉터리를 불러옵니다.

### 개발용 빌드

소스에서 NoAI를 실행하거나 패키징하려면 [개발](#개발)을 참고하세요.

## 개인정보 보호

NoAI에는 계정 시스템이나 개발자가 운영하는 서버가 없으며 광고, 분석 도구 또는 원격 측정 기능도 포함하지 않습니다.

설정, 사용자 규칙과 최소한의 공식 표시 캐시는 `storage.local`에 저장됩니다. Chrome Sync를 사용하지 않으며 이 데이터를 개발자 서버로 보내지 않습니다.

YouTube의 공식 표시를 확인하기 위해 Google 계정 인증 정보 없이 공개 YouTube 시청 페이지를 요청할 수 있습니다. `tabs`, `activeTab`, `history`, `cookies`, `identity`, `<all_urls>` 권한은 요청하지 않습니다.

자세한 내용은 [개인정보 처리방침](docs/privacy.md)을 참고하세요.

## 개발

### 필요 환경

- Node.js 22.13+
- npm

### 설정

```sh
git clone https://github.com/yoobilee/noai-music.git
cd noai-music
npm install
npm run dev
```

### 검증

```sh
npm run verify:all
```

### 프로덕션 빌드

```sh
npm run build
npm run zip
```

압축되지 않은 확장 프로그램은 `.output/chrome-mv3`에 생성됩니다.

## 문서

- [기술 설계](docs/technical-design.md)
- [YouTube 공식 표시 감지](docs/youtube-disclosure-detection.md)
- [YouTube 카드 필터링](docs/youtube-card-filtering.md)
- [YouTube Music 콘텐츠 식별](docs/youtube-music-identity.md)
- [YouTube Music 카드 필터링](docs/youtube-music-card-filtering.md)
- [YouTube Music 자동 건너뛰기](docs/youtube-music-auto-skip.md)
- [허용 목록](docs/allowlist.md)
- [직접 차단 목록](docs/blocklist.md)
- [개인정보 처리방침](docs/privacy.md)
- [Chrome Web Store 등록 정보](docs/store-listing.md)
- [릴리스 체크리스트](docs/release-checklist.md)
- [음악 판별 신호 후속 조사](docs/music-signal-followup.md)
- [YouTube 필터 지연 조사](docs/youtube-filter-latency-investigation.md)

그 밖의 문서는 [`docs/`](docs/)에서 확인할 수 있습니다.

## 기여하기

이슈와 풀 리퀘스트를 환영합니다.

변경을 제안할 때는 NoAI의 핵심 원칙을 지켜 주세요.

- 추측으로 AI 콘텐츠를 분류하지 않음
- 구조화되고 검증 가능한 신호를 우선함
- 콘텐츠의 식별 정보나 근거를 확인할 수 없으면 변경하지 않음
- 불필요한 권한, 추적 또는 외부 서비스를 지양함

버그 제보와 기능 제안은 [GitHub Issues](https://github.com/yoobilee/noai-music/issues)를 이용해 주세요.

## 후원

NoAI는 무료 오픈소스 프로젝트입니다.

NoAI가 유용하다면 [GitHub Sponsors](https://github.com/sponsors/yoobilee)를 통해 지속적인 개발을 후원할 수 있습니다. 후원은 선택 사항이며 추가 기능을 제공하지 않습니다.

## 라이선스

NoAI는 [MIT License](LICENSE)로 배포됩니다.
