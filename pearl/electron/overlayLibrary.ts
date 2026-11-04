import { LiveEvent } from "./providers/LiveProvider";
export const libraryFonts = ["Segoe UI", "Permanent Marker", "Arial", "Verdana", "Trebuchet MS", "Georgia", "Courier New"];
export type LibraryKind = "like-pop" | "gift-highlight";
export type LibraryStyle = { backgroundMode: "theme" | "transparent" | "solid" | "image"; backgroundColor: string; backgroundOpacity: number; backgroundImagePath: string; enabled: boolean; durationMs: number; accent: string; font: string; theme: "glow" | "minimal" | "spotlight" };
export type LibraryConfig = { likes: LibraryStyle & { threshold: number }; gifts: LibraryStyle & { minimumCount: number; names: string; maxBanners: number } };
const style = { backgroundMode: "theme" as const, backgroundColor: "#10121c", backgroundOpacity: 90, backgroundImagePath: "", enabled: false, font: "Segoe UI", durationMs: 5000, accent: "#62ffd1", theme: "glow" as const };
export const libraryDefaults: LibraryConfig = { likes: { ...style, accent: "#ff629c", threshold: 100 }, gifts: { ...style, minimumCount: 1, names: "", maxBanners: 1 } };
export function normalizeLibrary(value: any): LibraryConfig {
  const number = (n: any, fallback: number, min: number, max: number) => typeof n === "number" && Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback;
  const appearance = (v: any, base: LibraryStyle): LibraryStyle => ({ backgroundMode: ["theme", "transparent", "solid", "image"].includes(v?.backgroundMode) ? v.backgroundMode : base.backgroundMode, backgroundColor: /^#[0-9a-f]{6}$/i.test(v?.backgroundColor) ? v.backgroundColor : base.backgroundColor, backgroundOpacity: number(v?.backgroundOpacity, base.backgroundOpacity, 0, 100), backgroundImagePath: typeof v?.backgroundImagePath === "string" ? v.backgroundImagePath.slice(0, 4096) : "", font: libraryFonts.includes(v?.font) ? v.font : base.font, enabled: v?.enabled === true, durationMs: number(v?.durationMs, base.durationMs, 1000, 15000), accent: /^#[0-9a-f]{6}$/i.test(v?.accent) ? v.accent : base.accent, theme: ["glow", "minimal", "spotlight"].includes(v?.theme) ? v.theme : base.theme });
  return { likes: { ...appearance(value?.likes, libraryDefaults.likes), threshold: number(value?.likes?.threshold, 100, 1, 1000000) }, gifts: { ...appearance(value?.gifts, libraryDefaults.gifts), maxBanners: number(value?.gifts?.maxBanners, 1, 1, 5), minimumCount: number(value?.gifts?.minimumCount, 1, 1, 1000000), names: typeof value?.gifts?.names === "string" ? value.gifts.names.slice(0, 4000) : "" } };
}
export class OverlayLibrary {
  config = normalizeLibrary(null);
  private seenGifts = new Set<string>();
  private giftImages = new Map<string, string>();
  private image(value: unknown): string | undefined {
    if (typeof value !== "string") return;
    try { const url = new URL(value); if (url.protocol === "https:" && !url.username && !url.password) return url.href; } catch { /* Use saved artwork when available. */ }
  }
  configure(value: unknown, catalog?: unknown) {
    this.config = normalizeLibrary(value);
    if (Array.isArray(catalog)) for (const gift of catalog) {
      const image = this.image(gift?.imageUrl);
      if (typeof gift?.name === "string" && image) this.giftImages.set(gift.name.trim().toLowerCase(), image);
    }
  }
  like(event: LiveEvent, before: number, after: number) {
    const config = this.config.likes;
    if (!config.enabled || after <= before || Math.floor(after / config.threshold) <= Math.floor(before / config.threshold)) return;
    // One celebration for the highest milestone crossed by this batch.
    const milestone = Math.floor(after / config.threshold) * config.threshold;
    return { channel: "like-pop" as const, title: `${milestone.toLocaleString("en-US")} likes!`, body: `${event.displayName?.trim() || "@" + event.user.replace(/^@/, "")} is spreading the love`, imageUrl: event.profilePictureUrl, ...config };
  }
  gift(event: LiveEvent) {
    if (event.type !== "Gift") return;
    const key = (event.giftName || "").trim().toLowerCase();
    const imageUrl = this.image(event.giftImageUrl) || this.giftImages.get(key);
    if (key && imageUrl) this.giftImages.set(key, imageUrl);
    if (event.comboComplete === false) return;
    if (event.id && this.seenGifts.has(event.id)) return;
    if (event.id) { this.seenGifts.add(event.id); if (this.seenGifts.size > 20000) this.seenGifts.delete(this.seenGifts.values().next().value!); }
    const config = this.config.gifts;
    const count = Number.isSafeInteger(event.count) && event.count! > 0 ? event.count! : 1;
    const names = config.names.split(",").map(n => n.trim().toLowerCase()).filter(Boolean);
    if (!config.enabled || count < config.minimumCount || (names.length && !names.includes((event.giftName || "").trim().toLowerCase()))) return;
    return { channel: "gift-highlight" as const, title: `${event.giftName || "Gift"} ×${count}`, body: `Thank you, ${event.displayName?.trim() || "@" + event.user.replace(/^@/, "")}!`, imageUrl, ...config };
  }
}
