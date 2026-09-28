import { LiveEvent, LiveProvider, ProviderStatus } from "./LiveProvider";
import { TikToolProvider } from "./TikToolProvider";
import { normalizeDirectEvent } from "./directEvents";

type Connection = {
  on(event: string, handler: (...args: any[]) => void): unknown;
  connect(): Promise<{ roomId?: string }>;
  disconnect(): unknown;
};
export type ConnectorFactory = (username: string) => Promise<Connection>;
const createConnector: ConnectorFactory = async username => {
  // Node16 TypeScript output preserves native import for this ESM-only dependency.
  const { TikTokLiveConnection } = await import("tiktok-live-connector");
  return new TikTokLiveConnection(username, {
    processInitialData: false, enableExtendedGiftInfo: false,
    webClientOptions: { timeout: { request: 12000 }, retry: { limit: 0 } } as any // The connector supplies its own cookie jar at runtime.
  }) as unknown as Connection;
};
export function directError(error: any): string {
  const e = error?.exception || error;
  const name = String(e?.name || "");
  const message = String(e?.message || error?.info || "Unknown connection error")
    .replace(/https?:\/\/\S+/gi, "[service URL]").replace(/[\r\n]/g, " ").slice(0, 500);
  const code = Number(e?.response?.status || e?.statusCode);
  if (/ratelimit|rate.limit|too many|429/i.test(name + " " + message) || code === 429)
    return "Direct TikTok signing rate limit reached. Automatic reconnect is paused. Wait before connecting again, or select TikFinity.";
  if (/premium|api.key|unauthorized|forbidden|evaluation|subscription/i.test(name + " " + message) || [401, 402, 403].includes(code))
    return "The signing service requires account access. Automatic reconnect is paused. Select TikFinity as a fallback.";
  if (/offline|not.live|isn't online/i.test(name + " " + message))
    return "This TikTok account is not LIVE. Automatic reconnect is paused. Start your LIVE, then connect again.";
  return "Direct TikTok: " + message;
}
export class DirectTikTokProvider implements LiveProvider {
  private connection: Connection | null = null;
  private cancelPending: (() => void) | null = null;
  private generation = 0;
  private state: ProviderStatus = "disconnected";
  private events = new Set<(event: LiveEvent) => void>();
  private statuses = new Set<(status: ProviderStatus, message?: string) => void>();
  private rooms = new Set<(roomId: string) => void>();
  private decoder: TikToolProvider;
  private counts: Record<string, number> = {};
  private lastReceivedAt: string | null = null;
  private roomId = "";
  constructor(private log: (message: string) => void = () => {}, private factory: ConnectorFactory = createConnector, private timeoutMs = 45000) {
    this.decoder = this.newDecoder();
  }
  private newDecoder() {
    const decoder = new TikToolProvider("", this.log);
    decoder.onEvent(event => this.events.forEach(handler => handler(event)));
    return decoder;
  }
  onEvent(handler: (event: LiveEvent) => void) { this.events.add(handler); return () => this.events.delete(handler); }
  onStatus(handler: (status: ProviderStatus, message?: string) => void) { this.statuses.add(handler); return () => this.statuses.delete(handler); }
  onRoom(handler: (roomId: string) => void) { this.rooms.add(handler); return () => this.rooms.delete(handler); }
  status() { return this.state; }
  diagnostics() {
    return { ...this.decoder.diagnostics(), provider: "Direct TikTok", status: this.state, roomConfirmed: this.state === "connected",
      roomId: this.roomId, eventCounts: this.counts, lastReceivedAt: this.lastReceivedAt, signingService: "Euler Stream" };
  }
  private setStatus(status: ProviderStatus, message: string) {
    this.state = status; this.log("Status " + status + ": " + message); this.statuses.forEach(handler => handler(status, message));
  }
  private close(connection: Connection | null) {
    try { Promise.resolve(connection?.disconnect()).catch(() => undefined); } catch {}
  }
  async connect(username: string) {
    await this.disconnect();
    const uniqueId = username.trim().replace(/^@/, "");
    if (!/^[a-zA-Z0-9_.]{1,64}$/.test(uniqueId)) throw new Error("Enter your TikTok username without a URL.");
    const generation = ++this.generation;
    this.decoder = this.newDecoder(); this.counts = {}; this.lastReceivedAt = null; this.roomId = "";
    this.setStatus("connecting", "Connecting directly to @" + uniqueId + "...");
    const connection = await this.factory(uniqueId);
    if (generation !== this.generation) { this.close(connection); return; }
    this.connection = connection;
    const current = () => generation === this.generation && this.connection === connection;
    const eventTypes = ["chat", "gift", "like", "member", "follow", "social", "emote", "emotechat", "barrage", "superFanJoin", "roomUser"];
    for (const kind of eventTypes) connection.on(kind, raw => {
      if (!current() || this.state !== "connected") return;
      this.counts[kind] = (this.counts[kind] || 0) + 1; this.lastReceivedAt = new Date().toISOString();
      try { const event = normalizeDirectEvent(kind, raw); if (event) this.decoder.handle(event); }
      catch { this.log("Direct TikTok: skipped unreadable " + kind + " event."); }
    });
    connection.on("streamEnd", () => {
      if (!current()) return;
      this.connection = null; this.generation++; this.close(connection);
      this.setStatus("error", "The LIVE ended. Automatic reconnect is paused. Start your next LIVE, then connect again.");
    });
    connection.on("disconnected", () => {
      if (!current()) return;
      this.setStatus("error", "Direct TikTok connection lost.");
    });
    connection.on("error", error => {
      if (!current() || this.state !== "connected") return;
      if (/decod/i.test(String(error?.info || error?.message || ""))) { this.log("Direct TikTok: an incoming message could not be decoded."); return; }
      this.setStatus("error", directError(error));
    });
    let timer: NodeJS.Timeout | undefined;
    const pending = connection.connect();
    // A cancelled or timed-out HTTP handshake may finish later: close that stale socket.
    pending.then(() => { if (!current()) this.close(connection); }, () => undefined);
    try {
      const result = await Promise.race([pending, new Promise<never>((_, reject) => {
        this.cancelPending = () => reject(new Error("Connection cancelled"));
        timer = setTimeout(() => reject(new Error("Connection timed out. Check the LIVE username and network.")), this.timeoutMs);
      })]);
      if (!current()) return;
      this.roomId = String(result.roomId || "");
      if (this.roomId) this.rooms.forEach(handler => handler(this.roomId));
      this.setStatus("connected", "Connected directly to @" + uniqueId + "; TikFinity is not required");
    } catch (error) {
      if (!current()) return;
      this.connection = null; this.generation++; this.close(connection);
      const message = directError(error); this.setStatus("error", message); throw new Error(message);
    } finally { if (timer) clearTimeout(timer); if (generation === this.generation) this.cancelPending = null; }
  }
  async disconnect() {
    this.generation++; this.cancelPending?.(); this.cancelPending = null; const connection = this.connection; this.connection = null; this.close(connection);
    this.setStatus("disconnected", "Disconnected");
  }
}
