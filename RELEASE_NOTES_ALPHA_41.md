# StreamPulse Core Alpha 41

- Adds automatic settings backups on startup, before updates, and before saves at hourly intervals; retains 20 snapshots.
- Adds Back up now and Restore selected backup in Settings, with confirmation and a LIVE connection guard.
- Serializes settings writes and uses atomic replacement. Damaged settings are preserved during recovery instead of silently overwritten.
- Adds separate TikTok, local overlay, Cloudflare process, and public-overlay health checks.
- Prevents duplicate instances of this build and focuses the existing window.
- Adds a repeatable release check and Windows signing setup checklist.

Backups include settings, rules, and file paths, not the media files themselves or encrypted credentials. Restart after restoring connection or tunnel settings. Old builds without single-instance support should be closed before launching this version.

Validation: production and TypeScript checks; updater, backup/recovery, single-instance, health, gift, TTS, provider and reconnect regression tests; hidden-browser overlay and backup/restore UI tests. Actual alpha.40-to-alpha.41 installation and restart verification is pending an offline test. Installer signing still requires a publisher certificate or cloud-signing account.
