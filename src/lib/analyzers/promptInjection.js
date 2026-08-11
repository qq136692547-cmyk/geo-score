/**
 * Prompt Injection Detection analyzer
 *
 * Detects patterns that AI search engines may flag as prompt injection or
 * adversarial content manipulation attempts. These include:
 * - Hidden system/role instructions targeting AI crawlers
 * - "Ignore previous instructions" style attacks
 * - Hidden text (display:none, visibility:hidden, color matching background)
 * - Data exfiltration attempts (external URLs in hidden contexts)
 * - Adversarial unicode (zero-width chars, homoglyphs)
 */

function analyzePromptInjection(html) {
  const checks = [];
  const flags = [];

  if (!html) {
    return {
      score: 0,
      maxScore: 6,
      checks: [
        { id: 'system-instructions', label: 'System/role instructions', passed: false },
        { id: 'ignore-instructions', label: 'Ignore-previous patterns', passed: false },
        { id: 'hidden-text', label: 'Hidden text (display:none / visibility:hidden)', passed: false },
        { id: 'zero-width-chars', label: 'Zero-width / invisible unicode', passed: false },
        { id: 'data-exfil', label: 'Hidden data exfiltration URLs', passed: false },
        { id: 'homoglyphs', label: 'Homoglyph / confusable characters', passed: false },
      ],
      flags: [],
      passed: 0,
      total: 6,
    };
  }

  // --- 1. System/role instructions targeting AI ---
  // Patterns: [SYSTEM], <system>, role: system, #instructions-for-ai, etc.
  const systemPatterns = [
    /(?:^|\n)\s*#{0,6}\s*(?:SYSTEM|INSTRUCTIONS?|ROLE)\s*[:#]\s*/i,
    /(?:^|\n)\s*<!--\s*(?:SYSTEM|INSTRUCTIONS?|ROLE|AI[- ]?PROMPT)\s*[:#]/i,
    /<meta[^>]+name=["']ai[- ]?instructions?["']/i,
    /(?:^|\n)\s*\[(?:SYSTEM|INSTRUCTIONS?|AI[- ]?PROMPT|ROLE)\]\s*/i,
    /(?:^|\n)\s*\[(?:SYSTEM|INSTRUCTIONS?|AI[- ]?PROMPT|ROLE)\]\s*[:#]?\s*/i,
  ];
  const hasSystemInstructions = systemPatterns.some(p => p.test(html));
  checks.push({
    id: 'system-instructions',
    label: hasSystemInstructions ? 'System/role instructions detected' : 'No system/role instructions',
    passed: !hasSystemInstructions,
  });
  if (hasSystemInstructions) flags.push({ id: 'system-instructions', label: 'System instructions targeting AI', severity: 'high' });

  // --- 2. "Ignore previous instructions" patterns ---
  const ignorePatterns = [
    /ignore\s+(?:all\s+)?(?:previous|prior|above|earlier)\s+instructions?/i,
    /disregard\s+(?:all\s+)?(?:previous|prior|above)\s+instructions?/i,
    /forget\s+(?:all\s+)?(?:previous|prior)\s+(?:instructions?|context|rules)/i,
    /override\s+(?:your\s+)?(?:system|default|original)\s+(?:instructions?|prompt|rules)/i,
    /you\s+are\s+now\s+(?:in\s+)?(?:developer|root|admin|jailbreak)\s+mode/i,
    /(?:do\s+not|don'?t)\s+follow\s+(?:your\s+)?(?:previous|original|system)\s+instructions?/i,
    /new\s+instructions?\s*:\s*you\s+(?:are|must|should|can)/i,
    /act\s+as\s+(?:if\s+)?(?:you\s+(?:are|were)\s+)?(?:a\s+)?(?:different|unrestricted|unfiltered)/i,
  ];
  const ignoreMatches = ignorePatterns.filter(p => p.test(html));
  const hasIgnorePatterns = ignoreMatches.length > 0;
  checks.push({
    id: 'ignore-instructions',
    label: hasIgnorePatterns ? `Ignore-previous patterns detected (${ignoreMatches.length})` : 'No ignore-previous patterns',
    passed: !hasIgnorePatterns,
  });
  if (hasIgnorePatterns) flags.push({ id: 'ignore-instructions', label: `"Ignore previous instructions" patterns (${ignoreMatches.length})`, severity: 'critical' });

  // --- 3. Hidden text (display:none, visibility:hidden, color matching background) ---
  // Check inline styles and style blocks
  const hiddenStylePatterns = [
    /style=["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0[^.]|font-size\s*:\s*0px|height\s*:\s*0|width\s*:\s*0|overflow\s*:\s*hidden[^"']*height\s*:\s*0)[^"']*["']/i,
    /class=["'][^"']*(?:hidden|sr-only|visually-hidden|screen-reader-text)[^"']*["']/i,
  ];
  // Also check for white-on-white or same-color text (simplified)
  const colorMatch = html.match(/style=["'][^"']*color\s*:\s*(white|#fff|#ffffff)[^"']*background[^"']*color\s*:\s*(white|#fff|#ffffff)[^"']*["']/i) ||
    html.match(/style=["'][^"']*background[^"']*color\s*:\s*(white|#fff|#ffffff)[^"']*color\s*:\s*(white|#fff|#ffffff)[^"']*["']/i);
  const hasHiddenText = hiddenStylePatterns.some(p => p.test(html)) || !!colorMatch;
  checks.push({
    id: 'hidden-text',
    label: hasHiddenText ? 'Hidden text elements detected' : 'No hidden text detected',
    passed: !hasHiddenText,
  });
  if (hasHiddenText) flags.push({ id: 'hidden-text', label: 'Hidden text (display:none / visibility:hidden / color match)', severity: 'high' });

  // --- 4. Zero-width / invisible unicode characters ---
  // U+200B (zero-width space), U+200C (ZWNJ), U+200D (ZWJ), U+FEFF (BOM/ZWNBSP), U+2060 (word joiner), U+00AD (soft hyphen)
  const zeroWidthRegex = /[\u200B\u200C\u200D\uFEFF\u2060\u00AD]/;
  const zeroWidthCount = (html.match(new RegExp(zeroWidthRegex, 'g')) || []).length;
  // Allow up to 3 (BOM at file start is common), flag if more
  const hasZeroWidth = zeroWidthCount > 3;
  checks.push({
    id: 'zero-width-chars',
    label: hasZeroWidth ? `${zeroWidthCount} zero-width characters detected` : `${zeroWidthCount} zero-width characters (within tolerance)`,
    passed: !hasZeroWidth,
  });
  if (hasZeroWidth) flags.push({ id: 'zero-width-chars', label: `Excessive zero-width characters (${zeroWidthCount})`, severity: 'medium' });

  // --- 5. Hidden data exfiltration URLs ---
  // Check for external URLs in hidden contexts (img src in hidden elements, etc.)
  const hiddenContextRegex = /(?:display\s*:\s*none|visibility\s*:\s*hidden|width\s*:\s*0|height\s*:\s*0)[^>]*>/i;
  const imgInHidden = html.match(new RegExp(hiddenContextRegex.source + '\\s*[\\s\\S]*?<img[^>]+src=["\']https?://', 'i'));
  // Also check for tracking pixels / clear gifs
  const trackingPixel = /<img[^>]+(?:width|height)=["']1["'][^>]+(?:width|height)=["']1["'][^>]*>/i;
  const hasDataExfil = !!imgInHidden || trackingPixel.test(html);
  checks.push({
    id: 'data-exfil',
    label: hasDataExfil ? 'Hidden external resource URLs detected' : 'No hidden exfiltration URLs',
    passed: !hasDataExfil,
  });
  if (hasDataExfil) flags.push({ id: 'data-exfil', label: 'Hidden data exfiltration URLs (tracking pixels / hidden images)', severity: 'medium' });

  // --- 6. Homoglyph / confusable characters ---
  // Cyrillic а е о р с у х (look identical to Latin a e o p c y x)
  // Only flag if mixed script (Latin + Cyrillic in same text block)
  const cyrillicInLatin = /[\x00-\x7F][\u0400-\u04FF]{2,}[\x00-\x7F]/.test(html.replace(/<[^>]+>/g, ' '));
  const hasHomoglyphs = cyrillicInLatin;
  checks.push({
    id: 'homoglyphs',
    label: hasHomoglyphs ? 'Mixed-script (homoglyph) characters detected' : 'No homoglyph characters',
    passed: !hasHomoglyphs,
  });
  if (hasHomoglyphs) flags.push({ id: 'homoglyphs', label: 'Homoglyph / confusable characters (mixed Latin + Cyrillic)', severity: 'low' });

  // Score: start at maxScore, deduct for each flag
  const maxScore = 6;
  const severityDeduction = { critical: 3, high: 2, medium: 1, low: 0.5 };
  const deduction = flags.reduce((sum, f) => sum + (severityDeduction[f.severity] || 1), 0);
  const score = Math.max(0, maxScore - deduction);

  return {
    score,
    maxScore,
    checks,
    flags,
    passed: checks.filter(c => c.passed).length,
    total: checks.length,
  };
}

export { analyzePromptInjection };
