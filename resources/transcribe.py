"""Local-only speech worker. No video or audio is uploaded."""
import json
import subprocess
import sys
from pathlib import Path
import numpy as np
from faster_whisper import WhisperModel

ffmpeg, source, start, length, runtime = sys.argv[1:]
raw = subprocess.check_output([ffmpeg, '-nostdin', '-v', 'error', '-ss', start, '-i', source, '-t', length, '-map', '0:a:0', '-f', 'f32le', '-ac', '1', '-ar', '16000', '-'])
model = WhisperModel('small.en', device='cpu', compute_type='int8', download_root=str(Path(runtime)/'speech-models'), local_files_only=True)
segments, _ = model.transcribe(np.frombuffer(raw, dtype=np.float32), word_timestamps=True, beam_size=5)
words = []
previous = 0
for segment in segments:
    for word in segment.words or []:
        a = max(previous, word.start)
        b = min(float(length), max(a+0.02, word.end))
        if b > a:
            words.append({'start':round(a,3), 'end':round(b,3), 'text':word.word.strip()})
            previous = b
print(json.dumps(words))
