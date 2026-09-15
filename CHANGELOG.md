# 변경 기록

## Unreleased

- `allowlist > direct blocklist > official disclosure` 우선순위에 따른 곡·아티스트·채널 직접 차단, popup 관리 UI와 YouTube Music 즉시 auto-skip 추가
- 최신 YouTube 카드의 exact `@handle` 채널 링크를 direct block identity로 지원하고 percent-encoded 비라틴 handle 입력을 처리
- 채널 `Videos` 탭에서 카드 channel metadata가 생략된 경우 exact `@handle` 또는 UC route identity로 direct channel block 적용

### 추가

- 곡 video ID와 확인된 UC channel ID 기반 허용 목록, options 관리 UI, YouTube·YouTube Music 카드의 즉시 복구와 YouTube Music auto-skip 제외 정책 추가

- Manifest V3, TypeScript, WXT와 제한적인 React UI를 사용하는 확장 프로그램 기반
- Vitest 단위 테스트와 Playwright 확장 smoke test 구성
- YouTube·YouTube Music 어댑터, 판정, 필터링과 로컬 저장소의 책임 계약
- 영어·한국어 확장 metadata와 개발 단계 안내 문구
- NoAI 1.0 기술 설계 문서
- YouTube watch 페이지의 공식 AI disclosure evidence 추출과 순수 detector
- 동적 DOM과 SPA 전환에 대응하는 개발 검증용 disclosure 배지
- 개인정보를 제거한 YouTube fixture 기반 단위·확장 E2E 테스트
- 읽기 전용 GitHub Actions CI와 Codex self-review·안전한 auto-merge 정책
- 변경 파일 기반 fail-closed 병합 위험 판정 스크립트와 회귀 테스트
- YouTube 홈·검색·관련·재생목록 영상 단위의 fail-closed video ID 추출
- 순수 YouTube watch URL parser와 비식별 카드 fixture 기반 회귀 테스트
- background service worker의 제한된 YouTube watch-page disclosure 추가 확인
- 동시성·queue·timeout·중복 요청 제어와 versioned `storage.local` 판정 캐시
- versioned `storage.local` 전역 설정과 popup/options의 hide·blur·mark 제어
- confirmed 공식 disclosure 카드의 reversible 필터, 이유 표시와 SPA stale-result 방어
- YouTube Music 검색·앨범·플레이리스트·아티스트 row와 player bar의 fail-closed video ID identity adapter
- YouTube Music 현재 재생 항목의 confirmed 공식 disclosure 자동 건너뛰기, stale·중복 클릭 방어와 설정 toggle
- YouTube Music 검색·앨범·플레이리스트·아티스트 row의 confirmed 공식 disclosure hide·blur·mark 필터와 stale·reuse·중복 방어

### 변경

- checking·not-detected·unknown 개발 상태 배지를 제거하고 confirmed 결과만 제품 필터 정책에 연결
- 허용 목록을 popup 안에서 compact하게 직접 관리하도록 바꾸고, nested rich-grid mutation에서 Blur·Mark가 즉시 해제되던 회귀를 수정
- YouTube 카드 blur 대상을 안정적인 thumbnail·metadata 경계로 단순화하고 조상 path attribute와 강제 positioning을 제거
