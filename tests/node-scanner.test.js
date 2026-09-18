import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { createServer } from 'node:http';
import { auditUrl } from '../src/lib/node-scanner.js';

let server;
let baseUrl;

beforeAll(async () => {
  server = createServer((request, response) => {
    const path = request.url || '/';
    if (path === '/robots.txt') {
      response.setHeader('content-type', 'text/plain');
      response.end('User-agent: *\nAllow: /\nSitemap: ' + baseUrl + '/sitemap.xml\n');
      return;
    }
    if (path === '/llms.txt') {
      response.setHeader('content-type', 'text/plain');
      response.end('# Test Site\n\n> A test site\n\n## Pages\n\n- [Home](http://example.test/)\n');
      return;
    }
    if (path === '/sitemap.xml') {
      response.setHeader('content-type', 'application/xml');
      response.end('<?xml version="1.0"?><urlset><url><loc>' + baseUrl + '/</loc></url></urlset>');
      return;
    }
    if (path === '/.well-known/ai.txt' || path === '/ai/summary.json' || path === '/ai/faq.json') {
      response.statusCode = 404;
      response.end('not found');
      return;
    }
    response.setHeader('content-type', 'text/html');
    response.end('<!doctype html><html lang="zh-CN"><head><title>Test</title><meta name="description" content="test page"><meta name="author" content="Test Team"><script type="application/ld+json">{"@type":"WebSite","name":"Test"}</script></head><body><h1>测试页面</h1><main><p>这是一个用于测试 sitemap 检测的页面。</p></main></body></html>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('node scanner', () => {
  it('fetches sitemap.xml and passes the agent-friendliness sitemap check', async () => {
    const result = await auditUrl(baseUrl + '/');
    const sitemapCheck = result.dimensions.agentFriendliness.checks.find((check) => check.id === 'sitemap');
    expect(sitemapCheck.passed).toBe(true);
  });
});
