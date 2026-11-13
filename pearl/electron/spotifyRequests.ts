import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { ipcMain, safeStorage, shell } from "electron";

const loopback = "http://127.0.0.1";
const callbackPort = 8888;
const callbackPath = "/spotify/callback";
const redirectRegistration = loopback + ":" + callbackPort + callbackPath;
const tokenEndpoint = "https://accounts.spotify.com/api/token";

type SongRequest = { id: string; user: string; trackId: string };
type Credentials = { clientId: string; refreshToken: string };
type SpotifyToken = { access_token: string; expires_in: number; refresh_token?: string };

async function exchange(params: Record<string, string>): Promise<SpotifyToken> {
  const response = await fetch(tokenEndpoint, {
    method: "POST",
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    if (response.status === 400 || response.status === 401) throw Error("Spotify rejected the authorization. Check your Client ID or reconnect Spotify.");
    throw Error(`Spotify authorization failed (HTTP ${response.status}). Try again shortly.`);
  }
  const token = await response.json() as SpotifyToken;
  if (!token.access_token || !Number.isFinite(token.expires_in)) throw Error("Spotify returned an invalid access token.");
  return token;
}

async function authorize(clientId: string) {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state = randomBytes(32).toString("base64url");
  const server = createServer();
  try {
    await new Promise<void>((resolve, reject) => {
      const onError = (error: NodeJS.ErrnoException) => reject(error.code === "EADDRINUSE"
        ? new Error("Port 8888 is in use. Close the other app using this port and reconnect Spotify.")
        : error);
      server.once("error", onError);
      server.listen(callbackPort, "127.0.0.1", () => {
        server.removeListener("error", onError);
        resolve();
      });
    });
    const redirectUri = redirectRegistration;
    const authorizeUrl = new URL("https://accounts.spotify.com/authorize");
    authorizeUrl.search = new URLSearchParams({
      client_id: clientId, response_type: "code", redirect_uri: redirectUri,
      code_challenge_method: "S256", code_challenge: challenge, state,
      scope: "user-modify-playback-state",
    }).toString();

    const code = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error("Spotify sign-in timed out. Try connecting again.")), 120000);
      const fail = (error: Error) => { clearTimeout(timeout); reject(error); };
      server.once("error", fail);
      server.on("request", (request, response) => {
        if (!request.url?.startsWith(callbackPath + "?")) {
          response.writeHead(404).end();
          return;
        }
        const callback = new URL(loopback + request.url);
        if (request.method !== "GET" || callback.pathname !== callbackPath || callback.searchParams.get("state") !== state) {
          response.writeHead(404).end();
          return;
        }
        const code = callback.searchParams.get("code");
        response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" })
          .end("Return to Pearl to finish connecting Spotify.");
        if (!code) { fail(Error("Spotify sign-in was declined. Try connecting again.")); return; }
        clearTimeout(timeout);
        resolve(code);
      });
      void shell.openExternal(authorizeUrl.href).catch(fail);
    });
    return await exchange({ grant_type: "authorization_code", client_id: clientId, code, redirect_uri: redirectUri, code_verifier: verifier });
  } finally {
    if (server.listening) server.close();
    server.closeAllConnections();
  }
}

export class SpotifyRequests {
  private credentials: Credentials | null = null;
  private token: { value: string; expiresAt: number } | null = null;
  private enabled = false;
  private busy = false;
  private pending: SongRequest[] = [];
  private recent = new Map<string, number>();
  private readonly file: string;

  constructor(directory: string, private readonly changed: () => void) {
    this.file = path.join(directory, "spotify-credentials.bin");
  }

  async load() {
    if (!safeStorage.isEncryptionAvailable()) return;
    try {
      const credentials = JSON.parse(safeStorage.decryptString(await fs.readFile(this.file)));
      if (typeof credentials?.clientId === "string" && typeof credentials.refreshToken === "string") this.credentials = credentials;
    } catch { /* A missing or unreadable connection can be set up again. */ }
  }

  snapshot() {
    return { connected: Boolean(this.credentials), enabled: this.enabled, busy: this.busy, redirectUri: redirectRegistration, pending: this.pending };
  }

