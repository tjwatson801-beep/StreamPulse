# StreamPulse Core 0.1.0-alpha.46

Golden Moments now displays the current playback position over the preview as `HH:MM:SS.mmm` and total seconds. A separate seek slider and ±0.1/±1-second controls make it easier to find a cut point. Start/end inputs support millisecond increments and show formatted timestamps beside their values; the selection summary includes both boundaries and the precise duration.

The time display is a preview guide and is not burned into exports. Exported cuts remain constrained by the recording's video frames.

Validation: production build and TypeScript checks, release regressions, and real-video tests for fractional-second seeking, displayed timestamps, playhead-to-start capture, fine nudges, fractional clip boundaries, playback, and exports in all framings. Packaged-file tests verify the same workflow in alpha.46.
