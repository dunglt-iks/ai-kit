// @ts-check
// Chờ app của dự án sẵn sàng trước khi chạy test: gọi thẳng địa chỉ app (hoặc --wait-url), không đòi app có endpoint
// health. "Lên" = có phản hồi HTTP mã < 500 (kể cả 401 / 404: server đã trả lời). Hết thời gian chờ → "môi trường
// không lên": không chạy test, không tính là test fail. Xem docs/05-environments.md.

/**
 * @param {string} url
 * @param {{ timeoutSec?: number, intervalMs?: number, requestMs?: number, log?: (m: string) => void }} [o]
 *   timeoutSec 0 = thử một lần
 * @returns {Promise<{ ok: boolean, url: string, status?: number, error?: string, waitedMs: number }>}
 */
export async function waitForApp(url, o = {}) {
  const log = o.log || (() => {});
  const timeout = Math.max(0, Number(o.timeoutSec) || 0) * 1000;
  const interval = o.intervalMs ?? 5000;
  const start = Date.now();
  let last = { status: undefined, error: undefined };
  let announced = false;
  for (;;) {
    try {
      const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(o.requestMs ?? 10000) });
      await res.body?.cancel();
      if (res.status < 500) return { ok: true, url, status: res.status, waitedMs: Date.now() - start };
      last = { status: res.status, error: `HTTP ${res.status}` };
    } catch (e) {
      const cause = /** @type {any} */ (e).cause;
      last = { status: undefined, error: cause?.code || cause?.message || /** @type {any} */ (e).message };
    }
    const elapsed = Date.now() - start;
    if (elapsed >= timeout) return { ok: false, url, ...last, waitedMs: elapsed };
    if (!announced) log(`Chờ app ở ${url} (tối đa ${Math.round(timeout / 1000)} giây)…`);
    announced = true;
    await new Promise((r) => setTimeout(r, Math.min(interval, timeout - elapsed)));
  }
}
