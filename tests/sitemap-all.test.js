/**
 * sitemap-all.xml — the Search Console workaround mirror.
 *
 * Background: Google Search Console has reported "Couldn't fetch" for
 * https://geoscore.help/sitemap.xml since 2026-07-20 even though the file
 * itself is healthy (HTTP 200, application/xml, 50 <loc> entries, GSC's own
 * live test succeeds, Bing reports Success, Cloudflare logs no blocks).
 * Diagnosed 2026-11-27: the URL answers conditional requests with 304 and an
 * empty body, so Search Console keeps revalidating a stale validator.
 *
 * These tests lock the invariants that make the mirror safe:
 *   1. it exists and is valid XML with a real <urlset> (not a <sitemapindex>,
 *      which Google discourages for a single sitemap);
 *   2. it advertises exactly the same canonical URLs as /sitemap.xml, so the
 *      two can never drift into disagreeing about the site;
 *   3. robots.txt points at both paths;
 *   4. /sitemap.xml itself is untouched and still canonical.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  REPO_ROOT,
  extractLocs,
  buildMirrorXml,
} from '../scripts/sync-sitemap-all.mjs';

const SITEMAP_PATH = path.join(REPO_ROOT, 'public', 'sitemap.xml');
const MIRROR_PATH = path.join(REPO_ROOT, 'public', 'sitemap-all.xml');
const ROBOTS_PATH = path.join(REPO_ROOT, 'public', 'robots.txt');

const sourceXml = fs.readFileSync(SITEMAP_PATH, 'utf8');
const mirrorXml = fs.readFileSync(MIRROR_PATH, 'utf8');

describe('sitemap-all.xml mirror', () => {
  it('is a real <urlset>, not a <sitemapindex>', () => {
    expect(mirrorXml).toContain('<urlset');
    expect(mirrorXml).not.toContain('<sitemapindex');
    expect(mirrorXml.trimStart().startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });

  it('advertises exactly the same canonical URLs as /sitemap.xml', () => {
    const source = extractLocs(sourceXml);
    const mirror = extractLocs(mirrorXml);
    expect(mirror.length).toBe(source.length);
    expect(new Set(mirror)).toEqual(new Set(source));
    // Canonical host only: the mirror must never advertise its own path.
    for (const url of mirror) expect(url.startsWith('https://geoscore.help/')).toBe(true);
    expect(mirror.some((u) => u.includes('sitemap-all'))).toBe(false);
  });

  it('stays byte-identical to a fresh regeneration (no manual drift)', () => {
    expect(mirrorXml).toBe(buildMirrorXml(sourceXml));
  });

  it('declares both sitemaps in robots.txt', () => {
    const robots = fs.readFileSync(ROBOTS_PATH, 'utf8');
    expect(robots).toContain('Sitemap: https://geoscore.help/sitemap.xml');
    expect(robots).toContain('Sitemap: https://geoscore.help/sitemap-all.xml');
  });

  it('leaves /sitemap.xml canonical and unchanged in shape', () => {
    expect(sourceXml).toContain('<urlset');
    expect(sourceXml).not.toContain('sitemap-all');
    expect(extractLocs(sourceXml).length).toBeGreaterThanOrEqual(50);
  });

  it('fails loudly on a truncated source instead of mirroring a half file', () => {
    const truncated = sourceXml.slice(0, sourceXml.lastIndexOf('</urlset>'));
    expect(() => extractLocs(truncated)).toThrow(/truncated/i);
    expect(() => buildMirrorXml(truncated)).toThrow(/truncated/i);
  });
});