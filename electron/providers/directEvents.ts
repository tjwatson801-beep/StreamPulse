/** Converts tiktok-live-connector 2.5 raw webcast messages to our existing event format. */
export function imageUrl(value: any, depth = 0): string | undefined {
  if (!value || depth > 5) return;
  if (typeof value === "string") {
    try { const url = new URL(value.trim().replace(/^http:\/\//i, "https://").replace(/^\/\//, "https://")); return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined; } catch { return; }
  }
  const entries = Array.isArray(value) ? value : [value.urlList, value.url_list, value.url, value.imageUrl];
  for (const entry of entries) { const result = imageUrl(entry, depth + 1); if (result) return result; }
}
const text = (value: unknown) => typeof value === "string" || typeof value === "number" || typeof value === "bigint" ? String(value) : "";
export function normalizeDirectEvent(event: string, raw: any): { event: string; data: any } | null {
  const kind = event.toLowerCase();
  if (!["chat", "gift", "like", "member", "follow", "social", "emote", "emotechat", "barrage", "superfanjoin"].includes(kind)) return null;
  if (!raw || typeof raw !== "object") return null;
  const displays = [raw.common?.displayText, raw.content, raw.commonBarrageContent];
  const marker = displays.map(d => text(d?.key || d?.displayType)).find(s => s.toLowerCase() === "ttlive_superfan_commentnotif_superfanjoined");
  if (kind === "barrage" && !marker) return null;
  const pieceUser = displays.flatMap(d => Array.isArray(d?.pieces) ? d.pieces : []).find(p => p?.userValue?.user)?.userValue?.user;
  const user = raw.user || pieceUser || {};
  const uniqueId = text(user.displayId || user.uniqueId).trim();
  const badges = Array.isArray(user.badgeList) ? user.badgeList : [];
  const isSubscriber = user.isSubscriber === true || raw.userIdentity?.isSubscriberOfAnchor === true ||
    user.subscribeInfo?.isSubscribedToAnchor === true || user.subscribeInfo?.isSubscribe === true ||
    badges.some((b: any) => [4, 7].includes(Number(b.sceneType ?? b.badgeSceneType)));
  const followRole = Number(user.followInfo?.followStatus ?? user.followRole ?? 0);
  const emotes = [...(Array.isArray(raw.emotes) ? raw.emotes : []), ...(Array.isArray(raw.emoteList) ? raw.emoteList : [])].map(entry => {
    const emote = entry?.emote || entry;
    return { emoteId: text(emote?.emoteId), emoteImageUrl: imageUrl([emote?.image, emote?.emoteImageUrl, emote?.emoteUrl, emote?.url]), name: text(emote?.name) };
  }).filter(emote => emote.emoteId && emote.emoteId !== "0");
  const gift = raw.gift || raw.giftDetails || {};
  const msgId = text(raw.common?.msgId || raw.msgId);
  return { event: kind === "barrage" ? "superfanjoin" : kind, data: {
    msgId: msgId === "0" ? "" : msgId,
    user: { uniqueId, nickname: text(user.nickname), followRole: Number.isFinite(followRole) ? followRole : 0, isSubscriber,
      profilePictureUrl: imageUrl(user.avatarThumb) || imageUrl(user.avatarLarge) || imageUrl(user.profilePictureUrl) },
    comment: text(raw.content || raw.comment),
    displayType: marker || text(raw.common?.displayText?.key || raw.displayType),
    action: typeof raw.action === "string" && /follow|share/i.test(raw.action) ? raw.action : "",
    likeCount: raw.count ?? raw.likeCount, totalLikeCount: raw.total ?? raw.totalLikeCount,
    giftName: text(gift.name || raw.giftName) || (raw.giftId ? "Gift " + text(raw.giftId) : "Gift"),
    giftPictureUrl: imageUrl(gift.image) || imageUrl(gift.icon) || imageUrl(gift.giftImage) || imageUrl(raw.giftPictureUrl),
    giftType: gift.type ?? gift.giftType ?? raw.giftType,
    repeatCount: Math.max(1, Number(raw.repeatCount) || 1),
    repeatEnd: raw.repeatEnd == null ? false : Number(raw.repeatEnd) !== 0,
    emotes
  } };
}
