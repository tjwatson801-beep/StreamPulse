import WebSocket from "ws";
import { LiveEvent, LiveProvider, ProviderStatus } from "./LiveProvider";
import { TikToolProvider } from "./TikToolProvider";

// TikFinity uses the same webcast event payloads, with user fields at the top level.
// Reuse the event decoder only; this provider never opens a TikTools connection.
export class TikFinityProvider implements LiveProvider {
  private socket: WebSocket | null = null;
  private decoder: TikToolProvider;
  private currentStatus: ProviderStatus = "disconnected";
  private statuses = new Set<(status: ProviderStatus, message?: string) => void>();
  private events = new Set<(event: LiveEvent) => void>();
  private rooms = new Set<(roomId: string) => void>();
  private idleTimer: NodeJS.Timeout | null = null;
  private heartbeat: NodeJS.Timeout | null = null;
  private liveConfirmed = false;
  private lastReceivedAt: string | null = null;
  constructor(private diagnostic: (message: string) => void = () => {}, private endpoint = "ws://127.0.0.1:21213/") { this.decoder = this.makeDecoder(); }
  private makeDecoder() {
    const decoder = new TikToolProvider("", this.diagnostic);
    decoder.onEvent(event => this.events.forEach(handler => handler(event)));
    decoder.onRoom(roomId => this.rooms.forEach(handler => handler(roomId)));
    return decoder;
  }
  status() { return this.currentStatus; }
  onEvent(handler: (event: LiveEvent) => void) { this.events.add(handler); return () => this.events.delete(handler); }
  onStatus(handler: (status: ProviderStatus, message?: string) => void) { this.statuses.add(handler); return () => this.statuses.delete(handler); }
  onRoom(handler: (roomId: string) => void) { this.rooms.add(handler); return () => this.rooms.delete(handler); }
  diagnostics() { return { ...this.decoder.diagnostics(), provider: "TikFinity", status: this.currentStatus, roomConfirmed: this.liveConfirmed, lastReceivedAt: this.lastReceivedAt }; }
  private setStatus(status: ProviderStatus, message: string) {
    this.currentStatus = status; this.diagnostic("TikFinity " + status + ": " + message);
    this.statuses.forEach(handler => handler(status, message));
  }
  private clearTimers() { if (this.idleTimer) clearTimeout(this.idleTimer); if (this.heartbeat) clearInterval(this.heartbeat); this.idleTimer = null; this.heartbeat = null; }
  private waitForEvents() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.liveConfirmed = false;
      this.setStatus("connecting", "TikFinity is open, but no recent LIVE events were received. Check its LIVE connection.");
    }, 60000);
  }
  async connect(_username: string) {
    await this.disconnect();
    this.decoder = this.makeDecoder(); this.liveConfirmed = false; this.lastReceivedAt = null;
    this.setStatus("connecting", "Connecting to TikFinity on this PC...");
    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(this.endpoint, { handshakeTimeout: 5000 }); this.socket = socket;
      let opened = false, alive = true;
      socket.once("open", () => {
        if (this.socket !== socket) return;
        opened = true;
        this.setStatus("connecting", "TikFinity connected; waiting for LIVE events. Keep TikFinity open and connected to your LIVE.");
        this.waitForEvents();
        this.heartbeat = setInterval(() => { if (!alive) { socket.terminate(); return; } alive = false; socket.ping(); }, 15000);
        resolve();
      });
      socket.on("pong", () => { alive = true; });
      socket.on("message", raw => {
        if (this.socket !== socket) return;
        try { this.handle(JSON.parse(raw.toString())); } catch { this.diagnostic("TikFinity sent an unreadable event; skipped."); }
      });
      socket.on("error", () => {
        if (this.socket !== socket) return;
        this.setStatus("error", "Cannot reach TikFinity. Open the TikFinity desktop app on this PC and connect it to your LIVE.");
        if (!opened) reject(new Error("Cannot reach TikFinity. Keep its desktop app open and connected."));
      });
      socket.once("close", () => {
        if (!opened) reject(new Error("TikFinity connection closed before it was ready."));
        if (this.socket !== socket) return;
        this.socket = null; this.clearTimers(); this.liveConfirmed = false;
        this.setStatus("error", "TikFinity connection closed. Keep TikFinity open and connected to your LIVE.");
      });
    });
  }
  private handle(payload: any) {
    const kind = String(payload?.event || "").toLowerCase();
    if (kind === "config" || kind === "state_update") return;
    const data = payload?.data;
    if (!data || typeof data !== "object" || Array.isArray(data)) return;
    const liveEvents = ["chat", "gift", "like", "member", "join", "follow", "share", "subscribe", "roomuser", "roominfo", "social", "emote", "emotechat", "superfanjoin", "barrage"];
    if (liveEvents.includes(kind)) {
      this.liveConfirmed = true; this.lastReceivedAt = new Date().toISOString(); this.waitForEvents();
      if (this.currentStatus !== "connected") this.setStatus("connected", "Receiving LIVE events through TikFinity");
    }
    if (kind === "streamend" || (kind === "control" && Number(data.action) === 3)) {
      this.liveConfirmed = false;
      this.setStatus("connecting", "The LIVE ended. Connect TikFinity to your next LIVE; StreamPulse will keep listening.");
    }
    this.decoder.handle({ ...payload, data: { ...data, user: { ...data, ...(data.user || {}) } } });
  }
  async disconnect() {
    this.clearTimers(); const socket = this.socket; this.socket = null; this.liveConfirmed = false;
    if (socket) { if (socket.readyState === WebSocket.CONNECTING) socket.terminate(); else if (socket.readyState === WebSocket.OPEN) socket.close(1000, "User disconnected"); }
    this.setStatus("disconnected", "Disconnected");
  }
}
