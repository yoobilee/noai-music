# YouTube 공식 AI disclosure 감지

- 조사일: 2026-09-09
- 구현 범위: 데스크톱 YouTube watch 페이지에 이미 노출된 공식 표시
- 상태: 서버 제공 페이지 데이터 확인 완료, 실제 렌더링 브라우저 수동 검증 미수행

## 공식 의미와 현재 문구

YouTube 공식 도움말은 현재 `Made with AI`를 의미 있게 AI로 생성되거나 변경된 콘텐츠에 관한 disclosure로 설명한다. 이 표시는 creator의 신고, YouTube 생성형 AI 도구, C2PA 정보 또는 YouTube의 자체 시스템에 의해 추가될 수 있다. 따라서 NoAI는 표시의 존재만 기록하며 음악 전체가 AI 생성됐다고 단정하지 않는다.

2026년 5월 YouTube 변경 안내에 따르면 photorealistic 장편 영상의 표시는 플레이어 바로 아래에, Shorts는 플레이어 위에 표시될 수 있다. 비현실적·애니메이션 또는 약하게 변경된 콘텐츠는 확장 설명에서 확인할 수 있다. 모든 영상 카드에 disclosure가 포함된다는 공식 보장은 없다.

공식 근거:

- [YouTube의 How this content was made 설명](https://support.google.com/youtube/answer/15447836?hl=en)
- [YouTube의 GenAI disclosure 정책과 예시](https://support.google.com/youtube/answer/14328491?hl=en)
- [2024년 altered or synthetic content disclosure 도입 안내](https://blog.youtube/news-and-events/disclosing-ai-generated-content/)
- [2026년 YouTube AI label 변경 안내](https://blog.youtube/news-and-events/improving-ai-labels-viewers-creators/)

## 공개 샘플 조사

공개 URL은 현재 구조를 확인하는 수동 calibration 자료일 뿐 자동 테스트에서 호출하지 않는다.

| 역할 | URL·video ID | 2026-09-09 확인 결과 |
|---|---|---|
| disclosure 표본 | `https://www.youtube.com/watch?v=z8Dz-IFFFY4` | 영어·한국어 watch 응답에 공식 disclosure가 존재 |
| 일반 대조군 | `https://www.youtube.com/watch?v=dQw4w9WgXcQ` | 같은 disclosure key, 도움말 ID와 AI badge가 없음 |

disclosure 표본의 서버 제공 watch 페이지 데이터에서 다음 구조를 확인했다.

```text
videoPrimaryInfoRenderer
  badges[]
    metadataBadgeRenderer
      label: "AI"
      accessibilityData.label:
        en: "AI: Content was made with AI"
        ko: "AI: AI로 생성된 콘텐츠"

structuredDescriptionContentRenderer
  items[]
    howThisWasMadeSectionViewModel
      sectionTitle.content:
        en: "How this was made"
        ko: "콘텐츠 생성 방식"
      bodyHeader.content:
        en: "Made with AI"
        ko: "AI로 제작"
      bodyText.commandRuns[].onTap...urlEndpoint.url:
        //support.google.com/youtube/answer/15447836?hl=...
```

같은 표본을 video ID로 검색한 YouTube 검색 응답에는 `videoRenderer`가 있었지만 AI badge, `Made with AI`, 도움말 ID 또는 `howThisWasMadeSectionViewModel`은 없었다. 즉 현재 확인 범위에서는 카드 DOM만 보고 disclosure 유무를 판정할 수 없다.

대화 환경에서 연결 가능한 실제 브라우저가 없어 위 JSON/view-model이 만든 최종 렌더링 DOM은 직접 확인하지 못했다. 구현 selector는 확인된 renderer 이름과 YouTube custom element 구조를 좁게 반영하며, 실제 브라우저 수동 검증 전에는 전체 YouTube UI에서 안정 지원한다고 간주하지 않는다.

## 비식별 fixture

`tests/fixtures/youtube/watch-made-with-ai.en.html`은 공개 표본에서 다음 관계만 보존한다.

- 영상 단위와 11자리 video ID 링크
- 공식 metadata badge의 접근성 레이블
- `how-this-was-made-section-view-model`
- disclosure 제목과 YouTube 도움말 `15447836` 링크

채널명, 계정, 댓글, 추천 목록, 조회·시청 기록, tracking parameter와 원본 설명은 포함하지 않는다. fixture에는 중복 공식 badge, 일반 카드와 같은 문구를 사용자 콘텐츠로만 가진 카드도 포함해 중복 제거와 오탐 방지를 검증한다.

## 감지 계약

adapter는 다음 조합만 확정 evidence로 반환한다.

1. 알려진 YouTube badge renderer 안의 정확한 영어·한국어 접근성 레이블
2. 알려진 how-this-was-made component 안에서 공식 도움말 `15447836` 링크와 확인된 영어·한국어 제목·본문이 함께 존재

레거시 영어 `Altered or synthetic content`는 공식 도움말 component 안에서만 지원한다. 확인하지 않은 번역, 일반 제목·설명·채널명과 `AI` 키워드만으로는 evidence를 만들지 않는다. 공식 component와 도움말 링크는 있지만 제목이 알려지지 않은 경우 `indeterminate` evidence를 만들며 detector는 이를 감지하지 않는다.

## 동적 DOM과 SPA

- 시작 시 현재 문서를 한 번 처리한다.
- mutation에서 추가된 root와 제거·관련 속성 변경이 발생한 기존 영상 단위만 수집한다.
- 여러 mutation은 animation frame 하나로 합친다.
- `yt-navigate-finish`에서 route key를 비교하고 route별 `WeakMap` 상태를 초기화한다.
- DOM의 badge 속성으로 중복 삽입을 막고, fingerprint가 같으면 재렌더링하지 않는다.
- content script context invalidation에서 observer, listener와 예약 frame을 정리한다.

`yt-navigate-finish`는 공개 확장 API가 아니므로 단독 신호로 사용하지 않는다. `MutationObserver`가 동적 변경의 기본 경로다.

## 수동 검증 절차

1. `npm run build` 후 `.output/chrome-mv3`를 Chrome에 unpacked extension으로 로드한다.
2. 영어 UI에서 disclosure 표본을 열고 플레이어 아래 또는 확장 설명의 공식 표시를 확인한다.
3. 같은 영상 단위에 `NoAI: AI disclosure detected`가 정확히 하나만 추가되는지 확인한다.
4. 페이지 새로고침, 설명 펼치기와 YouTube 내부 링크를 통한 SPA 이동 후 중복 여부를 확인한다.
5. 일반 대조군에서 개발 배지가 생기지 않는지 확인한다.
6. YouTube 언어를 한국어로 바꾸고 같은 절차를 반복한다.
7. DevTools에서 실제 tag, 접근성 레이블과 도움말 링크가 fixture selector와 일치하는지 확인한다.
8. Chrome 확인 뒤 Edge와 Whale의 현재 안정 버전에서 반복한다.

공개 영상은 삭제, 변경 또는 disclosure 수정이 가능하므로 이 절차의 표본은 영구 테스트 oracle이 아니다. 결과가 달라지면 공식 문서와 별도 표본으로 원인을 다시 확인한다.

## 현재 한계

- 이 문서의 직접 DOM 감지만으로는 홈·검색·관련·재생목록 카드가 watch disclosure를 포함하지 않을 때 감지할 수 없다. video ID 기반 추가 확인은 별도 [`youtube-watch-disclosure-lookup.md`](youtube-watch-disclosure-lookup.md)에 기록한다.
- 확장 설명 disclosure가 아직 DOM에 렌더링되지 않았다면 설명이 로드될 때까지 감지할 수 없다.
- YouTube가 component tag, 접근성 레이블, 도움말 ID 또는 표시 위치를 변경하면 감지가 중단될 수 있다. 이 경우 오탐 대신 배지를 표시하지 않는다.
- 영어와 한국어의 확인된 현재 레이블 및 공식 component 안의 레거시 영어 문구만 지원한다.
- Shorts와 YouTube Music은 조사·구현하지 않았다.
- 개발 배지는 제품 UI가 아니며 hide, blur, allow/block 또는 skip 결정에 사용하지 않는다.
- 외부 서버와 YouTube Data API는 사용하지 않는다. 후속 vertical slice에서 최소 host permission을 사용하는 watch-page background fetch가 추가됐다.
