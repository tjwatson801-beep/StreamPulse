export async function sendWebhook(input: unknown): Promise<{ ok: boolean; error?: string }> {
  if (!input || typeof input !== 'object') return { ok: false, error: 'Enter a webhook URL.' };
  const { url, method, body } = input as { url?: unknown; method?: unknown; body?: unknown };
  let target: URL;
  try {
    if (typeof url !== 'string' || url.length > 8192) throw new Error();
    target = new URL(url.trim());
    if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) throw new Error();
  } catch { return { ok: false, error: 'Use a valid HTTP or HTTPS webhook URL without embedded credentials.' }; }
  if (method !== 'GET' && method !== 'POST') return { ok: false, error: 'Choose GET or POST.' };
  if (body !== undefined && (typeof body !== 'string' || body.length > 65536)) return { ok: false, error: 'Request body must be text under 64 KB.' };
  try {
    const response = await fetch(target, { method, redirect: 'error', signal: AbortSignal.timeout(5000), ...(method === 'POST' && body ? { body: body as string, headers: { 'Content-Type': 'application/json' } } : {}) });
    await response.body?.cancel();
    return response.ok ? { ok: true } : { ok: false, error: `Webhook returned HTTP ${response.status}.` };
  } catch { return { ok: false, error: 'Webhook failed or timed out. Check the URL and that Lucky Wheel is running. No retry was sent.' }; }
}
