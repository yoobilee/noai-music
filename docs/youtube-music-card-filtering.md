# YouTube Music 목록 row 필터링

- 구현 기준일: 2026-09-16
- 범위: 확인된 YouTube Music 목록·queue item identity를 기존 사용자 규칙 및 watch disclosure lookup과 연결해 hide·blur·mark 적용
- 제외: 홈 카드·two-row item, 믹스·라디오, queue artist identity 추론, 자동 skip 변경, 새 네트워크·캐시·권한·telemetry

## 지원 surface와 selector

identity가 실제 DOM에서 확인된 다음 desktop surface만 지원한다.

| surface | route | row 경계 |
|---|---|---|
| 검색 결과 | `/search` | `ytmusic-responsive-list-item-renderer` |
| 앨범 track | `/browse/MPRE...` | `ytmusic-responsive-list-item-renderer` |
| 플레이리스트 track | 유효한 단일 `list`가 있는 `/playlist` | `ytmusic-responsive-list-item-renderer` |
| 아티스트 song | 정확한 UC channel 경로 | `ytmusic-responsive-list-item-renderer` |
| 현재 재생목록 queue | 재생 중 표시되는 queue panel | `ytmusic-player-queue-item` |

일반 row identity link 우선순위는 `.title a[href]`, `a[href]`다. 같은 우선순위에서 서로 다른 유효 video ID가 나오거나 지원 watch anchor가 없으면 identity를 만들지 않는다. 홈의 `ytmusic-two-row-item-renderer`와 믹스·라디오는 추측해서 수집하지 않는다.

Premium live DOM에서 queue item 내부에 watch anchor는 없고 Polymer `data.videoId`에 exact 11자 video ID가 있음을 확인했다. Chrome isolated world는 페이지 JavaScript property를 직접 공유하지 않으므로, 최소 MAIN-world bridge가 이 값만 검증해 공유 DOM의 `data-noai-queue-video-id`에 반영한다. isolated adapter는 이 검증된 attribute만 읽는다. 값이 없거나 문자열이 아니거나 11자 형식이 아니면 attribute를 제거하고 no-op한다. 확인되지 않은 nested data, 제목, 아티스트명, 순번과 재생 순서를 fallback으로 쓰지 않는다. selector와 property 해석은 `src/adapters/youtube-music` 경계에 둔다.

## 필터 조건과 lookup 연결

다음 조건을 모두 만족할 때만 현재 설정의 mode를 적용한다.

1. 전역 `enabled === true`다.
2. adapter가 현재 row 또는 queue item에서 정확한 11자리 YTM video ID를 하나 얻는다.
3. 기존 content script runtime message와 background watch lookup 결과가 `status === 'confirmed'`다.
4. 결과 evidence를 기존 `detectYouTubeOfficialDisclosure`가 다시 검사해 YouTube 공식 evidence로 confirmed한다.
5. 결과 `videoId`, lookup 시작 시 ID와 완료 시 DOM에서 다시 읽은 row ID가 모두 같다.

`not-detected`, `unknown-or-error`, timeout, queue-full, background-unavailable, 잘못된 evidence, stale 결과, identity 없음과 ambiguous identity는 모두 no-op이다. 제목, 아티스트, 검색어 또는 renderer 주변 문구로 AI 여부를 추측하지 않는다.

YTM isolated content script는 기존 `requestWatchDisclosure`만 호출한다. background의 고정된 일반 YouTube watch URL, in-flight dedupe, lookup queue와 `youtubeDisclosureCacheV1`을 그대로 사용하며 새 fetch 경로와 새 cache를 추가하지 않는다. queue identity bridge는 runtime message, storage와 network를 사용하지 않는다.

## hide·blur·mark DOM 처리

YTM DOM 변경은 `src/ui/youtubeMusicRowFilter.ts`에 격리한다. row 자체를 remove하지 않고 NoAI data attribute와 한 번 삽입되는 style element로 가역 처리한다.

- `hide`: 일반 row와 queue item 모두 `display: none`으로 시각적 내용과 차지하던 공간을 숨긴다. DOM node, Polymer `data.videoId`와 queue 순서는 변경하지 않으며 설정·mode 변경이나 item reuse 시 attribute만 제거해 즉시 복구한다.
- `blur`: badge를 제외한 row의 직접 자식만 흐리며 pointer interaction은 막지 않는다. 이유 badge는 흐려지지 않는다.
- `mark`: 콘텐츠 표현은 유지하고 reason badge만 표시한다.

