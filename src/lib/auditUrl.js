// Turn whatever the user typed into the audit box into something safe to fetch,
// or null if it cannot be a hostname.
//
// WHY THIS EXISTS
//   boot.js used to check only for an empty string, then prefix "https://" and
//   start a real audit. Typing "not a url at all" therefore launched an audit
//   that hung for 45s+ with the input hidden and no way to fix the typo (found
//   by driving the live site in a browser, 2026-10-08). A user who mistypes one
//   character reaches the same dead end.
//
// Deliberately permissive about what counts as *valid* — IPs, multi-part TLDs,
// ports and paths all pass — and strict only about things that can never be a
// host, so this cannot reject a URL that used to work.

const MAX_HOST = 253;

/** @returns {{host: string, url: string} | null} */
export function normalizeAuditUrl(raw) {
  const value = String(raw == null ? '' : raw).trim();
  if (!value) return null;

  // A scheme that is not http(s) means the rest is not a host worth fetching
  // (ftp://example.com, javascript:alert(1)).
  const scheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(value);
  if (scheme && !/^https?$/i.test(scheme[1])) return null;
  // "javascript:alert(1)" has no "//" so the check above misses it. A colon
  // followed by a non-digit means it is a scheme, not a port: "example.com:8080"
  // is a host with a port and must pass, "javascript:alert(1)" must not.
  if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(value) && !/^https?:\/\//i.test(value)) return null;

  const withoutScheme = value.replace(/^https?:\/\//i, '');
  // Host runs from the start to the first path/query/hash, minus any port.
  const authority = withoutScheme.split(/[/?#]/)[0];
  const host = authority.split(':')[0].toLowerCase();

  if (!host || host.length > MAX_HOST) return null;
  if (host.includes(' ')) return null;
  // At least two labels, each starting and ending alphanumeric.
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host)) return null;

  return {
    host,
    url: /^https?:\/\//i.test(value) ? value : 'https://' + value,
  };
}
