# Pearl Preview — Stream Credits Manager

This directory contains the existing Midnight Pearl preview application plus the Credits Manager, version 0.1.0-pearl.8. The root StreamPulse sources and the existing GitHub credits implementation remain available independently.

Build from this directory with `npm ci`, `npx electron scripts/render-pearl-icon.cjs`, `npm run build` and `npx tsc --noEmit`. To create a Windows installer: `npm run dist:win -- --publish never`. Shared OCR, transcription and tunnel resources are loaded from `../resources`, without machine-specific C: paths. The packaged app retains `com.pearl.preview`, product name Pearl Preview, and the Pearl Preview userData profile. Settings, credentials, personal media and session archives are never included in the installer.

Open Credits Manager in the sidebar. Collection starts when a LIVE connects. Confirmed room IDs separate broadcasts; reconnecting retains the current session. With no reported room boundary, use End collection and Start new livestream between broadcasts. Each saved livestream has its own title, viewers, ordering and exclusions in stream-credits.json, separate from settings backups. Completed gift units, observed chat/likes, new follows and explicit Super Fan entries are tracked. No full follower roster, gift coin value or inferred TikTok status is claimed. Supporters use the editor order; this is not TikTok's monetary leaderboard.

Edit names and sections, add viewers manually, move them up/down, exclude them or remove them. Removal stays effective against later events; re-add the username to restore it. Play/pause/restart and fullscreen control the preview. Save HTML outro creates a standalone animation snapshot for a browser or compatible local browser source, ending with xGOLDx / STAY GOLDEN. This does not encode an MP4.

Tests: node tests/credits-manager.cjs and npx electron tests/credits-ui.cjs. Existing TikFinity/direct providers, likes, gift completion, TTS, actions, settings, reactions, reconnect and entrance checks are included in the release workflow. The GitHub Actions workflow publishes installers to the existing pearl-preview-updates channel after build, tests and metadata verification. The source stays on feature/stream-credits-manager; main is not merged or changed. Test the actual LIVE Studio capture after updating.


Compatible dependency fixes were applied to Pearl's independent lockfile. Runtime npm audit reports zero vulnerabilities; remaining moderate audit findings are in build tooling. No forced major-version dependency upgrades were used.

