import WebSocket from "ws";
import { LiveEvent, LiveProvider, ProviderStatus } from "./LiveProvider";

// TikTool can deliver a standalone emote, a list, or inline chat emotes.
function readStickers(data: any) {
  const candidates = [data, ...(Array.isArray(data?.emotes) ? data.emotes : []), ...(Array.isArray(data?.emoteList) ? data.emoteList : [])];
  const stickers = new Map<string, { stickerId: string; stickerImageUrl?: string; stickerName?: string }>();
  for (const candidate of candidates) {
    const emote = candidate?.emote || candidate;
    // Generic id/url belong to entries inside sticker lists, not the chat message itself.
    const rawId = emote?.emoteId ?? (candidate !== data || candidate?.emote ? emote?.id : undefined);
    if ((typeof rawId !== "string" && typeof rawId !== "number") || !String(rawId).trim()) continue;
    const stickerId = String(rawId).trim();
    const readImage = (value: any, depth = 0): string | undefined => {
      if (!value || depth > 5) return;
      if (typeof value === "string") {
        try {
          const url = new URL(value.trim().replace(/^http:\/\//i, "https://").replace(/^\/\//, "https://"));
          if (url.protocol === "https:" && !url.username && !url.password) return url.href;
        } catch { /* Try the next image candidate. */ }
        return;
      }
      const entries = Array.isArray(value) ? value : [value.urlList, value.url_list, value.url, value.imageUrl];
      for (const entry of entries) { const image = readImage(entry, depth + 1); if (image) return image; }
    };
    const stickerImageUrl = readImage([emote.emoteUrl, emote.emoteImageUrl, emote.image,
      candidate !== data || candidate?.emote ? [emote.url, emote.imageUrl] : undefined]);
    const stickerName = typeof emote.name === "string" && emote.name.trim() ? emote.name.trim() : undefined;
    stickers.set(stickerId, { stickerId, stickerImageUrl: stickerImageUrl || stickers.get(stickerId)?.stickerImageUrl, stickerName: stickerName || stickers.get(stickerId)?.stickerName });
  }
  return [...stickers.values()];
}

export class TikToolProvider implements LiveProvider {
  private socket: WebSocket | null = null;
  private currentStatus: ProviderStatus = "disconnected";
  private events = new Set<(event: LiveEvent) => void>();
  private statuses = new Set<(status: ProviderStatus, message?: string) => void>();
  private rooms = new Set<(roomId: string) => void>();
  onRoom(handler: (roomId: string) => void) { this.rooms.add(handler); return () => this.rooms.delete(handler); }
  private manuallyClosing = false;
  private recent = new Map<string, number>();

  private confirmationTimer: NodeJS.Timeout | null = null;
  private roomConfirmed = false;
  private receivedCount = 0;
  private eventCounts: Record<string, number> = {};
  private deliveredCounts: Record<string, number> = {};
  private lastReceivedAt: string | null = null;
  private recentEntrances: Array<Record<string, string>> = [];
  constructor(private apiKey: string, private diagnostic: (message: string) => void = () => {}) {}
  diagnostics() { return { status: this.currentStatus, roomConfirmed: this.roomConfirmed, receivedCount: this.receivedCount, eventCounts: this.eventCounts, deliveredCounts: this.deliveredCounts, lastReceivedAt: this.lastReceivedAt, recentEntrances: this.recentEntrances }; }
  private recordEntrance(kind: string, data: any, outcome: string) {
    const clean = (value: unknown) => value ? this.safeMessage(value).replace(/[\r\n]/g, " ").slice(0, 160) : "";
    const entry = { time: new Date().toISOString(), kind: clean(kind),
      username: clean(data?.user?.uniqueId || data?.uniqueId || ""),
      nickname: clean(data?.user?.nickname || ""),
      displayType: clean(data?.displayType || ""), action: clean(data?.action || ""), outcome };
    this.recentEntrances.push(entry);
    if (this.recentEntrances.length > 50) this.recentEntrances.shift();
    this.diagnostic(`Entrance ${JSON.stringify(entry)}`);
  }
  private clearConfirmation() { if (this.confirmationTimer) clearTimeout(this.confirmationTimer); this.confirmationTimer = null; }
  private safeMessage(value: unknown) { return String(value || "Unknown error").split(this.apiKey.trim() || "__no_key__").join("[redacted]").slice(0, 1000); }

  status() { return this.currentStatus; }
  onEvent(handler: (event: LiveEvent) => void) { this.events.add(handler); return () => this.events.delete(handler); }
  onStatus(handler: (status: ProviderStatus, message?: string) => void) { this.statuses.add(handler); return () => this.statuses.delete(handler); }
  private setStatus(status: ProviderStatus, message?: string) { this.currentStatus = status; const safe = message ? this.safeMessage(message) : undefined; this.diagnostic(`Status ${status}: ${safe || ""}`); this.statuses.forEach(h => h(status, safe)); }

  async connect(username: string) {
    const uniqueId = username.trim().replace(/^@/, "");
    if (!uniqueId) throw new Error("Enter the TikTok LIVE username.");
    if (!this.apiKey.trim()) throw new Error("Save a TikTool API key first.");
    await this.disconnect(); this.manuallyClosing = false; this.recent.clear(); this.roomConfirmed = false; this.receivedCount = 0; this.eventCounts = {}; this.deliveredCounts = {}; this.lastReceivedAt = null; this.recentEntrances = [];
    this.setStatus("connecting", `Connecting to @${uniqueId}...`);
    const url = new URL("wss://api.tik.tools"); url.searchParams.set("uniqueId", uniqueId); url.searchParams.set("apiKey", this.apiKey.trim());
    await new Promise<void>((resolve, reject) => {
      let settled = false; const socket = new WebSocket(url); this.socket = socket;
      socket.once("open", () => { if (this.socket !== socket) return; settled = true; this.setStatus("connecting", "TikTool reached; waiting for LIVE room confirmation...");
        this.confirmationTimer = setTimeout(() => { if (this.socket === socket && this.currentStatus === "connecting") this.setStatus("error", "TikTool did not confirm the LIVE room within 30 seconds. Check that the saved username is LIVE, then copy diagnostics."); }, 30000);
        resolve(); });
      socket.on("message", raw => { if (this.socket !== socket) return; try { this.handle(JSON.parse(raw.toString())); } catch (error) { this.setStatus("error", "An incoming TikTool message could not be parsed. Copy diagnostics."); } });
      socket.once("error", error => { this.clearConfirmation(); this.setStatus("error", error.message); if (!settled) { settled = true; reject(new Error(this.safeMessage(error.message))); } });
      socket.on("close", (code, reason) => { if (this.socket !== socket) { if (!settled) reject(new Error("Connection cancelled")); return; } this.clearConfirmation(); this.socket = null; const text = reason.toString() || `code ${code}`; if (this.manuallyClosing) this.setStatus("disconnected", "Disconnected"); else this.setStatus("error", `TikTool closed: ${text}`); if (!settled) { settled = true; reject(new Error(this.safeMessage(text))); } });
    });
  }

  // Shared webcast decoder, also used by the local TikFinity provider.
  handle(payload: any) {
    const kind = String(payload?.event || payload?.type || payload?.data?.type || "").toLowerCase();
    const data = payload?.data || payload;
    this.receivedCount += 1; this.lastReceivedAt = new Date().toISOString();
    const diagnosticKind = kind.slice(0, 80) || "untyped";
    this.eventCounts[diagnosticKind] = (this.eventCounts[diagnosticKind] || 0) + 1;
    if (this.eventCounts[diagnosticKind] === 1) this.diagnostic(`Received ${diagnosticKind}; fields: ${Object.keys(data || {}).slice(0, 30).join(", ")}`);
    if (kind === "error" || payload?.error || data?.error) {
      this.clearConfirmation();
      const error = data?.error || payload?.error;
      this.setStatus("error", `TikTool: ${this.safeMessage(error?.message || error || data?.message || payload?.message || "Server rejected the LIVE connection")}`); return;
    }
    if (kind === "roominfo") { const roomId = String(data?.roomId || data?.room_id || payload?.roomId || ""); if (roomId) this.rooms.forEach(handler => handler(roomId)); this.clearConfirmation(); this.roomConfirmed = true; this.setStatus("connected", "LIVE room confirmed; listening for events"); return; }
    const socialAction = String(data?.action || data?.displayType || "").toLowerCase();
    const isFollow = kind === "follow" || (kind === "social" && socialAction.includes("follow"));
    // TikTool may expose the original barrage instead of a derived superFanJoin.
    // Match the documented entrance marker; other announcements are not entrances.
    const isBarrage = kind === "barrage";
    const barrageEntrance = isBarrage && String(data?.displayType || "").toLowerCase() === "ttlive_superfan_commentnotif_superfanjoined";
    const isSuperFanJoin = kind === "superfanjoin" || kind === "super_fan_join" || kind === "superfan" || kind === "fansevent" || barrageEntrance;
    const isSticker = ["emote", "emotechat", "webcastemotechatmessage"].includes(kind.replace(/[_-]/g, ""));
    const stickers = kind === "chat" || isSticker ? readStickers(data) : [];
    if ((kind === "chat" || isSticker) && (isSticker || data?.emotes?.length || data?.emoteList?.length)) {
      // Record field names only: no chat text, viewer data, URLs, or credentials.
      const entries = [...(Array.isArray(data?.emotes) ? data.emotes : []), ...(Array.isArray(data?.emoteList) ? data.emoteList : [])];
      const shape = entries.slice(0, 3).map(item => ({
        fields: item && typeof item === "object" ? Object.keys(item).slice(0, 20) : [typeof item],
        emoteFields: item?.emote && typeof item.emote === "object" ? Object.keys(item.emote).slice(0, 20) : [],
        imageFields: item?.image && typeof item.image === "object" ? Object.keys(item.image).slice(0, 20) : []
      }));
      this.diagnostic(this.safeMessage(`Sticker parse: event=${kind}; recognized=${stickers.length}; entries=${JSON.stringify(shape)}`));
      if (kind === "chat" && !stickers.length) this.emit({
        id: `sticker-unreadable-${Date.now()}-${Math.random()}`, type: "Sticker", user: "", time: new Date().toLocaleTimeString(),
        detail: "Chat contained sticker data without a readable sticker ID. Copy diagnostics from Live so this format can be checked."
      });
    }
    const isJoin = kind === "member" || kind === "join";
    if (isBarrage && !barrageEntrance) this.recordEntrance(kind, data, "Ignored: not a recognized entrance announcement");
    if (kind !== "like" && kind !== "chat" && kind !== "gift" && !isFollow && !isSuperFanJoin && !isJoin && !isSticker) return;
    if (this.currentStatus === "connecting") { this.clearConfirmation(); this.setStatus("connected", "Receiving LIVE events"); }
    const userData = data?.user || {}; const user = String(userData.uniqueId || data?.uniqueId || userData.nickname || "viewer");
    const identity = String(data?.messageUuid || data?.transactionId || data?.msgId || data?.id || "");
    const normalizedKind = isFollow ? "follow" : isSuperFanJoin ? "superfanjoin" : isJoin ? "join" : isSticker ? "emotechat" : kind;
    const key = identity ? `${normalizedKind}:${identity}:${stickers.map(item => item.stickerId).join(",")}${kind === "gift" ? `:${data?.repeatCount || 1}:${data?.repeatEnd ?? true}` : ""}` : `${normalizedKind}:${user}:${data?.comment || data?.giftName || data?.emoteId || ""}:${data?.repeatCount || 1}:${data?.repeatEnd ?? ""}`;
    const now = Date.now(); const previous = this.recent.get(key); this.recent.set(key, now);
    for (const [k, time] of this.recent) if (now - time > 5000) this.recent.delete(k);
    if ((kind !== "like" || identity) && previous !== undefined && now - previous < (identity ? 5000 : 750) && (identity || (!isJoin && !isSuperFanJoin && !isSticker && !stickers.length))) {
      if (isJoin || isSuperFanJoin) this.recordEntrance(kind, data, "Ignored: duplicate event ID");
      return;
    }
    if (isJoin || isSuperFanJoin) this.recordEntrance(kind, data, `Delivered: ${isJoin ? "Join" : "SuperFanJoin"}`);
    if (kind === "like") {
      const count = Number(data?.likeCount);
      const total = data?.totalLikeCount == null ? undefined : Number(data.totalLikeCount);
      this.emit({ id: identity || `${now}-${Math.random()}`, type: "Like",
        user: String(userData.uniqueId || data?.uniqueId || "").trim(), time: new Date().toLocaleTimeString(), detail: "sent likes",
        profilePictureUrl: typeof userData.profilePictureUrl === "string" ? userData.profilePictureUrl : undefined,
        likeCount: Number.isSafeInteger(count) && count > 0 ? count : undefined,
        totalLikeCount: typeof total === "number" && Number.isSafeInteger(total) && total >= 0 ? total : undefined });
      return;
    }
    const followRole = Number(userData.followRole ?? 0);
    const common = { id: identity || `${now}-${Math.random()}`, user, time: new Date().toLocaleTimeString(), followRole, isFollower: followRole > 0, isSubscriber: Boolean(userData.isSubscriber) };
    for (const sticker of stickers) this.emit({ ...common, id: `${common.id}:sticker:${sticker.stickerId}`, type: "Sticker", detail: `sent sticker ${sticker.stickerId}`, ...sticker });
    if (kind === "chat") this.emit({ ...common, type: "Chat", detail: String(data?.comment || "") });
    else if (kind === "gift") this.emit({ ...common, type: "Gift", detail: `sent ${data?.giftName || "Gift"}`, giftName: String(data?.giftName || "Gift"), giftImageUrl: typeof data?.giftPictureUrl === "string" ? data.giftPictureUrl : undefined, count: Number(data?.repeatCount || 1), comboComplete: data?.giftType != null && Number(data.giftType) !== 1 ? true : Boolean(data?.repeatEnd ?? true) });
    else if (isSticker && !stickers.length) {
      this.emit({ ...common, type: "Sticker", detail: `A sticker event arrived without a readable sticker ID. Event: ${kind}. Fields: ${Object.keys(data || {}).slice(0, 20).join(", ")}.` });
    }
    else if (isSticker) return;
    else if (isFollow) this.emit({ ...common, type: "Follow", detail: "followed the LIVE", isFollower: true, followRole: Math.max(1, followRole) });
    else if (isJoin) this.emit({ ...common, type: "Join", detail: "entered the LIVE" });
    else this.emit({ ...common, type: "SuperFanJoin", detail: "entered as a Super Fan", isFollower: true, followRole: Math.max(1, followRole) });
  }
  private emit(event: LiveEvent) { this.deliveredCounts[event.type] = (this.deliveredCounts[event.type] || 0) + 1; this.events.forEach(handler => handler(event)); }
  async disconnect() { this.clearConfirmation(); const socket = this.socket; this.socket = null; this.manuallyClosing = true; if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000, "User disconnected"); this.setStatus("disconnected", "Disconnected"); }
}


