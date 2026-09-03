# 47 Citation Strategies

Based on research from the KDD 2024 GEO paper (Princeton) and AutoGEO ICLR 2026 paper (CMU). Strategies are ranked by their measured impact on AI citation frequency.

---

## 🔴 High Priority (≥20% Visibility Improvement)

### 1. Cite External Sources
**Impact:** +27–115%
**How:** Add links to authoritative external sources — .edu domains, .gov sites, academic papers, recognized industry reports.
**Why it works:** AI engines verify facts against multiple sources. Content backed by authoritative references is more likely to be cited.
**Example:** "According to a 2025 Gartner study, 67% of businesses..." rather than "Many businesses..."

### 2. Add Statistics
**Impact:** +33–40%
**How:** Include specific numbers — percentages, dollar amounts, dates, counts. Every claim that can have a number should have one.
**Why it works:** Statistics are concrete, verifiable, and make excellent citation material for AI responses.
**Example:** "The fee is 6% per transaction" rather than "The fee is reasonable"

### 3. Expert Quotations
**Impact:** +30–41%
**How:** Include direct quotes from named experts with credentials. Format: `"Quote" — Name, Title, Organization, Year`
**Why it works:** Named quotations provide clear authority attribution that AI engines can reference.
**Example:** `"AI will not replace human creativity" — Jane Smith, CEO, CreativeAI, 2026`

### 4. Fluency Optimization
**Impact:** +15–29%
**How:** Write in clear, direct language. Short sentences. Active voice. One idea per paragraph.
**Why it works:** AI models extract information more accurately from well-written content.
**Tips:**
- Avoid jargon without definition
- Use transition words ("Therefore," "However," "For example")
- Keep paragraphs under 4 sentences

### 5. Definition First
**Impact:** +25%
**How:** Open each section and subsection with a clear definition of the topic.
**Why it works:** AI models extract the opening paragraph as the section summary.
**Structure:** `{Topic} is {definition}. {Why it matters}. {Key facts}.`

### 6. Heading Boundaries
**Impact:** +22%
**How:** Follow each H2 or H3 heading immediately with core content. Don't bury the key information below secondary text.
**Why it works:** AI models weigh content more heavily when it follows a heading boundary.
**Example:**
```markdown
## Fee Structure
The TikTok Shop referral fee is 6% per transaction for all categories as of 2026.
[Continue with details]
```

---

## 🟠 Medium Priority (10–20% Improvement)

### 7. Authoritative Tone
Use phrasing like "Research shows," "Studies indicate," "Industry data confirms." Avoid hedging ("might," "could possibly," "some say").

### 8. Easy-to-Understand Language
Define technical terms on first use. Use analogies for complex concepts. Assume the reader is intelligent but not specialized.

### 9. Technical Terminology
Use correct industry terminology and acronyms — but always expand them on first use. AI models recognize domain-specific vocabulary as authority signals.

### 10. Anchor Sentences
Open each paragraph with a strong topic sentence that states the core point. The rest of the paragraph supports it.

### 11. Lists and Tables
Structure information in bullet lists and comparison tables. AI models parse structured formats more reliably than prose.

### 12. Internal Links
Link to related content on your own site. Use descriptive anchor text (not "click here").

### 13. Vocabulary Diversity
Vary your word choices. Avoid repeating the same phrases. AI models detect rich vocabulary as a quality signal.

### 14. Logical Connectives
Use transition words and phrases: "Therefore," "However," "For example," "In contrast," "As a result."

### 15. Scannable Paragraphs
Keep paragraphs short (2–4 sentences). Use subheadings to break up long sections.

### 16. Bold Key Terms
Bold critical terms and phrases on first mention. AI models give weighted attention to bolded content.

---

## 🟢 Lower Priority (<10% Improvement)

### 17–22: Structural Refinements

| # | Strategy | Description |
|---|----------|-------------|
| 17 | Front-loading | Higher information density in article opening |
| 18 | RAG Chunk Readiness | Sections 50–200 words, independently extractable |
| 19 | Embedding Proximity | Title, heading, and body aligned semantically |
| 20 | Consistent Terminology | Same term for same concept throughout |
| 21 | Summary Paragraphs | Brief summary before transitioning to next section |
| 22 | Conditional Language | Clear distinction between fact and opinion |

### 23–30: Content Completeness

| # | Strategy | Description |
|---|----------|-------------|
| 23 | Address Counterarguments | Acknowledge opposing views (balanced content ranks higher) |
| 24 | Update Old Content | Date-stamp and refresh outdated information |
| 25 | Multiple Format Delivery | Text + table + diagram for key concepts |
| 26 | Comparison Framing | "X vs Y" structures for decision-content |
| 27 | Step-by-Step Instructions | Numbered steps for how-to content |
| 28 | Case Studies | Real-world examples with concrete outcomes |
| 29 | Frequently Asked Questions | Dedicated FAQ section matching real search queries |
| 30 | Glossary of Terms | Define key terms used in the content |

### 31–40: Technical Signals

| # | Strategy | Description |
|---|----------|-------------|
| 31 | Correct HTML Heading Order | H1 → H2 → H3, no skipping levels |
| 32 | Meta Description Optimization | Clear, keyword-inclusive, 150–160 chars |
| 33 | Open Graph Tags | og:title, og:description, og:image per page |
| 34 | Twitter Card Tags | twitter:card, twitter:title, twitter:description |
| 35 | Canonical URLs | Avoid duplicate content confusion |
| 36 | Schema Markup | FAQPage, Article, Organization, Person |
| 37 | llms.txt Deployment | Guide AI crawlers to important pages |
| 38 | Well-Known AI Discovery | .well-known/ai.txt endpoint |
| 39 | RSS/Atom Feeds | Machine-readable content updates |
| 40 | Sitemap.xml | Complete, current sitemap |

### 41–47: Authority Building

| # | Strategy | Description |
|---|----------|-------------|
| 41 | Wikipedia Presence | Get mentioned on relevant Wikipedia pages |
| 42 | Google Knowledge Panel | Establish a Knowledge Graph entity |
| 43 | HARO/Connectively Responses | Get cited by journalists and bloggers |
| 44 | Guest Posts on Authoritative Sites | Build cross-domain citations |
| 45 | Original Research Publications | Reports, surveys, studies unique to your brand |
| 46 | Conference Presentations | Speaking at industry events |
| 47 | Academic Citations | Being referenced in research papers |

---

## ❌ Avoid These

| Strategy | Effect | Why |
|----------|--------|-----|
| Keyword stuffing | ~0% (neutral to negative) | AI engines detect and deprioritize |
| Clickbait headlines | Negative | Reduces trust signals |
| Duplicate content | Negative | Confuses source attribution |
| Excessive popups/modals | Negative | Negative signal detection |
| Thin content with grand claims | Negative | Content-to-heading mismatch |