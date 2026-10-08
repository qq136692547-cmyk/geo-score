import { describe, it, expect } from 'vitest';
import { normalizeAuditUrl } from '../src/lib/auditUrl.js';

// These tests reproduce a real defect found by driving the site in a browser on
// 2026-10-08: typing "not a url at all" and pressing Start Audit did NOT show an
// error. boot.js only checked for an empty string, then prefixed "https://" and
// launched a real audit, which hung for 45s+ with the input hidden and no way to
// correct the typo. A user who mistypes one character hits the same path.

describe('normalizeAuditUrl — accepts what a user might legitimately type', () => {
  it('bare domain gets an https prefix', () => {
    expect(normalizeAuditUrl('example.com')).toEqual({ host: 'example.com', url: 'https://example.com' });
  });

  it('keeps an existing scheme and any path', () => {
    expect(normalizeAuditUrl('https://example.com/blog/post'))
      .toEqual({ host: 'example.com', url: 'https://example.com/blog/post' });
    expect(normalizeAuditUrl('http://example.com')).toEqual({ host: 'example.com', url: 'http://example.com' });
  });

  it('handles subdomains, multi-part TLDs and an IP address', () => {
    expect(normalizeAuditUrl('sub.example.co.uk').host).toBe('sub.example.co.uk');
    expect(normalizeAuditUrl('192.168.1.1').host).toBe('192.168.1.1');
  });

  it('ignores surrounding whitespace and lowercases the host', () => {
    expect(normalizeAuditUrl('  Example.COM  ').host).toBe('example.com');
  });

  it('drops a port from the host match', () => {
    expect(normalizeAuditUrl('example.com:8080').host).toBe('example.com');
  });

  it('accepts a hyphenated domain', () => {
    expect(normalizeAuditUrl('my-site.example.com').host).toBe('my-site.example.com');
  });
});

describe('normalizeAuditUrl — rejects input that must not start an audit', () => {
  it('rejects the exact string that reproduced the bug', () => {
    expect(normalizeAuditUrl('not a url at all')).toBeNull();
  });

  it('rejects anything containing whitespace', () => {
    expect(normalizeAuditUrl('example .com')).toBeNull();
    expect(normalizeAuditUrl('example.com foo')).toBeNull();
  });

  it('rejects a single label with no dot', () => {
    expect(normalizeAuditUrl('localhost')).toBeNull();
    expect(normalizeAuditUrl('abc')).toBeNull();
  });

  it('rejects empty and whitespace-only input', () => {
    for (const v of ['', '   ', null, undefined]) expect(normalizeAuditUrl(v)).toBeNull();
  });

  it('rejects dangling, leading and doubled dots', () => {
    expect(normalizeAuditUrl('example.')).toBeNull();
    expect(normalizeAuditUrl('.example.com')).toBeNull();
    expect(normalizeAuditUrl('example..com')).toBeNull();
  });

  it('rejects labels that start or end with a hyphen', () => {
    expect(normalizeAuditUrl('-example.com')).toBeNull();
    expect(normalizeAuditUrl('example-.com')).toBeNull();
  });

  it('rejects a non-http scheme rather than treating it as a host', () => {
    expect(normalizeAuditUrl('ftp://example.com')).toBeNull();
    expect(normalizeAuditUrl('javascript:alert(1)')).toBeNull();
  });

  it('rejects a bare scheme with no host', () => {
    expect(normalizeAuditUrl('https://')).toBeNull();
    expect(normalizeAuditUrl('http://')).toBeNull();
  });

  it('rejects an absurdly long host', () => {
    expect(normalizeAuditUrl('a'.repeat(300) + '.com')).toBeNull();
  });
});
