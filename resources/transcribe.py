"""Offline caption worker using an application-private runtime."""
import json
import os
import subprocess
import sys
from pathlib import Path

runtime = Path(sys.argv[-1]).resolve()
sys.path.insert(0, str(runtime / 'speech-libs'))
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
import numpy as np
from faster_whisper import WhisperModel

model_path = runtime / 'model'
model = WhisperModel(str(model_path) if model_path.is_dir() else 'small.en', device='cpu', compute_type='int8', download_root=str(runtime / 'speech-models'), local_files_only=True)
if sys.argv[1] == '--check':
    print(json.dumps({'ready': True}))
    sys.exit(0)
ffmpeg, source, start, length, _ = sys.argv[1:]
raw = subprocess.check_output([ffmpeg, '-nostdin', '-v', 'error', '-ss', start, '-i', source, '-t', length, '-map', '0:a:0', '-f', 'f32le', '-ac', '1', '-ar', '16000', '-'], creationflags=0x08000000 if os.name == 'nt' else 0)
segments, _ = model.transcribe(np.frombuffer(raw, dtype=np.float32), word_timestamps=True, beam_size=5)
words = []
previous = 0
for segment in segments:
    for word in segment.words or []:
        a = max(previous, word.start)
        b = min(float(length), max(a+0.02, word.end))
        if b > a:
            words.append({'start': round(a,3), 'end': round(b,3), 'text': word.word.strip()})
            previous = b
print(json.dumps(words))
