# StreamPulse alpha.56 — default gift sound

Gift Reactions > Default gift response now includes a custom sound for gifts without a dedicated sound. Choose/change a file, preview it, clear it, and set its volume. Playback also follows Sound master volume and the existing overlap/queue/interrupt mode. Sound Library offers Default gift sound under Assign to alert.

Dedicated reaction sounds keep priority. An enabled reaction with no sound uses the default, as do gifts without a configured reaction. Disabled reactions and the global Reactions enabled switch suppress the fallback. Partial gift combos do not trigger it. A matching Actions sound rule suppresses the fallback to avoid adding a second sound; existing explicit actions and dedicated reactions remain independent.

The sound path and volume save automatically and are included in settings backups. Clearing the file disables the fallback. Existing installations start with no default sound, preserving prior behavior. Audio files remain at their selected locations.

Validation includes production-preload UI/event tests for file selection, preview, master volume, priority, disabled/partial gifts, sound actions, settings reload, library assignment and clearing; settings type/range checks and backup/restore. Full release checks and packaged verification are recorded in the release validation report.
Completed verification: full release regression checks passed; the actual packaged alpha 56 passed default gift sound controls/playback tests at 940px window width, including priority, volume, persistence, library assignment and clearing. Installer/blockmap and exact SHA-512 update metadata verified. Installer remains unsigned and has not been installed or published automatically.
