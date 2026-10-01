import type { LiveEvent, GiftAction } from './types';
export function matchesGiftAction(rule: GiftAction, event: LiveEvent): boolean {
  return rule.enabled && event.type === 'Gift' && event.comboComplete !== false &&
    Boolean(rule.giftName.trim()) && rule.giftName.trim().toLowerCase() === event.giftName?.trim().toLowerCase() &&
    (event.count ?? 1) >= Math.max(1, rule.minimumCount);
}
export const luckyWheelUrl = 'http://localhost:5730/wheel?id=0&userName={nickname}';
export function giftWebhookUrl(template: string, event: LiveEvent): string {
  const values: Record<string, string> = { nickname: event.user || 'viewer', username: event.user || 'viewer', gift: event.giftName || 'gift', count: String(event.count ?? 1) };
  return template.replace(/\{(nickname|username|gift|count)\}/g, (_, key: string) => encodeURIComponent(values[key]));
}
