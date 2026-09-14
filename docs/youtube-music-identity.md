# YouTube Music 재생 항목 identity 추출

- 조사일: 2026-09-14
- 구현 범위: 검색·앨범·플레이리스트·아티스트의 재생 가능한 row와 현재 player bar의 video ID
- 제외 범위: 홈 카드·믹스·라디오, disclosure lookup 호출 연결, hide/blur/mark, 자동 skip·재생 제어, 사용자 목록, 저장·권한·외부 통신 변경

## 조사 방법과 신뢰 수준

연결된 실제 Chrome에서 DOM을 확인하려 했으나 ChatGPT 브라우저 확장과 native host가 설치되지 않아 라이브 Chrome 검증은 수행하지 못했다. 따라서 다음 근거를 구분해 사용했다.

1. 쿠키와 계정 정보를 보내지 않은 공개 `music.youtube.com` HTML 응답에서 현재 renderer JSON과 navigation endpoint를 확인했다.
2. 검색 엔진이 렌더링한 공개 YouTube Music 페이지에서 검색 결과에 `Song`, `Video` 등 서로 다른 콘텐츠 종류가 함께 나타나고, `/watch?...&v=...` URL이 playlist 문맥과 함께 사용되는 것을 확인했다.
3. 공개 저장소의 DOM snapshot과 2026년 8~9월 player adapter 구현에서 custom element와 링크 위치를 보조 확인했다. 이 자료는 YouTube 공식 계약이 아니며 selector calibration 근거일 뿐이다.

공개 응답은 최종 브라우저 DOM과 같지 않을 수 있다. 특히 응답 JSON의 `playlistItemData.videoId`와 `watchEndpoint.videoId`는 확인됐지만 isolated content script에서 안정적으로 접근할 수 있는 DOM 속성이라고 볼 수 없으므로 구현에서 읽지 않는다.

조사한 공개 페이지:

- 홈: <https://music.youtube.com/>
- 검색: <https://music.youtube.com/search?q=bothell%20washington>
- 앨범 browse: <https://music.youtube.com/browse/MPREb_pkaseD1VVpm>
- 앨범 playlist 표현: <https://music.youtube.com/playlist?list=OLAK5uy_lO5K-YbR2XJSkaDQ_D1HeRX28hNZfqd0E>
- 일반 playlist: <https://music.youtube.com/playlist?list=PL-zl0Qa3WDZ-XYzFHodllO2vHmE7kGODR>
- 아티스트: <https://music.youtube.com/channel/UCx-SOnaWgKY6VtiTAyLiFbQ>
- 재생 URL: <https://music.youtube.com/watch?v=dQw4w9WgXcQ>
- playlist/queue 문맥 재생 URL: <https://music.youtube.com/watch?index=0&list=PLVjTwls1HJTYKitbFftIMMO-bqoY_UCjT&v=GrJUpbdecYA>

보조 DOM 자료:

- `ytmusic-responsive-list-item-renderer` DOM snapshot과 `watch?v=...&list=...` 제목 링크: <https://github.com/lopugit/mods/blob/b043ec6af310920be5c6eab022e92985cdf00325/ytmscraper/ytmusic-responsive-list-item-renderer.html> (2024-09-09)
- player bar의 `.title`과 watch anchor를 사용하는 adapter: <https://github.com/go-cristian/youtube-music-extension/blob/adad12eb411763d852f4c40901962ee04ef3b029/src/playerAdapter.js> (2026-08-07)
- player bar 제목 watch anchor를 우선하는 현재 재생 URL 처리 예: <https://github.com/naikaku1/YTM_Immersion/blob/c4a0c8815910c1d358a3e4febc6211fa3b870b83/src/js/module/discord-presence.js> (2026-09-12)

## surface 조사 결과

| surface | 공개 응답·DOM에서 확인한 구조 | 이번 지원 |
|---|---|---|
| 홈 | 비로그인 홈 응답에서는 재생 가능한 개인화 renderer를 확인하지 못함 | 제외 |
| 검색 | `musicResponsiveListItemRenderer`, `watchEndpoint.videoId`; 공개 렌더링 결과에 곡·영상·episode가 혼재 | `/search`의 `ytmusic-responsive-list-item-renderer` 중 지원 watch 링크가 있는 항목 |
| 앨범 | `/browse/MPRE...`와 `/playlist?list=OLAK5uy...`; track row의 `playlistItemData.videoId` 확인 | `/browse/MPRE...`의 row 중 지원 watch 링크가 있는 항목 |
| 플레이리스트 | `/playlist?list=...`; track row의 `playlistItemData.videoId` 확인 | 유일하고 비어 있지 않은 `list`가 있는 `/playlist`의 row 중 지원 watch 링크가 있는 항목 |
| 아티스트 | `/channel/UC...`; top song에 `musicResponsiveListItemRenderer`와 `videoId` 확인 | 정확한 UC channel 경로의 row 중 지원 watch 링크가 있는 항목 |
| player bar | `ytmusic-player-bar`, `.title`, title/watch anchor 사용을 현재 공개 adapter에서 보조 확인 | player bar 안의 지원 watch 링크가 유일할 때 `player-current` |
| queue | 공개 `/watch?index=...&list=...&v=...` URL 확인 | URL parser가 `list`, `index`를 문맥으로 무시하고 `v`만 추출 |
| 믹스·라디오 | 이번 공개 응답에서 `start_radio`와 `RDAMVM` 링크를 확인하지 못함 | 제외 |

