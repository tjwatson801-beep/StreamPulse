# StreamPulse Core 0.1.0-alpha.44

Adds a Sound Library and live soundboard so local clips can be found, played, and assigned to LIVE alerts from one page.

- Scans the local Documents/StreamPulse/Sounds folder; supports choosing another folder, automatic refresh, and manual refresh.
- Search by friendly name, tag, or filename; save favorites and global hotkeys.
- Play clips manually or assign them directly to existing gift, sticker, Super Fan, and follower alerts.
- Global shortcuts work from other apps, show conflicts/invalid shortcuts, and pause while editing in the focused StreamPulse window.
- All event and soundboard clips share a sound master volume and queue, interrupt, or overlap playback modes. Existing alerts default to overlap.
- Stop all sounds clears active clips and queued clips from the soundboard or Live page. Queues are bounded to 20 entries and skip entries over 30 seconds old.
- Settings backups include sound metadata and playback settings. Audio files are not moved or included in backups.

Validation: production build, both TypeScript checks, release regression suite including soundboard playback/hotkey/persistence tests and hidden-browser UI tests; soundboard and overlay preview review. Packaged version, soundboard renderer/desktop APIs, updater configuration, installer size, blockmap, and exact SHA-512 update metadata verified.

Actual alpha 43 to alpha 44 installation/restart and LIVE Studio checks remain for user verification. This alpha installer remains unsigned.
