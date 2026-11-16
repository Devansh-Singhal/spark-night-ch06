export function estimateSavings({ volume, rate, cost, share }) {
  const eligibleLoss = volume * (rate / 100) * cost;
  const lowShare = Math.max(0, share - 15);
  const highShare = Math.min(100, share + 15);
  return {
    annual: eligibleLoss * (share / 100),
    low: eligibleLoss * (lowShare / 100),
    high: eligibleLoss * (highShare / 100),
    lowShare,
    highShare,
  };
}

export function readSimulatorUrl(setting = "") {
  const url = setting.trim();
  if (!url) return "";
  if (/^\/(?!\/)/.test(url) && !/[\\\s]/.test(url)) return url;
  if (/^https?:\/\//i.test(url)) {
    const parsed = new URL(url);
    if (!parsed.username && !parsed.password) return parsed.href;
  }
  throw new Error("NABZ_SIMULATOR_URL must be an HTTP(S) URL or a route beginning with one slash.");
}
