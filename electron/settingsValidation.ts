type Rule = string | readonly string[];
type Schema = Record<string, Rule>;
function object(value: unknown, label: string): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(`Invalid ${label}: expected an object.`);
  return value as Record<string, any>;
}
function fields(value: unknown, schema: Schema, label: string, partial = false) {
  const state = object(value, label);
  for (const [field, rule] of Object.entries(schema)) {
    const optional = field.endsWith('?'); const key = optional ? field.slice(0, -1) : field;
    if (!(key in state) && (partial || optional)) continue;
    const v = state[key];
    if (Array.isArray(rule) ? !rule.includes(v) : typeof v !== rule || (rule === 'number' && !Number.isFinite(v))) throw Error(`Invalid ${label}.${key}.`);
  }
  return state;
}
const str = (keys: string): Schema => Object.fromEntries(keys.split(' ').map(k => [k, 'string']));
const num = (keys: string): Schema => Object.fromEntries(keys.split(' ').map(k => [k, 'number']));
const bool = (keys: string): Schema => Object.fromEntries(keys.split(' ').map(k => [k, 'boolean']));
const schemas: Record<string, Schema> = {
  reactions: {...str('id giftName message soundPath?'), ...bool('speak overlay enabled?'), ...num('volume?')},
  giftActions: {...str('id giftName message soundPath imagePath webhookUrl? webhookBody?'), ...bool('enabled'), ...num('minimumCount volume durationMs'), kind:['sound','tts','overlay','webhook'], 'webhookMethod?':['GET','POST']},
  superFans: {...str('id username message imagePath soundPath'), ...bool('enabled'), ...num('durationMs')},
  giftCatalog: str('name imageUrl?'), stickerCatalog: str('id name imageUrl?'),
  stickerReactions: {...str('id stickerId soundPath'), ...bool('enabled'), ...num('volume?')}
};
export function validateSettings(value: unknown): Record<string, any> {
  const state = fields(value, {
    ...str('username likesFont voiceURI chatTemplate followTemplate followSoundPath superFanTemplate superFanImagePath superFanSoundPath permanentOverlayHostname defaultGiftTemplate ttsBlockedPhrases'),
    ...bool('likesShowBorder ttsEnabled followEnabled superFanEnabled stickerSoundsEnabled ttsSkipLinks ttsSkipCommands giftReactionsEnabled giftCatalogSample'),
    ...num('likesTextScale likesWidth likesBackgroundOpacity volume rate pitch superFanDurationMs giftCatalogUpdatedAt'),
    connectionProvider:['direct','tikfinity'], audience:['everyone','followers','subscribers']
  }, 'settings', true);
  for (const [key,schema] of Object.entries(schemas)) {
    if (!(key in state)) continue;
    if (!Array.isArray(state[key])) throw Error(`Invalid ${key}: expected a list.`);
    state[key].forEach((entry: unknown, index: number) => fields(entry, schema, `${key}[${index}]`));
  }
  if ('overlayLibrary' in state) {
    const library = object(state.overlayLibrary, 'overlayLibrary');
    for (const key of ['likes','gifts']) fields(library[key], {
      ...bool('enabled'), ...num('durationMs'), ...str('accent'), theme:['glow','minimal','spotlight'],
      ...(key === 'likes' ? num('threshold') : {...num('minimumCount'), ...str('names')})
    }, `overlayLibrary.${key}`);
  }
  return state;
}
