# 음악 판별 신호 후속 조사

- 조사일: 2026-09-26
- 저장소 기준: `a06398d` (`main`)
- 범위: Blue rain 공개 표본, 기존 `www.youtube.com` watch-page 응답, YouTube Music 공개 초기 데이터와 renderer 응답, 현재 adapter/fixture/locale 검토
- 제외: 기능 코드, 테스트, locale JSON, 설정 schema, manifest·permission, network 경로, package/version, release 문서 변경

## 결론 요약

이번 공개 표본에서는 “일부 Blue rain 영상의 category가 `Music`이 아니어서 Music only에서 빠진다”는 가설을 재현하지 못했다.

- 채널의 현재 Videos 응답에서 얻은 30개 video ID 모두 공개 비로그인 watch 응답에 `ytInitialPlayerResponse`가 있었고, `playabilityStatus.status === 'OK'`, `videoDetails.videoId === 요청 ID`, `category === 'Music'`이었다. 현재 parser의 `contentKind`는 전부 `music`이다.
- 같은 시점의 현재 parser는 7개에서 공식 disclosure evidence를 확인했고 23개에서는 확인하지 못했다. 따라서 현재 응답만으로 예상되는 필터 여부 차이는 category가 아니라 disclosure 가용성 차이다.
- 수동 Chrome에서 보였다는 disclosure와 비로그인 background fetch 응답의 차이는 로그인·client·지역·실험·반영 시점 차이 또는 12시간 `not-detected` cache로 설명될 수 있지만, 당시 video ID·watch 응답·cache entry가 없어 하나로 확정할 수 없다.
- 기존 `www.youtube.com` watch HTML에서는 `Music` category 외의 독립적인 strong music positive signal을 찾지 못했다. Blue rain 비교 표본에도 `musicVideoType`, music 전용 renderer, topic metadata, YouTube Music 연결 field가 없었다.
- YouTube Music 데이터에는 실제 구조화 enum이 있었다. 음악 표본에는 `MUSIC_VIDEO_TYPE_ATV`, `MUSIC_VIDEO_TYPE_OMV`, `MUSIC_VIDEO_TYPE_UGC`, podcast 표본에는 `MUSIC_VIDEO_TYPE_PODCAST_EPISODE`가 관찰됐다. 다만 이는 공개 계약이 아닌 web client 내부 field이고, 현재 adapter와 fixture는 이를 읽거나 고정하지 않는다.
- 제품 선택지는 **3. YouTube와 YouTube Music의 music 판정을 서로 다르게 처리**를 권장한다. 일반 YouTube는 category-only를 유지하고, YouTube Music은 이미 로드된 항목 데이터에서 video ID와 결합된 strong item type을 안전하게 읽을 수 있음이 live DOM에서 확인된 뒤에만 추가 positive signal을 사용한다. 새 요청으로 YouTube Music에 video ID를 조회하는 방식은 권장하지 않는다.

출시 전 현재 구현을 그대로 유지한다면 `Music only`의 설명은 실제 contract를 정확히 드러내도록 “YouTube가 Music 카테고리로 분류한 콘텐츠”로 좁혀야 한다. YouTube Music 전용 strong signal을 구현한 뒤에는 두 근거를 함께 설명해야 한다.

## 조사 방법과 한계

### YouTube watch 응답

현재 background lookup과 같은 URL과 privacy 경계를 사용했다.

```text
https://www.youtube.com/watch?v=VIDEO_ID&hl=en
credentials: omit
redirect: follow
referrer: none
```

공개 HTML을 실행하지 않고 `ytInitialData`와 `ytInitialPlayerResponse`의 balanced JSON object만 추출했다. 마지막 전수 확인은 저장소의 실제 `parseYouTubeWatchPageHtml`을 Vite SSR loader로 불러 실행했다. 제목·설명·채널명·썸네일·keyword는 표본을 찾는 데만 사용했고 music 판정 입력으로 사용하지 않았다.

### YouTube Music