검색 결과의 곡, 영상과 episode는 동일한 row renderer를 쓸 수 있다. NoAI는 제목이나 renderer 주변 문구로 콘텐츠 종류를 추측하지 않고 모두 `search-result`라는 surface만 기록한다.

## adapter와 selector

YouTube Music 전용 DOM 이름은 `src/adapters/youtube-music/selectors.ts`에만 둔다.

| 목적 | selector와 우선순위 |
|---|---|
| 목록 row | `ytmusic-responsive-list-item-renderer` |
| row video link 1순위 | `.title a[href]` |
| row video link 2순위 | `a[href]` |
| 현재 재생 container | `ytmusic-player-bar` |
| 현재 재생 link 1순위 | `.title a[href]` |
| 현재 재생 link 2순위 | `a[href]` |

각 우선순위에서 지원 URL로 파싱되는 ID를 집합으로 만든다. ID가 하나면 사용하고, 같은 ID의 중복 링크는 허용한다. 같은 우선순위에서 서로 다른 ID가 나오면 하위 우선순위로 내려가지 않고 identity 없음으로 처리한다. 높은 우선순위에서 유일한 ID를 얻으면 낮은 우선순위의 다른 watch 링크는 선택에 영향을 주지 않는다.

목록 candidate의 surface는 현재 route에서만 정한다.

- `/search` → `search-result`
- `/browse/MPRE...` → `album-track`
- `/playlist?list=...` → `playlist-track`
- `/channel/UC...` → `artist-song`
- `ytmusic-player-bar` → `player-current`

홈·일반 browse·watch route에 보이는 row는 현재 조사 범위로 semantic surface를 확정할 수 없어 수집하지 않는다. `musicTwoRowItemRenderer`가 공개 응답에 있어도 최종 카드 DOM과 링크 경계를 라이브 Chrome에서 확인하지 못했으므로 `ytmusic-two-row-item-renderer`는 지원 selector에 넣지 않았다.

## URL과 video ID 계약

순수 parser는 다음 형식만 지원한다.

- `https://music.youtube.com/watch?v=VIDEO_ID`
- `/watch?v=VIDEO_ID`
- DOM snapshot에서 확인된 path-relative `watch?v=VIDEO_ID`
- 위 형식에 `list`와 `index`가 추가된 URL. query 순서는 무관하다.

video ID는 영문 대·소문자, 숫자, `_`, `-`만으로 이루어진 정확히 11자리 값이어야 한다. `v`는 정확히 한 번만 존재해야 하고 parameter 이름이나 값이 percent-encoded되면 거절한다.

다음은 지원하지 않는다.

- `v`가 없거나 비어 있거나 형식이 잘못된 URL
- 중복 `v`, encoded `v`, fragment, 확인하지 않은 query parameter
- `/browse`, `/playlist`, `/channel`, `/shorts` 자체
- HTTP, protocol-relative URL, 외부 origin
- `youtube.com`, `www.youtube.com`과 다른 YouTube subdomain
- `start_radio` 또는 다른 radio 시작 URL

`list`와 `index`는 identity가 아니며 저장하거나 lookup에 전달하지 않는다. radio collection 자체도 곡 identity로 해석하지 않는다.

11자리 형식 검증과 strict `v` 추출은 `src/shared/youtubeVideoId.ts`에서 YouTube와 YouTube Music parser가 공유한다. origin과 URL surface 규칙은 각 adapter parser에 남겨 두 사이트의 지원 범위가 섞이지 않게 했다.

## 현재 재생 identity 전략

현재 항목은 `ytmusic-player-bar` 안의 제목 watch anchor를 먼저 읽고, 없을 때만 같은 player bar 안의 다른 watch anchor를 확인한다. 내부 전역 객체, Polymer element의 비공개 property, Media Session metadata와 YouTube Music runtime state는 사용하지 않는다.

현재 페이지 URL은 공개 `/watch?v=...` 형태를 제공하지만 player bar가 다음 항목으로 전환되는 동안 route가 먼저 또는 나중에 바뀌면 stale ID가 될 수 있다. 이번 단계에서는 URL fallback을 사용하지 않는다. player bar에 유효하고 모호하지 않은 watch anchor가 없으면 `undefined`를 반환한다. 같은 DOM element가 재사용되더라도 호출할 때마다 현재 `href`를 다시 읽으므로 href가 제거된 전환 구간에는 이전 ID를 유지하지 않는다.

## 기존 YouTube watch lookup 재사용

