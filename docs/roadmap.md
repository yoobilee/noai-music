# NoAI Roadmap

이 문서는 NoAI의 향후 개발 우선순위를 기록한다. 순서는 현재 조사 결과와 사용자 영향도를 기준으로 하며 새로운 근거나 환경 변화에 따라 바뀔 수 있다. 구체적인 버전과 일정은 각 작업의 검증 결과에 따라 결정한다.

NoAI는 계속 YouTube의 공식 표시와 검증 가능한 구조화된 신호를 우선하며 추측 기반 AI 판정을 도입하지 않는다.

## 1. Filtering performance and reliability

현재 가장 높은 우선순위다.

[YouTube 카드 필터 지연 조사](youtube-filter-latency-investigation.md)에서는 cold cache의 watch-page fetch와 concurrency 2 FIFO queue에서 누적되는 대기 시간이 주 병목으로 확인됐다. parser, `storage.local`과 DOM 적용은 측정 표본의 주 병목이 아니었고, warm cache에서는 10개 항목 전체가 33ms 안에 적용됐다.

24개 unique video ID를 한 번에 발견한 synthetic burst에서는 active 2개와 pending 20개를 넘은 2개가 `queue-full`이 됐고, 같은 route에서 자동으로 다시 시도되지 않았다. 현재 scheduling은 DOM document order를 따르며 viewport priority가 없다.

### 1.1 Live viewport and DOM-order validation

- 실제 Chrome에서 카드의 DOM order와 화면 노출 순서를 비교한다.
- visible card가 below-the-fold card보다 늦게 enqueue되는 실제 사례가 있는지 확인한다.
- production telemetry는 추가하지 않는다.
- 임시 probe가 필요하면 title, description 등 불필요한 데이터를 수집하지 않고 결과 수집 후 제거한다.

완료 조건:

- 실제 Chrome 환경의 측정 기록이 남아 있다.
- visible-first scheduling이 필요한지 근거를 바탕으로 판단할 수 있다.

### 1.2 Visible-first initial scheduling

1.1에서 사용자 체감 개선 가능성이 확인된 경우에만 구현을 검토한다.

- initial document scan에서 `visible`, `near`, `below` 정도의 단순 bucket 우선순위를 검토한다.
- `getBoundingClientRect`를 사용할 경우 layout read 비용을 함께 측정한다.
- 기존 dedupe, SPA route 전환과 stale response 안전장치를 유지한다.
- permission과 network 경로를 변경하지 않는다.

완료 조건:

- 첫 화면의 사용자 체감 필터 완료 시간이 실제 측정에서 개선된다.
- 전체 처리 correctness와 기존 dedupe·SPA·stale response 동작에 회귀가 없다.
- 기존 unit/E2E와 새 scheduling 회귀 테스트가 통과한다.

### 1.3 Request concurrency evaluation

visible-first만으로 충분하지 않을 때 검토한다.

- concurrency 2 → 3을 우선 실험한다.
- 4 이상은 현재 roadmap의 기본 후보로 두지 않는다.
- 요청 수 자체는 늘리지 않는다.
- YouTube 동시 부하, rate-limit, timeout과 MV3 service worker lifecycle 영향을 확인한다.

완료 조건:

- concurrency 3의 실제 first-visible 및 전체 처리시간 개선 수치를 확보한다.
- 오류율, timeout과 rate-limit 회귀가 없다.
- 동시 부하 증가 대비 효과가 충분할 때만 적용한다.

### 1.4 Bounded queue-full rescheduling

- `queue-full` 결과가 같은 route의 `candidateResults`에 남아 자동 재시도되지 않는 문제를 개선한다.
- 무한 retry와 retry storm을 허용하지 않는다.
- route 변경과 stale candidate 안전장치를 유지한다.
- bounded retry 또는 동등하게 제한된 재스케줄 방식을 사용한다.

완료 조건:

- 22개를 넘는 burst에서도 queue가 비워진 뒤 누락 항목을 제한적으로 다시 처리한다.
- 요청 폭증이나 중복 요청 회귀가 없다.
- `invalid`, `unknown`과 `error`의 기존 의미를 바꾸지 않는다.

현 시점에서는 다음 최적화를 진행하지 않는다.

- 판정 전 provisional hiding
- concurrency 4 이상을 근거 없이 적용
- 복잡한 global priority queue 도입
- IntersectionObserver 기반 전체 scheduling 재설계

관련 문서: [YouTube 카드 필터 지연 조사](youtube-filter-latency-investigation.md)

## 2. YouTube Music structured music signals

[음악 판별 신호 후속 조사](music-signal-followup.md)에 따르면 현재 music scope는 watch-page player microformat의 `category === 'Music'`을 기준으로 한다. YouTube Music surface 자체는 음악으로 간주하지 않는다. YouTube Music에는 podcast, 일반 영상과 사용자 채널도 포함될 수 있기 때문이다.

실제 조사에서 다음 구조화 값이 관찰됐다.