공개 `music.youtube.com` HTML의 server bootstrap data와 같은 web client가 사용하는 공개 renderer 응답을 읽어 구조만 비교했다. 이 호출은 조사용이며 제품 runtime 제안이 아니다. 계정 cookie, API key의 저장, 별도 서버, telemetry는 사용하지 않았다.

연결된 Chrome/in-app browser가 이번 세션에 없어 signed-in live DOM의 element property는 직접 캡처하지 못했다. 따라서 “응답 JSON에 field가 존재한다”와 “현재 isolated-world adapter가 DOM에서 추가 network 없이 읽을 수 있다”를 구분한다. 후자는 구현 전 실제 Chrome 캡처가 필요하다.

관찰 결과는 2026-09-26의 snapshot이다. YouTube 내부 web field는 공개 API contract가 아니고 A/B 실험, locale, 지역, 로그인 상태와 응답 시점에 따라 달라질 수 있다.

## Blue rain 표본 조사

채널: [Blue rain Videos](https://www.youtube.com/@%EB%B8%94%EB%A3%A8%EB%A0%88%EC%9D%B8/videos)

### 현재 parser 기준 전수 결과

아래 30개 모두 다음 값이 같았다.

- `ytInitialData`: 있음
- `ytInitialPlayerResponse`: 있음
- `playabilityStatus.status`: `OK`
- `videoDetails.videoId`: 요청 ID와 일치
- `microformat.playerMicroformatRenderer.category`: `Music`
- 현재 parser `contentKind`: `music`

| video ID | 공식 disclosure evidence | 현재 정책의 예상 결과 |
|---|---|---|
| [`pktRxPLqveg`](https://www.youtube.com/watch?v=pktRxPLqveg) | 있음: badge + expanded description | 필터 |
| [`-voosUXaX_g`](https://www.youtube.com/watch?v=-voosUXaX_g) | 있음: badge + expanded description | 필터 |
| [`GsyuK2SQWm0`](https://www.youtube.com/watch?v=GsyuK2SQWm0) | 있음: badge + expanded description | 필터 |
| [`6W8gIGTsYig`](https://www.youtube.com/watch?v=6W8gIGTsYig) | 있음: badge + expanded description | 필터 |
| [`2NT0UoniiOA`](https://www.youtube.com/watch?v=2NT0UoniiOA) | 있음: badge + expanded description | 필터 |
| [`V7W69pgAVgo`](https://www.youtube.com/watch?v=V7W69pgAVgo) | 있음: badge + expanded description | 필터 |
| [`HDyH6iu3Gfg`](https://www.youtube.com/watch?v=HDyH6iu3Gfg) | 없음 | 필터하지 않음 |
| [`WDkWxzDKpeI`](https://www.youtube.com/watch?v=WDkWxzDKpeI) | 없음 | 필터하지 않음 |
| [`ux3kl7B4KGY`](https://www.youtube.com/watch?v=ux3kl7B4KGY) | 없음 | 필터하지 않음 |
| [`9bl8MUI31ik`](https://www.youtube.com/watch?v=9bl8MUI31ik) | 없음 | 필터하지 않음 |
| [`6dInb-4AKVc`](https://www.youtube.com/watch?v=6dInb-4AKVc) | 없음 | 필터하지 않음 |
| [`wlyboB7GC38`](https://www.youtube.com/watch?v=wlyboB7GC38) | 없음 | 필터하지 않음 |
| [`unT5ugRuow4`](https://www.youtube.com/watch?v=unT5ugRuow4) | 없음 | 필터하지 않음 |
| [`p-7BtiWpmoo`](https://www.youtube.com/watch?v=p-7BtiWpmoo) | 없음 | 필터하지 않음 |
| [`6EXAZ5l1GcE`](https://www.youtube.com/watch?v=6EXAZ5l1GcE) | 없음 | 필터하지 않음 |
| [`6KfOM7RDypI`](https://www.youtube.com/watch?v=6KfOM7RDypI) | 없음 | 필터하지 않음 |
| [`uTRAUJ983y8`](https://www.youtube.com/watch?v=uTRAUJ983y8) | 없음 | 필터하지 않음 |
| [`HDjE_WSjt8s`](https://www.youtube.com/watch?v=HDjE_WSjt8s) | 없음 | 필터하지 않음 |
| [`8lUrEIQJqzw`](https://www.youtube.com/watch?v=8lUrEIQJqzw) | 없음 | 필터하지 않음 |
| [`duG4jWjjuyU`](https://www.youtube.com/watch?v=duG4jWjjuyU) | 없음 | 필터하지 않음 |
| [`HgghXZT2Gn4`](https://www.youtube.com/watch?v=HgghXZT2Gn4) | 없음 | 필터하지 않음 |
| [`b7-kpSwkSMw`](https://www.youtube.com/watch?v=b7-kpSwkSMw) | 없음 | 필터하지 않음 |
| [`MhHjku2qaHg`](https://www.youtube.com/watch?v=MhHjku2qaHg) | 없음 | 필터하지 않음 |
| [`-ZFUeEMlytI`](https://www.youtube.com/watch?v=-ZFUeEMlytI) | 없음 | 필터하지 않음 |
| [`D-g7G6IRAXw`](https://www.youtube.com/watch?v=D-g7G6IRAXw) | 없음 | 필터하지 않음 |
| [`HMwd__dSSRs`](https://www.youtube.com/watch?v=HMwd__dSSRs) | 있음: badge + expanded description | 필터 |
| [`Hm-6mdzBdls`](https://www.youtube.com/watch?v=Hm-6mdzBdls) | 없음 | 필터하지 않음 |
| [`5PYgw08y-vI`](https://www.youtube.com/watch?v=5PYgw08y-vI) | 없음 | 필터하지 않음 |
| [`FeMBhPyDV3o`](https://www.youtube.com/watch?v=FeMBhPyDV3o) | 없음 | 필터하지 않음 |
| [`W8qNwesfBEM`](https://www.youtube.com/watch?v=W8qNwesfBEM) | 없음 | 필터하지 않음 |

`9bl8MUI31ik`와 `5PYgw08y-vI`는 한 전수 실행에서 `watch-page-structure-missing`에 해당하는 일시적 `unknown`이 나왔지만, 즉시 재조회에서는 `parsed`였다. 두 경우 모두 `contentKind`는 `music`이고 disclosure evidence는 없었다. 이는 내부 HTML 구조가 요청 사이에도 달라질 수 있음을 보여주며, unknown fallback을 유지해야 하는 근거다.

### 최소 직접 비교

| 구분 | video ID | disclosure | player | status | player video ID | category | contentKind |
|---|---|---:|---:|---|---|---|---|
| 현재 예상 필터 | `pktRxPLqveg` | 있음 | 있음 | `OK` | 일치 | `Music` | `music` |
| 현재 예상 미필터 | `HDyH6iu3Gfg` | 없음 | 있음 | `OK` | 일치 | `Music` | `music` |
| 현재 예상 미필터 | `WDkWxzDKpeI` | 없음 | 있음 | `OK` | 일치 | `Music` | `music` |
| 현재 예상 미필터 | `ux3kl7B4KGY` | 없음 | 있음 | `OK` | 일치 | `Music` | `music` |

### 왜 일부만 필터되는가

현재 정책은 Music only에서 다음 두 조건을 모두 요구한다.

1. `contentKind === 'music'`
2. `disclosureStatus === 'confirmed'`이며 confirmed evidence가 실제로 있음

이번 표본은 1번이 모두 참이므로 category 차이는 필터 여부를 나누지 않는다. 차이는 2번이다. 공개 background-equivalent 응답에 badge와 `howThisWasMadeSectionViewModel`이 있는 항목만 필터되고, 없는 항목은 `not-detected`로 fail-open한다.

수동 watch UI에서 같은 미필터 항목의 disclosure를 봤다면 가능한 차이는 다음과 같다.

- signed-in watch UI와 `credentials: 'omit'` background fetch가 서로 다른 initial data를 받음
- SPA navigation 뒤 추가된 DOM과 최초 public HTML이 다름
- region·locale·client 또는 A/B 실험 차이
- disclosure가 추가·변경되기 전에 저장된 `not-detected` 결과가 12시간 cache TTL 동안 재사용됨
- 당시와 현재 사이에 category 또는 disclosure metadata가 변경됨. YouTube는 업로드 뒤 category 수정이 가능하다고 문서화한다.

현재 데이터로는 이 후보를 더 좁힐 수 없다. 당시 실패한 exact video ID, popup/console lookup 결과의 `source`, `checkedAt`, `contentKind`, `status`, 그리고 같은 시점의 익명 watch HTML이 있어야 확정할 수 있다. 특히 “confirmed + unknown”이었다면 category 문제가 맞고, “not-detected + music”이었다면 disclosure 응답·cache 문제다.

## 기존 watch page의 추가 music positive signal

Blue rain의 필터 1개와 미필터 3개를 포함한 비교에서 다음을 확인했다.

| 후보 field 또는 구조 | 실제 관찰 | 결론 |
|---|---|---|
| `playerMicroformatRenderer.category` | 네 표본 모두 `Music` | 현재 유일한 watch-page positive signal. 독립 검증값은 아님 |
| HTML `meta[itemprop="genre"]` | 네 표본 모두 `Music` | category의 중복 표현이며 두 번째 근거가 아님 |
| `videoDetails.musicVideoType` | 네 표본 모두 없음 | `www.youtube.com` watch HTML에서 사용할 수 없음 |
| `structuredDescriptionContentRenderer` | 네 표본 모두 있음 | disclosure·channel·info card를 담는 generic container. music 의미 없음 |
| `videoDescriptionMusicSectionRenderer` | 없음 | 사용할 수 없음 |
| `musicCarouselShelfRenderer` | 없음 | 사용할 수 없음 |
| `richMetadataRenderer` / `metadataRowRenderer` | 없음 | 사용할 수 없음 |
| `topicDetails` 또는 topic metadata | 없음 | 사용할 수 없음 |
| canonical URL | watch URL만 있음 | identity 중복 확인일 뿐 music 의미 없음 |
| `pageType` / item type | 없음 | 사용할 수 없음 |
| `music.youtube.com` endpoint·URL | 없음 | YouTube Music 연결을 positive signal로 사용할 수 없음 |
| `isLiveContent`, `isTvfilmVideo` | 일반 boolean | music 의미 없음 |

따라서 기존 한 번의 `www.youtube.com` fetch만 유지하는 한 후보 B는 일반 YouTube에서 후보 A와 동일하다. 제목·설명·채널명·thumbnail·keyword를 OR 조건으로 넣는 것은 금지하며, category가 아닌 값을 보지 못했을 때는 `unknown`을 유지한다.

## YouTube Music 구조화 item type

### 실제로 관찰한 field

공개 YouTube Music web client 데이터에서 다음 값이 실제로 존재했다.

| 표본 종류 | 구조화 field | 관찰값 |
|---|---|---|
| album track | `videoDetails.musicVideoType` | `MUSIC_VIDEO_TYPE_ATV` |
| official music video | `videoDetails.musicVideoType` | `MUSIC_VIDEO_TYPE_OMV` |
| Blue rain 항목 | `videoDetails.musicVideoType` | `MUSIC_VIDEO_TYPE_UGC` |
| podcast queue/search item | `watchEndpointMusicConfig.musicVideoType` | `MUSIC_VIDEO_TYPE_PODCAST_EPISODE` |
| 기존 비음악 비교군 | `videoDetails.musicVideoType` | 없음 |

queue의 `playlistPanelVideoRenderer.navigationEndpoint.watchEndpoint.watchEndpointMusicSupportedConfigs.watchEndpointMusicConfig.musicVideoType`에서도 현재 항목과 video ID가 함께 있었다. 같은 위치에서 music video는 `OMV` 또는 `UGC`, podcast는 `PODCAST_EPISODE`로 구분됐다.

`pageType`도 다음과 같이 실제로 관찰했다.

- `MUSIC_PAGE_TYPE_ALBUM`
- `MUSIC_PAGE_TYPE_ARTIST`
- `MUSIC_PAGE_TYPE_PLAYLIST`
- `MUSIC_PAGE_TYPE_USER_CHANNEL`
- `MUSIC_PAGE_TYPE_PODCAST_SHOW_DETAIL_PAGE`
- `MUSIC_PAGE_TYPE_NON_MUSIC_AUDIO_TRACK_PAGE`

이 enum 이름은 title이나 label을 추측한 값이 아니라 응답에 있는 구조화 field다. 다만 Google이 공개적으로 안정성을 보장한 API는 아니다.

### surface별 신뢰도

| surface | 관찰 | music positive로서의 평가 |
|---|---|---|
| album track (`/browse/MPRE...`) | album 응답 row에 video ID가 있으나 row별 `musicVideoType`은 없었음 | album pageType과 route가 함께 확인되면 강함. route regex만으로는 내부 계약 의존 |
| artist song | artist browse row에 video ID가 있으나 row별 type이 없을 수 있음 | `MUSIC_PAGE_TYPE_ARTIST`와 song section을 함께 확인해야 함. 현재 `/channel/UC...` route만으로는 user channel과 구분 불가 |
| generic playlist | 한 실제 playlist 응답에 일반 row와 `PODCAST_EPISODE`가 함께 있었음 | playlist surface만으로 music 판정 금지 |
| search | 같은 `musicResponsiveListItemRenderer`에 playlist, profile, podcast, album, artist가 혼재 | renderer 이름이나 YTM origin만으로 music 판정 금지. item별 enum이 필요 |
| queue | current item의 video ID와 `musicVideoType`이 같은 renderer에 있었음 | item type을 안전하게 bridge할 수 있으면 가장 실용적인 strong signal |
| player | YTM player response의 `videoDetails.musicVideoType`에서 ATV/OMV/UGC를 관찰 | strong 후보지만 현재 DOM 접근 경로는 미검증. 별도 player request를 추가해서 얻는 방식은 금지 |

YouTube 공식 도움말도 YouTube Music이 음악만이 아니라 podcast와 episode를 제공한다고 설명한다. 따라서 “YTM에 나타난다” 또는 “YTM 검색 결과다” 자체는 music positive signal이 아니다.

### 현재 adapter와 fixture의 간극

현재 adapter는 다음만 읽는다.

- row의 `.title a[href]`와 fallback `a[href]`에서 strict video ID
- route를 기반으로 한 `search-result | album-track | playlist-track | artist-song`
- queue main-world bridge의 `element.data.videoId`
- player bar anchor 또는 현재 `/watch?v=` URL

현재 `tests/fixtures/youtube-music/*.html`은 renderer tag, link와 synthetic video ID만 보존하고 `musicVideoType`, `pageType` 또는 semantic item type을 담지 않는다. 따라서 지금은 새 규칙을 회귀 테스트할 fixture 근거가 없다.

추가 network 없이 사용하려면 이미 로드된 renderer/player data에서 video ID와 item type을 한 원자적 snapshot으로 읽고, isolated world에는 allowlisted enum만 전달해야 한다. queue bridge가 `element.data.videoId`를 읽는 패턴은 재사용 가능성이 있지만 nested type의 실제 element property 경로, search/album/artist/player별 존재 여부는 connected Chrome에서 먼저 확인해야 한다. field가 누락되거나 video ID가 불일치하면 `unknown`이어야 한다.

## 후보 판정 규칙 비교

### A. `category === 'Music'`

| 항목 | 평가 |
|---|---|
| false positive | 중간. 음악 교육·해설도 `Music`일 수 있음 |
| false negative | 중간~높음. 음악 공연이 다른 category일 수 있음 |
| 추가 network | 없음. 기존 watch fetch 재사용 |
| permission | 영향 없음 |
| DOM 안정성 | DOM 비의존. 비공개 HTML field 안정성은 중간 |
| No guessing | 적합. exact structured positive만 사용하고 나머지는 unknown |
| 테스트 가능성 | 높음. 현재 fixture/unit test 존재 |
| 유지보수 | 낮음 |

### B. category 또는 추가 strong music signal

여기서 strong signal은 title류가 아니라 video ID와 결합된 allowlisted `musicVideoType`만 뜻한다.

| 항목 | 평가 |
|---|---|
| false positive | ATV/OMV는 낮아 보임. UGC의 의미 범위는 추가 검증 필요 |
| false negative | YTM에서는 감소 가능. 일반 YouTube는 새 signal이 없어 A와 같음 |
| 추가 network | 기존 YTM app state를 읽으면 없음. 일반 YouTube에서 YTM player endpoint를 호출하면 추가 network가 생기므로 비권장 |
| permission | state 재사용은 영향 없음. endpoint 추가 호출도 현재 host 범위일 수 있으나 privacy/network contract가 바뀜 |
| DOM 안정성 | 내부 renderer/property에 의존해 중간 이하 |
| No guessing | enum allowlist + ID 일치 + unknown fallback이면 적합 |
| 테스트 가능성 | 현재 fixture로는 부족. live capture와 sanitized fixture 필요 |
| 유지보수 | 중간~높음 |

### C. YouTube Music의 특정 surface만 music, 일반 YouTube는 category

| 항목 | 평가 |
|---|---|
| false positive | album은 낮지만 search·playlist·queue·player blanket rule은 높음. podcast가 실제로 혼재 |
| false negative | 인정 surface 밖의 실제 음악을 놓침 |
| 추가 network | 없음 |
| permission | 영향 없음 |
| DOM 안정성 | route는 중간, section 의미까지 쓰면 중간 이하 |
| No guessing | MPRE album처럼 좁은 surface는 적합. origin/renderer blanket rule은 부적합 |
| 테스트 가능성 | route는 높음, semantic section은 fixture 추가 필요 |
| 유지보수 | 중간 |

### D. surface + structured item type + category 조합

권장 contract는 OR을 무제한 늘리는 것이 아니라 source별 allowlist를 분리하는 방식이다.

```text
YouTube:
  validated watch response AND category == Music

YouTube Music:
  위 category rule
  OR supported surface AND same-video structured music type in allowlist

unknown or mismatched item:
  unknown
```

| 항목 | 평가 |
|---|---|
| false positive | 네 후보 중 가장 낮게 제어 가능. podcast enum과 user-channel pageType을 제외 가능 |
| false negative | A보다 낮아질 수 있으나 item type이 없는 album/artist row는 계속 category fallback |
| 추가 network | 이미 로드된 YTM data만 사용하면 없음. 새 검색/player 요청은 금지 |
| permission | 영향 없음 |
| DOM 안정성 | 중간 이하. 비공개 enum과 main-world bridge 경로를 fixture로 고정해야 함 |
| No guessing | 가장 적합. exact enum·surface·video ID 결합과 fail-open을 유지 |
| 테스트 가능성 | live DOM capture 뒤에는 높음. 현재는 증거와 fixture가 부족 |
| 유지보수 | 중간~높음. surface별 adapter 경계에 격리 필요 |

## 제품 권장안

**3. YouTube와 YouTube Music의 music 판정을 서로 다르게 처리**를 권장한다. 구체적으로는 후보 D를 단계적으로 적용한다.

1. 일반 YouTube는 `category === 'Music' ? 'music' : 'unknown'`을 유지한다. 이번 Blue rain snapshot에서 이를 대체할 watch-page strong signal은 없었다.
2. YouTube Music은 origin이나 route만으로 music으로 만들지 않는다.
3. 이미 로드된 item data에서 같은 video ID에 결합된 `musicVideoType`을 확인할 수 있는 surface만 추가 positive로 승격한다.
4. 첫 allowlist 후보는 ATV/OMV다. UGC는 Blue rain에서 필요한 값이지만 의미 범위가 넓을 수 있으므로 music/non-music 경계 표본을 더 모은 뒤 채택한다.
5. `MUSIC_VIDEO_TYPE_PODCAST_EPISODE`, podcast pageType, user-channel pageType은 music positive가 아니다. 이를 곧바로 `non-music`으로 저장할 필요도 없고, 계약이 불명확하면 `unknown`을 유지한다.
6. album/artist는 pageType과 현재 section까지 같은 renderer data에서 확인할 수 있을 때만 surface positive를 검토한다. generic playlist/search/queue/player는 surface만으로 인정하지 않는다.

이 권장안은 Blue rain의 일반 YouTube channel card 문제를 자동으로 해결하지 않는다. 그 surface에는 새 strong signal이 없기 때문이다. 해당 증상을 다시 재현하면 먼저 lookup의 disclosure status와 cache source를 캡처해야 하며, recall을 이유로 title·description·channel 휴리스틱을 추가해서는 안 된다.

### trade-off

- false positive를 낮게 유지하는 대신 일반 YouTube의 non-`Music` 음악은 계속 놓친다.
- YouTube Music에서는 구조화 item type이 있는 경우 recall을 높일 수 있지만, 내부 field 변경 시 unknown으로 후퇴해야 한다.
- `UGC`까지 strong positive로 넣으면 Blue rain 같은 user-uploaded music recall은 올라가지만, YTM이 허용하는 UGC 범위를 충분히 검증하지 않으면 false positive 위험이 커진다.
- “Music only”를 “실제 음악을 모두 찾는 기능”으로 약속해서는 안 된다. 구조화 positive가 있는 항목만 다루는 precision-first 기능이다.

### privacy, permission, network

권장안은 다음 조건을 지킬 때 영향이 없다.

- 기존 `www.youtube.com` watch fetch 외 요청을 추가하지 않음
- YTM이 이미 로드한 renderer/player state만 읽음
- 새 host permission·민감 permission을 추가하지 않음
- 계정 cookie, 검색 query, 시청·청취 기록, title·description을 저장하거나 전송하지 않음
- 로컬 cache에는 기존 video ID와 판정 enum만 유지

반대로 일반 YouTube video ID를 `music.youtube.com/youtubei/v1/player` 또는 검색 endpoint로 별도 조회하는 설계는 새 network path와 privacy review를 만들며 권장하지 않는다. “YTM에서 검색해 본다”는 판정 방식도 사용하지 않는다.

## UI 문구 검토

### 일반화가 필요한 locale key

All AI-labeled content에서는 동일 video ID rule이 일반 영상·episode에도 적용될 수 있으므로 사용자 문구는 `곡/track`보다 `콘텐츠/content`가 정확하다. 내부 type, 함수, storage key의 `track` 이름은 바꿀 필요가 없다.

| locale key | 권장 KO | 권장 EN |
|---|---|---|
| `allowThisTrack` | 이 콘텐츠 허용 | Allow this content |
| `addTrackAllowlist` | 콘텐츠 허용 | Allow content |
| `allowedTrackCount` | 허용된 콘텐츠 $COUNT$개 | Allowed content: $COUNT$ |
| `allowedTracksHeading` | 허용된 콘텐츠 | Allowed content |
| `allowlistDescription` | 허용한 콘텐츠와 아티스트는 YouTube 공식 AI 표시가 확인되어도 필터링하거나 건너뛰지 않습니다. 사용자가 추가한 ID만 저장합니다. | Allowed content and artists are not filtered or skipped, even when an official YouTube AI disclosure is confirmed. IDs are stored only when you add them. |
| `addTrackBlocklist` | 콘텐츠 차단 | Block content |
| `blockedTrackCount` | 차단된 콘텐츠 $COUNT$개 | Blocked content: $COUNT$ |
| `blockedTracksHeading` | 차단된 콘텐츠 | Blocked content |
| `directBlockTrackReason` | NoAI · 직접 차단한 콘텐츠 | NoAI · Directly blocked content |
| `trackAllowlistInputLabel` | YouTube video ID 또는 watch URL | YouTube video ID or watch URL |
| `trackBlocklistInputLabel` | YouTube video ID 또는 watch URL | YouTube video ID or watch URL |
| `youtubeMusicAutoSkipDescription` | 재생 중 정책에 해당하는 콘텐츠를 다음 항목으로 넘깁니다. | Skip matching content during playback. |

`extDescription`도 현재 “음악 콘텐츠”만 필터링한다고 말해 All scope와 완전히 일치하지 않는다. 제품명은 유지하더라도 설명은 다음처럼 일반화하는 편이 정확하다.

| locale key | 권장 KO | 권장 EN |
|---|---|---|
| `extDescription` | YouTube와 YouTube Music에서 공식 AI·변경 표시가 있는 콘텐츠를 필터링합니다. | Filter officially labeled AI or altered content on YouTube and YouTube Music. |

### Music only 설명

현재 category-only 구현을 유지한다면 기존 문구의 “음악으로 확인된 / confirmed as music”은 실제 보장보다 넓다. 다음 문구가 정확하다.

| locale key | 권장 KO | 권장 EN |
|---|---|---|
| `filterScopeMusicDescription` | YouTube가 Music 카테고리로 분류한 콘텐츠에만 AI 표시 필터를 적용합니다. | Apply AI-label filtering only to content categorized as Music by YouTube. |

YouTube Music 전용 strong signal까지 구현한 뒤에는 다음처럼 바꿀 수 있다.

- KO: `YouTube가 Music 카테고리로 분류했거나 YouTube Music의 구조화된 음악 항목으로 확인한 콘텐츠에만 AI 표시 필터를 적용합니다.`
- EN: `Apply AI-label filtering only to content categorized as Music by YouTube or identified as a structured music item by YouTube Music.`

후자도 실제 allowlist와 surface가 확정되기 전에는 사용하지 않는다.

## 구현 전 남은 불확실성

1. 수동 테스트에서 실패한 exact Blue rain ID와 그 시점의 cache/lookup 결과가 없어 과거 증상의 최초 원인을 확정하지 못했다.
2. signed-in Chrome DOM에는 있지만 익명 최초 HTML에는 없는 disclosure가 있는지 같은 시점 비교가 필요하다.
3. `MUSIC_VIDEO_TYPE_UGC`가 YTM에서 어느 범위까지 부여되는지 더 많은 음악·비음악·spoken-word 경계 표본이 필요하다.
4. row, queue와 player custom element의 live `data` property에 item type이 유지되는지, isolated world에서 직접 읽을 수 있는지, main-world bridge가 필요한지 확인해야 한다.
5. album/artist row는 per-item type이 없을 수 있다. pageType과 section이 video ID에 안전하게 결합되는지 확인해야 한다.
6. private enum이나 renderer path가 바뀌었을 때 기존 category fallback과 unknown이 회귀 없이 유지되는 테스트가 필요하다.
7. locale 문구 변경 시 popup/options와 YouTube/YouTube Music card·queue·player의 실제 문맥을 함께 화면 검증해야 한다.

## 참고

- 기존 조사: [YouTube 음악 콘텐츠 판별 조사](youtube-music-content-classification.md)
- 현재 YTM identity 경계: [YouTube Music 재생 항목 identity 추출](youtube-music-identity.md)
- [YouTube Data API video resource](https://developers.google.com/youtube/v3/docs/videos)
- [YouTube upload default settings](https://support.google.com/youtube/answer/2660027?hl=en)
- [YouTube Music에서 음악과 podcast 찾기](https://support.google.com/youtube/answer/13401025?hl=en)
- [YouTube podcast 구조 설명](https://support.google.com/youtube/answer/12751636?hl=en-GB)
