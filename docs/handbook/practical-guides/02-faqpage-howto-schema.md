# FAQPage & HowTo Schema Guide

A practical guide to implementing FAQPage and HowTo structured data for maximum GEO impact.

---

## Why FAQPage Schema?

FAQPage schema is the single highest-ROI GEO tactic:

| Metric | Improvement |
|--------|-------------|
| AI extraction accuracy | 16% → 54% (with correct schema) |
| Rich result eligibility | FAQ rich snippets in Google |
| Question matching | Direct answer extraction by AI engines |

Source: Semrush research on structured data impact.

---

## FAQPage Implementation

### Step 1: Write Visible FAQ Content

Create a visible FAQ section in your HTML:

```html
<section class="faq-section">
  <h2>Frequently Asked Questions</h2>
  
  <details>
    <summary>What is the commission rate?</summary>
    <p>The commission rate is 6% per transaction for all categories as of 2026.</p>
  </details>
  
  <details>
    <summary>How are fees calculated?</summary>
    <p>Fees are calculated as: item price × 6% + shipping fee × 6% + any promotional discounts.</p>
  </details>
</section>
```

### Step 2: Add Matching JSON-LD

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is the commission rate?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "The commission rate is 6% per transaction for all categories as of 2026."
      }
    },
    {
      "@type": "Question",
      "name": "How are fees calculated?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Fees are calculated as: item price × 6% + shipping fee × 6% + any promotional discounts."
      }
    }
  ]
}
</script>
```

### Step 3: Verify Matching

- Every question in JSON-LD must have a visible answer in the HTML
- Every visible FAQ should have a matching JSON-LD entry
- Order doesn't need to match, but content must

---

## FAQ Question Writing Rules

### Do This

✅ Write questions as real user searches:
```
"What is the TikTok Shop fee?"
"How do FBA storage fees work?"
```

✅ Write answers as self-contained paragraphs (40–80 words):
```
"The TikTok Shop referral fee is a flat 6% per transaction regardless of product category. This was updated in 2026, replacing the previous category-based fee structure that ranged from 1% to 8%."
```

✅ Include specific numbers and data

### Don't Do This

❌ "As discussed above..." (AI extracts standalone, not sequential)
❌ "Please see our pricing page" (AI doesn't click links)
❌ Questions that don't match real search behavior

---

## HowTo Schema for Tool Pages

### When to Use

- Calculator/estimator tools
- Step-by-step guides
- Tutorial content

### Implementation

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to calculate profit on TikTok Shop",
  "description": "Use this calculator to estimate your net profit after fees.",
  "step": [
    {
      "@type": "HowToStep",
      "position": 1,
      "text": "Enter your product price in the 'Item Price' field."
    },
    {
      "@type": "HowToStep",
      "position": 2,
      "text": "Enter your cost of goods sold (COGS)."
    },
    {
      "@type": "HowToStep",
      "position": 3,
      "text": "The calculator automatically subtracts the 6% referral fee and shipping costs."
    },
    {
      "@type": "HowToStep",
      "position": 4,
      "text": "Review the profit breakdown showing net profit, profit margin, and fee breakdown."
    }
  ]
}
</script>
```

---

## Schema Count Guidelines

| Schema Type | Per-Page Count | Notes |
|-------------|----------------|-------|
| FAQPage | 3–10 Q&A pairs | Below 3: minimal impact. Above 10: may dilute. |
| HowTo | 3–8 steps | Match actual tool usage steps |
| Article | 1 per post | Required for blog content |
| Organization | 1 per site | Same across all pages |
| Person | 1 per author | On author pages or about page |

---

## Validation Checklist

- [ ] FAQPage schema present on pages with Q&A content
- [ ] Visible FAQ HTML matches JSON-LD content
- [ ] Each answer is self-contained (no "as above" references)
- [ ] HowTo steps are in logical order
- [ ] JSON-LD validated via Google Rich Results Test
- [ ] No duplicate FAQPage entries on same page
- [ ] Answers include specific numbers where applicable