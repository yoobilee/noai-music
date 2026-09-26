# YouTube 카드 필터 지연 조사

- 조사일: 2026-09-26
- 저장소 기준: `fd94690` (`main`, NoAI 1.1.0 RC)
- 대상: YouTube 카드 discovery부터 watch-page 판정과 DOM filter 적용까지
- 범위: 측정·원인 분석·후속 후보 비교만 수행. production 코드와 설정은 변경하지 않음

## 결론

관찰된 순차 필터링의 주원인은 **cold cache에서 video ID마다 필요한 watch-page fetch를 동시 2개 FIFO로 제한한 결과 누적되는 queue wait**다.

- Blue rain 공개 watch 표본 10개의 실제 fetch는 p50 `736.1 ms`, p90 `914.8 ms`, 최악 `919.4 ms`였다.
- 같은 실행에서 parse는 p50 `8.2 ms`, p90 `17.6 ms`, 최악 `19.8 ms`였다.
- concurrency 2에서 10번째 요청의 queue wait는 `3,222.6 ms`, 10개 전체 fetch+parse 완료는 `3,966.0 ms`였다.
- bundled Chromium의 실제 확장 synthetic workload는 250 ms 응답 10개를 cold cache에서 첫 필터 `337 ms`, 첫 6개 `883 ms`, 10개 전체 `1,416 ms`에 적용했다. warm cache에서는 10개 전체가 `33 ms` 안에 적용됐다.
- 응답 완료 뒤 parse, 직렬 cache write, message 반환과 DOM 적용을 모두 합친 tail은 synthetic 표본에서 p50 `9 ms`, p90 `12 ms`, 최악 `43 ms`였다. storage와 DOM 적용은 이번 표본의 주 병목이 아니다.
- 동일 video ID 카드 2개는 watch 요청 1회만 사용하고 같은 millisecond에 함께 갱신됐다.
- 24개 unique ID를 한 번에 발견한 synthetic burst에서는 active 2 + pending 20만 받아들여 22개만 요청·필터했다. 나머지 2개는 `queue-full` unknown이 되었고 같은 route의 mutation 재평가로 자동 재시도되지 않았다.

첫 카드가 약 1초 안에 처리되고, visible 10개도 실제 공개 fetch 표본에서 약 4초 안에 판정됐으며, warm cache는 33 ms였다. correctness 회귀나 timeout·retry 폭증도 관찰되지 않았다. 연결된 실제 Chrome에서 Blue rain channel DOM 순서와 viewport를 측정하지 못했으므로 **1.1.0은 현재 설정으로 출시하고 성능 개선은 후속 버전에서 별도 검증**하는 것을 권장한다.

후속 우선순위는 (1) 실제 Chrome에서 viewport/DOM 순서 캡처, (2) visible-first initial scheduling, (3) 필요하면 concurrency 2→3 검증, (4) queue-full 항목의 제한된 재스케줄링이다. concurrency 4나 provisional hide는 현재 근거로 권장하지 않는다.

## 측정 환경과 한계

### 라이브 공개 fetch

- Windows 개발 환경의 Node/Vitest에서 production `fetchYouTubeWatchPage`, `parseYouTubeWatchPageHtml`, `detectYouTubeOfficialDisclosure`, `createRequestQueue(2, 20)`을 그대로 호출했다.
- URL은 runtime과 같은 `https://www.youtube.com/watch?v=VIDEO_ID&hl=en`, `credentials: 'omit'`, `referrerPolicy: 'no-referrer'`였다.
- Blue rain 후속 조사에 기록된 공개 video ID 중 앞 10개를 사용했다. 제목·설명·채널명은 수집하거나 기록하지 않았다.
- 각 ID는 한 번만 요청했다. concurrency 3/4 비교는 같은 실제 fetch duration을 FIFO slot에 재배치한 계산이다. 반복 live 요청으로 YouTube 부하를 늘리지 않았다.

### bundled Chromium synthetic workload

