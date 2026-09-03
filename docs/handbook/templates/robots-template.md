# Robots.txt Template

A ready-to-use robots.txt configuration that allows AI citation bots while blocking AI training bots.

---

## Recommended Configuration

```apache
# ============================================
# ALLOWED — AI Citation Bots
# These bots search the web to cite content in AI answers.
# Blocking them reduces your visibility in AI search results.
# ============================================

User-agent: OAI-SearchBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Google-Extended
Allow: /

# ============================================
# DISALLOWED — AI Training Bots
# These bots collect data for training AI models.
# Blocking them protects your content from being used for training.
# ============================================

User-agent: GPTBot
Disallow: /

User-agent: anthropic-ai
Disallow: /

User-agent: CCBot
Disallow: /

# ============================================
# Additional Training Bots
# ============================================

User-agent: Applebot-Extended
Disallow: /

User-agent: Meta-ExternalFetcher
Disallow: /

# ============================================
# AI Chat Browsing Bots (Allow)
# These bots let users browse the web through AI chat interfaces.
# ============================================

User-agent: ChatGPT-User
Allow: /

# ============================================
# General Crawlers
# ============================================

User-agent: *
Allow: /

Sitemap: https://yoursite.com/sitemap.xml
```

---

## Bot Purpose Reference

| Bot | Purpose | Citation or Training? |
|-----|---------|-----------------------|
| `OAI-SearchBot` | ChatGPT Search answer citations | ✅ Citation |
| `PerplexityBot` | Perplexity AI answer citations | ✅ Citation |
| `ClaudeBot` | Claude web search citations | ✅ Citation |
| `Google-Extended` | Gemini / Google AI Overviews | ✅ Citation |
| `GPTBot` | GPT model training data | ❌ Training |
| `anthropic-ai` | Claude model training | ❌ Training |
| `CCBot` | Common Crawl (used for training) | ❌ Training |
| `ChatGPT-User` | ChatGPT user web browsing | ✅ Citation |
| `Applebot-Extended` | Apple AI training | ❌ Training |
| `Meta-ExternalFetcher` | Meta AI training | ❌ Training |

---

## Verification

After deploying, verify your configuration:

```bash
curl -s https://yoursite.com/robots.txt

# Check a specific bot's allowed paths
curl -s https://yoursite.com/robots.txt | grep -A1 'OAI-SearchBot'
```