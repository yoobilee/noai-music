# NoAI 0.9.0 → 1.0.0 릴리스 체크리스트

0.9.0은 1.0 release candidate이며 Chrome Web Store에서 공개되어 설치할 수 있다. 이 문서는 1.0.0 전에 사람이 실제 환경에서 확인할 항목과 0.9.0 배포 상태를 기록한다. 자동 fixture 통과를 live 검증으로 간주하지 않는다.

## 기능 동결

- [ ] 0.9.0 이후 새 기능 없이 회귀 수정과 문서·asset 보완만 진행
- [ ] `allowlist > direct blocklist > official disclosure` 우선순위 재확인
- [ ] official disclosure가 음악 자체의 AI 생성을 단정하지 않는 UI 문구 재확인
- [ ] 판정 불가와 identity 누락이 fail-closed인지 재확인

## YouTube 수동 검증

- [ ] Home 카드: Hide / Blur / Mark
- [ ] Search 카드: Hide / Blur / Mark
- [ ] Related 카드: Hide / Blur / Mark
- [ ] Playlist 카드: Hide / Blur / Mark
- [ ] channel `Videos` 카드와 route fallback
- [ ] 곡 allowlist 추가·삭제와 즉시 복구·재평가
- [ ] 곡 direct block 추가·삭제
- [ ] UC channel ID direct block 추가·삭제
- [ ] exact `@handle` channel block 추가·삭제
- [ ] block 제거 후 confirmed 항목은 official disclosure reason으로 복귀
- [ ] SPA 이동, 뒤로가기와 infinite/lazy render에서 stale 상태 없음
- [ ] hover 중 badge 중복, 깜빡임과 card layout shift 없음
- [ ] 일반 곡과 unknown/error 항목은 official policy로 필터링되지 않음

## YouTube Music 수동 검증

- [ ] Home의 미지원 card·two-row item은 no-op이며 검색·앨범·플레이리스트·아티스트 row 상태가 섞이지 않음
- [ ] Search 지원 row: Hide / Blur / Mark
- [ ] Album track row: Hide / Blur / Mark
- [ ] Playlist track row: Hide / Blur / Mark
- [ ] Artist song row: Hide / Blur / Mark
- [x] Premium live DOM에서 queue renderer `ytmusic-player-queue-item`과 exact `data.videoId` identity source 확인
- [ ] queue item: Hide / Blur / Mark, track allow/direct block, invalid identity no-op — Premium 환경 필요
- [ ] queue Hide에서 빈 공간이 남지 않고 DOM/playback 순서 유지, mode·Enabled 전환 시 즉시 복구 — Premium 환경 필요
- [ ] playlist → `/watch?...&list=...` → playlist 복귀 후 기존 row 필터 재적용과 badge 중복 없음 — Premium 환경 필요
- [ ] player bar가 현재 재생곡의 exact video ID를 읽음 — Premium 환경 필요
- [ ] confirmed 현재 곡 auto-skip — Premium 환경 필요
- [ ] track allowlist가 auto-skip을 방지함 — Premium 환경 필요
- [ ] direct blocked track/확실한 artist가 disclosure lookup 없이 한 번 skip됨 — Premium 환경 필요
- [ ] Enabled OFF와 YouTube Music auto-skip OFF가 skip을 중지함 — Premium 환경 필요
- [ ] playback generation별 one-click latch와 transition failure 재클릭 방지 — Premium 환경 필요
- [ ] 다음 곡 전환과 SPA 이동에서 stale identity 또는 중복 click 없음 — Premium 환경 필요
- [ ] manual Next, queue/playlist 선택과 자연스러운 곡 종료로 confirmed 곡 진입 시 generation당 한 번 auto-skip — Premium 환경 필요

Premium 환경을 사용할 수 없으면 위 Premium 항목을 완료로 표시하지 않고 bundled Chromium fixture/E2E 결과와 구분해 기록한다.

## Popup과 options

