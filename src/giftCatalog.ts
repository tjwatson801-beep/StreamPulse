import { GiftOption, LiveEvent, Settings } from "./types";

export const giftKey = (name: string) => name.trim().toLowerCase();

export function giftOptions(settings: Settings): GiftOption[] {
  const options = new Map<string, GiftOption>();
  for (const gift of [{ name: "Rose" }, ...(settings.giftCatalog || []), ...settings.reactions.map(r => ({ name: r.giftName }))]) {
    const key = giftKey(gift.name);
    if (key) options.set(key, { ...gift, ...options.get(key), name: options.get(key)?.name || gift.name.trim() });
  }
  return [...options.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function rememberGift(settings: Settings, event: LiveEvent): Settings {
  if (event.type !== "Gift" || !event.giftName?.trim()) return settings;
  const name = event.giftName.trim();
  const found = settings.giftCatalog.find(gift => giftKey(gift.name) === giftKey(name));
  const imageUrl = event.giftImageUrl?.startsWith("https://") ? event.giftImageUrl : found?.imageUrl;
  if (found && found.imageUrl === imageUrl) return settings;
  const gift = { name: found?.name || name, imageUrl };
  return { ...settings, giftCatalog: found ? settings.giftCatalog.map(item => item === found ? gift : item) : [...settings.giftCatalog, gift] };
}

export function mergeGiftCatalog(settings: Settings, gifts: GiftOption[], sample: boolean, updatedAt = Date.now()): Settings {
  const merged = new Map(settings.giftCatalog.map(gift => [giftKey(gift.name), gift]));
  for (const gift of gifts) {
    const existing = merged.get(giftKey(gift.name));
    merged.set(giftKey(gift.name), { ...existing, ...gift, imageUrl: gift.imageUrl || existing?.imageUrl });
  }
  return { ...settings, giftCatalog: [...merged.values()], giftCatalogUpdatedAt: updatedAt, giftCatalogSample: sample };
}
