import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import type { LiveEvent } from "./providers/LiveProvider";

export const creditGroups = ["Super Fans", "Active Fans", "Top Supporters", "New Followers"] as const;
export type CreditGroup = typeof creditGroups[number];
export type CreditRow = { user: string; name: string; excluded?: boolean };
export type CreditGroups = Record<CreditGroup, CreditRow[]>;
export type CreditSession = { id: string; startedAt: string; groups: CreditGroups };

const username = (value: string) => value.trim().replace(/^@/, "").toLowerCase();
const emptyGroups = (): CreditGroups => ({
  "Super Fans": [], "Active Fans": [], "Top Supporters": [], "New Followers": []
});
type Viewer = CreditRow & { superFan: boolean; activity: number; gifts: number; followed: boolean };

export class CreditsTracker {
  private session: Omit<CreditSession, "groups"> | null = null;
  private viewers = new Map<string, Viewer>();
  private seen = new Set<string>();
  private collecting = false;
  private roomId = "";
  private streamer = "";

  start(streamer = "", roomId = "") {
    if (this.session) throw new Error("Finish the current credits session first.");
    this.session = { id: randomUUID(), startedAt: new Date().toISOString() };
    this.collecting = true;
    this.streamer = username(streamer);
    this.roomId = roomId;
    return this.snapshot()!;
  }

  confirmRoom(streamer: string, roomId: string) {
    if (!this.collecting) return;
    const channel = username(streamer);
    if ((this.streamer && channel !== this.streamer) || (this.roomId && roomId && this.roomId !== roomId)) {
      this.collecting = false;
      return;
    }
    this.streamer = channel;
    if (roomId) this.roomId = roomId;
  }

  stop() {
    this.collecting = false;
    return this.snapshot();
  }

  get active() { return this.collecting; }

  finish(id: string) {
    if (id !== this.session?.id) return;
    this.session = null;
    this.collecting = false;
    this.viewers.clear();
    this.seen.clear();
  }

  add(event: LiveEvent, roster: ReadonlySet<string>) {
    if (!this.collecting || (event.type === "Gift" && event.comboComplete === false)) return;
    const delivery = event.id && `${event.type}:${event.id}`;
    if (delivery && this.seen.has(delivery)) return;
    const user = username(event.user).slice(0, 200);
    if (!user) return;
    const viewer = this.viewers.get(user) ?? { user, name: user, superFan: false, activity: 0, gifts: 0, followed: false };
    if (delivery) {
      this.seen.add(delivery);
      if (this.seen.size > 20000) this.seen.delete(this.seen.values().next().value!);
    }
    viewer.name = event.displayName?.trim().slice(0, 200) || viewer.name;
    viewer.superFan ||= event.type === "SuperFanJoin" || roster.has(user);
    viewer.followed ||= event.type === "Follow";
    if (event.type === "Chat" || event.type === "Sticker" || event.type === "Like") viewer.activity++;
    if (event.type === "Gift") {
      const count = event.count;
      viewer.gifts += count && Number.isSafeInteger(count) && count > 0 ? count : 1;
    }
    this.viewers.set(user, viewer);
  }

  snapshot(): CreditSession | null {
    if (!this.session) return null;
    const groups = emptyGroups();
    const viewers = [...this.viewers.values()];
    groups["Super Fans"] = viewers.filter(viewer => viewer.superFan);
    groups["New Followers"] = viewers.filter(viewer => viewer.followed);
    groups["Active Fans"] = viewers.filter(viewer => viewer.activity > 0).sort((a, b) => b.activity - a.activity).slice(0, 20);
    groups["Top Supporters"] = viewers.filter(viewer => viewer.gifts > 0).sort((a, b) => b.gifts - a.gifts).slice(0, 20);
    for (const group of creditGroups) groups[group] = groups[group].map(({ user, name }) => ({ user, name }));
    return { ...this.session, groups };
  }
}

export function validateCredits(value: unknown): CreditSession {
  const session = value as CreditSession | null;
  if (!session || typeof session.id !== "string" || !/^[a-f0-9-]{36}$/.test(session.id)
    || typeof session.startedAt !== "string" || !Number.isFinite(Date.parse(session.startedAt))) {
    throw new Error("Invalid credits session.");
  }
  const groups = emptyGroups();
  for (const group of creditGroups) {
    const rows = session.groups?.[group];
    if (!Array.isArray(rows) || rows.length > 10000) throw new Error("Invalid credits group.");
    groups[group] = rows.map(row => {
      if (!row || typeof row.user !== "string" || typeof row.name !== "string"
        || !username(row.user) || !row.name.trim() || row.user.length > 200 || row.name.length > 200) {
        throw new Error("Invalid credits viewer.");
      }
      return { user: username(row.user), name: row.name.trim(), excluded: row.excluded === true };
    });
  }
  return { id: session.id, startedAt: session.startedAt, groups };
}

export class CreditsHistory {
  constructor(private directory: string) {}

  async list() {
    await fs.mkdir(this.directory, { recursive: true });
    const files = (await fs.readdir(this.directory)).filter(file => /^[a-f0-9-]{36}\.json$/.test(file));
    const sessions = await Promise.all(files.map(async file =>
      validateCredits(JSON.parse(await fs.readFile(path.join(this.directory, file), "utf8")))));
    return sessions.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  }

  async save(session: CreditSession) {
    await fs.mkdir(this.directory, { recursive: true });
    const temporary = path.join(this.directory, randomUUID() + ".tmp");
    try {
      await fs.writeFile(temporary, JSON.stringify(session), { flag: "wx" });
      await fs.rename(temporary, path.join(this.directory, session.id + ".json"));
    } finally {
      await fs.unlink(temporary).catch(() => {});
    }
  }
}