- [ ] 실제 Chrome popup이 처음부터 약 380px이며 좌우 oscillation이 없음
- [ ] collapsed/expanded details와 목록 추가·삭제 중 popup 폭이 변하지 않음
- [ ] 600px 제한에서 vertical scroll만 나타나고 horizontal scroll이 없음
- [ ] Hide / Blur / Mark와 ON/OFF의 현재 상태를 바로 이해할 수 있음
- [ ] 허용·차단 details의 제목, 저장 개수와 chevron이 명확함
- [ ] popup과 options의 설정·목록이 즉시 동기화됨
- [ ] 한국어 UI와 긴 한글 `@handle` 줄바꿈
- [ ] 영어 UI와 긴 UC ID/URL 줄바꿈
- [ ] keyboard Tab / Shift+Tab / Enter / Space와 focus-visible
- [ ] 200% zoom에서 내용·control 손실과 가로 overflow 없음
- [ ] 오류 메시지, `aria-invalid`와 `aria-describedby` 연결

## 브라우저

- [ ] desktop Chrome 현재 안정 버전 — 전체 수동 매트릭스
- [ ] desktop Edge 현재 안정 버전 — 핵심 기능과 UI smoke
- [ ] desktop Whale 현재 안정 버전 — 핵심 기능과 UI smoke
- [ ] 각 브라우저 버전, OS, 언어와 로그인 상태 기록

## 자동 검증

- [ ] `npm ci`
- [ ] `npm audit --audit-level=low`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run test:automation-policy`
- [ ] `npm run build`
- [ ] `npm run test:e2e`
- [ ] `npm run verify:all`
- [ ] `npm run zip`
- [ ] `git diff --check`
- [ ] PR 최신 head의 CI `Verify`

## Manifest와 배포 artifact

- [ ] `package.json`과 `package-lock.json`의 project version이 `0.9.0`
- [ ] `.output/chrome-mv3/manifest.json`의 version이 `0.9.0`
- [ ] manifest name, description, `default_locale`, action popup과 options 확인
- [ ] `permissions: [storage]`와 `host_permissions: [https://www.youtube.com/*]` 외 증가 없음
- [ ] content-script matches가 YouTube와 YouTube Music 두 HTTPS origin으로 제한됨
- [ ] `.output/noai-music-0.9.0-chrome.zip` 생성
- [ ] zip에 `.git`, `node_modules`, tests, docs, fixture, 환경 파일과 source map이 없음
- [ ] zip에 manifest, runtime bundle, popup/options, locale 파일이 있음
- [ ] source·fixture·secret 문자열과 로컬 절대 경로가 bundle에 포함되지 않음
- [ ] Git working tree clean

## Store asset와 listing

- [x] 사용자 승인된 NoAI 브랜드 원본 확보
- [x] 16×16, 32×32, 48×48, 128×128 PNG icon 확보·manifest 등록
- [x] 128×128 icon이 실제 extension zip에 포함됨
- [ ] 440×280 small promotional image 준비
- [ ] 실제 기능 screenshot 최소 1개, 권장 5개 준비
- [ ] 한국어·영어 상세 설명과 screenshot locale 확인
- [ ] 공개 가능한 stable Privacy policy HTTPS URL 확정
- [ ] Support URL과 publisher identity 확인
- [ ] Dashboard Privacy practices가 [privacy 문서](privacy.md) 및 실제 구현과 일치
- [ ] remote code 사용 안 함으로 선언
- [ ] 단일 목적과 모든 permission justification 입력

Chrome 공식 문서의 현재 이미지 규격은 [Web Store 이미지 안내](https://developer.chrome.com/docs/webstore/images)에서, privacy 입력 항목은 [Privacy practices 안내](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)에서 listing 변경 전에 다시 확인한다.

## 배포 단계

- [x] 0.9.0 PR 사람 review와 병합 승인
- [x] 0.9.0 tag 생성 및 push 승인
- [x] GitHub Release 생성과 검증된 zip 첨부 승인
- [x] Chrome Web Store package upload 및 제출 승인 — [공개 listing](https://chromewebstore.google.com/detail/noai/eiddibmnpcdbgdmeoipniomddiboikkf)
- [ ] 1.0.0 version bump 전 최종 회귀 결과와 남은 blocker 확인
