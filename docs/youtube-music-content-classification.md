# YouTube 음악 콘텐츠 판별 조사

- 조사일: 2026-09-24
- 범위: 기존 공개 YouTube watch-page fetch 응답에서 음악 콘텐츠 여부를 구조화 데이터만으로 판별할 수 있는지 검토
- 제외: 기능 구현, 설정 schema, popup/options, package/version/release 변경

## 결론

현재 제약 안에서 모든 YouTube 영상을 정확히 `music | non-music | unknown`으로 나누는 공식 필드는 확인하지 못했다. 같은 watch HTML의 `ytInitialPlayerResponse.microformat.playerMicroformatRenderer.category`가 유일하게 실용적인 구조화 후보지만, YouTube의 공개 문서상 video category는 업로더가 영상에 연결하고 수정할 수 있는 metadata다. 실제 표본에서도 음악을 설명하는 교육 영상이 `Music`, 노래 공연 영상이 `Entertainment`로 나타났다. 따라서 category는 “곡 또는 음악 공연임을 YouTube가 보증하는 필드”가 아니다.

NoAI의 오탐 최소화와 판정 불가 시 fail-open 원칙에 맞는 권장 규칙은 단방향이다.

```ts
type ContentKind = 'music' | 'non-music' | 'unknown';

// www.youtube.com watch-page lookup
category === 'Music' ? 'music' : 'unknown';
```

- `Music`은 YouTube가 제공한 구조화 category에 근거한 `music`으로 사용할 수 있다. 다만 이는 “YouTube Music category”라는 operational definition이며 곡만을 뜻하지 않는다.
- 다른 category, category 누락, player response 누락·불일치와 알 수 없는 구조는 `unknown`이다.
- 다른 category를 `non-music`으로 바꾸지 않는다. 음악 공연도 `Entertainment` 같은 다른 category를 가질 수 있기 때문이다.
- 현재 조사만으로 `non-music`을 신뢰성 있게 생성할 수 있는 독립적인 명시 신호는 없다. union에는 향후 계약을 위해 남길 수 있지만 첫 구현에서는 사실상 나오지 않아야 한다.

이 규칙은 false positive 가능성을 완전히 없애지 못한다. `Music` category에는 음악 자체뿐 아니라 음악 교육·해설처럼 음악에 관한 콘텐츠도 포함될 수 있다. 제품의 “Music only”가 “YouTube가 Music으로 분류한 콘텐츠”인지, 더 좁은 “곡·음악 공연”인지 구현 전에 확정해야 한다. 후자라면 현재 제약만으로는 출시 가능한 수준의 판별을 만들 수 없다.

## 현재 watch-page lookup 구조

현재 흐름은 다음과 같다.

1. YouTube/YouTube Music adapter가 strict 11자리 video ID를 얻는다.
2. content script가 video ID만 background service worker에 보낸다.
3. background가 sender origin과 ID를 검증하고 `https://www.youtube.com/watch?v=VIDEO_ID&hl=en`을 조립한다.
4. `credentials: 'omit'`, `referrerPolicy: 'no-referrer'`, timeout 8초, 최대 5 MB 조건으로 HTML을 한 번 fetch한다.
5. `watchPageHtml.ts`가 HTML을 실행하거나 DOM에 넣지 않고 `ytInitialData` JSON만 추출한다.
6. 현재 영상의 `videoPrimaryInfoRenderer.badges`와 최상위 `engagementPanels`의 `howThisWasMadeSectionViewModel`만 disclosure evidence로 변환한다.
7. detector가 confirmed 공식 evidence만 `confirmed`로 만들고, 나머지는 `not-detected` 또는 `unknown-or-error`로 둔다.
8. 결과는 video ID 기준 `storage.local` cache에 저장한다.

관련 구현:

- `src/background/youtubeWatchPageFetch.ts`
- `src/adapters/youtube/watchPageHtml.ts`
- `src/background/youtubeWatchDisclosureLookup.ts`
- `src/shared/youtubeWatchDisclosure.ts`
- `src/storage/youtubeDisclosureCache.ts`
- [`youtube-watch-disclosure-lookup.md`](youtube-watch-disclosure-lookup.md)