- production build를 Chromium MV3 persistent context에 로드했다.
- 실제 content script, background service worker, runtime messaging, `storage.local` cache, HTML parser와 DOM filter를 모두 통과했다.
- 10개 unique ID와 첫 ID의 중복 카드 1개를 동시에 DOM에 제공했다.
- watch 응답은 identity가 요청 ID와 일치하는 sanitized disclosed fixture이며 각각 250 ms 지연했다.
- cold cache 뒤 같은 페이지를 다시 로드해 warm cache를 측정했다.
- 별도 24-ID burst에는 400 ms 응답을 사용해 queue capacity와 재시도를 검사했다.

### 확인하지 못한 것

연결된 Chrome 세션을 사용할 수 없어 signed-in Blue rain channel의 실제 DOM discovery 시각, 현재 viewport 카드 집합, visual order와 DOM order의 일치 여부는 측정하지 못했다. 따라서 결과를 다음처럼 분리한다.

1. 실제 공개 network/parser timing: Blue rain 10개
2. 실제 확장 pipeline의 discovery/filter/cache/dedupe: sanitized synthetic cards
3. concurrency 3/4: 실제 latency 표본을 사용한 FIFO 예상값

임시 probe는 결과 수집 뒤 삭제했다. production bundle에 logger, telemetry 또는 debug code를 남기지 않았고 외부 서버로 데이터를 전송하지 않았다.

첫 synthetic 실행은 요청 ID와 disclosed fixture 내부 player video ID가 달라 0개가 필터됐다. 이는 parser의 identity mismatch fail-closed 동작이며 latency 표본으로 사용하지 않았다. fixture의 구조화 video ID를 각 요청 ID와 일치시킨 뒤 전체 probe를 다시 실행했고, 이 문서에는 수정 후 결과만 기록했다.

## 현재 lookup pipeline

### 1. DOM discovery와 identity

1. [`youtube.content.ts`](../src/entrypoints/youtube.content.ts)의 content script는 `document_idle`에 실행된다.
2. settings, allowlist와 blocklist를 `Promise.all`로 읽은 뒤 `processRoots([document])`를 처음 호출한다.
3. [`createYouTubeAdapter`](../src/adapters/youtube/index.ts)의 `collectCandidates`가 `YOUTUBE_SELECTORS.videoUnit`을 `querySelectorAll`로 찾는다.
4. `collectCandidateElements`는 outermost candidate만 `Set`에 넣고 광고 ancestor를 제외한다. 반환 순서는 DOM document order다.
5. `createCandidate`와 `getVideoId`는 `a#video-title`, `a#thumbnail`, 그 밖의 anchor 순서로 strict 11자리 watch video ID를 읽는다. 한 priority selector에서 서로 다른 ID가 둘 이상이면 candidate를 만들지 않는다.

`observePage`는 `MutationObserver`로 `aria-label`, `href`, child 추가·삭제를 관찰하고 한 animation frame 동안 changed root를 `Set`에 모은 뒤 `processRoots`에 전달한다. 별도 viewport 검사나 priority는 없다.

### 2. content-side policy와 dedupe

`processRoots`는 candidate를 `Map<Element, DomMediaCandidate>`에 DOM 발견 순서로 넣고 순차 순회한다.

1. allowlist면 즉시 filter를 제거한다.
2. direct block이면 watch lookup 없이 즉시 filter한다.
3. 카드 DOM 자체에서 official disclosure를 찾았고 scope가 `all`이면 즉시 filter한다.
4. 그 외에는 `lookupCard`가 `requestWatchDisclosure`를 호출한다.

`lookupCard`의 상태 경계는 다음과 같다.

- `expectedLookupKeys: WeakMap<Element, string>`: 같은 element/route/video lookup을 반복 시작하지 않는다.
- `candidateResults`: 완료 결과를 같은 element 재평가에 재사용한다.
- `routeLookups: Map<videoId, Promise>`: 같은 route에서 동일 ID 카드가 여러 개면 하나의 Promise를 공유한다.
- lookup 시작 때 `unknown-or-error`를 `renderResult`에 전달하지만 policy 결과는 `none`이므로 provisional visual state는 표시하지 않는다.
- route가 바뀌면 WeakMap과 route Map을 교체하고, 늦은 응답은 `lookupKey`와 `isConnected` 검사로 새 카드에 적용하지 않는다.

