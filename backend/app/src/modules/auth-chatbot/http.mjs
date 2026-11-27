export function sendOk(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

export function sendFail(res, status, message) {
  return res.status(status).json({ success: false, message });
}

export function parseCookies(header = '') {
  const out = {};
  for (const part of String(header).split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

// Pembatas permintaan sederhana (di memori server, cukup untuk pengembangan dan tugas kuliah)
export function createRateLimiter({ windowMs, max, message, keyFn, maxKeys = 10000 }) {
  const hits = new Map();

  // Bersihkan entri kedaluwarsa secara berkala, tidak pada setiap permintaan
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) {
      if (v.resetAt <= now) hits.delete(k);
    }
  }, windowMs).unref();

  return function rateLimiter(req, res, next) {
    const now = Date.now();

    const key = keyFn ? keyFn(req) : req.ip;
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.delete(key);
      // Jika penuh, buang entri paling lama
      if (hits.size >= maxKeys) hits.delete(hits.keys().next().value);
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return sendFail(res, 429, message);
    }
    return next();
  };
}