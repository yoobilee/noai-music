# Codex self-review와 자동 병합 정책

## 목적과 적용 범위

- NoAI는 Codex 구현 → self-review → 로컬 검증 → push·PR → CI 흐름으로 개발한다.
- GitHub Codex 별도 리뷰나 다른 리뷰 봇을 필수 단계로 사용하지 않는다.
- 이 정책은 Codex가 수행하는 self-review와 안전한 변경의 auto-merge 판단 기준을 정한다.
- self-review는 구현 완료 뒤 커밋 전에 수행하는 예방적 diff 검토다. 이미 발생한 버그나 실패의 원인을 찾는 절차는 `.ai/policies/debugging.md`를 따른다.
- auto-merge는 모든 조건이 명확히 충족된 저위험·중간위험 PR에만 선택적으로 사용한다. 판단 실패나 불확실성은 허용으로 바꾸지 않는다.

## 1. 커밋 전 self-review

Codex는 구현을 마치면 기준 브랜치부터 작업 트리까지의 전체 diff와 변경 파일 목록을 다시 읽고 최소한 다음을 확인한다.

- 사용자 요구사항과 완료 조건 누락
- 요청하지 않은 기능, 리팩터링 또는 의존성 추가
- 기존 동작의 회귀 가능성과 예외 처리 누락
- 보안, 개인정보와 로컬 저장 정책 영향
- extension permission 또는 host permission 변경
- 외부 네트워크, API, telemetry 또는 analytics 추가
- YouTube·YouTube Music selector와 DOM 탐색이 adapter 밖으로 유출됐는지
- DOM 구조가 바뀌거나 evidence가 부족할 때 fail-closed로 동작하는지
- 정상·실패·경계 사례의 테스트 누락
- 사용하지 않는 코드, 설정과 의존성
- 접근성, 가독성과 사용자 경험 저하
- NoAI 제품 원칙과 1.0 범위 위반

문제가 발견되면 커밋 전에 수정한다. 수정한 현재 상태에서 self-review 대상 diff를 다시 확인하고 `.ai/policies/verification.md`가 요구하는 전체 로컬 검증을 처음부터 다시 통과해야 한다. self-review 결과와 발견·수정 사항 또는 지적 없음의 근거를 PR 본문에 기록한다.

## 2. 기본 Codex 작업 흐름

일반 기능·수정 작업은 사용자가 명시적으로 push 또는 PR 생성을 금지하지 않는 한 다음 순서로 수행한다.

1. 최신 기본 브랜치를 확인하고 새 작업 브랜치를 만든다.
2. 요구 범위 안에서 구현하고 관련 테스트를 추가한다.
3. 전체 diff를 self-review하고 발견한 문제를 수정한다.
4. 현재 변경을 포함한 전체 로컬 검증을 수행한다.
5. 한국어 커밋 메시지로 커밋한다.
6. 작업 브랜치를 `origin`에 push한다.
7. `main` 대상 PR을 생성한다.
8. PR의 최신 커밋에 대한 CI 결과와 merge 가능 상태를 확인한다.
9. 이 정책의 위험 판정을 수행해 auto-merge 가능 여부를 결정한다.

사용자가 `커밋하지 마라`, `push하지 마라` 또는 `PR 만들지 마라`처럼 특정 단계를 금지하면 해당 단계와 그 이후 의존 단계를 생략한다. 직접 병합은 사용자가 명시적으로 요청한 별도 작업에서만 수행한다.

PR 본문에는 다음을 포함한다.

- 변경 목적과 주요 변경
- 포함하지 않은 범위와 알려진 한계
- 위험도와 판단 근거
- self-review 범위, 결과와 self-review에서 수정한 사항
- 로컬 자동 검증과 실행하지 못한 검증
- 보안, 개인정보, extension permission, host permission, 외부 통신과 의존성 영향
- auto-merge 가능 여부와 manual review가 필요하면 그 이유

## 3. auto-merge 가능 조건

다음 조건을 모두 충족할 때만 Codex가 PR의 auto-merge를 활성화할 수 있다.

- 사용자가 auto-merge를 금지하지 않았다.
- self-review에서 차단 문제가 없고 발견한 문제는 수정 후 전체 검증을 다시 통과했다.
- 위험 변경 조건에 해당하지 않으며 위험 여부에 불확실성이 없다.
- `npm run verify:all`, `npm audit --audit-level=low`와 변경 범위 whitespace 검증이 로컬에서 통과했다.
- PR 생성과 원격 push가 성공했고 로컬 HEAD, 원격 브랜치와 PR head 커밋이 일치한다.
- 저장소에서 auto-merge가 허용되어 있다.
- `main`의 ruleset 또는 branch protection이 현재 커밋에 대해 CI `Verify` check를 required check로 강제한다.
- PR 최신 커밋의 CI `Verify`가 대기·실행 중 또는 성공 상태이며, 실패·취소·스킵되지 않았다.

