# Academic Research

Key academic papers that form the foundation of GEO as a discipline.

---

## GEO: Generative Engine Optimization (KDD 2024)

**Paper:** arXiv:2311.09735
**Authors:** Pranjal Aggarwal et al., Princeton University
**Venue:** ACM SIGKDD Conference on Knowledge Discovery and Data Mining, 2024

### Key Findings

- GEO strategies can improve AI citation visibility by **up to 40%**
- Introduced **GEO-bench**, a large-scale benchmark for evaluating GEO techniques
- Most effective single strategy: citing external sources (+27–115%)
- Second most effective: adding statistics (+33–40%)
- Third: expert quotations (+30–41%)

### Methodology

The authors created a simulated generative engine environment and tested various content optimization strategies against a control group. Strategies were evaluated on citation frequency — how often optimized content appeared in AI-generated responses.

**Link:** https://arxiv.org/abs/2311.09735

---

## AutoGEO: Automatic GEO (ICLR 2026)

**Paper:** arXiv:2510.11438
**Authors:** Carnegie Mellon University
**Venue:** International Conference on Learning Representations, 2026

### Key Findings

- Extended the 47 citation strategies from KDD 2024
- Developed automated optimization pipeline
- Demonstrated that machine-learned GEO strategies outperform manual approaches
- Showed that strategy effectiveness varies by platform (ChatGPT vs. Perplexity vs. Gemini)

### Significance

AutoGEO represents the shift from manual GEO guidelines to automated, platform-aware optimization.

**Link:** https://arxiv.org/abs/2510.11438

---

## UC Berkeley EMNLP 2024: Negative Signal Detection

**Venue:** Conference on Empirical Methods in Natural Language Processing, 2024

### Key Findings

- Identified 8 categories of negative signals that reduce AI citation priority
- Demonstrated that AI models consistently deprioritize content with excessive CTAs, thin content, and missing author signals
- Showed that these signals are evaluated by the AI engine, not just search crawlers

### Practical Application

This research formed the basis of the 8-signal negative detection system used in GEO auditing tools.

---

## How to Use This Research

| Paper | Best Use |
|-------|----------|
| KDD 2024 (Princeton) | Apply the 47 citation strategies ranked by impact |
| ICLR 2026 (CMU) | Understand platform-specific optimization |
| EMNLP 2024 (Berkeley) | Audit your content for negative signals |
| SIGIR 2026 (Vishwakarma et al.) | Competitive GEO dynamics — freshness > domain authority |

---

## 2026 Research Updates

### C-SEO Bench: Does Conversational SEO Work? (NeurIPS 2025)

**Paper:** [arXiv:2506.11097](https://arxiv.org/abs/2506.11097)
**Venue:** NeurIPS D&B 2025

Introduces a benchmark for evaluating conversational SEO effectiveness. Empirical evidence that conversational content strategies significantly influence AI search rankings.

### IF-GEO: Conflict-Aware Instruction Fusion (2026)

**Paper:** [arXiv:2601.13938](https://arxiv.org/abs/2601.13938)

Addresses multi-query GEO optimization — fusing potentially conflicting optimization instructions for different AI engines simultaneously.

### Multimodal GEO (2026)

**Paper:** [arXiv:2601.12263](https://arxiv.org/abs/2601.12263)

Extends GEO to vision-language model rankers — optimizing content for multimodal AI search.

### Source Composition Analysis of 167,551 Citations (2026)

**Paper:** [doi:10.5281/zenodo.20788142](https://doi.org/10.5281/zenodo.20788142) (Rankfor.AI)

Analysis of which source types, domains, and formats are most frequently cited by AI search platforms.

### What Gets Cited: Competitive GEO in AI Answer Engines (SIGIR 2026)

**Paper:** [arXiv:2605.25517](https://arxiv.org/abs/2605.25517)
**Venue:** ACM SIGIR 2026 (July 2026)

Conducted **252,000 controlled trials** across 6 LLMs testing 18 content factors in paired comparisons. Key findings:

- **Source freshness and content quality** are more important than domain authority for AI citation
- When two retrieved candidates compete for a single citation slot, **being cited is the bottleneck** — not being retrieved
- Content factors that help retrieval (SEO) can differ from factors that help citation (GEO)
- Introduces a competitive GEO framework for understanding multi-agent content dynamics

### Additional Papers

| Year | Paper | Link |
|------|-------|------|
|| 2026 | What Gets Cited: Competitive GEO in AI Answer Engines (SIGIR 2026) | [arXiv:2605.25517](https://arxiv.org/abs/2605.25517) |
|| 2026 | Navigating the Shift: Web Search vs Generative AI | [arXiv:2601.16858](https://arxiv.org/abs/2601.16858) |
|| 2025 | GEO: How to Dominate AI Search | [arXiv:2509.08919](https://arxiv.org/abs/2509.08919) |
|| 2025 | Beyond SEO: Transformer-Based Content Optimization | [ChatPaper](https://chatpaper.com/chatpaper/paper/158775) |
| 2025 | StealthRank: LLM Ranking Manipulation | [arXiv:2504.05804](https://arxiv.org/abs/2504.05804) |
| 2025 | NExT-Search: User Feedback for Generative AI Search | [arXiv:2505.14680](https://arxiv.org/abs/2505.14680) |
| 2024 | Ranking Manipulation for Conversational Search Engines | [arXiv:2406.03589](https://arxiv.org/abs/2406.03589) |
| 2024 | Manipulating LLMs to Increase Product Visibility | [arXiv:2404.07981](https://arxiv.org/abs/2404.07981) |