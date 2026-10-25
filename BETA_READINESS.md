# StreamPulse beta.1 internal candidate — October 11, 2026

Based on alpha.53. Alpha.53 installer artifacts and the source snapshot in work/beta-baseline-alpha53 were preserved.

## Delivered
- Separate StreamPulse Beta installer identity and fresh per-user settings. Alpha account/domain/tunnel settings are not copied.
- First-run Setup screen with account connection, overlay links, voice test and tool checks. Setup is available later from the sidebar.
- Direct TikTok is the beta first-run selection, preserving the owner's existing in-app connection workflow. TikFinity remains a fallback. No managed-provider migration was made.
- Bundled FFmpeg/FFprobe, official private Python 3.14.8, caption libraries and the small.en speech model. Caption processing is offline and requires no manually selected Python/model folders.
- Optional temporary Cloudflare links; no developer domain or account token is included.
- Automatic beta updates disabled. Beta is provided through separate manual installers.
- Segoe UI default caption font; extra fonts retain fallback behavior.
- Dependency inventory and available license notices included in resources/third-party-notices.

## Artifact
release-beta1/StreamPulse-Beta-Setup-0.1.0-beta.1.exe
Size: 720.11 MiB
SHA256: 1C1D42CF4EA00C4A8F5AB1C41E35B9C664BA64B7D9CDD6BE2D77E2BDB98051BA
Authenticode: NotSigned
No installer was installed or published during this work.

## Verified
- Production build and TypeScript checks.
- Full release regression suite.
- Real Golden Moments tests: playback, selection, framing, highlights, OCR, montage, caption rendering, edited preview, cancellation and source preservation.
- Development AND actual packaged beta: production Setup/preload, fresh settings and restricted PATH, automatic bundled FFmpeg discovery, offline model check, synthetic speech transcription, captioned H.264 export and output decode. No external caption setup file was required.
- Packaged production main: correct beta version and fresh user-data directory, no alpha username/domain/tunnel credentials, Direct first-run choice, manual-only updates, packaged video tools and captions. Tests isolated account/overlay infrastructure; they did not connect a real LIVE or a real public tunnel.
- Setup screenshot visually inspected.
- Corrected beta packaging configuration explicitly includes only built app files plus intended resources. Old releases, development snapshots and personal settings are excluded.

## Still required before outside distribution
1. Resolve tiktok-live-connector AGPL-3.0-only obligations or replace/license the connector while preserving the in-app connection workflow. No decision to publish StreamPulse's source has been made.
2. Complete corresponding-source and build-material provisions for the GPL FFmpeg build and inspect the GPL-linked libraries included by PyAV. Existing license text/source links and inventory are not complete redistribution clearance.
3. Complete transitive notices/source requirements for all bundled binaries.
4. Fresh Windows 10/11 x64 installation without existing Python, FFmpeg, developer runtimes or Office fonts. Current-machine isolated tests are not a clean-OS test.
5. Actual tester LIVE account connection and every overlay in LIVE Studio, including temporary secure-link changes after restart.
6. Install/uninstall, restart, manual beta upgrade and unsigned-installer experience. Obtain publisher signing before a public commercial release.

## Usage constraints
Run one StreamPulse installation at a time; alpha and beta share the local overlay port. Temporary HTTPS overlay addresses can change on restart and are publicly reachable. Keep the link private. Direct TikTok still depends on external signing-service access and can encounter service limits.