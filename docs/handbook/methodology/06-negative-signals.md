# Negative Signals: What Reduces AI Citation Priority

> Based on UC Berkeley EMNLP 2024 research and the Auriti-Labs GEO Optimizer framework. AI engines detect these signals and deprioritize content in their responses.

---

## Overview

AI search engines evaluate not just content quality, but also **negative signals** — page characteristics that reduce the likelihood of citation. These signals are distinct from spam penalties; they're about trust, usability, and content integrity.

**Severity Levels:**
| Signal Count | Severity |
|--------------|----------|
| ≥ 4 signals | 🔴 High |
| 2–3 signals | 🟠 Medium |
| 1 signal | 🟡 Low |

---

## Signal 1: Excessive CTA Density 🟠

| Aspect | Detail |
|--------|--------|
| **Detection** | > 5 CTAs on a page, or > 1% of words are CTA-class |
| **Why it matters** | AI engines prioritize informational content over promotional. Excessive CTAs signal low informational value. |
| **Fix** | Limit CTAs to 3–5 per page. Keep promotional language under 1% of total word count. Use contextual CTAs rather than generic "Buy Now" / "Sign Up" buttons. |
| **Example** | ❌ A 800-word article with 7 "Click here" / "Buy now" / "Get started" links |
| | ✅ Same article with 2 contextual CTAs at natural break points |

## Signal 2: Popup/Modal Overlays 🟠

| Aspect | Detail |
|--------|--------|
| **Detection** | Modal, popup, overlay, lightbox, or interstitial elements detected |
| **Why it matters** | Popups degrade user experience and signal that the page prioritizes conversion over content. |
| **Fix** | Remove or reduce intrusive popups. Use inline banners or exit-intent only. No full-screen overlays. |
| **Example** | ❌ Full-screen newsletter signup popup on page load |
| | ✅ Small inline banner at bottom of article |

## Signal 3: Thin Content 🔴

| Aspect | Detail |
|--------|--------|
| **Detection** | < 300 words when H1 promises depth (e.g., "Complete Guide", "Ultimate Tutorial") |
| **Why it matters** | AI engines compare content length against heading promises. Thin content that claims depth is a strong negative signal. |
| **Fix** | Match word count to heading promise. Short content is fine — but don't call it "Ultimate" or "Complete" if it's under 300 words. |
| **Example** | ❌ H1: "Complete Guide to SEO" — 250 words of content |
| | ✅ H1: "SEO Basics" — 250 words, or expand to 1500+ words |

## Signal 4: Broken Links 🟡

| Aspect | Detail |
|--------|--------|
| **Detection** | > 3 empty or broken links (internal or external) |
| **Why it matters** | Broken links indicate poor maintenance and reduce trust in the page's accuracy and relevance. |
| **Fix** | Regularly audit links. Use a broken link checker monthly. Remove or update broken external links. |
| **Example** | ❌ 5 external links to resources that return 404 |
| | ✅ All links verified, dead links replaced with working alternatives |

## Signal 5: Keyword Stuffing 🟡

| Aspect | Detail |
|--------|--------|
| **Detection** | Single keyword density > 2.5% AND keyword appears ≥ 5 times |
| **Why it matters** | AI engines detect unnatural keyword repetition as a manipulation attempt, not a quality signal. |
| **Fix** | Write naturally. Use synonyms and related terms. If a keyword appears more than once per ~100 words, consider varying the language. |
| **Example** | ❌ "Best SEO tools. Our SEO tools are the best SEO tools for SEO..." |
| | ✅ "Best SEO tools. Our toolkit helps you rank higher in search results..." |

## Signal 6: Missing Author Signal 🔴

| Aspect | Detail |
|--------|--------|
| **Detection** | No Person schema, no rel=author, no visible author byline |
| **Why it matters** | AI engines prefer content with identifiable authorship. Anonymous content is less trustworthy. |
| **Fix** | Add Person schema or rel=author to every content page. Include a visible author byline with name and optionally credentials. |
| **Example** | ❌ Article with no author listed anywhere |
| | ✅ Article with "By Jane Smith, Senior SEO Analyst" + Person schema |

## Signal 7: Excessive Boilerplate 🟠

| Aspect | Detail |
|--------|--------|
| **Detection** | Non-content (navigation, footer, sidebar, ads) exceeds a threshold ratio of total page content |
| **Why it matters** | AI engines evaluate the content-to-template ratio. Pages dominated by navigation, widgets, and boilerplate text have lower informational value. |
| **Fix** | Reduce template elements. Use concise navigation. Minimize sidebar widgets. Ensure main content is the majority of the page. |
| **Example** | ❌ 300 words of content in a 2000-word page (rest is nav, sidebar, footer) |
| | ✅ 1500 words of content in a 2000-word page |

## Signal 8: Mixed Signals (Heading vs Content Mismatch) 🟡

| Aspect | Detail |
|--------|--------|
| **Detection** | H1 or H2 promises comprehensive coverage, but content is thin or superficial |
| **Why it matters** | AI engines detect when a heading promises more than the content delivers. This signals low-quality or misleading content. |
| **Fix** | Ensure each H2 delivers what its heading promises. If a section is brief, use a modest heading. |
| **Example** | ❌ H2: "Complete Fee Breakdown" — followed by 2 sentences |
| | ✅ H2: "Fee Overview" — 2 sentences, or expand to full breakdown |

---

## Quick Self-Audit

```bash
# Check CTA density
curl -s https://yoursite.com | grep -oi 'buy now\|sign up\|click here\|get started\|subscribe' | wc -l

# Check keyword density (replace 'your-keyword' with actual keyword)
curl -s https://yoursite.com | grep -oi 'your-keyword' | wc -l

# Check word count
curl -s https://yoursite.com | wc -w

# Check author presence
curl -s https://yoursite.com | grep -E 'Person|author|byline|By ' | head -5

# Check broken links
curl -s https://yoursite.com | grep -oE 'href="https?://[^"]*"' | head -20
```

---

## References

- UC Berkeley EMNLP 2024 — "LLM View of Negative Signal Detection"
- Auriti-Labs GEO Optimizer — 8 negative signal checks
- See [Trust Stack](../methodology/05-trust-stack.md) for complementary positive signals