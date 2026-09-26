# 직접 차단 목록

## 목적과 정책

직접 차단은 AI 판정이 아니라 사용자가 명시적으로 추가한 로컬 규칙이다. 공식 disclosure가 없거나 조회가 실패해도 적용할 수 있으며, 화면 문구도 공식 AI 표시와 구분한다.

최종 우선순위는 `allowlist > direct blocklist > official disclosure`다. 같은 항목이 허용과 차단 양쪽에 있으면 허용한다. 여러 직접 차단 규칙이 일치하면 더 구체적인 `track > artist > channel` 순서로 reason을 선택한다. 저장 단계에서 충돌 항목을 강제로 삭제하지 않는다.

## identity와 지원 범위

- 곡: 정확한 11자 YouTube video ID. raw ID와 지원되는 `youtube.com/watch`, `music.youtube.com/watch` URL을 받는다.
- 아티스트: 정확한 `UC` channel ID 형식. YTM의 전용 artist link에서 확인된 ID에만 적용한다.
- 채널: 정확한 `UC` channel ID 또는 exact YouTube `@handle`. 일반 YouTube 카드의 `/channel/UC…` 또는 `/@handle` metadata link에서 확인된 identity에 적용한다. 카드에 channel metadata가 반복되지 않는 채널 `Videos` 탭에서는 exact route identity를 제한적으로 사용한다.
- raw `@handle`과 `https://www.youtube.com/@handle` URL을 받으며 percent-encoded 비라틴 handle URL은 URL parser로 decode한다. 이름과 제목 문자열은 identity로 사용하지 않고 handle을 UC ID로 변환하거나 추측하지 않는다. 새 네트워크 조회도 하지 않는다.

YouTube의 channel link는 channel kind로만 평가한다. UC ID와 handle이 모두 확인되면 각 exact identity를 독립적으로 비교하며 둘 다 같은 `direct-block-channel` reason을 사용한다. UC ID가 handle보다 안정적이지만, 최신 카드에 UC link가 없으면 DOM에 노출된 exact handle을 사용할 수 있다. YTM의 search, album, playlist, artist row와 player는 전용 artist link의 UC ID를 artist kind로만 평가한다. 따라서 YouTube에서는 track/channel, YTM에서는 track/artist를 지원하며 불명확한 교차 kind는 fail-closed다.

YouTube 채널의 `/<@handle>/videos`와 `/channel/<UC ID>/videos` route는 해당 채널 소유 영상 목록으로 한정해 해석한다. 이 surface에서 카드 내부에 유효한 channel identity가 전혀 없을 때만 route의 exact handle 또는 UC ID를 fallback으로 사용한다. card DOM의 UC ID, card DOM의 handle, Videos route fallback 순서이며, card에 하나라도 explicit identity가 있거나 여러 identity가 섞여 모호하면 route로 덮어쓰지 않는다. 채널 Home, Shorts, Streams, Playlists, Community와 기타 탭에는 fallback을 적용하지 않는다.

## 저장과 개인정보

`storage.local`의 `blocklistV1`은 다음 versioned schema를 사용한다.

```json
{
  "schemaVersion": 1,
  "tracks": [{ "videoId": "…", "title": "선택적 표시명" }],
  "artists": [{ "artistId": "UC…", "name": "선택적 표시명" }],
  "channels": [
    { "identityType": "channel-id", "channelId": "UC…", "name": "선택적 표시명" },
    { "identityType": "handle", "handle": "@example", "name": "선택적 표시명" }
  ]
}
```

잘못된 값은 정규화하고 ID 중복을 제거해 결정적인 ID 순서로 저장한다. title은 200자, name은 120자로 제한한다. 현재 빌드가 모르는 future schema version은 빈 목록처럼 안전하게 처리하되 원본 저장 값을 덮어쓰지 않는다. 사용자가 추가한 ID와 최소 표시 metadata 외에 시청·청취 기록, 검색어, queue나 계정 정보는 저장하지 않는다. 외부 전송, sync, telemetry가 없다.

PR 개발 중 사용한 legacy `{ "channelId": "UC…" }` 항목은 같은 schema version에서 명시적인 `identityType: "channel-id"` 항목으로 정규화한다. 한 channel entry에 ID와 handle을 동시에 저장하지 않으며 각 identity type 안에서 exact 값으로 중복 제거하고 정렬한다.

