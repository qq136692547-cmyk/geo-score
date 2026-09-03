# Static Site GEO

Optimizing static HTML sites (GitHub Pages, Netlify, Vercel, any pure HTML/CSS/JS site) for AI search engine visibility.

---

## Why Static Sites Need Special GEO Treatment

Static sites have unique advantages and challenges for GEO:

| Aspect | Advantage | Challenge |
|--------|-----------|-----------|
| **Speed** | Fast loading (positive signal) | — |
| **SSR** | Content is HTML from the start | — |
| **Metadata** | Full control over head tags | Must be manually configured |
| **Schema** | Can insert anywhere | Must be manually embedded |
| **Dynamic features** | — | No CMS to auto-manage GEO elements |

---

## Step-by-Step GEO for Static Sites

### Step 1: robots.txt Configuration

Ensure AI citation bots are allowed:

```apache
User-agent: OAI-SearchBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: GPTBot
Disallow: /

User-agent: anthropic-ai
Disallow: /
```

Place this in the root of your static site (e.g., `/robots.txt`).

### Step 2: llms.txt Deployment

Create `/llms.txt` in your site root to guide AI crawlers:

```markdown
# Site Name
> One-sentence description of your site

## Tools
- [Tool Name 1](https://yoursite.com/tools/tool1): Brief description
- [Tool Name 2](https://yoursite.com/tools/tool2): Brief description

## Blog
- [Post Title 1](https://yoursite.com/blog/post1): Brief description
- [Post Title 2](https://yoursite.com/blog/post2): Brief description
```

Keep llms.txt under 200 lines. Add an `/llms-full.txt` for complete documentation if needed.

### Step 3: Open Graph + Twitter Cards

Every page needs these meta tags in `<head>`:

```html
<meta property="og:title" content="Unique Page Title — Brand Name" />
<meta property="og:description" content="120-160 character description with primary keyword." />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://yoursite.com/page-url" />
<meta property="og:image" content="https://yoursite.com/og-image.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Unique Page Title — Brand Name" />
<meta name="twitter:description" content="120-160 character description." />
<link rel="canonical" href="https://yoursite.com/page-url" />
```

### Step 4: Structured Data

Insert JSON-LD in each page. At minimum:

1. **Organization schema** on every page (in `<head>` or base template)
2. **Article schema** on blog posts (in post HTML)
3. **FAQPage schema** on content with Q&A sections
4. **HowTo schema** on calculator/tool pages

### Step 5: Definition-First Content

The first 100 words of every page must directly answer the core question:

```
Bad: "Welcome to our tool site. We offer various calculators..."
Good: "The TikTok Shop Profit Calculator helps sellers estimate net profit by subtracting the 6% referral fee, shipping costs, and COGS from gross revenue."
```

### Step 6: Blog Post Structure

Every blog post should follow this structure:

```
H1: Direct question or clear topic
├── First paragraph: Direct answer (AI snippet)
├── H2: Key section
│   ├── Definition first sentence
│   ├── Supporting content with statistics
│   └── External citations
├── H2: Comparison/Details
│   ├── Table or bullet list
│   └── Concrete examples
├── H2: FAQ section
│   ├── 3-5 Q&A pairs (visible HTML)
│   └── FAQPage JSON-LD
└── Internal links to related tools/pages
```

### Step 7: AI Discovery Endpoints

Create these files for AI crawler discovery:

- `/.well-known/ai.txt` — Points to key site resources
- `/ai/summary.json` — JSON summary of what your site offers
- `/ai/faq.json` — JSON array of common questions and answers

---

## Quick Deployment Check

```bash
# Check robots.txt
curl -s https://yoursite.com/robots.txt | head -10

# Check llms.txt
curl -s https://yoursite.com/llms.txt | head -10

# Check OG tags
curl -s https://yoursite.com | grep -o 'og:title\|og:description\|twitter:card'

# Check schema
curl -s https://yoursite.com | grep -o 'schema.org/[A-Za-z]*' | sort -u

# Check FAQPage
curl -s https://yoursite.com | grep -c 'FAQPage'
```