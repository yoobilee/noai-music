# YouTube Music 현재 재생 자동 건너뛰기

- 구현 기준일: 2026-09-14
- 범위: 현재 재생 player bar identity, 기존 YouTube watch disclosure lookup 재사용, confirmed 항목의 다음 곡 버튼 1회 클릭
- 제외: YTM 카드 필터, queue 재작성, 반복 정책 변경, 비공개 player API, 새 네트워크·권한·telemetry, 재생 기록 저장

## 동작 조건

다음 조건을 모두 만족할 때만 현재 항목의 다음 버튼을 한 번 클릭한다.

1. `ytmusic-player-bar`의 지원되는 watch anchor에서 정확한 11자리 video ID를 얻는다.
2. 전역 `enabled`와 `youtubeMusicAutoSkip` 설정이 모두 `true`다.
3. 기존 background message로 조회한 결과가 `status === 'confirmed'`다.
4. 반환된 evidence를 기존 `detectYouTubeOfficialDisclosure`로 다시 검사했을 때 YouTube 공식 evidence가 confirmed다.
5. 결과의 video ID, lookup 시작 시 video ID, 클릭 직전 player bar video ID가 모두 같다.
6. 현재 player bar 안에 연결되고 disabled 상태가 아닌 지원 next control이 있다.

`not-detected`, `unknown-or-error`, timeout, queue-full, background-unavailable, invalid-html, evidence 없는 confirmed, stale result, ID 없음은 모두 no-op이다. 실패 시 추측하거나 다른 network path로 재시도하지 않는다.

## player identity와 관측

현재 identity는 기존 YouTube Music adapter의 `ytmusic-player-bar`와 `.title a[href]`, 이후 동일 player bar 안의 `a[href]` 우선순위를 재사용한다. 현재 URL이나 Polymer property, Media Session, 비공개 runtime state로 fallback하지 않는다. 동일 element가 재사용되더라도 매번 현재 `href`를 파싱하므로 전환 중 href가 사라지면 identity 없음으로 처리한다.

adapter는 `href`, `disabled`, `aria-disabled`, child-list 변경과 `yt-navigate-finish`를 관측하고 animation frame 단위로 알린다. selector와 YTM 전용 navigation event 명칭은 adapter 안에만 있다.

## next control 전략

2026-09-14에 확인한 공개 YTM desktop adapter 구현은 player bar의 `.next-button.ytmusic-player-bar`를 DOM click 대상으로 사용한다. NoAI도 이 selector 하나만 `src/adapters/youtube-music/selectors.ts`에 두며, player bar 내부로 조회 범위를 제한한다.

클릭 직전에 adapter가 현재 video ID를 다시 읽고 expected ID와 비교한다. control이 없거나 DOM에서 분리됐거나 `disabled` 또는 `aria-disabled="true"`이면 클릭하지 않는다. `click()` 예외도 adapter 안에서 실패로 닫는다. 내부 player API와 queue 객체는 호출하지 않는다.

공개 구현은 최종 YouTube Music DOM의 공식 계약이 아니므로 실제 Chrome 검증 전까지 selector drift 가능성이 남는다. 조사 근거:

- <https://github.com/ndayishimiyeA/youtube-music/blob/master/src/renderer.ts>
- <https://github.com/Sv443/BetterYTM/blob/main/src/observers.ts>

## stale 결과와 중복 방어

runtime controller는 유효한 current video ID가 바뀔 때마다 in-memory playback generation을 만든다. lookup callback은 generation과 expected/current/result video ID가 모두 일치할 때만 반영한다. href가 사라지는 전환 구간은 진행 중 generation을 무효화한다.

confirmed 결과가 skip 조건을 만족하면 next control을 찾기 전에 해당 video ID를 `blockedUntilDifferentVideoId`로 latch한다. 클릭 성공, control 없음, disabled, disconnected, 예외 여부와 무관하게 같은 ID에서는 다시 클릭하지 않는다. href가 잠시 사라졌다가 같은 ID로 돌아와도 latch를 유지한다. 다른 유효 ID가 관측되어야 latch가 풀린다.

따라서 A confirmed 후 A가 그대로인 동안 observer가 반복돼도 클릭은 한 번뿐이다. B로 전환되면 새 generation에서 별도 lookup과 한 번의 skip이 가능해 연속 confirmed A → B → C를 처리한다. 나중에 B를 거쳐 A가 다시 재생되면 A도 새 generation으로 다시 판단한다. ID 변화 없이 같은 항목이 다시 시작되는 repeat-one 상태는 구분할 신뢰 가능한 DOM identity가 없으므로 추가 클릭하지 않는다.

## 기존 lookup 재사용