### 3. background cache, queue와 fetch

[`background.ts`](../src/entrypoints/background.ts)는 sender를 검증한 뒤 하나의 `createYouTubeWatchDisclosureLookupService`에 요청을 보낸다.

[`youtubeWatchDisclosureLookup.ts`](../src/background/youtubeWatchDisclosureLookup.ts)의 실제 상수는 다음과 같다.

| 설정 | 최신 main 값 |
|---|---:|
| `WATCH_PAGE_REQUEST_CONCURRENCY` | 2 |
| `WATCH_PAGE_REQUEST_QUEUE_CAPACITY` | 20 pending tasks |
| active + pending 최대 수 | 22 |
| `WATCH_PAGE_FETCH_TIMEOUT_MS` | 8,000 ms |
| response size limit | 5,000,000 bytes |

service의 `inFlight: Map<videoId, Promise>`는 content script, 탭과 route를 넘어 같은 service worker 실행 중인 동일 ID를 다시 dedupe한다.

lookup 순서는 다음과 같다.

1. strict video ID 검증
2. background `inFlight` 확인
3. `cache.get(videoId)`
4. miss이면 `lookupAfterCacheMiss`
5. FIFO `RequestQueue.run`
6. slot이 나면 `fetchYouTubeWatchPage`
7. `fetch`와 response body read
8. `parseYouTubeWatchPageHtml`
9. `detectYouTubeOfficialDisclosure`
10. `cache.set(result)` 완료 대기
11. content script에 result 반환

queue는 active가 2이고 pending이 이미 20이면 `RequestQueueFullError`를 즉시 반환한다. 이 결과는 `queue-full` unknown이지만 `lookupAfterCacheMiss`가 일찍 return하므로 cache에는 쓰지 않는다.

### 4. parse, cache write와 DOM 적용

parser는 요청 ID와 player ID, watch 구조, disclosure renderer와 category를 검사한다. Music 판정은 유효한 player response의 category가 정확히 `Music`일 때만 `music`이다.

[`youtubeDisclosureCache.ts`](../src/storage/youtubeDisclosureCache.ts)는 `youtubeDisclosureCacheV1` 단일 객체를 사용한다.

- `get`은 unique ID마다 `storage.local.get`으로 전체 cache 객체를 읽는다. batch read나 memory mirror는 없다.
- `set`은 `mutationChain`으로 직렬화한다. 각 result마다 다시 전체 cache를 읽고, live entries를 정렬·최대 500개로 제한한 뒤 전체 객체를 쓴다.
- service는 `cache.set` 완료 뒤 결과를 반환하므로 write latency가 lookup total에 포함된다.

content script의 Promise callback은 element/key 유효성을 확인하고 `candidateResults`에 저장한 뒤 `renderResult`를 호출한다. `decideYouTubeCardFilter`가 최종 decision을 만들고 `applyYouTubeCardFilter`가 attribute, blur/hide 또는 badge를 동기적으로 적용한다.

## 실제 Blue rain 공개 fetch 결과

시각은 각 probe 시작을 0으로 한 상대값이다. 이 측정에는 실제 channel DOM discovery와 DOM filter 적용이 포함되지 않는다.

