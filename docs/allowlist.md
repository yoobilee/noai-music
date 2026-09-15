# 곡·아티스트 허용 목록

- 구현 기준일: 2026-09-15
- 범위: 사용자가 명시적으로 저장한 곡 또는 아티스트를 YouTube·YouTube Music 목록 필터링과 YouTube Music auto-skip에서 제외
- 제외: 직접·채널 blocklist, 이름 기반 판정, 외부 API, cloud sync, 계정, telemetry

## 우선순위와 판정 정책

현재 실제 우선순위는 `allowlist > direct blocklist > official disclosure`다. 유효한 곡 video ID 또는 확인된 아티스트 ID가 허용 목록과 일치하면, 같은 identity가 직접 차단 목록에 있거나 공식 YouTube AI disclosure가 confirmed여도 필터링하거나 건너뛰지 않는다.

allowlist와 direct blocklist의 충돌 판정은 DOM 함수가 아니라 공통 순수 정책을 YouTube 카드, YouTube Music row와 auto-skip이 함께 사용한다.

## identity

곡은 정확한 11자 YouTube video ID만 식별자로 사용한다. options 입력은 video ID 또는 지원하는 `youtube.com/watch`·`music.youtube.com/watch` URL을 받을 수 있지만 저장과 판정에는 video ID만 사용한다. 제목과 아티스트 이름은 식별에 사용하지 않는다.

아티스트는 `UC`로 시작하는 정확한 24자 YouTube channel ID만 사용한다. 이름과 handle 문자열은 판정하지 않는다.

- YouTube: adapter의 `#channel-name a[href], ytd-channel-name a[href]`에서 정확한 `/channel/UC…` 링크가 확인된 카드만 아티스트 allowlist를 적용한다.
- YouTube Music: 지원 row 또는 player bar 내부의 `a[href]` 중 정확한 `/channel/UC…` 또는 `/browse/UC…` 링크만 수집한다.
- 한 항목에서 아티스트 ID가 없으면 아티스트 동작을 표시하지 않는다. 여러 ID가 있으면 정책상 어느 하나가 허용돼도 항목을 허용하지만, 항목에서 추가하는 버튼은 단일 ID가 확정될 때만 표시한다.

YouTube와 YouTube Music selector 및 URL 해석은 각 adapter 경계 안에 유지한다. 이름 기반 fallback은 없다.

## 저장 schema

목록은 `storage.local`의 `allowlistV1`에 다음 형태로 저장한다.

```json
{
  "schemaVersion": 1,
  "tracks": [
    {
      "videoId": "exact11char",
      "title": "optional display text",
      "artistName": "optional display text"
    }
  ],
  "artists": [
    {
      "artistId": "UCxxxxxxxxxxxxxxxxxxxxxx",
      "name": "optional display text"
    }
  ]
}
```

ID 기준으로 중복을 제거하고 ASCII ID 순서로 안정적으로 정렬한다. 같은 schema의 손상 값은 유효한 항목만 정규화하며, 구조 전체가 손상됐으면 빈 기본값으로 복구한다. 이 빌드가 알지 못하는 숫자 schema version은 런타임에서 빈 목록처럼 안전하게 처리하되 저장 값을 덮어쓰지 않는다.

임의의 항목 수 제한은 두지 않는다. `storage.local` 자체 quota가 물리적 상한이며, 선택적인 표시 문자열은 공백을 정규화하고 title 200자, name 120자로 제한한다. 현재 UI는 ID 또는 사용자가 명시적으로 클릭한 항목의 최소 제목만 저장하며 자동으로 발견한 곡 목록, queue나 재생 기록을 축적하지 않는다.

## UI와 실시간 반영

popup의 compact “허용 목록” 영역은 저장된 곡·아티스트 수를 항상 표시하고, 펼치면 곡 video ID·watch URL과 아티스트 UC channel ID·URL의 추가·조회·개별 삭제를 현재 popup 안에서 처리한다. 목록이 길어지면 popup 내부를 scroll한다. options에는 같은 `AllowlistManager`의 전체 presentation을 유지한다. 잘못된 identity는 저장하지 않고 연결된 오류 설명과 `aria-invalid`로 안내한다. popup에서 options page를 열거나 현재 탭 identity를 읽지 않으므로 `tabs`나 `activeTab` permission이 필요하지 않다.