YTM content script는 기존 `noai:youtube-watch-disclosure:lookup` runtime message와 background lookup service를 그대로 사용한다. background는 요청 sender를 동일 extension의 정확한 `https://www.youtube.com` 또는 `https://music.youtube.com` origin으로 제한한다. 실제 fetch URL, detector, queue, timeout, cache와 cache/network 결과 정책은 기존 YouTube 경로와 동일하다.

새 fetch, 외부 API, cache, permission 또는 host permission은 추가하지 않는다. YTM video ID는 기존 identity 조사에서 일반 YouTube watch video ID와 같은 형식임을 확인한 범위에서만 전달한다.

## 설정과 migration

`settingsV1`의 schema version과 storage key는 유지하고 `youtubeMusicAutoSkip: boolean`을 additive field로 추가했다. 기본값은 `true`다. 구버전 version-1 값에 새 field가 없거나 field만 손상된 경우 기존 `enabled`와 `mode`를 보존한 채 새 field만 기본값으로 보정해 다시 저장한다. version, `enabled` 또는 `mode`가 손상된 값은 기존과 같이 전체 안전 기본값으로 복구한다.

전역 `enabled=false`이면 auto-skip checkbox 값과 무관하게 lookup과 skip을 실행하지 않는다. popup/options의 같은 설정 패널에 한국어·영어 checkbox 하나를 추가했으며 storage change는 열린 YTM 페이지에 즉시 반영된다.

## 자동 검증

비식별 fixture는 합성 video ID와 player bar/next control 관계만 포함한다. 단위 테스트는 policy, evidence 재검증, player ID 변경, stale callback, 중복 observer, transition latch, 순차 confirmed 항목, missing/disabled/disconnected/throwing next control, 설정 migration과 sender origin 경계를 검증한다.

bundled Chromium extension E2E는 YTM fixture content script → runtime message → 기존 background watch lookup → detector → next DOM click 전체 흐름을 검증한다. A와 B가 연속 confirmed일 때 각 한 번 건너뛰고 ordinary C에서 멈추는 경우, 늦은 A 결과가 B를 건너뛰지 않는 경우, 설정 변경이 reload 없이 반영되는 경우를 포함한다. CI는 실제 YTM live DOM이나 계정에 의존하지 않는다.

## 실제 Chrome 수동 검증 절차

1. `npm run build`를 실행한다.
2. `chrome://extensions`에서 개발자 모드를 켜고 `.output/chrome-mv3`를 reload한다.
3. YouTube Music을 열고 popup/options에서 `YouTube Music 자동 건너뛰기`가 켜져 있는지 확인한다.
4. DevTools Elements에서 `ytmusic-player-bar`의 `.title a[href]`가 현재 항목의 `/watch?...v=...`를 가리키는지 확인한다.
5. 같은 player bar 안에 `.next-button.ytmusic-player-bar`가 있고 실제 다음 곡 control인지 확인한다.
6. 기존 공개 sample video ID 등 YTM에서 직접 재생 가능하고 공식 disclosure lookup이 confirmed인 테스트 항목을 재생해 다음 항목으로 한 번만 넘어가는지 확인한다.
7. official disclosure가 없는 일반 항목은 계속 재생되는지 확인한다.
8. confirmed 항목이 연속된 queue에서 각 playback generation마다 한 번씩 넘어가는지 확인한다.
9. auto-skip을 끄거나 전역 NoAI를 끈 상태에서는 현재 항목이 유지되는지 확인한다.
10. 검색·앨범·playlist·artist SPA 이동과 queue 변경 뒤 stale 항목을 건너뛰거나 같은 항목을 반복 클릭하지 않는지 확인한다.
11. 테스트가 끝나면 제목, 아티스트, 검색어, queue 또는 청취 기록이 `storage.local`에 추가되지 않았는지 확인한다.

이번 구현 환경에서는 in-app Chrome 연결을 다시 시도했으나 browser bridge를 사용할 수 없어 live YTM 수동 검증은 실행하지 못했다. fixture E2E 결과와 live 일반곡 no-op 검증은 구분해야 하며, PR 병합 전 위 절차의 사람 확인이 필요하다.

## 알려진 한계

- YouTube Music DOM은 공개 안정 API가 아니며 player bar 또는 next selector가 바뀌면 fail-closed no-op이 된다.
- player bar에 지원 watch anchor가 없는 전환 구간이나 premium/disabled UI에서는 skip하지 않는다.
- 클릭 성공 뒤 실제 player 전환 완료 여부를 비공개 state로 확인하지 않는다. ID가 바뀌지 않으면 같은 항목을 재클릭하지 않는다.
- 같은 video ID가 중간에 다른 유효 ID 없이 repeat되면 새 playback generation으로 판단할 수 없어 추가 skip하지 않는다.
- skip toast, badge, 이유 history, queue 정책과 YTM 카드 필터는 이 단계의 범위가 아니다.
