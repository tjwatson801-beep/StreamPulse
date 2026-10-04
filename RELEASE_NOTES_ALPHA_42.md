# StreamPulse Core 0.1.0-alpha.42

Gift alerts and Super Fan entrances now have separate browser-source URLs and independent alert queues.

- Add the Super Fan URL from Overlay as a new browser/Link source in TikTok LIVE Studio. Your existing gift source now shows gifts only. Saved Super Fan profiles are preserved.
- Settings finish saving before closing the app or installing an update. Failed saves are reported before closing.
- Backups validate nested rules and profile data before restoration.
- Secure tunnels recover automatically after unexpected process exits, with bounded retries and refreshed connection status. Temporary tunnel recovery can change the URL; copy the new URL into Studio when needed.
- Release checks now cover overlay separation, queue limits, repeated GIFs, HTTP fallback, immediate settings saves, and tunnel recovery.

Validation: production build, both TypeScript checks, regression suite, hidden-browser overlay and settings tests, and visual overlay review passed. Installer metadata and archive checks are performed before publication.

The installed alpha 41 to alpha 42 update and real LIVE Studio connection checks remain for user verification. This alpha installer remains unsigned.