| video ID | enqueue (ms) | queue wait (ms) | fetch (ms) | parse (ms) | lookup total (ms) | status | contentKind |
|---|---:|---:|---:|---:|---:|---|---|
| `pktRxPLqveg` | 0.0 | 0.1 | 914.8 | 14.8 | 929.8 | confirmed | music |
| `-voosUXaX_g` | 38.4 | 0.0 | 919.4 | 19.8 | 939.2 | confirmed | music |
| `GsyuK2SQWm0` | 39.6 | 890.3 | 565.2 | 17.6 | 1,473.1 | confirmed | music |
| `6W8gIGTsYig` | 39.6 | 938.1 | 827.3 | 8.3 | 1,773.7 | confirmed | music |
| `2NT0UoniiOA` | 39.6 | 1,473.1 | 677.1 | 7.8 | 2,158.1 | confirmed | music |
| `V7W69pgAVgo` | 39.6 | 1,773.8 | 764.2 | 8.2 | 2,546.3 | confirmed | music |
| `HDyH6iu3Gfg` | 39.6 | 2,158.1 | 787.2 | 6.8 | 2,952.1 | not-detected | music |
| `WDkWxzDKpeI` | 39.6 | 2,546.3 | 667.7 | 8.6 | 3,222.6 | not-detected | music |
| `ux3kl7B4KGY` | 39.6 | 2,952.1 | 669.0 | 7.1 | 3,628.2 | not-detected | music |
| `9bl8MUI31ik` | 39.6 | 3,222.6 | 736.1 | 7.2 | 3,966.0 | not-detected | music |

| 지표 | p50 | p90 | worst |
|---|---:|---:|---:|
| fetch | 736.1 ms | 914.8 ms | 919.4 ms |
| parse | 8.2 ms | 17.6 ms | 19.8 ms |
| queue wait | 1,473.1 ms | 2,952.1 ms | 3,222.6 ms |

timeout, retry, HTTP 오류와 invalid HTML은 이 실행에서 없었다. 10개 중 앞 6개는 confirmed, 뒤 4개는 not-detected였으며 10개 모두 `contentKind: music`이었다.

### cold 화면 milestone

| 범위 | Blue rain live fetch+parse | synthetic 전체 pipeline |
|---|---:|---:|
| 첫 confirmed 결과 / 첫 filter | 929.8 ms | 337 ms |
| 첫 6개 | 2,546.3 ms | 883 ms |
| 첫 10개 | 3,966.0 ms | 1,416 ms |
| 전체 unique IDs | 3,966.0 ms (10개) | 1,416 ms (10개) |

live 열은 실제 fetch+parse 완료이며 DOM filter 시각이 아니다. synthetic 열은 discovery부터 실제 `data-noai-filter-action` 적용까지다. synthetic network는 250 ms로 live보다 빠르기 때문에 절대값을 서로 섞어 해석하지 않는다.

## cold와 warm cache 비교

동일한 10개 ID, 중복 카드 1개를 bundled Chromium에서 비교했다.

| workload | 발견 카드 | unique ID | 최대 active fetch | 최대 pending queue |
|---|---:|---:|---:|---:|
| cold/warm 비교 | 11 | 10 | 2 | 8 (동시 discovery와 fetch 시작 순서에서 산출) |
| capacity burst | 24 | 24 | 2 | 20 (설정 상한 도달) |

| 상태 | cache hit/miss | watch 요청 | 첫 filter | 첫 6개 | 첫 10개 | 전체 unique |
|---|---|---:|---:|---:|---:|---:|
| cold | 0 hit / 10 miss | 10 | 337 ms | 883 ms | 1,416 ms | 1,416 ms |
| warm | 10 hit / 0 miss | 0 | 32 ms | 32 ms | 33 ms | 33 ms |

10개 cold request의 discovery→fetch start, 즉 cache read와 FIFO wait를 합친 값은 p50 `609 ms`, p90 `1,142 ms`, 최악 `1,143 ms`였다. response fulfill→DOM filter tail은 p50 `9 ms`, p90 `12 ms`, 최악 `43 ms`였다.

warm cache에서도 ID별 `storage.local.get`은 발생하지만 10개 전체가 33 ms 안에 적용됐다. 이 표본에서 storage read는 사용자 체감 병목이 아니다.

## 중복 요청과 scheduling

### 동일 ID dedupe

- content route Map과 background `inFlight` Map의 두 층에서 dedupe한다.
- synthetic 11개 카드 중 두 카드가 같은 ID였지만 watch 요청은 unique ID 수와 같은 10회였다.
- 두 중복 카드는 cold와 warm 모두 같은 millisecond에 filter attribute를 받았다.
- 완료 뒤 새 duplicate card가 생기면 content route Map에서는 완료 Promise가 이미 삭제됐으므로 새 runtime message를 보낼 수 있다. background cache hit이므로 network는 추가되지 않는다.

