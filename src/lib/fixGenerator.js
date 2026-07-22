/**
 * Fix Files Generator — generates ready-to-use llms.txt, robots.txt, and JSON-LD
 * based on the audit result data.
 */

function generateLlmsTxt(result) {
  const url = result.url || 'https://example.com';
  const origin = url.replace(/^(https?:\/\/[^/]+).*$/, '$1');
  const domain = origin.replace(/^https?:\/\//, '');

  // Extract site name from page title or meta
  const html = result.raw && result.raw.pageHtml ? result.raw.pageHtml : '';
  let siteName = domain;
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch && titleMatch[1].trim()) {
    siteName = titleMatch[1].trim().split(/[|–\-—]/)[0].trim();
  }

  // Extract meta description for summary
  let summary = siteName + ' — website available at ' + domain;
  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  if (descMatch && descMatch[1].trim()) {
    summary = descMatch[1].trim().substring(0, 200);
  }

  // Build llms.txt content
  let content = '# ' + siteName + '\n\n';
  content += '> ' + summary + '\n\n';
  content += '## Key Pages\n\n';
  content += '[' + siteName + '](' + origin + '): Main website homepage.\n\n';

  // Add common pages
  content += '[About](' + origin + '/about): About ' + siteName + '.\n';
  content += '[Contact](' + origin + '/contact): Contact information and inquiry form.\n';
  content += '[Privacy Policy](' + origin + '/privacy): Privacy policy and data handling practices.\n';

  // Add llms.txt self-reference
  content += '\n## AI Resources\n\n';
  content += '[llms.txt](' + origin + '/llms.txt): This file — AI guidance for ' + siteName + '.\n';
  content += '[robots.txt](' + origin + '/robots.txt): Crawler directives for ' + siteName + '.\n';
  content += '[Sitemap](' + origin + '/sitemap.xml): XML sitemap listing all pages.\n';

  return content;
}

function generateRobotsTxt(result) {
  const url = result.url || 'https://example.com';
  const origin = url.replace(/^(https?:\/\/[^/]+).*$/, '$1');

  // Parse existing robots.txt to preserve user-specific rules
  const existing = result.raw && result.raw.robotsTxt ? result.raw.robotsTxt : '';
  var userRules = [];
  if (existing) {
    var lines = existing.split('\n');
    var inUserAgent = false;
    var skipBlock = false;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || line.startsWith('#')) continue;
      var uaMatch = line.match(/^User-agent:\s*(.+)$/i);
      if (uaMatch) {
        var ua = uaMatch[1].trim().toLowerCase();
        // Skip known AI crawler blocks — we'll regenerate them
        var aiBots = ['gptbot', 'claudebot', 'perplexitybot', 'google-extended', 'ccbot', 'bytespider', 'amazonbot'];
        skipBlock = aiBots.indexOf(ua) >= 0;
        inUserAgent = true;
        if (!skipBlock) {
          userRules.push('User-agent: ' + uaMatch[1].trim());
        }
        continue;
      }
      if (inUserAgent && !skipBlock) {
        userRules.push(line);
      }
    }
  }

  var content = 'User-agent: *\n';
  content += 'Allow: /\n\n';

  // If user had custom rules, preserve them
  if (userRules.length > 0) {
    content += '# Preserved rules from your original robots.txt\n';
    content += userRules.join('\n') + '\n\n';
  }

  content += '# AI Crawlers — explicitly allowed for GEO\n';
  content += 'User-agent: GPTBot\nAllow: /\n\n';
  content += 'User-agent: ClaudeBot\nAllow: /\n\n';
  content += 'User-agent: PerplexityBot\nAllow: /\n\n';
  content += 'User-agent: Google-Extended\nAllow: /\n\n';
  content += 'User-agent: CCBot\nAllow: /\n\n';
  content += 'User-agent: Bytespider\nAllow: /\n\n';
  content += 'Sitemap: ' + origin + '/sitemap.xml\n';

  return content;
}

function generateJsonLd(result) {
  const url = result.url || 'https://example.com';
  const origin = url.replace(/^(https?:\/\/[^/]+).*$/, '$1');
  const domain = origin.replace(/^https?:\/\//, '');

  const html = result.raw && result.raw.pageHtml ? result.raw.pageHtml : '';

  // Extract site name
  let siteName = domain;
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch && titleMatch[1].trim()) {
    siteName = titleMatch[1].trim().split(/[|–\-—]/)[0].trim();
  }

  // Extract description
  let description = 'Website at ' + domain;
  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  if (descMatch && descMatch[1].trim()) {
    description = descMatch[1].trim();
  }

  // Extract OG image if available
  let logo = null;
  const ogImgMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (ogImgMatch) logo = ogImgMatch[1].trim();

  var schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteName,
    url: origin,
    description: description,
  };

  if (logo) {
    schema.publisher = {
      '@type': 'Organization',
      name: siteName,
      logo: { '@type': 'ImageObject', url: logo }
    };
  }

  return '<script type="application/ld+json">\n' + JSON.stringify(schema, null, 2) + '\n</script>';
}

function generateFixFiles(result) {
  return {
    llmsTxt: {
      filename: 'llms.txt',
      content: generateLlmsTxt(result),
      mime: 'text/plain',
      path: '/llms.txt (place at your website root)',
    },
    robotsTxt: {
      filename: 'robots.txt',
      content: generateRobotsTxt(result),
      mime: 'text/plain',
      path: '/robots.txt (place at your website root)',
    },
    jsonLd: {
      filename: 'json-ld-schema.html',
      content: generateJsonLd(result),
      mime: 'text/html',
      path: 'Add this snippet to your <head> section',
    },
  };
}

export { generateFixFiles, generateLlmsTxt, generateRobotsTxt, generateJsonLd };
