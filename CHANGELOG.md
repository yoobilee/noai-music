# 변경 기록

이 프로젝트의 주요 사용자 영향 변경 사항을 기록합니다.

## Unreleased

0.9.0 이후에는 1.0 출시를 위한 회귀 수정과 검증 문서 변경만 예정되어 있습니다.

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
