import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export const videoBinary = (name: string) => name + (process.platform === 'win32' ? '.exe' : '');
export const hasVideoTools = (folder: string) => ['ffmpeg','ffprobe'].every(name => existsSync(path.join(folder, videoBinary(name))));

export async function discoverVideoTools(downloads: string, resources: string) {
  const directories = [path.join(resources, 'video-tools'), ...(process.env.PATH || '').split(path.delimiter).filter(Boolean)];
  for (const folder of directories) if (hasVideoTools(folder)) return folder;
  // Support the usual extracted FFmpeg download without recursively searching the user's files.
  try {
    const entries = await fs.readdir(downloads, {withFileTypes:true});
    for (const entry of entries.filter(item => item.isDirectory() && /^ffmpeg/i.test(item.name)).reverse()) {
      const base = path.join(downloads, entry.name);
      for (const folder of [base, path.join(base, 'bin')]) if (hasVideoTools(folder)) return folder;
      for (const nested of await fs.readdir(base, {withFileTypes:true})) {
        if (!nested.isDirectory() || !/^ffmpeg/i.test(nested.name)) continue;
        const folder = path.join(base, nested.name, 'bin');
        if (hasVideoTools(folder)) return folder;
      }
    }
  } catch { /* A manual folder can be selected if automatic discovery fails. */ }
  return '';
}

export class AudioEnergy {
  private remainder: Buffer = Buffer.alloc(0);
  private samples = 0;
  private sum = 0;
  readonly levels: number[] = [];
  feed(chunk: Buffer) {
    const buffer = this.remainder.length ? Buffer.concat([this.remainder, chunk]) : chunk;
    const limit = buffer.length - buffer.length % 2;
    for (let offset = 0; offset < limit; offset += 2) {
      const value = buffer.readInt16LE(offset) / 32768;
      this.sum += value * value;
      if (++this.samples === 8000) this.flush();
    }
    this.remainder = buffer.subarray(limit);
  }
  finish() { if (this.samples) this.flush(); return this.levels; }
  private flush() { this.levels.push(10 * Math.log10(Math.max(1e-12, this.sum / this.samples))); this.samples = 0; this.sum = 0; }
}

export type AudioHighlight = {start: number; end: number; peakAt: number; levelDb: number; reason: string};
function suggestSectionHighlights(levels: number[], duration: number): AudioHighlight[] {
  if (!levels.length) return [];
  const sorted = [...levels].sort((a,b) => a-b);
  const baseline = sorted[Math.floor(sorted.length/2)];
  const length = Math.min(30, duration);
  const candidates = levels.map((levelDb, index) => ({levelDb, index})).filter(item => item.levelDb > -45 && item.levelDb >= baseline + 3).sort((a,b) => b.levelDb-a.levelDb);
  const result: AudioHighlight[] = [];
  for (const item of candidates) {
    const start = Math.max(0, Math.min(duration-length, item.index-8));
    const end = Math.min(duration, start+length);
    if (result.some(other => Math.min(end,other.end)-Math.max(start,other.start) > length*0.5)) continue;
    result.push({start, end, peakAt:item.index, levelDb:Math.round(item.levelDb*10)/10, reason:'Audio peak above the recording’s typical level'});
    if (result.length === 8) break;
  }
  return result;
}

export function suggestAudioHighlights(levels: number[], duration: number): AudioHighlight[] {
  // Decode once; analyze the one-second energy samples in overlapping windows.
  // Short recordings retain the existing detector and ordering.
  if(duration<=900)return suggestSectionHighlights(levels,duration);
  const candidates: (AudioHighlight & {prominence:number})[]=[];
  for(let offset=0;offset<levels.length;offset+=840){
    const section=levels.slice(offset,offset+900);
    const sectionDuration=Math.min(section.length,duration-offset);
    if(sectionDuration<=0)break;
    const sorted=[...section].sort((a,b)=>a-b);
    const baseline=sorted[Math.floor(sorted.length/2)];
    for(const item of suggestSectionHighlights(section,sectionDuration)){
      const peakAt=offset+item.peakAt;
      const length=Math.min(30,duration);
      // Use original recording times, with context on both sides of a window edge.
      const start=Math.max(0,Math.min(duration-length,peakAt-8));
      candidates.push({...item,start,end:start+length,peakAt,prominence:item.levelDb-baseline,reason:'Audio peak above this 15-minute section’s typical level'});
    }
    if(offset+900>=levels.length)break;
  }
  candidates.sort((a,b)=>b.prominence-a.prominence || b.levelDb-a.levelDb || a.peakAt-b.peakAt);
  const result:AudioHighlight[]=[];
  for(const item of candidates){
    if(result.some(other=>Math.min(item.end,other.end)-Math.max(item.start,other.start)>(item.end-item.start)*0.5))continue;
    const {prominence,...highlight}=item;result.push(highlight);
    if(result.length>=64)break;
  }
  return result.sort((a,b)=>a.peakAt-b.peakAt);
}
