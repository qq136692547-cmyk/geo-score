# 5-Layer Trust Stack

The Trust Stack is a scoring system that evaluates how trustworthy your site appears to AI engines. Based on the Auriti-Labs GEO Optimizer framework.

---

## Scoring Overview

**Maximum Score:** 25 points
**Rating:** A (21–25) · B (16–20) · C (11–15) · D (6–10) · F (0–5)

---

## Layer 1: Technical Trust (5 points)

| Check | Points | How to Pass |
|-------|--------|-------------|
| HTTPS enabled | 2 | Valid SSL certificate, no mixed content |
| HSTS header | 1 | `Strict-Transport-Security` header present |
| CSP header | 1 | Content Security Policy configured |
| X-Frame-Options | 1 | `DENY` or `SAMEORIGIN` set |

**Why it matters:** AI engines deprioritize sites with security issues.

---

## Layer 2: Identity Trust (5 points)

| Check | Points | How to Pass |
|-------|--------|-------------|
| Consistent branding | 1.5 | Same brand name/logo across all pages |
| About page | 1 | Clear, detailed About page with team/location info |
| Contact information | 1 | Email, contact form, or physical address |
| Organization schema | 1 | JSON-LD with Organization type present |
| Author identification | 0.5 | Author bylines on all content pages |

**Why it matters:** AI engines need to know who created the content and whether they're credible.

---

## Layer 3: Social Trust (5 points)

| Check | Points | How to Pass |
|-------|--------|-------------|
| sameAs links present | 1.5 | Links to GitHub, Twitter, LinkedIn, etc. |
| Social media activity | 1.5 | Active profiles on at least 2 platforms |
| Reviews/testimonials | 1 | Third-party reviews (Google, G2, Trustpilot) |
| Community engagement | 1 | Comments, forums, or discussion activity |

**Why it matters:** Social proof signals real-world presence and engagement.

---

## Layer 4: Academic Trust (5 points)

| Check | Points | How to Pass |
|-------|--------|-------------|
| Research citations | 2 | Cite academic papers or industry research |
| Statistical data | 1.5 | Use specific numbers with attributions |
| Author credentials | 1.5 | Author bio with relevant qualifications |

**Why it matters:** Academic and data-backed content is the most cited by AI engines.

---

## Layer 5: Consistency Trust (5 points)

| Check | Points | How to Pass |
|-------|--------|-------------|
| Brand consistency | 1.5 | Same across all pages, no mixed signals |
| Date consistency | 1 | All dates accurate and matching |
| Factual accuracy | 1.5 | Claims verifiable from independent sources |
| No conflicting info | 1 | No contradictory statements across pages |

**Why it matters:** AI engines detect inconsistencies and downgrade trust.

---

## Quick Audit Command

```bash
# Check key trust signals on any site
curl -sI https://yoursite.com | grep -i 'strict-transport-security\|x-frame-options\|content-security-policy'
curl -s https://yoursite.com | grep -c 'schema.org'
curl -s https://yoursite.com/about | grep -c 'contact\|team\|location'
```