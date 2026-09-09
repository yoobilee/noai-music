# YouTube confirmed disclosure 카드 필터링

- 설계·구현일: 2026-09-09
- 범위: 데스크톱 YouTube 영상 카드의 전역 필터와 hide/blur/mark 모드
- 제외: Shorts, YouTube Music, 허용·차단 목록, 자동 skip

## 적용 조건과 정책

NoAI는 제목, 설명, 채널명, 음원 특성이나 AI 관련 키워드로 콘텐츠를 추측하지 않는다. 필터 정책은 다음 조건이 모두 맞을 때만 `hide`, `blur` 또는 `mark`를 반환한다.

1. 전역 설정 `enabled`가 `true`다.
2. watch-page 추가 확인 또는 카드 DOM의 직접 evidence 결과가 `confirmed`다.
3. 기존 detector가 evidence 안에서 지원하는 YouTube 공식 AI·변경 disclosure를 다시 확인한다.

`not-detected`, `unknown-or-error`, timeout, queue-full, background 오류와 evidence가 없는 손상된 confirmed 결과는 모두 `none`이다. 여기서 confirmed는 YouTube의 공식 disclosure를 확인했다는 뜻이며 음악 자체가 AI로 생성됐다는 별도 주장이 아니다.

## 설정 저장

`storage.local`의 `settingsV1` 키에 다음 schema version 1 객체만 저장한다.

```json
{
  "schemaVersion": 1,
  "enabled": true,
  "mode": "hide"
}
```

기본값은 활성화와 `hide`다. `enabled` 또는 mode가 잘못됐거나 schema version이 다르면 전체 객체를 기본값으로 복구한다. popup과 options는 같은 저장 함수를 사용하며 `storage.onChanged`를 통해 서로의 변경과 열려 있는 YouTube 탭에 즉시 반영한다.

## DOM 적용과 접근성

필터 정책은 DOM을 참조하지 않는다. content script가 adapter에서 받은 영상 카드 element와 정책 결정을 UI 계층에 전달한다. UI 계층은 YouTube selector 대신 NoAI 전용 `data-noai-filter-*` 속성과 한 번만 삽입되는 style element를 사용한다.

- `hide`: 카드에 `display: none`을 적용하되 element를 제거하지 않는다. 숨겨진 하위 요소는 키보드 focus 대상에서도 제외되고 설정 변경 시 즉시 복구된다. 이유 코드는 숨겨진 element의 data attribute에 남긴다.
- `blur`: 카드의 콘텐츠를 흐리지만 pointer interaction은 차단하지 않는다. 사용자는 원하면 카드를 직접 클릭할 수 있으며, 흐려지지 않는 이유 badge를 함께 표시한다.
- `mark`: 콘텐츠는 바꾸지 않고 `NoAI · YouTube AI disclosure` 이유 badge만 표시한다.

blur와 mark의 이유는 실제 텍스트 node로 제공해 보조 기술이 읽을 수 있다. 기존 YouTube ARIA 속성이나 tabindex는 변경하지 않고, 빈번한 `aria-live` 알림도 만들지 않는다. popup/options는 native checkbox, fieldset, radio와 연결된 label을 사용하며 keyboard focus outline을 제공한다.

## SPA와 비동기 결과 안전성

candidate별 expected key는 route key와 video ID를 결합한다. lookup 완료 시 element가 여전히 연결되어 있고 expected key가 같을 때만 결과를 적용한다. 같은 element의 링크가 다른 video ID로 바뀌면 이전 필터를 먼저 제거하고 새 결과를 기다린다.

MutationObserver batch는 새 candidate와 NoAI가 이미 처리한 가까운 element만 조정한다. route 변경에서는 모든 NoAI 필터 속성과 이유 badge를 먼저 제거하고 route별 lookup map 및 WeakMap 상태를 교체한다. 설정 변경은 현재 문서를 재처리하며 `hide → mark`, `blur → off` 같은 전환도 새로고침 없이 이전 상태를 제거한다. extension context가 종료될 때 observer와 storage listener를 해제하고 적용 상태를 복구한다.

checking, not-detected와 unknown 상태를 표시하던 `NoAI dev:` badge는 기본 사용자 화면에서 제거했다. 자동화 검증은 제품 data attribute를 hook으로 사용한다.

## 자동 및 수동 검증

Vitest는 순수 policy의 confirmed/non-confirmed 경계, 설정 기본값·저장·손상 복구·change parsing, DOM hide/blur/mark 적용과 원복을 검증한다. Playwright fixture는 confirmed 카드 숨김, mark/blur/off 즉시 전환, 동일 ID 요청 결합과 cache hit, element 재사용 및 stale 응답 무시를 빌드된 확장에서 확인한다. 실제 YouTube 네트워크는 CI 성공 조건이 아니다.

실제 Chrome에서는 다음을 수동 확인한다.

1. `.output/chrome-mv3`를 unpacked extension으로 로드한다.
2. popup에서 활성화와 각 mode를 바꾸고 열려 있는 홈·검색·관련·재생목록 카드가 즉시 전환되는지 확인한다.
3. 공식 disclosure 표본 카드가 노출되는 경우에만 필터가 적용되는지 확인한다.
4. 일반 카드와 unknown/error 카드가 숨겨지거나 흐려지지 않는지 확인한다.
5. SPA 이동, 뒤로가기와 무한 스크롤 뒤에도 이전 카드 상태가 새 video ID에 남지 않는지 확인한다.
6. blur 카드가 pointer로 열리고 reason text가 screen reader 탐색에 나타나는지 확인한다.
7. popup/options를 keyboard만으로 조작하고 focus 표시, 200% 확대와 한·영 문구를 확인한다.

## 현재 한계

- 현재 YouTube 영상 카드만 처리하며 Shorts와 YouTube Music은 지원하지 않는다.
- hide 모드는 카드별 복구 버튼이나 숨김 개수 UI를 제공하지 않는다.
- 사용자 허용 목록과 직접 차단 목록은 아직 정책에 연결하지 않았다.
- 실제 Chrome·Edge·Whale의 라이브 화면 수동 검증은 자동 fixture 검증과 별도로 필요하다.
- YouTube가 renderer나 링크 구조를 바꾸면 adapter가 candidate를 반환하지 않아 필터가 적용되지 않는다. 이 경우 추측으로 차단하지 않는다.
