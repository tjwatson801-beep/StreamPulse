# StreamPulse Core 0.1.0-alpha.45

Golden Moments turns local livestream recordings into clips inside StreamPulse.

- Import MP4, MOV, MKV, and WebM recordings, preview them, and choose start/end times.
- Find up to eight suggestions around audio peaks, then review and adjust each clip.
- Export H.264/AAC MP4 in original framing, vertical fit with black bars, or vertical center crop.
- Show job progress and cancel analysis or export; incomplete outputs are removed.
- Detect FFmpeg/FFprobe from PATH or an extracted FFmpeg download. A manually chosen tools folder is saved across restarts.
- Protect recordings from overwrite, including destination aliases, and prevent closing or installing an update during a video job.

FFmpeg and FFprobe are external prerequisites. This release detects the locally installed tools; it does not bundle them. Audio suggestions measure volume changes, not humor or conversation meaning. Transcripts, captions, branding, and live-event alignment are future work.

Validation: release regression suite; real FFmpeg tests using synthetic video/audio through the production preload and UI, preview playback, all export framings, silent video, cancellation, source preservation, and output decoding. Packaged-file testing and installer metadata validation are recorded in the alpha.45 validation report. Public GitHub update delivery and an in-place installation require separate verification.
