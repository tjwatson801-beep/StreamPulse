type CatalogGift = { name: string; imageUrl?: string };
export type CatalogResult = { ok: boolean; gifts?: CatalogGift[]; sample?: boolean; error?: string };

export function parseGiftCatalog(payload: any): CatalogResult {
  if (payload?.status_code != null && Number(payload.status_code) !== 0) return { ok: false, error: "TikTool could not load the gift catalog. Check your API key and plan." };
  if (!Array.isArray(payload?.data?.gifts)) return { ok: false, error: "TikTool returned an unreadable gift catalog. Try refreshing again." };
  const gifts = new Map<string, CatalogGift>();
  for (const entry of payload.data.gifts) {
    if (typeof entry?.name !== "string" || !entry.name.trim()) continue;
    const name = entry.name.trim();
    const icon = entry.icon_url || entry.icon;
    const rawImage = typeof icon === "string" ? icon : icon?.url_list?.[0] || icon?.urlList?.[0];
    let imageUrl: string | undefined;
    try { const url = new URL(rawImage); if (url.protocol === "https:" && !url.username && !url.password) imageUrl = url.href; } catch {}
    const key = name.toLowerCase();
    gifts.set(key, { name, imageUrl: imageUrl || gifts.get(key)?.imageUrl });
  }
  if (!gifts.size) return { ok: false, error: "TikTool returned an empty gift catalog. Your saved gifts are still available." };
  return { ok: true, gifts: [...gifts.values()], sample: payload.is_sample === true || payload.source === "sample" || payload.data.is_sample === true || payload.data.source === "sample" };
}

export async function fetchGiftCatalog(apiKey: string, request: typeof fetch = fetch): Promise<CatalogResult> {
  if (!apiKey.trim()) return { ok: false, error: "Save your TikTool API key in Settings to load the gift catalog." };
  try {
    const response = await request("https://api.tik.tools/webcast/gift_info", {
      headers: { "x-api-key": apiKey.trim() }, signal: AbortSignal.timeout(20000), redirect: "error"
    });
    if (!response.ok) return { ok: false, error: response.status === 401 || response.status === 403
      ? "TikTool denied catalog access. Check your saved API key and plan."
      : response.status === 429 ? "TikTool's request limit was reached. Try refreshing later."
      : "TikTool could not load the gift catalog. Try refreshing later." };
    return parseGiftCatalog(await response.json());
  } catch { return { ok: false, error: "Could not reach the TikTool gift catalog. Your saved gifts are still available; try refreshing again." }; }
}