## 카드와 auto-skip

YouTube와 지원 YTM row의 직접 차단 항목은 현재 Hide/Blur/Mark 모드를 그대로 사용한다. reason은 각각 “직접 차단한 콘텐츠/아티스트/채널”이며 공식 disclosure 문구를 사용하지 않는다. `storage.onChanged` 시 현재 DOM을 재평가하므로 추가는 즉시 필터를 적용하고 삭제는 즉시 복원하거나 기존 official 결과에 따라 다시 적용한다. 기존 row reuse, expected key, stale lookup과 badge 중복 방어는 유지한다.

YTM auto-skip은 `enabled`와 `youtubeMusicAutoSkip`이 모두 켜진 경우 allowlist를 먼저 검사한다. 직접 차단 track 또는 확실한 artist이면 disclosure lookup을 시작하지 않고 현재 playback generation에서 한 번만 다음 버튼을 누른다. 전환 실패에도 같은 generation에서 재클릭하지 않는다. 재생 중 새 direct block은 최신 storage snapshot 평가에서 한 번 skip할 수 있다. allowlist로 이미 보호된 generation은 block 규칙이 없으면 기존처럼 끝까지 보호되며, 새 block 규칙은 최신 allowlist가 아니라는 조건에서 즉시 적용된다.

## Popup UI

popup의 compact 허용 목록 아래에 native `<details>/<summary>` 차단 목록이 있다. 접힌 상태에서 곡·아티스트·채널 수를 보여주고, 펼치면 ID/지원 URL 추가, 목록 조회와 개별 삭제를 제공한다. 두 목록 summary의 chevron은 펼칠 수 있다는 시각적 힌트이며 native keyboard/focus semantics를 유지한다. “허용 목록이 차단 목록보다 우선합니다” 설명으로 충돌 결과를 안내한다. options에도 같은 관리 presentation이 남아 있다.

## 수동 검증

1. `npm run build` 후 `chrome://extensions`에서 unpacked extension을 reload한다.
2. popup에서 허용·차단 summary를 키보드로 펼치고 곡·아티스트·채널 ID/URL 및 `@handle`의 추가, 오류, 중복, 삭제와 scroll을 확인한다.
3. YouTube의 일반 카드 track/channel을 차단해 Hide/Blur/Mark 및 각 reason을 확인한다.
4. 차단한 `@handle`의 채널 `Videos` 탭으로 이동해 channel metadata가 없는 카드도 `직접 차단한 채널` reason으로 처리되는지 확인한다.
5. 같은 identity를 allowlist에도 넣어 즉시 복원되는지, allow만 삭제해 direct block이 다시 적용되는지 확인한다.
6. block을 삭제해 일반 카드는 복원되고 confirmed official disclosure 카드는 기존 official reason으로 재평가되는지 확인한다.
7. 서로 다른 두 채널의 `Videos` 탭을 SPA 이동하고 infinite render와 hover mutation 후 stale 상태나 badge 중복이 없는지 확인한다.
8. Premium 환경이 있으면 YTM 지원 row의 track/artist 차단과 현재 곡의 lookup 없는 한 번 auto-skip, allow 우선, 설정 OFF를 확인한다.

## 알려진 한계

- YouTube에서 artist kind, YTM에서 channel kind는 현재 DOM 계약으로 의미를 확실히 구분할 수 없어 적용하지 않는다.
- UC channel ID가 가장 안정적이다. handle rule은 현재 DOM의 exact handle에만 일치하며, 채널 소유자가 handle을 변경하면 기존 rule은 더 이상 일치하지 않을 수 있다. 이를 보완하는 handle→UC network/API lookup은 1.0에서 하지 않는다.
- legacy custom URL이나 채널 표시 이름만 제공되는 경우는 지원하지 않는다.
- route fallback은 현재 `Videos` 탭만 지원한다. ownership과 기존 video identity 계약을 함께 검증하지 않은 Home, Shorts, Streams 및 기타 탭은 fail-closed다.
- live 사이트 DOM과 YTM Premium 재생은 자동 CI가 아닌 수동 검증이 필요하다. CI는 비식별 fixture와 bundled Chromium을 사용한다.