2026-09-14 공개 YTM 응답에서 얻은 네 개의 video ID를 쿠키 없이 `https://www.youtube.com/watch?v=VIDEO_ID&hl=en`으로 조회했다. 모두 HTTP 200 응답의 현재 video ID와 일치했다. 따라서 이번에 지원하는 YTM watch anchor의 `v`는 기존 YouTube watch lookup이 받는 동일한 11자리 identity 계약으로 전달할 수 있다.

adapter output은 기존 `MediaCandidateSnapshot.identity`를 사용한다.

```ts
{
  site: 'youtube-music',
  videoId: 'exactly11id',
  artistIds: [],
}
```

이번 단계에서는 content script에서 background lookup을 호출하지 않는다. 새로운 network path, API, cache schema와 permission도 추가하지 않는다. 향후 연결 시 background가 이미 수행하는 video ID 형식 검증과 고정된 YouTube watch URL 조립을 그대로 사용한다.

## fixture와 자동 검증

`tests/fixtures/youtube-music/playable-items.html`은 custom element, link 우선순위와 surface 관계만 남긴 비식별 합성 fixture다. 실제 제목, 아티스트, 계정, 검색어, 추천·재생 기록과 tracking 값은 포함하지 않는다.

단위 테스트는 다음을 고정한다.

- 검색 곡·영상 row, 앨범·플레이리스트 track row, 아티스트 곡 row
- player bar의 현재 항목
- title 우선순위, 동일 ID 중복, 서로 다른 ID 모호성
- video ID 없음과 일부 DOM 누락
- player element 재사용 중 href 제거·교체 시 stale identity 방지
- 지원·제외 URL, malformed·duplicate·encoded `v`
- 기존 YouTube parser와 카드 추출 회귀

## 실제 Chrome 수동 검증 절차

현재 작업에서는 연결된 Chrome이 없어 다음 절차를 실행하지 못했다. Chrome에서 `.output/chrome-mv3`를 unpacked extension으로 로드한 뒤 logged-out과 logged-in 상태를 구분해 확인한다.

1. DevTools의 Elements에서 `ytmusic-responsive-list-item-renderer`와 `ytmusic-player-bar`가 실제로 존재하는지 확인한다.
2. 홈에서는 two-row 카드·믹스·라디오 renderer와 링크를 기록하되 이번 adapter가 지원한다고 간주하지 않는다.
3. 검색에서 곡과 영상 결과 각각의 row를 골라 `.title a[href]` 및 다른 anchor의 raw `href`를 확인한다. 추출한 `v`가 클릭 후 재생되는 항목과 같은지 확인한다.
4. `/browse/MPRE...` 앨범, `/playlist?list=...` 플레이리스트, `/channel/UC...` 아티스트에서 각각 최소 두 row를 같은 방법으로 확인한다. watch anchor가 없는 disabled/premium row는 identity 없음이어야 한다.
5. DevTools Console에서 다음 최소 점검식을 각 row에 실행해 후보 anchor를 확인한다. `row`는 Elements 패널에서 선택한 `$0`을 사용한다.

   ```js
   const row = $0;
   [...row.querySelectorAll('.title a[href], a[href]')]
     .map((anchor) => anchor.getAttribute('href'));
   ```

6. 재생 중 `ytmusic-player-bar`의 `.title a[href]`가 현재 항목의 `/watch?...v=...`를 가리키는지 확인한다. queue에서 다음·이전 곡으로 이동할 때 같은 player bar element의 href가 새 ID로 바뀌는지, 전환 중 제거된다면 adapter가 이전 ID를 유지하지 않는지 확인한다.
7. SPA로 검색 → 앨범 → 플레이리스트 → 아티스트 → 홈을 이동하고 route별 surface가 맞으며 홈 row는 수집하지 않는지 확인한다.
8. 선택한 anchor URL을 `parseYouTubeMusicWatchVideoId` 단위 테스트에 임시 입력해 실제 클릭·재생 대상과 ID가 일치하는지 확인하고, 새 URL 형태가 나타나면 조사 근거와 fixture를 먼저 추가한다.
9. 수동 검증 후 Chrome 버전, 로그인 상태, locale, route, renderer, raw href와 실패 사례를 이 문서에 추가한다. 제목·아티스트·계정·추천 내용은 기록하지 않는다.

## 알려진 한계

- 실제 Chrome의 2026-09-14 렌더링 DOM을 직접 확인하지 못했다. 공개 응답과 보조 DOM 자료가 최종 DOM과 다를 수 있다.
- row에 DOM watch anchor가 없고 비공개 renderer state에만 video ID가 있으면 의도적으로 identity를 반환하지 않는다.
- 검색 결과의 곡·영상·episode를 semantic type으로 구분하지 않는다.
- 홈 카드, `ytmusic-two-row-item-renderer`, 믹스, 라디오와 queue panel row는 지원하지 않는다.
- player bar watch anchor가 없거나 모호한 전환 구간에는 현재 identity를 반환하지 않는다.
- adapter는 entrypoint, lookup, 필터와 skip에 아직 연결되지 않았다.
