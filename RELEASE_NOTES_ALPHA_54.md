# StreamPulse alpha.54 — viewer display names

Viewer-facing names use the TikTok display name when supplied, with username fallback. Applies to chat TTS, gift/follow messages, Super Fan welcomes, activity, like/gift celebrations and the like leaderboard. Usernames still identify viewers for totals, duplicate handling and Super Fan matching. Like rankings retain the latest known display name when subsequent events omit it.

Message templates use {username} or {nickname} for the display name and {handle} for the actual TikTok username. Webhook URLs keep {username} as the actual account identifier and use {nickname} for the display name. Profile configuration still requires the actual username.

This is a local alpha update for the current installation; the standalone beta.1 remains unchanged. LIVE Studio verification and in-place installation require user testing.

Validation: production build, both TypeScript checks, full regression suite, provider/identity tests, actual preload/UI tests for TTS and Super Fan matching, and browser overlay tests for display-name rendering and safe text handling passed. Installation into the user's active app and real LIVE Studio verification remain untested.