현재 parser는 `ytInitialPlayerResponse`를 읽지 않는다. 그러나 2026-09-24에 성공한 공개 표본 15개에서는 기존 fetch의 같은 HTML 안에 `ytInitialData`와 `ytInitialPlayerResponse`가 모두 있었다. 따라서 별도 요청 없이 기존 응답에서 category를 함께 읽을 수 있다.

## 조사 방법과 경계

공개 watch URL을 기존 lookup과 같은 `hl=en` 및 비로그인 요청으로 가져와 다음만 기록했다.

- HTTP/playability와 응답 video ID 일치
- `ytInitialData`, `ytInitialPlayerResponse` 존재 여부
- `microformat.playerMicroformatRenderer.category`
- HTML의 `itemprop="genre"` meta
- `videoDetails.musicVideoType` 존재 여부
- music 이름을 가진 renderer/key와 structured description item 종류
- 기존 공식 disclosure renderer와 도움말 ID 존재 여부

제목, 설명, channel name, thumbnail, keyword/tag, 장르 추측과 오디오 분석은 판정 후보로 사용하지 않았다. 표본의 사람이 이해하는 종류는 비교군을 고르기 위한 조사 label일 뿐 runtime 입력이 아니다.

## 표본 비교

아래 결과는 2026-09-24의 일회성 관찰이며 영구 oracle이 아니다. 공개 응답 구조는 로그인, 지역, consent, 연령 제한, 실험과 YouTube 변경에 따라 달라질 수 있다.