Blur와 Mark 상태의 사유 badge에는 “이 곡 허용” 버튼을 표시한다. 단일 안정적 아티스트 ID가 있으면 “이 아티스트 허용”도 표시한다. 버튼은 실제 `button` 요소, 접근 가능한 이름과 키보드 focus 표시를 사용한다. Hide 상태는 row가 보이지 않으므로 options에서 URL 또는 ID로 추가한다.

YouTube 카드 badge는 adapter가 확인한 `ytd-thumbnail` 또는 `yt-thumbnail-view-model`에 absolute overlay로 mount한다. 카드 root의 일반 flow에 높이를 추가하지 않는다. YouTube element에 `position: relative !important`를 강제하거나 card→thumbnail 조상마다 path attribute를 삽입하지 않는다. Blur는 adapter에 격리한 안정적인 thumbnail child와 metadata wrapper selector에만 적용하므로 hover preview subtree가 바뀌어도 filter 대상 경계가 흔들리지 않는다. badge wrapper는 pointer event를 통과시키고 실제 버튼만 클릭·keyboard interaction을 받는다.

현재 rich-grid의 `ytd-rich-item-renderer > #content > yt-lockup-view-model > .ytLockupViewModelHost > a.ytLockupViewModelContentImage > yt-thumbnail-view-model` 중첩 구조를 지원한다. 내부 mutation에서 가장 가까운 `yt-lockup-view-model`만 수집했다가 nested candidate 정책으로 버리지 않고, 바깥 `ytd-rich-item-renderer`까지 올라가 같은 카드 identity와 filter 상태를 유지한다.

`storage.onChanged`가 YouTube와 YouTube Music content script의 목록 snapshot을 갱신한다. 추가하면 현재 filter attribute와 badge를 즉시 제거한다. 삭제하면 현재 DOM을 다시 평가하고 기존 confirmed 결과이면 현재 mode를 재적용한다. row의 video ID나 artist ID가 바뀌면 adapter가 현재 identity를 다시 읽으므로 이전 허용 상태가 남지 않는다. badge 버튼도 클릭 시 현재 DOM identity가 캡처한 identity와 같은지 재확인한다.

## 필터링과 auto-skip

- YouTube 카드: video ID allowlist를 모든 기존 카드 surface에 적용한다. 아티스트는 위의 안정적 channel link가 확인된 기존 카드만 지원한다.
- YouTube Music 목록: 검색 결과, 앨범 track, 플레이리스트 track과 아티스트 song row의 video ID 및 확인된 UC ID를 적용한다.
- YouTube Music auto-skip: player의 video ID를 항상 적용하며, player bar에 안정적 UC ID가 있을 때만 아티스트 allowlist도 적용한다.
- `enabled=false`이면 기존과 같이 필터링과 auto-skip이 모두 꺼진다. `youtubeMusicAutoSkip=false`는 목록 allowlist 및 카드 필터링과 독립적이다.

현재 재생 세대가 allowlist로 한 번 보호되면, 재생 중 목록에서 삭제해도 그 곡을 뒤늦게 건너뛰지 않는다. 다음 video ID 재생 세대부터 최신 목록으로 다시 판정한다. lookup이 진행 중일 때 allowlist가 추가돼도 완료 callback에서 최신 snapshot을 다시 확인하므로 잘못 skip하지 않는다.

## 개인정보·보안

- 사용자가 명시적으로 추가한 video ID, UC channel ID와 선택적인 최소 표시 metadata만 로컬에 저장한다.
- 전체 시청·청취 기록, 검색어, queue, Google 계정 정보와 자동 수집한 항목 목록은 저장하지 않는다.
- 목록을 외부 서버로 보내지 않으며 새 fetch, telemetry 또는 analytics가 없다.
- extension permission, host permission과 content-script match를 추가하거나 넓히지 않는다.

