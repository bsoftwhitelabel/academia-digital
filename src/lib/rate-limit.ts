type Entry = { count: number; resetAt: number };

const store = new Map<string, Entry>();
let _calls = 0;

function gc() {
  // Limpeza preguiçosa: remove entradas expiradas a cada 100 chamadas
  if (++_calls % 100 !== 0) return;
  const now = Date.now();
  for (const [k, v] of store.entries()) {
    if (v.resetAt <= now) store.delete(k);
  }
}

export type RateLimitResult = {
  ok: boolean;
  count: number;
  remaining: number;
  resetAt: number;
  retryAfterSec: number;
};

/**
 * Rate limiter simples baseado em Map em memória. Para MVP — sem Redis.
 *
 * @param key  identificador (ex.: "login:1.2.3.4")
 * @param max  número máximo de pedidos na janela (default 5)
 * @param windowMs janela em milissegundos (default 15 min)
 */
export function rateLimit(
  key: string,
  max = 5,
  windowMs = 15 * 60 * 1000
): RateLimitResult {
  gc();
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return {
      ok: true,
      count: 1,
      remaining: max - 1,
      resetAt: now + windowMs,
      retryAfterSec: 0,
    };
  }

  existing.count += 1;
  store.set(key, existing);

  const ok = existing.count <= max;
  return {
    ok,
    count: existing.count,
    remaining: Math.max(0, max - existing.count),
    resetAt: existing.resetAt,
    retryAfterSec: Math.max(0, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

/** Limpa o store — usado em testes. */
export function _resetRateLimit() {
  store.clear();
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
