# NoAI

> Block AI music on YouTube. Skip it on YouTube Music.

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Install-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/noai/eiddibmnpcdbgdmeoipniomddiboikkf)
[![GitHub Release](https://img.shields.io/github/v/release/yoobilee/noai-music?display_name=release&label=GitHub%20Release)](https://github.com/yoobilee/noai-music/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[한국어](README.ko.md)

NoAI is an open-source browser extension for filtering content that YouTube officially labels as AI or altered.

Choose **Music only** to focus on content categorized as Music by YouTube, or **All AI-labeled content** to filter all supported disclosed content. On YouTube Music, matching content can also be skipped automatically.

NoAI does not use its own AI detector and does not guess from titles, channel names, thumbnails, or audio characteristics.

## Why NoAI

AI-generated music can appear alongside other content while browsing YouTube and YouTube Music.

NoAI takes a conservative approach: it uses YouTube's own disclosure and structured metadata instead of trying to guess whether something is AI-generated.

If the required evidence cannot be confirmed, NoAI leaves the content unchanged.

## Features

- **Music only or all AI-labeled content**

  Choose whether filtering applies only to content categorized as Music by YouTube or to all supported AI-labeled content.

- **Hide, blur, or mark**

  Control how matching content appears instead of using one fixed filtering behavior.

- **YouTube Music auto-skip**

  Automatically move past matching content during playback.

- **Allow and block rules**

  Keep content or artists you want, or directly block specific content, artists, and channels. Allow rules take priority over direct blocks.

- **No guessing**

  Use YouTube's official disclosure and structured metadata instead of a custom AI detector.

- **Private by design**

  No ads, analytics, telemetry, or NoAI account.

## How it works

NoAI uses YouTube's official AI or altered-content disclosure as its primary signal.

When **Music only** is selected, filtering is limited to content categorized as Music by YouTube. When **All AI-labeled content** is selected, the same disclosure policy applies to all supported content.

NoAI intentionally takes a conservative approach:

- no AI model of its own
- no title or channel-name heuristics
- no audio-based guessing
- unknown or unverifiable items are left unchanged

An official disclosure means that YouTube has labeled the content as AI or altered. It does not necessarily mean the music itself was fully AI-generated.

## Installation

### Chrome Web Store

[Install NoAI from the Chrome Web Store](https://chromewebstore.google.com/detail/noai/eiddibmnpcdbgdmeoipniomddiboikkf)

Install the extension from the store to receive updates through your browser.

### GitHub Releases

[Download the latest packaged build from GitHub Releases](https://github.com/yoobilee/noai-music/releases)

Extract the ZIP, enable Developer mode on `chrome://extensions`, and choose **Load unpacked** to select the extracted directory.

### Development build

To run or package NoAI from source, see [Development](#development).

## Privacy

NoAI has no account system or developer-operated server, and it includes no ads, analytics, or telemetry.

Settings, user rules, and a minimal disclosure cache are stored in `storage.local`. NoAI does not use Chrome Sync or send this data to a developer server.

To verify YouTube's official disclosure, NoAI may request a public YouTube watch page without Google account credentials. It does not request the `tabs`, `activeTab`, `history`, `cookies`, `identity`, or `<all_urls>` permissions.

See the [privacy policy](docs/privacy.md) for details.

## Development

### Requirements

- Node.js 22.13+
- npm

### Setup

```sh
git clone https://github.com/yoobilee/noai-music.git
cd noai-music
npm install
npm run dev
```

### Validation

```sh
npm run verify:all
```

### Production build

```sh
npm run build
npm run zip
```

The unpacked extension is written to `.output/chrome-mv3`.

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
- [Release checklist](docs/release-checklist.md)
- [Music signal follow-up](docs/music-signal-followup.md)
- [YouTube filter latency investigation](docs/youtube-filter-latency-investigation.md)

More documentation is available in [`docs/`](docs/).

## Contributing

Issues and pull requests are welcome.

Before submitting a change, please keep NoAI's core principles in mind:

- do not classify AI content by guessing
- prefer structured, verifiable signals
- leave content unchanged when identity or evidence cannot be confirmed
- avoid unnecessary permissions, tracking, or external services

Use [GitHub Issues](https://github.com/yoobilee/noai-music/issues) for bug reports and feature requests.

## Support

NoAI is free and open source.

If NoAI is useful to you, you can support continued development through [GitHub Sponsors](https://github.com/sponsors/yoobilee). Sponsorship is optional and does not unlock additional features.

## License

NoAI is available under the [MIT License](LICENSE).
