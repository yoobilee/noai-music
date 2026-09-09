# YouTube 영상 카드 video ID 추출

- 조사일: 2026-09-09
- 구현 범위: 데스크톱 YouTube 홈·검색·watch 관련 영상·재생목록의 영상 단위와 video ID
- 제외 범위: Shorts, YouTube Music, 네트워크 확인, disclosure 조회, 캐시와 필터 UI

## 현재 구조 조사

개인 세션과 쿠키를 사용하지 않은 공개 YouTube 응답을 확인했다. 공개 응답은 렌더링 완료 DOM과 동일하지 않으므로 renderer/view-model 종류를 확인하는 calibration 근거로만 사용하며 자동 테스트에서 요청하지 않는다.

| surface | 공개 URL | 확인 결과 |
|---|---|---|
| 홈 | `https://www.youtube.com/` | 로그아웃 응답에 영상 카드가 없어 현재 renderer를 확인하지 못함 |
| 검색 | `https://www.youtube.com/results?search_query=music` | `videoRenderer`와 `/watch?v=...` watch endpoint 확인 |
| 관련 영상 | `https://www.youtube.com/watch?v=dQw4w9WgXcQ` | video content type의 `lockupViewModel`과 watch endpoint 확인 |
| 재생목록 | `https://www.youtube.com/playlist?list=PLBCF2DAC6FFB574DE` | video content type의 `lockupViewModel`과 playlist 문맥의 watch endpoint 확인 |

기존 YouTube adapter가 사용하는 `ytd-rich-item-renderer`, `ytd-video-renderer`, `ytd-compact-video-renderer`, `ytd-playlist-video-renderer`와 `yt-lockup-view-model`을 영상 단위 경계로 유지한다. 검색·관련·재생목록은 위 공개 응답에서 대응 renderer/view-model을 확인했지만, 홈과 최종 custom-element DOM은 실제 Chrome 연결을 사용할 수 없어 이번 작업에서 수동 확인하지 못했다. 확인하지 못한 구조를 새 selector로 추측해 추가하지 않았다.

## URL 파싱 계약

`parseYouTubeWatchVideoId`는 DOM을 받지 않는 순수 함수다. 다음 조건을 모두 만족할 때만 11자리 video ID를 반환한다.

- 상대 URL은 `/watch` 경로
- 절대 URL은 HTTPS의 `youtube.com` 또는 `www.youtube.com`
- 경로가 정확히 `/watch`
- query에 정확히 하나의 원문 `v` parameter가 존재
- `v` 값이 영문 대소문자, 숫자, `_`, `-`로 구성된 정확히 11자리 값

`feature`, `list`, `index`, `t`, `pp` 같은 추가 query parameter의 존재와 순서는 video ID 판정에 영향을 주지 않는다. percent-encoded video ID와 중복 `v`는 확인되지 않은 모호한 입력이므로 거부한다.

다음 형태는 명시적으로 지원하지 않는다.

- `/shorts/VIDEO_ID`와 `youtu.be/VIDEO_ID`
- `/playlist`, `/channel`과 video ID 없는 `/watch`
- HTTP, protocol-relative URL, 외부 origin
- `music.youtube.com`, `m.youtube.com`과 다른 YouTube subdomain
- `/watch/`처럼 확인하지 않은 경로 변형
- 길이·문자 집합이 잘못됐거나 중복·encoded된 `v`

## 카드 내 링크 우선순위

adapter는 selector를 `adapters/youtube/selectors.ts` 한곳에 두고 카드 내부 링크를 다음 순서로 평가한다.

1. `a#video-title[href]`
2. `a#thumbnail[href]`
3. 그 밖의 `a[href]`

각 단계에서 순수 URL 파서를 통과한 video ID만 모아 중복을 제거한다. 하나면 채택하고, 서로 다른 ID가 둘 이상이면 해당 카드를 모호한 상태로 보고 추출하지 않는다. 유효한 링크가 없을 때만 다음 단계로 이동한다. 따라서 같은 영상의 제목·썸네일 링크 반복은 허용하고, title이 명시된 카드 안의 낮은 우선순위 링크가 다른 영상을 가리켜도 title을 우선한다.

