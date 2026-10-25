# StreamPulse beta candidate

This is an internal development candidate, not yet cleared for outside distribution.

The beta installs as StreamPulse Beta and saves its own settings. Your alpha settings, domain and tunnel token are not copied. Run one StreamPulse installation at a time: overlays use the same local port. Automatic beta updates are disabled.

1. Open Setup and enter your TikTok username. Direct TikTok preserves the existing in-app workflow, but relies on an external signing service and can encounter access/rate limits. TikFinity is a fallback, not a requirement for Direct mode.
2. Start LIVE and connect. Check chat, gifts, likes, follows and entrances on your own account.
3. Copy your own overlay link into LIVE Studio. Temporary HTTPS links need no domain or Cloudflare account and can change on restart. The link is publicly reachable: keep it private.
4. Check tools and test voice. The candidate includes FFmpeg/FFprobe, private Python, caption libraries and the small.en model. No separate Python or FFmpeg installation is intended.
5. Import a recording, preview, trim and export. Generate captions and check the words before sharing. Segoe UI is the default caption font; other fonts may fall back if absent.

## Before outside testing
- Resolve redistribution/source obligations listed in resources/third-party-notices/INVENTORY.json.
- Confirm fresh Windows 10/11 x64 operation without Python, FFmpeg, Office fonts or developer tools installed.
- Verify real LIVE connection and every overlay in LIVE Studio.
- Confirm unsigned installer behavior, install/uninstall, app relaunch, settings isolation and manual beta upgrade.
- Record expected behavior, actual behavior and reproduction steps for failures. Inspect copied diagnostics for personal viewer information before sharing.