  register() {
    ipcMain.handle("spotify:status", () => this.snapshot());
    ipcMain.handle("spotify:connect", (_event, value: unknown) => this.run(async () => {
      const clientId = typeof value === "string" ? value.trim() : "";
      if (!/^[a-f0-9]{32}$/i.test(clientId)) throw Error("Enter the Client ID from your Spotify developer app.");
      if (!safeStorage.isEncryptionAvailable()) throw Error("Windows encryption is unavailable.");
      const token = await authorize(clientId);
      if (!token.refresh_token) throw Error("Spotify did not return a refresh token. Try connecting again.");
      await this.saveCredentials({ clientId, refreshToken: token.refresh_token });
      this.cacheToken(token);
      this.enabled = true;
    }));
    ipcMain.handle("spotify:disconnect", () => this.run(async () => {
      await fs.rm(this.file, { force: true });
      this.credentials = null;
      this.token = null;
      this.enabled = false;
      this.pending = [];
      this.recent.clear();
    }));
    ipcMain.handle("spotify:enable", (_event, enabled: unknown) => this.run(async () => {
      if (!this.credentials || typeof enabled !== "boolean") throw Error("Connect Spotify before enabling requests.");
      this.enabled = enabled;
    }));
    ipcMain.handle("spotify:approve", (_event, id: unknown) => this.run(async () => {
      const request = this.find(id);
      await this.queue(request.trackId);
      this.pending = this.pending.filter(item => item.id !== id);
    }));
    ipcMain.handle("spotify:dismiss", (_event, id: unknown) => this.run(async () => {
      this.find(id);
      this.pending = this.pending.filter(item => item.id !== id);
    }));
    ipcMain.handle("spotify:preview", (_event, id: unknown) => this.run(async () => {
      await shell.openExternal(`https://open.spotify.com/track/${this.find(id).trackId}`);
    }));
  }

  collect(user: string, message: string) {
    if (!this.enabled || this.pending.length >= 25) return;
    const track = /^!sr\s+(?:https:\/\/open\.spotify\.com\/track\/|spotify:track:)([a-z0-9]{22})(?:\?[^\s]*)?$/i.exec(message.trim());
    if (!track) return;
    const trackId = track[1];
    const viewer = user.toLowerCase();
    const now = Date.now();
    for (const [name, expires] of this.recent) {
      if (expires <= now) this.recent.delete(name);
    }
    if (this.recent.has(viewer) || this.pending.some(item => item.trackId === trackId || item.user.toLowerCase() === viewer)) return;
    this.recent.set(viewer, now + 60000);
    this.pending.push({ id: randomUUID(), user, trackId });
    this.changed();
  }

  private find(id: unknown) {
    const request = this.pending.find(item => item.id === id);
    if (!request) throw Error("That song request is no longer pending.");
    return request;
  }

  private async run(action: () => Promise<void>) {
    if (this.busy) return { error: "A Spotify action is already running." };
    this.busy = true;
    this.changed();
    try {
      await action();
      return {};
    } catch (error) {
      return { error: error instanceof Error ? error.message : "The Spotify action failed." };
    } finally {
      this.busy = false;
      this.changed();
    }
  }

  private async saveCredentials(credentials: Credentials) {
    const temporary = this.file + ".tmp";
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(temporary, safeStorage.encryptString(JSON.stringify(credentials)));
    await fs.rename(temporary, this.file);
    this.credentials = credentials;
  }

  private cacheToken(token: SpotifyToken) {
    this.token = { value: token.access_token, expiresAt: Date.now() + (token.expires_in - 30) * 1000 };
  }

  private async accessToken() {
    if (!this.credentials) throw Error("Connect Spotify to queue songs.");
    if (this.token && this.token.expiresAt > Date.now()) return this.token.value;
    const { clientId, refreshToken } = this.credentials;
    const token = await exchange({ grant_type: "refresh_token", client_id: clientId, refresh_token: refreshToken });
    if (token.refresh_token) await this.saveCredentials({ clientId, refreshToken: token.refresh_token });
    this.cacheToken(token);
    return token.access_token;
  }

  private async queue(trackId: string) {
    const url = new URL("https://api.spotify.com/v1/me/player/queue");
    url.searchParams.set("uri", `spotify:track:${trackId}`);
    const add = async () => fetch(url, {
      method: "POST", headers: { Authorization: `Bearer ${await this.accessToken()}` },
      signal: AbortSignal.timeout(10000),
    });
    let response: Response;
    try { response = await add(); }
    catch { throw Error("Spotify did not confirm the request. Check your Spotify queue before approving it again."); }
    if (response.status === 401) { this.token = null; response = await add(); }
    if (response.ok) return;
    if (response.status === 404) throw Error("Start playback in Spotify and try again.");
    if (response.status === 403) throw Error("Spotify refused the request. Check that the connected account has Premium and access to your developer app.");
    if (response.status === 429) throw Error("Spotify is limiting requests. Wait briefly and try again.");
    throw Error(`Spotify could not queue the song (HTTP ${response.status}).`);
  }
}
