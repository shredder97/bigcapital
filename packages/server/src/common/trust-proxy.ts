/**
 * Positive integer hop count from TRUST_PROXY_HOPS.
 * Unset, zero, negative, fractional, and non-numeric values are 0.
 * Fractions are rejected, not truncated: parseInt('2.5') === 2.
 */
export function trustProxyHops(env = process.env): number {
  const raw = env.TRUST_PROXY_HOPS;
  if (typeof raw !== 'string') return 0;

  const trimmed = raw.trim();
  if (!/^[0-9]+$/.test(trimmed)) return 0;

  const hops = Number(trimmed);
  return hops > 0 && Number.isSafeInteger(hops) ? hops : 0;
}
