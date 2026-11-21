/**
 * GeoScore Chrome Extension - Tech Stack Detector & Platform Guidance
 *
 * Pure module with zero DOM dependencies.
 * Identifies common platforms (Shopify, Next.js, WordPress) from HTML/URL signals
 * and returns accurate, platform-specific GEO deployment guidance.
 */

const SHOPIFY_RE = /cdn\.shopify\.com|Shopify\.theme|Shopify\.shop|shopify-section|\.myshopify\.com/i;
const NEXTJS_RE = /__NEXT_DATA__|\/_next\/static\/|next-route-announcer/i;
const WORDPRESS_RE = /\/wp-content\/|\/wp-includes\/|<meta[^>]+name=["']generator["'][^>]*WordPress|<meta[^>]+content=["'][^"']*WordPress[^"']*["'][^>]+name=["']generator["']/i;

const STACK_GUIDANCE_EN = {
  shopify: {
    stack: 'shopify',
    name: 'Shopify',
    summary:
      'Upload llms.txt via Content > Files and set up a /llms.txt URL Redirect, customize robots via templates/robots.txt.liquid, and add Product JSON-LD in your product template.',
    guideUrl: 'https://geoscore.help/geo-for/shopify/?utm_source=chrome_ext',
    showFixPackHint: true,
  },
  wordpress: {
    stack: 'wordpress',
    name: 'WordPress',
    summary:
      'Place llms.txt in your WP root directory (alongside wp-config.php), configure AI crawler rules in Yoast or Rank Math, and inject JSON-LD via WPCode.',
    guideUrl: 'https://geoscore.help/geo-for/wordpress/?utm_source=chrome_ext',
    showFixPackHint: true,
  },
  nextjs: {
    stack: 'nextjs',
    name: 'Next.js',
    summary:
      'Serve static guidance from public/llms.txt, define crawler rules in app/robots.ts, and output JSON-LD server-side in app/layout.tsx.',
    guideUrl: 'https://geoscore.help/geo-for/nextjs/?utm_source=chrome_ext',
    showFixPackHint: false,
  },
};

const STACK_GUIDANCE_ZH = {
  shopify: {
    stack: 'shopify',
    name: 'Shopify',
    summary:
      '在后台 Content > Files 上传 llms.txt 并配置 /llms.txt URL Redirect 跳转；通过 templates/robots.txt.liquid 放行 AI 爬虫；在商品模板中补充 Product JSON-LD。',
    guideUrl: 'https://geoscore.help/zh/geo-for/shopify/?utm_source=chrome_ext',
    showFixPackHint: true,
  },
  wordpress: {
    stack: 'wordpress',
    name: 'WordPress',
    summary:
      '将 llms.txt 放在 WP 根目录（wp-config.php 同级）；在 Yoast 或 Rank Math 中配置 AI 爬虫规则；通过 WPCode 插件注入 JSON-LD 结构化数据。',
    guideUrl: 'https://geoscore.help/zh/geo-for/wordpress/?utm_source=chrome_ext',
    showFixPackHint: true,
  },
  nextjs: {
    stack: 'nextjs',
    name: 'Next.js',
    summary:
      '将静态文件放置于 public/llms.txt，使用 app/robots.ts 定义爬虫权限，并在 app/layout.tsx 中直接服务端输出 JSON-LD 结构化数据。',
    guideUrl: 'https://geoscore.help/zh/geo-for/nextjs/?utm_source=chrome_ext',
    showFixPackHint: false,
  },
};

export function detectTechStack(html = '', url = '') {
  const safeHtml = typeof html === 'string' ? html : '';
  const safeUrl = typeof url === 'string' ? url : '';
  const combined = `${safeUrl}\n${safeHtml}`;

  if (!combined.trim()) return null;
  if (SHOPIFY_RE.test(combined)) return 'shopify';
  if (NEXTJS_RE.test(safeHtml)) return 'nextjs';
  if (WORDPRESS_RE.test(safeHtml)) return 'wordpress';
  return null;
}

export function getStackGuidance(stack, isZh = false) {
  if (!stack || typeof stack !== 'string') return null;
  const key = stack.toLowerCase();
  const table = isZh ? STACK_GUIDANCE_ZH : STACK_GUIDANCE_EN;
  const entry = table[key];
  return entry ? { ...entry } : null;
}