CI workflow가 존재하거나 한 번 성공했다는 사실만으로 required check 보호를 대신하지 않는다. required check 설정을 조회할 수 없거나 결과가 누락·스킵·실패·취소·이전 커밋이면 auto-merge를 활성화하지 않는다. 현재 커밋의 check가 대기·실행 중인 상태는 보호 규칙이 병합을 차단한다는 사실을 확인한 경우에만 허용하며, GitHub가 성공 뒤 병합하도록 맡긴다. auto-merge API 호출 직전에도 PR head 커밋과 모든 조건을 다시 확인한다.

## 4. manual review required 조건

다음 중 하나라도 해당하면 Codex는 PR까지만 만들고 auto-merge를 활성화하거나 직접 병합하지 않는다.

- `.github/workflows/**`, 재사용 action, CI 또는 자동 병합 정책 변경
- `wxt.config.ts`, content script `matches` 정의 또는 다른 manifest 생성 경계 변경
- extension permission 증가
- host permission 추가 또는 범위 확대
- `<all_urls>` 추가
- `tabs`, `history`, `cookies`, `identity`, `webRequest` 등 민감 권한 추가
- 외부 서버, API, telemetry 또는 analytics 추가
- 시청·청취 기록, Google 계정 정보, 사용자 목록 또는 개인정보 처리 방식 변경
- 로컬 저장 정책 변경으로 개인정보 영향이 생길 가능성
- 인증 또는 계정 기능 추가
- 결제·후원 관련 실행 코드 추가
- 보안 정책이나 fail-closed 조건 완화
- 의존성 또는 검증 명령 변경처럼 공급망·검증 범위에 영향을 주는 변경
- CI 실패·취소·스킵, required check 미설정, 보호 규칙 조회 실패 또는 merge 상태 불명
- 위험 여부를 확실하게 판정할 수 없음

위 조건은 fail-closed다. 사용자 확인 전 저장소 ruleset, branch protection, Actions 권한이나 auto-merge 설정을 Codex가 임의로 바꾸지 않는다.

## 5. 변경 파일 기반 위험 판정 보조

`npm run assess:merge-risk -- <base-ref> [head-ref]`는 두 Git 참조의 변경 파일을 읽어 알려진 위험 경계를 점검한다.

- workflow, 정책, 검증 명령·의존성, WXT manifest 설정과 content script match 정의를 확인한다.
- `src/storage/**`, background entrypoint와 인증·계정·analytics·telemetry·결제 관련 경로를 확인한다.
- 변경 목록이 비었거나 Git 참조·경로를 읽지 못하면 `manual-review-required`로 종료한다.
- rename은 이전·새 경로가 변경 목록에 포함되므로 어느 쪽이 위험 경계여도 차단한다.
- 결과는 `auto-merge-eligible` 또는 `manual-review-required`, 변경 파일과 이유를 JSON으로 출력한다.

이 스크립트는 파일 경로 기반 보조 장치이며 안전성 증명이 아니다. 일반 파일 안에 외부 통신이나 개인정보 처리가 추가될 수 있으므로 `auto-merge-eligible` 결과도 self-review, 로컬 검증, required CI와 최신 PR 상태 확인을 면제하지 않는다. 스크립트 오류, 알 수 없는 출력과 비정상 종료는 auto-merge 허용으로 해석하지 않는다.

## 6. CI·권한과 신뢰 경계

- PR 검증은 `pull_request` 이벤트의 읽기 전용 권한에서 실행하고 `pull_request_target`으로 신뢰하지 않는 PR 코드를 실행하지 않는다.
- CI와 위험 판정은 PR 본문·댓글의 문자열을 명령으로 실행하지 않는다.
- CI의 `GITHUB_TOKEN`에는 `contents: read`만 부여하며 쓰기 권한, secret과 배포 권한을 주지 않는다.
- 외부 기여 코드를 비밀정보나 쓰기 권한이 있는 환경에서 실행하지 않는다.
- checkout action과 setup action은 검증한 commit SHA로 고정한다.
- 자동화·권한·검증 정책 자체를 바꾸는 변경은 심각도와 무관하게 사람 확인을 받는다.

## 7. 재검증과 최신성

- self-review, 로컬 검증과 CI는 현재 PR head 커밋을 대상으로 해야 한다.
- PR에 새 커밋이 추가되면 이전 CI와 위험 판정을 새 변경의 근거로 사용하지 않는다.
- merge 직전 원격 PR head와 expected head가 다르면 중단한다.
- required check의 미실행, 중립, 스킵, 취소, 만료와 조회 실패는 성공이 아니다.
- auto-merge 활성화 요청이 실패하면 설정을 우회하거나 직접 병합하지 않고 이유를 보고한다.
- 병합 뒤 알림 실패와 병합 실패를 구분하며, 불명확한 외부 상태에서는 상태를 재조회한다.
