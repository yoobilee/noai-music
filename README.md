# NoAI

> Block AI music on YouTube. Skip it on YouTube Music.

[한국어](README.ko.md)

NoAI is an open-source browser extension that helps users manage music content that YouTube officially labels as AI or altered content.

The product brand remains **NoAI**. From 0.9.1, the localized extension display name is **NoAI — AI-Labeled Music Filter** in English and **NoAI — AI 표시 음악 필터** in Korean.

NoAI does not guess whether music is AI-generated. It uses confirmed YouTube disclosures and exact user-defined identities, and does nothing when it cannot verify the required evidence or identity.

## Key features

- Hide, blur, or mark officially AI/altered-labeled content on YouTube
- Automatically skip matching tracks on YouTube Music
- Filter supported YouTube Music track rows and queue items
- Track and artist allowlists
- Direct blocking for tracks, artists, and channels
- Korean and English UI with automatic browser-language detection or manual language selection
- No ads, analytics, or telemetry

## How it works

NoAI uses YouTube's official AI or altered-content disclosure as its primary detection signal.

- It does not use an AI detector of its own.
- It does not infer AI use from titles, channel names, or audio characteristics.
- An official disclosure does not by itself prove that the music was AI-generated. NoAI reports only the disclosure it confirmed.
- If NoAI cannot verify the page structure, identity, or disclosure evidence, it leaves the item unchanged rather than guessing.
- A direct block is a user rule, not an AI classification.

## Supported surfaces

### YouTube

- Supported video cards on Home, Search, Related, and Playlist surfaces
- Supported channel `Videos` cards, including exact route identity fallback when card metadata is absent
- Exact video ID rules
- UC channel ID rules
- Exact YouTube `@handle` direct-block rules

### YouTube Music

- Supported track rows in Search, Album, Playlist, and Artist surfaces
- Queue items with a confirmed exact video ID
- Current playback identity and auto-skip
- Track allow and block rules
- Artist allow and block rules where a stable artist identity is available

Queue artist identity is not inferred. If a supported renderer does not provide a confirmed identity, NoAI leaves it unchanged.

## User rules

User rules follow this priority:

```text
allowlist > direct blocklist > official disclosure
```

- An allowed track or artist is not filtered or skipped, even if it also matches a direct block or official disclosure.
- A direct block applies when its exact track, artist, or channel identity matches, regardless of disclosure lookup results.
- The official disclosure policy applies only when no higher-priority user rule matches.

## Installation

### Chrome Web Store

NoAI 0.9.1 is available to install from the [Chrome Web Store](https://chromewebstore.google.com/detail/noai/eiddibmnpcdbgdmeoipniomddiboikkf).

### GitHub Release

The [NoAI v0.9.1 release](https://github.com/yoobilee/noai-music/releases/tag/v0.9.1) includes the Chrome extension ZIP. You can extract the ZIP and load the extracted extension through Chrome's developer mode as an alternative to the store installation.

For a development build instead, follow the instructions below and load `.output/chrome-mv3` as an unpacked extension.

## Privacy

- No separate NoAI account
- No NoAI data collection server
- No ads, analytics, or telemetry
- Settings, allow/block rules, and the minimal disclosure cache are stored in `storage.local`
- Chrome Sync is not used
- Local settings, rules, and cache are not sent to a NoAI developer server
- To verify an official disclosure, NoAI may request the public YouTube watch page for a video using `credentials: omit` and `referrerPolicy: no-referrer`
- No `tabs`, `activeTab`, `history`, `cookies`, `identity`, or `<all_urls>` permission

See the [privacy policy](docs/privacy.md) for the complete data-handling details.

## Browser support and current status

- Current version: **0.9.1**
- Latest GitHub Release: [v0.9.1](https://github.com/yoobilee/noai-music/releases/tag/v0.9.1)
- Chrome Web Store: **[0.9.1 available to install](https://chromewebstore.google.com/detail/noai/eiddibmnpcdbgdmeoipniomddiboikkf)**
- Primary validation target: current desktop Chrome
- Edge and Whale: Chromium compatibility targets; final browser-specific manual validation remains
- Firefox: not in the 1.0 scope and may be considered later

Automated regression coverage uses non-identifying fixtures and bundled Chromium. Live browser and YouTube Music Premium checks are tracked in the [release checklist](docs/release-checklist.md).

## Development

Requirements:

- Node.js 22.13.0 or later
- npm

```sh
npm install
npm run dev
npm run build
npm run zip
npm run verify:all
```

Build artifacts:

- Unpacked Chrome extension: `.output/chrome-mv3`
- Prepared release ZIP: `.output/noai-music-0.9.1-chrome.zip`

## Documentation

- [Technical design](docs/technical-design.md)
- [YouTube disclosure detection](docs/youtube-disclosure-detection.md)
- [YouTube card filtering](docs/youtube-card-filtering.md)
- [YouTube Music identity](docs/youtube-music-identity.md)
- [YouTube Music card filtering](docs/youtube-music-card-filtering.md)
- [YouTube Music auto-skip](docs/youtube-music-auto-skip.md)
- [Allowlist](docs/allowlist.md)
- [Direct blocklist](docs/blocklist.md)
- [Privacy policy](docs/privacy.md)
- [Chrome Web Store listing](docs/store-listing.md)
- [0.9.1 release status and 1.0.0 checklist](docs/release-checklist.md)

## License

[MIT License](LICENSE)
