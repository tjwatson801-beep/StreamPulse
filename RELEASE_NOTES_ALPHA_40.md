# StreamPulse Core Alpha 40

- Adds Settings > StreamPulse updates and update-available notifications.
- Checks public GitHub releases on startup, including alpha releases.
- Downloads only when requested, with progress and release notes.
- Install and restart requires confirmation and disconnecting from LIVE.
- Closing the app never installs a downloaded update automatically.
- Saves current settings before installation; existing settings and rules are retained.

Install this version manually once to enable in-app updates.

Future GitHub releases must include the generated installer, its .blockmap, and latest.yml together. Build with npm run dist:win -- --publish never. Upload all assets to a draft release, then publish it only after uploads complete. Do not edit the generated checksums or rename the installer.

Validation: production build, renderer and main-process TypeScript checks, updater lifecycle tests, gift-action/webhook/TTS/reaction regression checks. Real installation of a newer version must be tested when a subsequent release is available.
