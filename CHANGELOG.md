# 변경 기록

## Unreleased

### 추가

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

### 변경

- checking·not-detected·unknown 개발 상태 배지를 제거하고 confirmed 결과만 제품 필터 정책에 연결
