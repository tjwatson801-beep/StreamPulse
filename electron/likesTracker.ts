import { LiveEvent } from "./providers/LiveProvider";

export type LikeRow = { user: string; profilePictureUrl?: string; likes: number; rank: number };
export type LikesSnapshot = { type: "likes-leaderboard"; streamer: string; roomId: string; startedAt: string; totalLikes: number | null; trackedLikes: number; viewers: number; leaders: LikeRow[] };

export class LikesTracker {
  private streamer = "";
  private roomId = "";
  private startedAt = new Date().toISOString();
  private totalLikes: number | null = null;
  private trackedLikes = 0;
  private people = new Map<string, { user: string; profilePictureUrl?: string; likes: number }>();
  private seen = new Set<string>();

  confirmRoom(streamer: string, roomId: string) {
    const normalized = streamer.trim().replace(/^@/, "").toLowerCase();
    if ((this.streamer && normalized && normalized !== this.streamer) || (this.roomId && roomId && roomId !== this.roomId)) this.reset();
    if (normalized) this.streamer = normalized;
    if (roomId) this.roomId = roomId;
  }
  reset() {
    this.startedAt = new Date().toISOString();
    this.totalLikes = null;
    this.trackedLikes = 0;
    this.people.clear();
    // Keep recent delivery IDs so a replay after a manual reset is not counted.
  }
  startStream(streamer: string, roomId: string) {
    const changed = (this.streamer && streamer.trim().replace(/^@/, "").toLowerCase() !== this.streamer) || (this.roomId && roomId && this.roomId !== roomId);
    if (changed) { this.reset(); this.seen.clear(); this.roomId = ""; }
    this.confirmRoom(streamer, roomId);
  }
  add(event: LiveEvent) {
    if (event.type !== "Like") return false;
    if (event.id && this.seen.has(event.id)) return false;
    if (event.id) {
      this.seen.add(event.id);
      if (this.seen.size > 20000) this.seen.delete(this.seen.values().next().value!);
    }
    if (typeof event.totalLikeCount === "number" && Number.isSafeInteger(event.totalLikeCount) && event.totalLikeCount >= 0) {
      this.totalLikes = Math.max(this.totalLikes ?? 0, event.totalLikeCount);
    }
    const count = event.likeCount;
    const user = event.user.trim().replace(/^@/, "");
    if (typeof count !== "number" || !Number.isSafeInteger(count) || count <= 0 || !user) return true;
    const key = user.toLowerCase();
    const existing = this.people.get(key);
    let profilePictureUrl = existing?.profilePictureUrl;
    try {
      if (event.profilePictureUrl) {
        const url = new URL(event.profilePictureUrl);
        if (url.protocol === "https:" && !url.username && !url.password) profilePictureUrl = url.href;
      }
    } catch { /* Keep the last usable picture when an event omits or has an invalid URL. */ }
    this.people.set(key, { user, profilePictureUrl, likes: Math.min(Number.MAX_SAFE_INTEGER, (existing?.likes || 0) + count) });
    this.trackedLikes = Math.min(Number.MAX_SAFE_INTEGER, this.trackedLikes + count);
    return true;
  }
  viewerLikes(user: string) { return this.people.get(user.trim().replace(/^@/, "").toLowerCase())?.likes || 0; }
  snapshot(): LikesSnapshot {
    const sorted = [...this.people.values()].sort((a, b) => b.likes - a.likes || a.user.toLowerCase().localeCompare(b.user.toLowerCase()));
    let rank = 0, previous = -1;
    const leaders = sorted.slice(0, 10).map((row, index) => {
      if (row.likes !== previous) rank = index + 1;
      previous = row.likes;
      return { ...row, rank };
    });
    return { type: "likes-leaderboard", streamer: this.streamer, roomId: this.roomId, startedAt: this.startedAt, totalLikes: this.totalLikes, trackedLikes: this.trackedLikes, viewers: this.people.size, leaders };
  }
}