### 반복 mutation

`expectedLookupKeys`가 같은 element/route/video를 막고 완료 결과는 `candidateResults`가 재사용한다. hover와 SPA mutation이 같은 ID를 반복 enqueue하는 경로는 현재 테스트와 코드에서 확인되지 않았다.

예외는 queue-full이다. 24-ID burst에서 22개만 request/filter되고 2개는 unknown이었다. unfiltered 카드에 관찰 대상 attribute mutation을 추가해도 요청 수는 22회 그대로였다. queue-full 결과가 element의 `candidateResults`에 남고 expected key가 같기 때문에 같은 route에서는 자동 retry하지 않는다.

### viewport 순서

- `querySelectorAll` → `Set` → `Map` → `candidates.values()` 순서이므로 scheduling은 DOM order다.
- `getBoundingClientRect`, `IntersectionObserver`, viewport 거리 또는 화면 노출 여부를 사용하지 않는다.
- 따라서 DOM에서 화면 아래 카드가 visible 카드보다 먼저 있으면 먼저 queue를 차지할 수 있다.
- 실제 Blue rain channel에서 DOM order와 visual order가 다른지는 연결된 Chrome이 없어 확인하지 못했다. 일반적으로 일치한다고 가정해서는 안 된다.

## 병목 분해

| 후보 | 측정·코드 근거 | 판단 |
|---|---|---|
| DOM discovery | synthetic에서 모든 카드 동시 발견 후 첫 fetch 시작까지 약 68 ms | 주 병목 아님. 실제 signed-in channel은 미측정 |
| queue wait | live p50 1.47 s, p90 2.95 s, worst 3.22 s | **주 병목** |
| concurrency 2 | 두 요청씩 wave로 완료, synthetic 최대 active 2 | **queue wait의 직접 원인** |
| watch fetch | live p50 736 ms, p90 915 ms | 각 wave의 기본 비용으로 큼 |
| 응답 구조/재시도 | 이번 live 10개 모두 정상 parse, retry 자체가 없음 | 이번 지연 원인 아님 |
| 8초 timeout | timeout 0건, worst fetch 919 ms | 이번 지연 원인 아님 |
| parsing | p50 8.2 ms, worst 19.8 ms | 무시 가능한 비중 |
| `storage.local` | warm 10개 전체 33 ms, cold post-response tail p90 12 ms | 이번 표본에서 주 병목 아님 |
| DOM filter 적용 | post-response tail에 포함해도 p90 12 ms | 주 병목 아님 |
| 중복 ID | 2개 카드가 1회 요청 공유 | 요청 증폭 없음 |
| MutationObserver/SPA | rAF batching과 expected key dedupe 확인 | 요청 증폭 근거 없음 |
| 12시간 negative cache | warm lookup을 빠르게 하지만 바뀐 disclosure를 최대 12시간 not-detected로 유지 | latency가 아니라 freshness/체감 누락 문제 |
| queue capacity 20 | 24-ID burst에서 22 accepted, 2 queue-full, 같은 route에서 retry 없음 | 22개 초과 동시 burst의 별도 coverage 위험 |

## concurrency 2→3/4 효과

아래는 한 번 측정한 실제 Blue rain fetch duration을 같은 FIFO 순서로 재배치한 값이다. network contention과 rate limit이 늘지 않는다는 가정이므로 예상값이지 live 3/4 실측값은 아니다.

