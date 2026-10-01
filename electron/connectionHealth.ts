export async function probeOverlay(url: string) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000), cache: 'no-store', redirect: 'error' });
    if (!response.ok) return { ok: false, message: `HTTP ${response.status}` };
    const data = await response.json();
    return data?.app === 'StreamPulse Core' && data?.ok === true ? { ok: true, message: 'Reachable' } : { ok: false, message: 'Unexpected response' };
  } catch { return { ok: false, message: 'Unreachable or timed out' }; }
}