채널·재생목록·외부·Shorts 링크는 파서 단계에서 제외한다. playlist navigation 링크와 watch 링크가 함께 있는 collection 카드는 video item으로 선택하지 않으며, `ytd-ad-slot-renderer` 안의 영상형 markup도 후보에서 제외한다. video ID를 얻지 못한 카드와 일부 구조가 누락된 카드는 예외 없이 미감지로 처리한다. 같은 video ID가 서로 다른 카드에서 반복되는 것은 정상이며 카드 element별 candidate를 유지한다.

watch page의 `ytd-watch-metadata`는 기존 disclosure vertical slice 회귀를 막기 위해 카드 링크가 없으면 현재 `/watch?v=...` URL을 같은 순수 파서로 처리한다.

## 비식별 fixture와 자동 테스트

`tests/fixtures/youtube/video-cards.html`은 다음 관계만 보존한 합성 fixture다.

- 홈·검색·관련·재생목록 renderer/custom-element 경계
- 제목·썸네일·일반 anchor 우선순위
- 상대·절대 watch URL과 playlist 문맥 query
- 채널·재생목록 collection·외부·Shorts·광고·누락·모호한 링크
- 서로 다른 카드에서 반복되는 동일 video ID

실제 제목, 채널, 계정, 추천 기록, tracking 값과 개인정보는 포함하지 않는다. Vitest는 순수 URL parser와 fixture adapter를 검증한다. 기존 disclosure fixture와 Playwright smoke test는 그대로 유지해 watch disclosure 회귀를 확인한다. live YouTube DOM은 영구 test oracle로 사용하지 않는다.

## Chrome 수동 검증 절차

1. `npm run build` 후 `.output/chrome-mv3`를 Chrome에 unpacked extension으로 로드한다.
2. DevTools에서 NoAI content script 문맥을 선택한다.
3. 홈의 일반 영상 카드에서 adapter candidate의 `snapshot.identity.videoId`가 카드 watch URL의 `v`와 같은지 확인한다.
4. 검색 결과, watch page 관련 영상과 공개 재생목록 항목에서 각각 최소 한 개를 같은 방법으로 확인한다.
5. 카드마다 제목·썸네일·채널·재생목록 링크가 함께 있을 때 채널이나 playlist ID가 선택되지 않는지 확인한다.
6. Shorts와 광고가 candidate로 수집되지 않는지 확인한다.
7. 같은 영상이 여러 카드에 나타나면 각 카드가 같은 video ID를 갖되 별도 candidate로 유지되는지 확인한다.
8. YouTube 내부 SPA 이동과 뒤로가기 뒤 새 카드의 ID가 다시 추출되는지 확인한다.

이번 작업 환경에서는 연결된 Chrome을 사용할 수 없어 위 수동 절차를 수행하지 못했다. 이는 fixture 기반 자동 검증 통과와 구분하며, 실제 홈 custom-element와 변경된 lockup DOM은 병합 전 또는 후속 호환성 점검에서 확인해야 한다.

## 현재 한계

- 공개 응답에서 확인되지 않은 새 renderer와 watch URL 변형은 인식하지 않는다.
- 홈은 로그아웃 공개 응답에 카드가 없어 실제 현재 DOM을 확인하지 못했다.
- 관련·재생목록의 `lockupViewModel`은 서버 view-model에서 확인했지만 최종 custom-element DOM은 실제 Chrome에서 확인하지 못했다.
- 현재 확인한 `ytd-ad-slot-renderer` 밖의 새로운 광고 container는 자동으로 식별하지 못할 수 있다.
- ID 추출만 수행하며 watch page fetch, background 네트워크 요청, disclosure 원격 확인과 캐시를 하지 않는다.
- 콘텐츠 숨김·흐림·필터 이유 UI를 적용하지 않는다.
- Shorts와 YouTube Music은 이번 범위에서 제외한다.
- extension permission과 host permission은 변경하지 않는다.