| unique IDs | concurrency | 첫 card | 첫 6개 완료 | 첫 10개 완료 | 전체 완료 | c2 대비 전체 개선 |
|---:|---:|---:|---:|---:|---:|---:|
| 10 | 2 | 914.8 ms | 2,510.9 ms | 3,914.7 ms | 3,914.7 ms | 기준 |
| 10 | 3 | 914.8 ms | 1,683.6 ms | 2,915.8 ms | 2,915.8 ms | 25.5% |
| 10 | 4 | 914.8 ms | 1,591.5 ms | 2,323.2 ms | 2,323.2 ms | 40.7% |
| 20 | 2 | 914.8 ms | 2,510.9 ms | 3,914.7 ms | 7,829.4 ms | 기준 |
| 20 | 3 | 914.8 ms | 1,683.6 ms | 2,915.8 ms | 5,405.5 ms | 31.0% |
| 20 | 4 | 914.8 ms | 1,591.5 ms | 2,323.2 ms | 4,006.6 ms | 48.8% |

첫 DOM/첫 카드 request는 concurrency 2에서도 즉시 시작하므로 그 카드 자체의 latency는 바뀌지 않는다. concurrency 증가는 첫 화면의 여러 카드를 모두 처리하는 시간과 전체 throughput을 개선한다. 반대로 concurrency 3은 YouTube 동시 부하를 50%, 4는 100% 늘린다. 실제 rate-limit, signed-in region별 latency와 MV3 lifecycle 영향은 측정하지 못했다.

5 이상은 현재 근거보다 부하와 회귀 위험이 크므로 후보에서 제외한다.

## viewport priority 가능성

추가 permission이나 network 없이 구현할 수 있다.

### 후보 1: initial scan을 visible-first로 정렬

`processRoots([document])`에서 수집한 candidate를 enqueue 전에 `getBoundingClientRect`로 정렬한다.

- 장점: 가장 작은 변경. 첫 document scan에서 visible 카드를 active slot에 먼저 넣을 수 있다.
- 한계: 이미 background FIFO에 들어간 작업은 재정렬하지 못한다. mutation root가 여러 frame에 나뉘면 전역 우선순위를 보장하지 않는다.
- 비용: 많은 element의 layout read가 style/layout flush를 일으킬 수 있다. 한 frame에 read를 모으고 visible/near/below 세 bucket 정도로 단순화해야 한다.

### 후보 2: queue enqueue에 priority 부여

background `RequestQueue`에 priority를 전달하려면 content message contract에 viewport 상태가 추가된다.

- 장점: 이미 pending인 below-viewport 작업보다 뒤늦게 발견된 visible 작업을 앞세울 수 있다.
- 한계: message schema, queue test와 scheduling contract 변경이 필요하다. 여러 탭의 viewport priority를 하나의 global queue에서 비교하는 정책도 정해야 한다.

### 후보 3: IntersectionObserver

- 장점: 지속적인 visibility 변화를 비동기로 받을 수 있다.
- 한계: observer callback 전에 initial lookup이 enqueue될 수 있고, card lifecycle·unobserve·SPA reuse 상태가 추가된다. 이번 문제에 비해 복잡도가 크다.

현재 구조에서는 **initial scan의 단순 visible-first bucket**이 가장 작은 검증 후보다. 실제 Blue rain DOM에서 document order가 이미 visual order와 같다면 효과가 없으므로 구현 전에 connected Chrome capture가 필요하다.

## 개선 후보 A~F

