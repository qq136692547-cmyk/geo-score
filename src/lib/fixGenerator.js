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

  // Parse the existing robots.txt into GROUPS, not a flat line list.
  //
  // 2026-10-22: the previous version flattened everything into `userRules` and
  // then unconditionally prefixed `User-agent: *` + `Allow: /`. Two ways that
  // hurt the user:
  //   1. A site that deliberately said `Disallow: /` got `Allow: /` merged into
  //      the same group. Equal-length Allow beats Disallow in RFC 9309, so the
  //      "fix" file silently unlocked a site that was closed on purpose.
  //   2. An AI bot blocked by name (e.g. `User-agent: GPTBot / Disallow: /`) was
  //      stripped and re-emitted as `Allow: /`, contradicting an explicit choice.
  // Now we read the groups first and refuse to contradict them.
  const existing = result.raw && result.raw.robotsTxt ? result.raw.robotsTxt : '';

  var AI_BOTS = ['gptbot','oai-searchbot','chatgpt-user','claudebot','anthropic-ai','claude-searchbot','perplexitybot','perplexity-user','google-extended','ccbot','bytespider','meta-externalagent','amazonbot','applebot-extended','cohere-ai','duckassistbot','ai2bot','xai-bot','youbot','petalbot'];

  var groups = [];
  var sitemapLines = [];
  var group = null;
  if (existing) {
    var lines = existing.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      if (line.charAt(0) === '#') continue;
      if (/^sitemap:/i.test(line)) { sitemapLines.push(line); continue; }
      var uaMatch = line.match(/^User-agent:\s*(.+)$/i);
      if (uaMatch) {
        // A User-agent line after rules have started begins a new group.
        if (!group || group.lines.length > 0) { group = { agents: [], lines: [] }; groups.push(group); }
        group.agents.push(uaMatch[1].trim().toLowerCase());
        continue;
      }
      if (group) group.lines.push(line);
    }
  }

  var isDisallowAll = function (l) { return /^disallow:\s*\/\s*$/i.test(l); };

  // Whole site closed on purpose? Then the honest output is "I did not change it".
  var globalBlock = groups.some(function (g) {
    return g.agents.indexOf('*') >= 0 && g.lines.some(isDisallowAll);
  });
  if (globalBlock) {
    return existing.replace(/\s+$/, '') + '\n\n' +
      '# GeoScore: your robots.txt closes the whole site to every crawler\n' +
      '# (User-agent: * + Disallow: /). That is a deliberate choice, so this\n' +
      '# file is returned unchanged — adding Allow: / here would override it.\n' +
      '# Remove that rule first if you actually want AI crawlers in.\n';
  }

  // Bots this site block by name — keep their block, do not "fix" it away.
  var blockedBots = {};
  groups.forEach(function (g) {
    if (!g.lines.some(isDisallowAll)) return;
    g.agents.forEach(function (a) {
      if (AI_BOTS.indexOf(a) >= 0) blockedBots[a] = true;
    });
  });

  // Everything except AI-bot groups becomes the preserved block. The `*` group
  // is rebuilt so we control where Allow: / sits.
  var userRules = [];
  groups.forEach(function (g) {
    var onlyAi = g.agents.every(function (a) { return AI_BOTS.indexOf(a) >= 0; });
    if (onlyAi) return;
    if (g.agents.indexOf('*') >= 0) {
      userRules.push('User-agent: *');
      g.lines.forEach(function (l) {
        if (!/^allow:\s*\/\s*$/i.test(l)) userRules.push(l);
      });
      return;
    }
    g.agents.forEach(function (a) { userRules.push('User-agent: ' + a); });
    g.lines.forEach(function (l) { userRules.push(l); });
  });

  var content = 'User-agent: *\n';
  content += 'Allow: /\n\n';

  // If user had custom rules, preserve them
  if (userRules.length > 0) {
    content += '# Preserved rules from your original robots.txt\n';
    content += userRules.join('\n') + '\n\n';
  }
  content += '# AI Crawlers — explicitly allowed for GEO\n';
  [
    ['# Tier 1: Critical (ChatGPT, Claude, Perplexity, Gemini)', ['GPTBot','OAI-SearchBot','ChatGPT-User','ClaudeBot','anthropic-ai','Claude-SearchBot','PerplexityBot','Perplexity-User','Google-Extended']],
    ['# Tier 2: Important', ['CCBot','Bytespider','meta-externalagent','Amazonbot','Applebot-Extended']],
    ['# Tier 3: Emerging', ['cohere-ai','DuckAssistBot','AI2Bot','xAI-Bot','YouBot','PetalBot']],
  ].forEach(function (tier) {
    var bots = tier[1];
    var kept = bots.filter(function (b) { return !blockedBots[b.toLowerCase()]; });
    var keptBlocked = bots.filter(function (b) { return blockedBots[b.toLowerCase()]; });

    if (keptBlocked.length > 0) {
      content += '# You block these by name. Kept blocked — re-allowing them would\n';
      content += '# contradict a rule you set on purpose.\n';
      keptBlocked.forEach(function (b) {
        content += 'User-agent: ' + b + '\nDisallow: /\n\n';
      });
    }
    if (kept.length === 0) return;
    content += tier[0] + '\n';
    kept.forEach(function (b) {
      content += 'User-agent: ' + b + '\nAllow: /\n\n';
    });
  });
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

  // 2026-10-22: the old output put @type WebSite at the top level and nested the
  // Organization under `publisher`. schema.js looks for a top-level (or @graph)
  // Organization, so a site that deployed OUR fix file still scored 0 on the org
  // check and lost 3 points (21% of the dimension). Generating a fix that fails
  // our own audit is worse than generating nothing.
  // Now both nodes are siblings in an @graph. extractJsonLd() flattens @graph,
  // so each node is checked on its own.
  var organization = {
    '@type': 'Organization',
    '@id': origin + '/#organization',
    name: siteName,
    url: origin,
  };
  if (logo) {
    organization.logo = { '@type': 'ImageObject', url: logo };
  }

  var website = {
    '@type': 'WebSite',
    '@id': origin + '/#website',
    name: siteName,
    url: origin,
    description: description,
    publisher: { '@id': origin + '/#organization' },
  };

  var schema = {
    '@context': 'https://schema.org',
    '@graph': [organization, website],
  };

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
      // The two path strings above are the only ones containing angle brackets,
      // and f.path is interpolated into innerHTML by fixFilesPanel.js. An
      // unescaped <head> there is parsed as a real element and silently
      // swallowed, so the user never sees the word in the UI. Escaped here so
      // the panel renders the literal text. The download name (f.filename)
      // never went through HTML and is deliberately left unescaped.
      path: 'Add this snippet to your &lt;head&gt; section',
    },
  };
}

export { generateFixFiles, generateLlmsTxt, generateRobotsTxt, generateJsonLd };