| 비교군 | video ID | disclosure 구조 | player category | music 전용 field/renderer |
|---|---|---:|---|---|
| AI 표시 음악 | [`z8Dz-IFFFY4`](https://www.youtube.com/watch?v=z8Dz-IFFFY4) | 있음 | `Music` | 없음 |
| AI 표시 비음악 | [`lQE0GwkSu1Y`](https://www.youtube.com/watch?v=lQE0GwkSu1Y) | 있음 | `Film & Animation` | 없음 |
| AI 표시 비음악 | [`oUUIP_DPRTk`](https://www.youtube.com/watch?v=oUUIP_DPRTk) | 있음 | `Pets & Animals` | 없음 |
| AI 표시 비음악 | [`uwMvoJ99GSw`](https://www.youtube.com/watch?v=uwMvoJ99GSw) | 있음 | `Pets & Animals` | 없음 |
| 일반 음악 | [`dQw4w9WgXcQ`](https://www.youtube.com/watch?v=dQw4w9WgXcQ) | 없음 | `Music` | 없음 |
| 일반 음악 | [`kJQP7kiw5Fk`](https://www.youtube.com/watch?v=kJQP7kiw5Fk) | 없음 | `Music` | 없음 |
| 일반 음악 Art Track | [`T1tl66trXTQ`](https://www.youtube.com/watch?v=T1tl66trXTQ) | 없음 | `Music` | 없음 |
| 일반 비음악 | [`jNQXAC9IVRw`](https://www.youtube.com/watch?v=jNQXAC9IVRw) | 없음 | `Film & Animation` | 없음 |
| 일반 비음악 | [`9kt9-L1ymFA`](https://www.youtube.com/watch?v=9kt9-L1ymFA) | 없음 | `People & Blogs` | 없음 |
| 일반 비음악 | [`M7lc1UVf-VE`](https://www.youtube.com/watch?v=M7lc1UVf-VE) | 없음 | `Science & Technology` | 없음 |
| 경계: 음악 교육·해설 | [`rgaTLrZGlk0`](https://www.youtube.com/watch?v=rgaTLrZGlk0) | 없음 | `Music` | 없음 |
| 경계: 노래 공연 | [`RxPZh4AnWyk`](https://www.youtube.com/watch?v=RxPZh4AnWyk) | 없음 | `Entertainment` | 없음 |

추가 AI 표시 비음악 표본 `IW2BEkXQxU4`, `3KI_XX1sbwE`도 `Pets & Animals`였고 같은 disclosure 구조를 제공했다. 조사 중 찾은 `b23f8jVb7aU`는 현재 `playabilityStatus: ERROR`여서 비교 결과에서 제외했다.

성공한 15개 응답 모두 다음 특성을 보였다.

- 최종 URL과 `videoDetails.videoId`가 요청 ID와 일치했다.
- `ytInitialData`와 `ytInitialPlayerResponse`가 함께 있었다.
- `playerMicroformatRenderer.category`가 있었다.
- HTML `itemprop="genre"`는 category와 같은 값이었으며 독립적인 두 번째 판정 근거가 아니었다.
- `videoDetails.musicVideoType`은 없었다.
- `videoDescriptionMusicSectionRenderer`, `musicCarouselShelfRenderer`, `richMetadataRenderer` 같은 music 전용 renderer는 초기 HTML JSON에서 확인되지 않았다.

## 후보 신호 평가

| 후보 | 실제 관찰 | 신뢰도 | 채택 여부와 한계 |
|---|---|---|---|
| `ytInitialPlayerResponse.microformat.playerMicroformatRenderer.category` | 모든 성공 표본에 존재, `hl=en`에서 `Music` 등 영어 category | 중간 | 유일한 실용 후보. `Music → music`의 단방향 positive signal로만 권장. 업로더 연계 metadata이며 곡 보증이 아님 |
| HTML `meta[itemprop="genre"]` | 모든 성공 표본에서 player category와 동일 | 중간 이하 | player category의 중복 표현이다. 독립 corroboration이 아니며 JSON parser가 실패했을 때 의미를 높이지 못함 |
| `videoDetails.musicVideoType` | 음악 영상, Art Track, AI 표시 음악을 포함해 15개 모두 없음 | 사용 불가 | 현재 `www.youtube.com` 공개 watch HTML에서 가용하지 않음. 존재를 가정하지 않음 |
| music 전용 renderer/section | 초기 HTML의 두 JSON 객체에서 확인되지 않음 | 사용 불가 | 다른 client나 lazy-loaded endpoint에는 있을 수 있으나 기존 fetch 응답의 안정 신호가 아님 |
| `metadataRowRenderer` | 비음악 표본에서도 나타나는 generic renderer | 낮음 | renderer 이름 자체에 음악 의미가 없어 사용하지 않음 |
| structured description | disclosure, transcript, info cards 등은 확인 | 낮음 | `howThisWasMadeSectionViewModel`은 AI disclosure 근거일 뿐 음악 종류 근거가 아님 |
| `videoDetails.isLiveContent`, `isTvfilmVideo` | 일부 공통 boolean으로 존재 | 없음 | 음악 여부를 뜻하지 않음 |
| title/description/keywords/channel/thumbnail | 응답에 존재할 수 있음 | 금지 | 사용자 요구와 NoAI 원칙에 따라 읽거나 추론 입력으로 사용하지 않음 |
| YouTube Data API `snippet.categoryId` | 공식 API에 category가 있지만 API key/quota 요청 필요 | 범위 밖 | 호출하지 않음. 새 API·외부 요청 금지. 공식 문서는 category의 metadata 성격을 설명하는 근거로만 사용 |

YouTube 공식 Data API 문서는 `snippet.categoryId`를 “video category associated with the video”로 설명하고, uploader가 연결한 category를 사용한다고 명시한다. YouTube Help도 category를 upload default로 선택하고 업로드 뒤 바꿀 수 있다고 설명한다. 이는 watch HTML의 category가 공식 구조화 데이터라는 점은 지지하지만 실제 영상 내용을 검증한 분류라는 보장은 제공하지 않는다.

참고:

- [YouTube Data API video resource](https://developers.google.com/youtube/v3/docs/videos)
- [YouTube upload default settings](https://support.google.com/youtube/answer/2660027?hl=en)
- [YouTube Art Track 설명](https://support.google.com/youtube/answer/6007071?hl=en)
- [YouTube altered/synthetic content disclosure](https://support.google.com/youtube/answer/14328491?hl=en)
- [YouTube “How this content was made” 설명](https://support.google.com/youtube/answer/15447836?hl=en)

## 권장 판정 contract

```ts
type ContentKind = 'music' | 'non-music' | 'unknown';

interface ContentKindResult {
  kind: ContentKind;
  source?: 'youtube-video-category';
}
```

watch parser가 다음 조건을 모두 만족할 때만 `music`을 반환한다.

1. `ytInitialPlayerResponse`가 안전한 balanced JSON extraction과 `JSON.parse`를 통과한다.
2. `playabilityStatus.status === 'OK'`다.
3. `videoDetails.videoId`가 요청한 strict video ID와 일치한다.
4. `microformat.playerMicroformatRenderer.category === 'Music'`다.

그 외는 모두 `unknown`이다. 첫 구현에서 `non-music`을 반환하는 규칙은 두지 않는다. `htmlGenreMeta`가 다르면 구조 불일치로 `unknown`을 선택할 수 있지만, 같은 값이어도 독립 신뢰가 추가되는 것은 아니다.

```ts
function classifyYouTubeWatchPage(player: unknown, requestedVideoId: string) {
  if (!isValidatedPlayerResponse(player, requestedVideoId)) return 'unknown';
  return player.microformat.playerMicroformatRenderer.category === 'Music'
    ? 'music'
    : 'unknown';
}
```

정책 적용은 제안된 contract와 일치한다.

| mode | `music` | `non-music` | `unknown` |
|---|---|---|---|
| Music only | 기존 official disclosure 정책 적용 | 필터하지 않음 | 필터하지 않음 |
| All AI-labeled content | 기존 official disclosure 정책 적용 | 기존 official disclosure 정책 적용 | 기존 official disclosure 정책 적용 |

여기서 `unknown`은 음악 종류만 unknown이라는 뜻이다. disclosure 결과의 `confirmed | not-detected | unknown-or-error`와 별도 축이어야 한다. 예를 들어 disclosure는 `confirmed`지만 category가 없으면 `Music only`에서는 필터하지 않고 `All AI-labeled content`에서는 필터한다.

## YouTube Music surface

YouTube Music origin 자체를 모든 항목의 `music` 근거로 사용하는 것은 권장하지 않는다.

- 기존 조사에서 `/search`의 같은 row renderer에 곡, 영상과 episode가 혼재했다.
- 현재 adapter의 `playlist-track`, `queue-item`, `player-current`는 strict video ID는 보장하지만 semantic content type은 확인하지 않는다.
- YouTube Music은 음악 외 episode/podcast도 다룰 수 있으므로 product origin만으로 모든 재생 항목이 곡이라고 단정할 수 없다.
- `/browse/MPRE...`의 `album-track`과 아티스트 song 영역은 강한 music context지만, 현재 adapter는 row의 item-type field를 검증하지 않고 route와 watch link만 사용한다.

따라서 일관성을 위해 지원되는 YouTube Music row/queue/player도 이미 disclosure 확인에 사용하는 같은 `www.youtube.com` watch 응답의 category를 재사용하는 것이 안전하다. 추가 fetch는 필요하지 않는다. 향후 live DOM에서 YouTube가 제공하는 item type을 구조적으로 확인하고 fixture로 고정한다면 `album-track` 같은 좁은 surface를 별도 positive signal로 승격할 수 있다.

## 기존 fetch 경로 재사용 가능성

재사용 가능하다.

- 요청 URL, timeout, size limit, credential 제외, queue와 in-flight dedupe는 그대로 유지할 수 있다.
- 기존 HTML 응답에 두 initial JSON 객체가 함께 있으므로 network request를 추가할 필요가 없다.
- `watchPageHtml.ts`의 JSON object extraction을 일반화해 `ytInitialData`와 `ytInitialPlayerResponse`를 각각 읽을 수 있다.
- disclosure parsing 실패와 content-kind parsing 실패는 가능한 한 분리해야 한다. 한쪽 구조가 없어도 다른 쪽의 유효한 결과를 버리지 않는다.
- category는 `hl=en` 요청을 유지해 exact `Music` 비교의 locale 변동을 줄인다. 그래도 내부 web response field는 공개 API 계약이 아니므로 누락·변경 시 `unknown`이어야 한다.

## 예상 코드 변경 범위

구현 시 최소 변경 예상은 다음과 같다.

1. `src/adapters/youtube/watchPageHtml.ts`
   - `ytInitialPlayerResponse` marker와 parser 추가
   - request video ID와 player video ID/playability/category 검증
   - disclosure parse 결과와 `contentKind`를 독립적으로 반환
2. `src/shared/youtubeWatchDisclosure.ts`
   - lookup result에 `contentKind` 또는 별도 classification result 추가
3. `src/background/youtubeWatchDisclosureLookup.ts`
   - 동일 fetch 결과에서 disclosure와 content kind를 조합
4. `src/storage/youtubeDisclosureCache.ts`
   - enum 한 개를 저장하도록 cache schema 갱신
   - 기존 cache entry는 content kind를 `unknown`으로 읽거나 schema bump 후 cache miss 처리
5. filtering policy와 YouTube/YouTube Music controller
   - filter scope와 disclosure status를 서로 다른 축으로 평가
   - `Music only + unknown` fail-open 회귀 테스트
6. fixture/unit/E2E
   - 네 기본 비교군, category 누락·변형·video ID 불일치·player response malformed
   - disclosure confirmed/content unknown 조합
   - `Music` category의 broad-content 경계와 non-`Music` 음악 경계

사용자 설정을 실제로 추가하는 단계에서는 settings schema migration과 popup/options UI가 별도 작업으로 필요하다. 이번 조사에서는 변경하지 않는다.

## Privacy, permission과 network 영향

권장안은 새 privacy, permission 또는 network 영향을 만들지 않는다. 구현 시 로컬 cache schema에는 enum 한 개가 추가될 수 있다.

- 기존 video ID별 watch-page fetch 한 번을 재사용한다.
- 새 외부 API, YouTube Data API, 별도 서버, telemetry와 analytics를 사용하지 않는다.
- 새 host permission이나 민감 permission이 필요하지 않다.
- 쿠키와 Google 계정 정보는 계속 보내지 않는다.
- 원문 HTML을 저장하지 않는다.
- cache에 추가하더라도 `music | non-music | unknown` enum만 저장하며 제목, description, channel, category 원문을 보존할 필요가 없다.

## 구현 전 남은 불확실성

1. “Music only”가 YouTube의 broad `Music` category를 의미하는지, 곡·음악 공연만 의미하는지 제품 정의가 필요하다.
2. `Music → music`도 음악 교육·해설을 포함할 수 있다. 이 false positive를 허용할지 결정해야 한다.
3. non-`Music` category의 음악 공연을 `unknown`으로 두므로 Music only의 recall이 낮아질 수 있다.
4. 로그인 여부, locale, 지역, age/consent/challenge, live/Shorts와 YouTube A/B 실험에서 player response/category 가용성을 더 확인해야 한다.
5. `ytInitialPlayerResponse` assignment marker와 microformat 구조는 공개 web API 계약이 아니므로 fixture와 unknown fallback이 필요하다.
6. 현재 표본에서는 music 전용 renderer와 `musicVideoType`이 전혀 없었다. 다른 client에서 보이는 필드를 www watch HTML에도 있다고 가정하면 안 된다.
7. YouTube Music의 search/playlist/queue/player를 일괄 music context로 보지 않는다면 모든 surface에서 동일 category 판정을 연결해야 한다.
8. `non-music`을 실제로 생성해야 하는 제품 요구가 생기면 현재 제약 안에서는 추가 공식 신호를 더 찾아야 하며, category != Music만으로 채우면 안 된다.

## 권장 결정

첫 구현으로 진행하려면 다음을 명시적으로 수용하는 것이 좋다.

- `music`의 뜻은 “현재 공개 watch 응답에서 YouTube category가 정확히 `Music`인 콘텐츠”다.
- `non-music`은 첫 버전에서 생성하지 않는다.
- category가 다른 실제 음악 콘텐츠를 놓치는 것은 false positive 방지를 위한 의도된 fail-open이다.
- YouTube Music도 product origin만으로 우회하지 않고 같은 watch response category를 사용한다.
- 향후 더 강한 YouTube 구조화 신호가 확인되기 전까지 title/description/channel/thumbnail/오디오 기반 fallback을 추가하지 않는다.
