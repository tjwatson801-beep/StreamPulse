import { LiveEvent, Settings, StickerOption } from "./types";

export function stickerOptions(settings: Settings): StickerOption[] {
  const options = [...settings.stickerCatalog];
  for (const reaction of settings.stickerReactions) {
    if (reaction.stickerId && !options.some(item => item.id === reaction.stickerId)) options.push({ id: reaction.stickerId, name: `Saved sticker ${options.length + 1}` });
  }
  return options;
}

export function rememberSticker(settings: Settings, event: LiveEvent): Settings {
  if (!event.stickerId) return settings;
  const options = stickerOptions(settings);
  const found = options.find(item => item.id === event.stickerId);
  if (found && (!event.stickerImageUrl || event.stickerImageUrl === found.imageUrl) && (!event.stickerName || !/^(?:Saved )?Sticker \d+$/i.test(found.name)) && settings.stickerCatalog.some(item => item.id === found.id)) return settings;
  const defaultName = found?.name && !/^(?:Saved )?Sticker \d+$/i.test(found.name) ? found.name : event.stickerName?.trim() || found?.name || `Sticker ${options.length + 1}`;
  const sticker = { id: event.stickerId, name: defaultName, imageUrl: event.stickerImageUrl || found?.imageUrl };
  return { ...settings, stickerCatalog: found ? options.map(item => item.id === sticker.id ? sticker : item) : [...options, sticker] };
}
