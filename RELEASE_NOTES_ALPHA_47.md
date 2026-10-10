# StreamPulse alpha.47 — Golden Moments editing

Golden Moments now exports a camera-focused layout, styled captions with gold word highlights, and optional audio normalization. Captions have editable text and word times, relative to the selected clip. Changing the recording or cut requires regenerating captions.

Camera focus is designed for vertical recordings with a camera in the top third, gameplay below it, and branding at the bottom, matching the Count Speed and Neo Joins examples. It is not automatic face detection. The player previews the source; review the exported video for the final layout and captions.

Local captions require a Python executable and a runtime folder containing `speech-libs` (faster-whisper and its dependencies) and `speech-models` (cached small.en model). Use **Set up local captions** to choose both. This release does not bundle Python or download a model automatically. Recordings remain on the computer. Bauhaus 93 must be installed; other font choices are available.

Workflow: import → select the cut → generate captions → correct words/times → select camera focus, font, word highlights, audio polish → export MP4. Exports preserve the source recording.

No GitHub release is published by the local build.