| 후보 | first-visible latency | 전체 시간 | 요청 수·YouTube 부하 | 복잡도/DOM 의존성 | 회귀·privacy·테스트 |
|---|---|---|---|---|---|
| A. concurrency 2 + FIFO 유지 | 실제 first 약 0.93 s, 10개 약 3.97 s | 기준 | 동시 2, 가장 보수적 | 없음 | 현재 테스트 충분, privacy 변화 없음 |
| B. concurrency 3 | 첫 카드 거의 동일, 첫 6개 예상 1.68 s, 10개 2.92 s | 약 25~31% 단축 | 요청 수 동일, 동시 부하 +50% | 상수 변경은 단순 | rate-limit/live 회귀 검증 필요 |
| B. concurrency 4 | 첫 카드 거의 동일, 첫 6개 1.59 s, 10개 2.32 s | 약 41~49% 단축 | 요청 수 동일, 동시 부하 +100% | 단순하지만 보수적 설계에서 큰 변화 | 3보다 rate-limit 위험 큼 |
| C. viewport priority | visible 카드가 FIFO 뒤에 있으면 sample worst queue wait 3.22 s를 피할 수 있음 | 전체 시간 거의 동일 | 요청 수·동시 부하 동일 | initial sort는 낮음~중간, full priority queue는 중간~높음 | DOM geometry 의존, permission/privacy 변화 없음 |
| D. viewport + concurrency 3 | visible set과 전체 throughput을 함께 개선 | c3 수준 | 동시 부하 +50% | 두 변수를 함께 바꿔 원인 분리가 어려움 | 단계적 검증 필요 |
| E. dedupe/cache scheduling | dedupe는 이미 정상. warm 33 ms라 batching 이득 작음 | queue-full retry는 22+ burst coverage 개선 | 잘못된 retry는 요청 폭증 가능 | cache batch/memory mirror 또는 retry policy가 중간 이상 | privacy 변화는 없지만 storage/route 회귀 위험 |
| F. provisional visual state | 즉시 보이는 것처럼 만들 수 있음 | 판정 시간은 그대로 | 요청 변화 없음 | UI state 추가 | confirmed 전 hide/blur는 false positive·flicker·접근성 위험. 권장하지 않음 |

## cache와 TTL 해석

| status | TTL | latency 영향 |
|---|---:|---|
| confirmed | 7일 | 재방문 시 network 없이 즉시 filter |
| not-detected | 12시간 | 재방문은 빠르지만 disclosure가 새로 추가돼도 TTL 동안 재조회하지 않음 |
| unknown-or-error | 5분 | 일시 오류 폭주 억제. queue-full은 cache write하지 않음 |

12시간 not-detected cache는 카드가 천천히 하나씩 필터되는 현상의 원인이 아니다. cache hit은 오히려 빠르다. 다만 사용자가 watch page에서 새 disclosure를 확인했는데 이전 background 결과가 not-detected였다면 “계속 필터되지 않는” 체감 원인이 될 수 있다. 이번 조사에서는 TTL과 schema를 변경하지 않았다.

## 최종 추천

선택: **1. 1.1.0 그대로 출시하고 성능 개선은 후속 버전에서 진행**.

근거:

1. 첫 실제 confirmed 결과는 약 0.93초, 10개 전체 판정은 약 3.97초였고 timeout·retry·parse 오류는 없었다.
2. warm cache는 10개 전체 33 ms로 빠르다.
3. parsing, storage와 DOM 적용은 주 병목이 아니며 correctness와 dedupe도 정상이다.
4. concurrency 3은 첫 6개와 전체 시간을 의미 있게 줄일 가능성이 있지만 첫 카드 latency는 바꾸지 않고 YouTube 동시 부하를 50% 높인다.
5. 실제 signed-in Blue rain DOM/viewport를 측정하지 못해 viewport priority의 실효성과 concurrency 상향의 rate-limit 안전성을 출시 전에 확정할 근거가 부족하다.
6. queue-full no-retry는 22개 초과 동시 burst에서 확인된 별도 문제지만, 보고된 “결국 대부분 순차 적용”의 10-card 지연 원인은 아니다. 급하게 concurrency를 올려 우회하기보다 bounded retry와 viewport scheduling을 함께 설계해야 한다.

후속 실험은 concurrency 3과 visible-first를 각각 독립적으로 A/B 측정해야 한다. 실제 Chrome에서 first card, first 6 visible, first 10, queue peak와 429/timeout 비율을 수집한 뒤 concurrency 3이 반복해서 약 25% 이상 개선되고 오류율을 높이지 않을 때만 채택한다.

## privacy, permission, network

- production telemetry, analytics와 외부 서버 전송을 추가하지 않았다.
- 기존 공개 YouTube watch URL 이외의 endpoint를 사용하지 않았다.
- 계정 cookie, title, description, channel, thumbnail과 검색어를 수집·저장하지 않았다.
- permission, host permission, cache TTL/schema와 runtime network path를 변경하지 않았다.
- 임시 probe와 log는 작업 트리에서 제거했다.
