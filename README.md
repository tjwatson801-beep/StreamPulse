# StreamPulse Core

A focused Windows desktop application for TikTok LIVE Studio:

- TikTool LIVE connection with encrypted API-key storage
- Chat text-to-speech for everyone, followers, or subscribers
- Gift-specific TTS and visual reactions
- Sound Library and live soundboard: searchable clips, names, tags, favorites, global hotkeys, and alert assignments
- Shared sound master volume, queue/interrupt/overlap playback, and Stop all sounds
- Local transparent gift overlay for TikTok LIVE Studio
- Mock chat and gift testing
- One combined event/action activity log

## Development

```powershell
npm install
npm run dev
```

## Build

```powershell
npm run build
npm run dist:win
```

TikTok LIVE Studio overlay URL: `http://127.0.0.1:17890/overlay/gifts`

## Sound Library

Open **Sound Library** to scan the local `Documents/StreamPulse/Sounds` folder. Use **Choose folder** for another location. Audio files appear automatically every 10 seconds, or immediately with **Refresh**. Supported files: MP3, WAV, OGG, M4A, AAC, FLAC, and WebM; codec availability depends on Electron.

Give clips a friendly name, tags, or a favorite star. **Play** previews/triggers the clip. Global hotkeys such as `Ctrl+Alt+1` or `F1` work while StreamPulse is open, including from other apps. Invalid, duplicate, or unavailable shortcuts show a warning. Hotkeys pause while editing a field in the focused StreamPulse window.

**Assign to alert** selects an existing gift reaction, sticker alert, or Super Fan profile, plus follower and default Super Fan sounds. Assignment updates the sound without changing the alert's enable switch. Create individual alert rules on their existing pages first.

Sound master volume applies to all soundboard and event sounds, separately from TTS. **Allow overlap** preserves existing playback behavior; **Queue in order** waits for the current sound to end; **Interrupt current sound** replaces it. Changing modes stops current sounds. Queues keep up to 20 clips and skip clips waiting over 30 seconds. **Stop all sounds** clears both playing sounds and the queue, and is also available on the Live page. Names, tags, favorites, shortcuts, folder choice, and playback settings are included in settings backups; audio files remain in their folder.
