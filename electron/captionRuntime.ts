import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
export type CaptionRuntime = { python: string; runtime: string; bundled: boolean };
export function bundledCaptionRuntime(resources: string): CaptionRuntime | null {
  const runtime = path.join(resources, 'caption-runtime');
  const python = path.join(runtime, 'python', 'python.exe');
  const required = [python, path.join(runtime, 'speech-libs', 'faster_whisper', '__init__.py'), ...['model.bin','config.json','tokenizer.json','vocabulary.txt'].map(name => path.join(runtime, 'model', name))];
  return required.every(existsSync) ? { python, runtime, bundled: true } : null;
}
export async function resolveCaptionRuntime(resources: string, savedFile: string): Promise<CaptionRuntime> {
  const bundled = bundledCaptionRuntime(resources);
  if (bundled) return bundled;
  try {
    const saved = JSON.parse(await fs.readFile(savedFile, 'utf8'));
    if (typeof saved.python === 'string' && typeof saved.runtime === 'string' && existsSync(saved.python) && existsSync(path.join(saved.runtime, 'speech-libs')) && existsSync(path.join(saved.runtime, 'speech-models'))) return {...saved, bundled: false};
  } catch {}
  throw Error('Local captions are unavailable. Reinstall the complete StreamPulse beta, or configure an external caption runtime under Advanced tools.');
}
