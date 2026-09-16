# NoAI 개인정보 처리방침

- 적용 버전: 0.9.0
- 최종 갱신일: 2026-09-16

NoAI는 YouTube와 YouTube Music에서 사용자가 선택한 필터 규칙을 적용하는 로컬 우선 브라우저 확장 프로그램이다. NoAI 개발자는 별도 사용자 계정이나 데이터 수집 서버를 운영하지 않는다.

## 처리하는 데이터

NoAI는 기능 제공을 위해 다음 정보를 사용자의 브라우저 안에서 처리할 수 있다.

- 필터 활성화 여부, 숨기기·흐리기·표시 모드와 YouTube Music 자동 건너뛰기 설정
- 사용자가 명시적으로 허용 또는 차단 목록에 추가한 exact video ID, 아티스트·채널 UC ID와 채널 `@handle`
- 목록에 사용자가 추가한 항목을 알아보기 위한 최소 표시 정보(곡 제목, 아티스트 또는 채널 이름이 있는 경우)
- 현재 YouTube 또는 YouTube Music 화면에서 기능 적용에 필요한 video·artist·channel identity와 YouTube 공식 disclosure evidence
- watch-page 확인 결과 cache의 video ID, 판정 상태, 최소 evidence, 확인·만료 시각과 필요한 경우 오류 범주

NoAI는 전체 시청·청취 기록, 검색어, queue, Google 계정 정보, 인증 cookie나 페이지 원문 HTML을 사용자 목록 또는 cache로 저장하지 않는다.

## 로컬 저장

설정, 허용 목록, 직접 차단 목록과 disclosure result cache는 Chrome 확장 프로그램의 `storage.local`에 저장된다. 이 데이터는 Chrome 동기화 기능이나 NoAI 서버로 전송되지 않는다.

Cache는 반복 요청을 줄이기 위해 제한적으로 유지된다. 현재 confirmed 결과는 최대 7일, not-detected 결과는 최대 12시간, 오류 결과는 최대 5분 동안 보관하며 전체 cache는 최대 500개 항목이다. 사용자가 명시적으로 추가한 허용·차단 규칙은 사용자가 삭제하거나 확장 프로그램 저장소가 제거될 때까지 남는다.

## YouTube 요청

카드에 공식 표시가 직접 보이지 않을 때 NoAI background는 해당 video ID로 `https://www.youtube.com/watch`의 공개 watch page를 HTTPS 요청할 수 있다. 이 요청은 공식 disclosure를 확인하는 사용자 대면 기능에만 사용된다.

- 요청 옵션은 `credentials: omit`과 `referrerPolicy: no-referrer`를 사용한다.
- Google 로그인 cookie나 인증 정보를 의도적으로 첨부하지 않는다.
- 요청 대상은 YouTube이며 NoAI 개발자 서버, 광고 사업자, analytics 서비스나 별도 외부 API가 아니다.
- 일반적인 인터넷 요청과 마찬가지로 YouTube는 요청된 URL, IP 주소와 브라우저가 전송하는 기본 네트워크 정보를 자체 정책에 따라 처리할 수 있다.
- 받은 HTML은 실행하거나 저장하지 않고 현재 영상의 지원되는 공식 disclosure 구조만 파싱한다.

## 전송, 공유와 판매

NoAI는 사용자의 설정, 사용자 규칙과 disclosure cache를 NoAI 개발자 서버나 별도의 제3자 서비스로 전송·공유·판매하지 않는다. 단, 공식 표시를 추가로 확인할 때는 앞에서 설명한 것처럼 해당 video ID의 공개 watch page를 YouTube에 요청할 수 있다. 광고, 맞춤형 광고, telemetry와 analytics를 사용하지 않으며 제3자 광고를 표시하지 않는다.

NoAI가 처리하는 정보는 확장 프로그램의 단일 목적과 사용자 대면 기능을 제공하는 데만 사용된다. 사람의 수동 검토 대상으로 보내지 않으며 신용 평가, 대출, 고용이나 보험 같은 목적에 사용하지 않는다.

## 데이터 삭제

사용자는 popup 또는 options에서 허용·차단 항목을 개별 삭제할 수 있다. 확장 프로그램을 제거하거나 Chrome의 확장 프로그램 저장 데이터를 삭제하면 해당 브라우저 프로필의 NoAI 로컬 데이터도 제거된다.

## 권한

- `storage`: 설정, 사용자 규칙과 최소 disclosure cache를 브라우저에 로컬 저장한다.
- `https://www.youtube.com/*` host permission: background에서 검증된 video ID의 공개 watch page를 요청해 공식 disclosure를 추가 확인한다.
- `https://www.youtube.com/*`, `https://music.youtube.com/*` content-script matches: 각 사이트의 지원되는 카드·row와 player에 로컬 설정을 적용한다. YouTube Music 범위는 생성 manifest의 별도 `host_permissions`가 아니라 `content_scripts.matches`에만 선언된다.

NoAI는 `tabs`, `activeTab`, `history`, `cookies`, `identity` 또는 `<all_urls>` 권한을 요청하지 않는다.

## Chrome Web Store 사용자 데이터 정책

NoAI가 처리하는 정보는 확장 프로그램의 공개된 단일 목적과 사용자 대면 기능을 제공하는 데에만 사용됩니다. NoAI의 정보 사용은 [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies)와 [Limited Use](https://developer.chrome.com/docs/webstore/program-policies/limited-use) 요구사항을 준수합니다.

## 정책과 문의

Chrome Web Store는 로컬에서만 처리되는 정보도 데이터 처리 공개 대상이 될 수 있다고 안내한다. 이 문서는 Chrome Web Store Dashboard의 Privacy practices 응답과 일치하도록 유지해야 한다. 자세한 기준은 [Chrome Web Store User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)와 [Privacy practices 작성 안내](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)를 참고한다.

정책 또는 구현에 관한 문의는 [GitHub Issues](https://github.com/yoobilee/noai-music/issues)에 남길 수 있다.