영어 reason은 `NoAI · YouTube AI disclosure`, 한국어 reason은 `NoAI · YouTube AI 표시`다. 이 문구는 공식 표시를 확인했다는 뜻만 전달하며 음악 자체가 AI 생성됐다고 단정하지 않는다. badge는 실제 텍스트와 `role="note"`, `title`을 가지며 pointer event를 받지 않는다. absolute positioning, 최대 너비와 말줄임으로 row 열이나 긴 제목의 레이아웃을 늘리지 않는다.

## SPA, stale 결과와 row 재사용

adapter의 `MutationObserver`는 `href`, queue identity attribute, `hidden`·`aria-hidden`, child-list와 subtree 변경을 관찰하고 animation frame마다 관련 root만 묶어 전달한다. `yt-navigate-finish`와 `popstate`에서는 전체 문서를 다시 처리한다. observer batch를 flush할 때 route key가 달라졌다면 부분 root 대신 전체 문서를 처리한다. route key가 바뀌면 기존 필터 상태와 route-scoped pending map을 초기화한다.

Premium에서 확인된 플레이리스트 재생 흐름은 `/playlist?list=…` → `/watch?v=…&list=…` → `/playlist?list=…`다. `/watch` 전환 시 기존 playlist filter가 의도적으로 정리되며 queue를 별도로 처리한다. 복귀 시 navigation event가 최종 URL·visibility 변경보다 먼저 발생하더라도, 후속 visibility/DOM mutation에서 route 차이를 감지해 전체 playlist document를 다시 처리한다. detached renderer가 새 renderer로 교체되면 added node를 처리하고, 같은 renderer가 다시 드러나면 `hidden`·`aria-hidden` 변경을 처리한다.

각 row에는 WeakMap으로 `surface|videoId` expected key를 둔다. 같은 row·key를 observer가 반복 전달해도 lookup callback을 다시 연결하지 않는다. 같은 video ID의 동시에 진행 중인 row 요청은 content script의 route map으로 하나의 Promise를 공유하고, background in-flight dedupe도 그대로 동작한다.

lookup 완료 시 다음을 다시 확인한다.

- content script가 아직 유효한가
- row가 DOM에 연결돼 있는가
- WeakMap expected key가 시작 시 key와 같은가
- adapter가 현재 DOM에서 다시 읽은 `surface|videoId`가 같은가
- lookup 결과의 `videoId`가 현재 row ID와 같은가

하나라도 다르면 결과를 버린다. 적용된 A row가 B로 재사용되면 href mutation 처리 시 A의 attribute와 badge를 먼저 제거한 뒤 B를 별도로 판정한다. identity가 없어지거나 ambiguous해진 row도 이전 상태를 즉시 제거한다. badge 삽입 자체가 observer를 다시 깨워도 fingerprint와 DOM 현재 상태 확인으로 badge를 중복 삽입하지 않는다.

## 설정 반영과 auto-skip 관계

`storage.onChanged`에서 기존 `enabled`와 `mode` snapshot을 갱신한 뒤 현재 문서를 다시 처리한다. hide → blur, blur → mark, mark → hide와 enabled OFF/ON 전환은 이전 attribute와 badge를 모두 제거한 뒤 새 상태만 남긴다. 처음부터 disabled이면 row lookup을 시작하지 않으며, 이미 받은 동일 identity 결과는 OFF 동안 표시하지 않고 다시 ON이 되면 재사용할 수 있다.

목록·queue 필터 controller는 `youtubeMusicAutoSkip`을 읽어 판단하지 않는다. 따라서 auto-skip이 꺼져 있어도 `enabled`가 켜져 있으면 필터는 동작한다. 현재 재생 auto-skip은 별도 player observer와 controller를 유지한다. queue filter는 CSS attribute와 badge만 바꾸며 DOM node, Polymer queue data, `clickNext`, playback generation이나 latch를 변경하지 않는다. 두 기능이 같은 ID를 동시에 요청해도 기존 background in-flight dedupe/cache만 공유한다.

## fixture와 자동 검증