- `MUSIC_VIDEO_TYPE_ATV`
- `MUSIC_VIDEO_TYPE_OMV`
- `MUSIC_VIDEO_TYPE_UGC`
- `MUSIC_VIDEO_TYPE_PODCAST_EPISODE`

향후 조사는 다음 경계를 따른다.

- 이미 로드된 YouTube Music 구조화 데이터에서 같은 video ID에 연결되는 강한 신호만 검토한다.
- `MUSIC_VIDEO_TYPE_ATV`와 `MUSIC_VIDEO_TYPE_OMV`를 우선 검증한다.
- `MUSIC_VIDEO_TYPE_UGC`는 음악을 보장하는지 확인되지 않았으므로 음악·비음악·spoken-word 경계를 별도로 검증한다.
- `MUSIC_VIDEO_TYPE_PODCAST_EPISODE`, podcast page type과 일반 영상이 music으로 오분류되지 않아야 한다.
- 새 API, 검색 요청 또는 추가 watch request를 만들지 않는다.
- 기존 category 신호를 제거하거나 약화하지 않고, 보조 positive signal의 가능성만 조사한다.

완료 조건:

- signed-in live Chrome에서 renderer/player data의 실제 위치와 안정성을 확인한다.
- 구조화 item type이 같은 video ID와 원자적으로 연결되는지 검증한다.
- podcast, UGC와 일반 영상에 대한 false-positive 경계 테스트를 갖춘다.
- 추가 permission이나 network 없이 적용할 수 있는지 판단한다.

관련 문서: [음악 판별 신호 후속 조사](music-signal-followup.md)

## 3. Browser and live-environment validation

기능 개발과 구분해 관리하는 품질 백로그다.

- 남은 desktop Chrome 실제 수동 검증
- YouTube Music Premium auto-skip 세부 시나리오
- Edge 핵심 기능과 UI smoke test
- Whale 핵심 기능과 UI smoke test
- popup/options의 남은 접근성 항목
- 오래된 release checklist 미완료 항목의 실제 상태 재정리

자동 fixture 통과를 live 검증으로 바꾸어 기록하지 않는다. 실제로 검증하지 않은 브라우저를 정식 지원한다고 작성하지 않는다.

관련 문서: [릴리스 기록과 검증 체크리스트](release-checklist.md)

## 4. Community and user-rule research

장기 연구 항목이며 현재 상태는 **Research only**다.

후보:

- community-maintained content information
- 사용자 제보
- 이의제기와 정정 흐름
- 사용자 규칙 관리 개선

다음 원칙을 먼저 검증한다.

- community 정보와 YouTube 공식 disclosure를 같은 종류의 판정으로 취급하지 않는다.
- community 데이터만으로 콘텐츠가 AI 생성이라고 단정하지 않는다.
- 각 정보의 provenance와 source를 명확하게 구분한다.
- privacy, 악용과 허위 제보 가능성을 구현보다 먼저 조사한다.
- 별도 server나 database가 필요하면 구현 전에 별도의 기술 설계와 privacy 검토를 거친다.

## 5. Browser and platform expansion

장기 항목이며 현재 지원 범위를 확대한 것으로 간주하지 않는다.

### Firefox

현재 상태: **Not scheduled**

- Manifest V3와 WebExtension API compatibility를 조사한다.
- storage, background lifecycle과 content script 차이를 확인한다.
- 기존 Chromium 동작과 최소 권한 구조를 약화시키지 않는지 검토한다.

### Other music platforms

현재 상태: **Research only**

Spotify 같은 다른 음악 플랫폼은 현재 지원 대상으로 선언하지 않는다.

- 해당 플랫폼에 공식적이고 검증 가능한 AI 또는 altered-content 신호가 있는지 먼저 조사한다.
- 공식 신호가 없을 때 title, channel 또는 audio heuristic으로 대체하지 않는다.
- 이용약관, 기술 구조, privacy와 permission 영향을 구현 전에 검토한다.

## Principles

- **Official and verifiable signals first:** 공식 표시와 검증 가능한 구조화 신호를 우선한다.
- **No guessing:** 제목, 채널명, 썸네일이나 오디오 특성으로 AI 여부를 추측하지 않는다.
- **Unknown means unchanged:** 식별 정보나 근거를 확인할 수 없으면 콘텐츠를 변경하지 않는다.
- **Allow rules keep priority:** 적용 가능한 영역에서는 허용 규칙이 필터링 규칙보다 계속 우선한다.
- **Minimal permissions:** 기능에 필요한 최소 권한만 사용한다.
- **No analytics or telemetry:** 분석 도구와 production telemetry를 추가하지 않는다.
- **No unnecessary external services:** 불필요한 외부 서비스와 network 경로를 만들지 않는다.
- **Measure before optimizing:** 최적화 전에 실제 병목과 사용자 영향을 측정한다.
- **Separate automated and live validation:** 자동 테스트와 실제 환경 검증을 구분해 기록한다.
