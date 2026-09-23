# 변경 기록

이 프로젝트의 주요 사용자 영향 변경 사항을 기록합니다.

## Unreleased

## [0.9.1] - 2026-09-21

### Added

- popup과 options에서 Auto, 한국어, English 중 UI 언어를 직접 선택할 수 있습니다.
- popup과 options 사이에서 선택한 UI 언어를 즉시 동기화하고 `storage.local`에 유지합니다.
- Premium 실제 DOM에서 확인한 정확한 영상 ID로 YouTube Music 재생 대기열의 항목을 필터링합니다.

### Changed

- 확장 프로그램 외부 표시 이름을 영어 **NoAI — AI-Labeled Music Filter**, 한국어 **NoAI — AI 표시 음악 필터**로 구체화했습니다. 제품 UI 내부 브랜드는 계속 **NoAI**입니다.
- options 페이지를 공통 설정과 2열 사용자 규칙 관리 카드로 정리하고, 좁은 화면에서는 1열로 전환하도록 개선했습니다.
- 사용자 승인된 16×16, 32×32, 48×48, 128×128 PNG 아이콘을 확장 프로그램과 도구 모음 버튼에 적용했습니다.

### Fixed

- 플레이리스트에서 재생 화면으로 이동했다가 돌아올 때 기존 목록 필터가 간헐적으로 풀리는 회귀를 수정했습니다.
- 재생 대기열을 숨길 때 빈 공간이 남지 않도록 수정했습니다.
- 수동으로 다음 곡을 선택하는 등 SPA에서 현재 곡이 바뀔 때 자동 건너뛰기가 새 곡을 감지하도록 수정했습니다.

### Privacy and permissions

- 새 permission, host permission, 외부 network request, analytics, telemetry 또는 remote code를 추가하지 않았습니다.
- YouTube와 YouTube Music에 삽입되는 badge와 reason 문구는 계속 browser locale을 따릅니다.

## [0.9.0] - 2026-09-15

### 추가

- YouTube가 공식적으로 제공하는 AI·변경 콘텐츠 표시를 확인해 영상 카드를 숨기기, 흐리기 또는 표시만 할 수 있습니다.
- YouTube 홈·검색·관련 영상·재생목록과 YouTube Music 검색·앨범·플레이리스트·아티스트 목록의 확인된 항목을 필터링합니다.
- YouTube Music에서 정책 대상인 현재 재생곡을 자동으로 건너뜁니다.
- exact video ID와 확인된 아티스트 UC ID를 사용하는 곡·아티스트 허용 목록을 제공합니다.
- exact video ID, 아티스트·채널 UC ID와 YouTube `@handle`을 사용하는 곡·아티스트·채널 직접 차단 목록을 제공합니다.
- 채널 `Videos` 경로에서 카드에 채널 정보가 생략된 경우 exact route identity를 안전하게 사용합니다.
- 한국어·영어 popup/options UI와 로컬 목록 관리 기능을 제공합니다.
- versioned `storage.local` 설정·사용자 규칙·최소 disclosure cache와 비식별 fixture 기반 회귀 테스트를 제공합니다.

### 변경

- 정책 우선순위를 `allowlist > direct blocklist > official disclosure`로 확정했습니다.
- popup에서 핵심 상태와 필터 방식을 먼저 확인하고 허용·차단 목록을 직접 관리할 수 있도록 정보 구조와 접근성을 정돈했습니다.
- options에는 같은 저장·검증 로직을 재사용하는 넓은 목록 관리 화면을 제공합니다.
- 확인 중이거나 판정할 수 없는 상태는 사용자 콘텐츠를 변경하지 않도록 fail-closed 동작을 유지합니다.

### 수정

- SPA 이동, DOM element 재사용과 늦게 도착한 lookup 결과가 다른 카드에 적용되지 않도록 stale·중복 처리를 보강했습니다.
- YouTube hover 상태에서 badge와 blur가 카드 높이를 변경하거나 깜빡이지 않도록 overlay와 filter 경계를 안정화했습니다.
- Chrome popup 폭을 380px로 고정하고 내부 panel만 스크롤하도록 해 좁은 폭과 resize 흔들림 회귀를 수정했습니다.