`tests/fixtures/youtube-music/card-rows.html`은 실제 제목, 아티스트, 계정, 검색어와 추적 값을 포함하지 않는 비식별 fixture다. 네 일반 surface와 live 구조를 최소화한 `ytmusic-player-queue-item`의 confirmed·ordinary row 및 synthetic video ID만 유지한다. script로 history와 body를 교체하고 `yt-navigate-finish`를 보내 검색 → 앨범 → 플레이리스트 → 아티스트 SPA 이동과 `/playlist` → `/watch` → `/playlist` 복귀 순서, renderer 교체·재노출과 queue item reuse를 재현한다.

Vitest는 네 일반 surface와 queue, 세 mode, disabled, 음성·오류 결과, evidence 없는 confirmed, 응답 ID 불일치, invalid·ambiguous identity, stale callback, row reuse, 중복 처리와 모든 설정 전환을 검증한다. Playwright는 bundled Chromium extension에서 MAIN-world queue bridge → isolated adapter → runtime message → background lookup → fixture watch HTML detector → row 필터 전체 경로를 검증한다. 실제 YouTube Music 네트워크는 CI 입력이나 성공 조건이 아니다.

## 실제 Chrome 수동 검증 절차

1. `npm run build`를 실행한다.
2. `chrome://extensions`에서 `.output/chrome-mv3` unpacked extension을 reload한다.
3. YouTube Music 검색 결과에서 지원 row와 일반 항목을 확인한다.
4. 앨범 화면의 track row를 확인한다.
5. 플레이리스트 화면의 track row를 확인한다.
6. 아티스트 화면의 song row를 확인한다.
7. popup 또는 options에서 Hide → Blur → Mark를 전환하고 row가 즉시 복구·변경되는지 확인한다.
8. Enabled를 OFF → ON으로 전환하고 attribute, 흐림과 badge 잔존이 없는지 확인한다.
9. 공식 disclosure가 confirmed인 항목만 선택 mode로 처리되는지 확인한다.
10. 일반 항목, 판정 대기·실패 항목과 identity 없는 row가 그대로 유지되는지 확인한다.
11. 검색 → 앨범 → 플레이리스트 → 아티스트로 SPA 이동하고 이전 row의 상태나 badge가 남지 않는지 확인한다.
12. `youtubeMusicAutoSkip`을 각각 ON/OFF로 두고 목록 필터와 현재 재생 skip이 서로의 설정·DOM·동작을 방해하지 않는지 확인한다.
13. Premium에서 일반 곡을 재생해 queue panel을 열고 confirmed queue item의 Hide·Blur·Mark, track allow/direct block과 일반 item no-op을 확인한다. Hide에서 빈 row 공간이 남지 않고 Blur/Mark 또는 Enabled OFF로 즉시 복구되는지도 확인한다.
14. 플레이리스트 → 재생 화면 → 플레이리스트로 돌아와 기존 confirmed row의 필터가 자동으로 다시 적용되고 badge가 중복되지 않는지 확인한다.

실제 confirmed YTM 항목을 안정적으로 찾지 못하면 “confirmed 적용”은 비식별 fixture E2E 결과로 기록하고, live Chrome에서는 일반곡 no-op과 selector·SPA·설정 복구만 별도로 기록한다. 두 결과를 하나의 live confirmed 검증처럼 합쳐 보고하지 않는다.

## 보안·개인정보와 알려진 한계

- manifest permission, host permission과 content-script matches를 변경하지 않는다.
- 새 외부 fetch, telemetry, analytics와 영구 filter history가 없다.
- 제목, 아티스트, 검색어, listening history와 계정 정보를 저장하지 않는다.
- 기존 cache에는 video ID와 최소 disclosure 결과만 기존 TTL 정책으로 저장한다.
- 실제 Chrome의 최신 logged-in/logged-out YTM DOM과 Edge·Whale은 수동 검증이 필요하다.
- 일반 지원 row에 DOM watch anchor가 없으면 no-op한다. queue만 live-confirmed `data.videoId`를 전용 bridge로 지원한다.
- queue에서 안정적인 artist UC identity는 확인되지 않았으므로 track allow/direct block만 적용하고 artist 규칙은 추론하지 않는다.
- 홈 카드·two-row item과 믹스·라디오는 지원하지 않는다.
- badge의 실제 YTM 행 높이·겹침과 한국어/영어 긴 텍스트는 live Chrome과 확대 환경에서 추가 확인이 필요하다.
