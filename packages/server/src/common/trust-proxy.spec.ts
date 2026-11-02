import { trustProxyHops } from '@/common/trust-proxy';

describe('trustProxyHops', () => {
  const previous = process.env.TRUST_PROXY_HOPS;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.TRUST_PROXY_HOPS;
    } else {
      process.env.TRUST_PROXY_HOPS = previous;
    }
  });

  it('returns 0 when TRUST_PROXY_HOPS is unset', () => {
    expect(trustProxyHops({})).toBe(0);

    delete process.env.TRUST_PROXY_HOPS;
    expect(trustProxyHops()).toBe(0);
  });

  it('returns 0 for 0', () => {
    expect(trustProxyHops({ TRUST_PROXY_HOPS: '0' })).toBe(0);
  });

  it('returns 0 for non-numeric values', () => {
    expect(trustProxyHops({ TRUST_PROXY_HOPS: 'abc' })).toBe(0);
    expect(trustProxyHops({ TRUST_PROXY_HOPS: 'true' })).toBe(0);
  });

  it('returns 0 for a negative hop count', () => {
    expect(trustProxyHops({ TRUST_PROXY_HOPS: '-1' })).toBe(0);
    expect(trustProxyHops({ TRUST_PROXY_HOPS: ' -1 ' })).toBe(0);
  });

  it('returns the integer hop count', () => {
    expect(trustProxyHops({ TRUST_PROXY_HOPS: '2' })).toBe(2);
    expect(trustProxyHops({ TRUST_PROXY_HOPS: '08' })).toBe(8);
  });

  it('returns 0 for a fractional value instead of truncating it', () => {
    // parseInt('2.5', 10) === 2, which would trust the wrong number of hops.
    expect(trustProxyHops({ TRUST_PROXY_HOPS: '2.5' })).toBe(0);
    expect(trustProxyHops({ TRUST_PROXY_HOPS: '2.0' })).toBe(0);
  });

  it('ignores surrounding whitespace around an integer', () => {
    expect(trustProxyHops({ TRUST_PROXY_HOPS: ' 2' })).toBe(2);
    expect(trustProxyHops({ TRUST_PROXY_HOPS: '2 ' })).toBe(2);
    expect(trustProxyHops({ TRUST_PROXY_HOPS: '  2  ' })).toBe(2);
    expect(trustProxyHops({ TRUST_PROXY_HOPS: '\t2\n' })).toBe(2);
  });

  it('returns 0 for blank or partial tokens', () => {
    expect(trustProxyHops({ TRUST_PROXY_HOPS: '' })).toBe(0);
    expect(trustProxyHops({ TRUST_PROXY_HOPS: '   ' })).toBe(0);
    expect(trustProxyHops({ TRUST_PROXY_HOPS: '2abc' })).toBe(0);
    expect(trustProxyHops({ TRUST_PROXY_HOPS: '+2' })).toBe(0);
  });

  it('reads process.env when no env object is passed', () => {
    process.env.TRUST_PROXY_HOPS = '4';
    expect(trustProxyHops()).toBe(4);
  });
});