## fixture와 자동 검증

비식별 fixture는 합성 video ID와 합성 UC ID만 사용한다. Vitest는 기본값, 정상·손상 schema, 중복 제거, 잘못된 ID, 추가·삭제, 순수 우선순위 정책, stale identity, element reuse, badge 중복, setting 전환과 auto-skip 재생 세대를 검증한다.

bundled Chromium E2E는 popup/options의 추가·중복·삭제, 실제 구조에 가까운 nested rich-grid 카드의 Hide→Blur→Mark→Hide 전환, hover-like child mutation 중 badge identity와 filter attribute 유지, YouTube와 YouTube Music confirmed 카드의 즉시 복구·삭제 후 재필터링, 안정적 artist ID, 허용된 현재 곡·아티스트의 auto-skip 제외와 다음 재생 세대 재평가를 content script → runtime message → background lookup 경로로 검증한다. CI는 live YouTube 또는 YouTube Music에 의존하지 않는다.

## 실제 Chrome 수동 검증 절차

1. `npm run build`를 실행한다.
2. `chrome://extensions`에서 `.output/chrome-mv3` unpacked extension을 reload한다.
3. popup의 compact “허용 목록”에 곡·아티스트 수가 표시되고 펼치기·접기가 keyboard로 동작하는지 확인한다.
4. popup 안에서 곡 video ID 또는 watch URL과 아티스트 UC channel ID 또는 URL을 추가·삭제하고 중복이 생기지 않는지 확인한다.
5. 잘못된 제목·아티스트 이름이 거부되고 오류와 focus가 popup scroll 영역에서 보이는지 확인한다.
6. YouTube confirmed 카드에서 Blur 또는 Mark로 전환하고 곡 허용 버튼, 가능한 경우 아티스트 허용 버튼을 누른 뒤 즉시 원복되는지 확인한다.
7. 같은 카드에 hover해도 아래 grid row가 움직이지 않고 badge가 깜빡이거나 중복되지 않는지 확인한다.
8. popup 허용 목록에서 해당 항목을 삭제하고 현재 mode가 다시 적용되는지 확인한다.
9. Hide·Blur·Mark와 Enabled OFF/ON을 전환해 이전 attribute, class 또는 badge가 남지 않는지 확인한다.
10. 카드 element가 다른 video ID로 재사용되거나 SPA 이동 후 이전 allowlist 상태가 남지 않는지 확인한다.
11. YouTube Music Premium을 사용할 수 있으면 검색·앨범·플레이리스트·아티스트 row에서 같은 흐름을 확인한다.
12. confirmed 현재 곡 또는 안정적 ID를 가진 아티스트를 허용했을 때 auto-skip되지 않고, 삭제 후 다음 재생 세대부터 기존 정책이 적용되는지 확인한다.
13. 일반 항목은 계속 유지되고 allowlist와 `youtubeMusicAutoSkip` 설정이 서로 방해하지 않는지 확인한다.

한국 Premium 또는 안정적으로 찾을 수 있는 live confirmed 항목이 없으면, confirmed 적용은 fixture E2E 결과로 기록하고 live에서는 일반 항목 no-op, options 저장, SPA·설정 복구만 별도로 확인한다. fixture 결과를 live confirmed 검증처럼 보고하지 않는다.

## 알려진 한계

- 제목, 아티스트 이름, `@handle`, custom URL만 있는 DOM에서는 아티스트 allowlist를 적용하지 않는다.
- YouTube에서 안정적 channel 링크가 확인되지 않는 카드와 YouTube Music player bar에서 UC 링크가 없는 경우에는 곡 allowlist만 동작한다.
- Hide 상태의 항목 내부 버튼은 보이지 않으므로 popup 또는 options에 video ID나 URL을 입력해야 한다.
- popup에서 현재 탭 항목 identity를 직접 읽지는 않는다. 이를 위한 `tabs`나 `activeTab` permission은 추가하지 않았다.
- 실제 최신 로그인·비로그인 YouTube/YTM DOM, 작은 화면, Edge와 Whale은 수동 확인이 필요하다.
