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

## Golden Moments

Open **Golden Moments** to import an MP4, MOV, MKV, or WebM recording, preview it, select start/end times, and export an H.264/AAC MP4. FFmpeg and FFprobe are required. StreamPulse detects tools on PATH and in an extracted FFmpeg download, or use **Choose video tools folder**. Manually selected folders are saved across restarts. Video tools are external and are not included in the installer.

**Find audio highlights** analyzes recordings longer than 15 minutes in overlapping 15-minute sections, combines the results, removes duplicate moments, and returns up to 64 suggestions in recording order. Short recordings return up to eight suggestions. Each section uses its own audio baseline so quieter parts of a long stream can produce suggestions. Review each moment for context and adjust its boundaries before exporting. Suggestions measure audio energy; they do not recognize jokes, meaning, or gift/chat events. Silent recordings still support manual clipping.

The preview timestamp identifies the moment being reviewed and the recording name. Camera focus enlarges the camera in the top third of a vertical recording, with gameplay underneath and compact branding at the bottom. Optional audio polish normalizes clip volume. Eight caption fonts and a live font sample are available, with gold highlights on spoken words. The player displays the source; final framing and burned captions appear in the exported MP4.

Moments appear in a compact dropdown beside the player, showing time, category and search method. Previous/Next browse the filtered results while keeping the player in view. The current moment's details remain visible, including when a new filter excludes it.

Local captions require Python, faster-whisper libraries in a `speech-libs` folder, and the cached small.en model in `speech-models`. Select your Python executable and the parent runtime folder with **Set up local captions**. These speech dependencies and font files are not bundled in the installer. Captions have editable word text and start/end times relative to the selected clip. Regenerate captions after changing the cut.

**Search selected methods** combines general audio peaks with editable spoken cues and optional experimental visual text search. Initial spoken cues are Got one, Team wipe, Victory and Clip that. Visual search uses Windows OCR to find Eliminated or Victory Royale within an adjustable region, sampling every two seconds. Results retain their source/category labels and can be filtered. OCR matches do not establish whose kill or win happened, and brief/stylized messages may be missed. Failed optional methods are reported while successful results remain available.

For **Montage**, review and trim a moment, assign its category, then add the selected cut. Export mixed highlights, kills, wins or general selections, with maximum lengths of 15/30/60 seconds and up to three distinct versions using recording order, reverse order or alternating cuts. Camera layout, regenerated captions, font/word highlights and audio polish are supported. Montage uses cuts from the currently imported recording. Source clips totaling less than the requested maximum produce shorter versions. The original recording is preserved.

**Preview edited clip** renders a temporary playback copy of the selected cut with your current camera/framing, generated captions, word highlights and audio polish. It plays inside StreamPulse without asking for a save destination. Generate captions first if you want them included. Changing the cut or editing settings clears the old preview; export remains a separate action. Preview generation takes time and supports cancellation.

Export with the original aspect ratio, fit the full recording into a 1080 × 1920 vertical frame with black bars, or center-crop to vertical. Preview codec support depends on Electron; H.264 MP4 is a suitable starting format. Processing stays on this computer. Progress and cancellation are available for analysis and encoding. Partial exports are removed, and recording paths and file aliases are protected from overwrite. Finish or cancel the active video job before closing the app or installing an update.

Build and run `npm run video:check` for real FFmpeg tests through the production preload and UI using synthetic media. Set `STREAMPULSE_TEST_PACKAGE` to a packaged `resources/app.asar` path to run the same tests against a packaged build. `npm run release:check` includes backend unit/integration tests and the existing regression suite.

## Sound Library

Open **Sound Library** to scan the local `Documents/StreamPulse/Sounds` folder. Use **Choose folder** for another location. Audio files appear automatically every 10 seconds, or immediately with **Refresh**. Supported files: MP3, WAV, OGG, M4A, AAC, FLAC, and WebM; codec availability depends on Electron.

Give clips a friendly name, tags, or a favorite star. **Play** previews/triggers the clip. Global hotkeys such as `Ctrl+Alt+1` or `F1` work while StreamPulse is open, including from other apps. Invalid, duplicate, or unavailable shortcuts show a warning. Hotkeys pause while editing a field in the focused StreamPulse window.

**Assign to alert** selects an existing gift reaction, sticker alert, or Super Fan profile, plus follower and default Super Fan sounds. Assignment updates the sound without changing the alert's enable switch. Create individual alert rules on their existing pages first.

Sound master volume applies to all soundboard and event sounds, separately from TTS. **Allow overlap** preserves existing playback behavior; **Queue in order** waits for the current sound to end; **Interrupt current sound** replaces it. Changing modes stops current sounds. Queues keep up to 20 clips and skip clips waiting over 30 seconds. **Stop all sounds** clears both playing sounds and the queue, and is also available on the Live page. Names, tags, favorites, shortcuts, folder choice, and playback settings are included in settings backups; audio files remain in their folder.
