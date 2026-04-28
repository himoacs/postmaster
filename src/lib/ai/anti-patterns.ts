/**
 * AI Anti-Patterns Database
 * 
 * Curated list of phrases, structures, and patterns commonly associated with
 * AI-generated content. Used to:
 * 1. Instruct AI to avoid these patterns during generation
 * 2. Post-generation scanning to detect AI-isms
 * 3. Score content on "sounds human" scale
 */

export interface AntiPattern {
  pattern: string;
  category: AntiPatternCategory;
  severity: "high" | "medium" | "low"; // How strongly it signals AI
  replacement?: string; // Optional human-sounding alternative
}

export type AntiPatternCategory = 
  | "opener"      // Generic opening lines
  | "transition"  // Overused transition phrases
  | "closer"      // Generic conclusions
  | "buzzword"    // Corporate/AI buzzwords
  | "filler"      // Empty filler phrases
  | "structure"   // Structural patterns (e.g., always 3 bullet points)
  | "hedge"       // Over-hedging language
  | "enthusiasm"; // Fake enthusiasm

/**
 * High-severity patterns: Strong AI signals, should almost always be avoided
 */
export const HIGH_SEVERITY_PATTERNS: AntiPattern[] = [
  // Openers
  { pattern: "In today's fast-paced world", category: "opener", severity: "high" },
  { pattern: "In today's digital age", category: "opener", severity: "high" },
  { pattern: "In the ever-evolving landscape", category: "opener", severity: "high" },
  { pattern: "In an increasingly connected world", category: "opener", severity: "high" },
  { pattern: "As we navigate", category: "opener", severity: "high" },
  { pattern: "In the realm of", category: "opener", severity: "high" },
  { pattern: "In the world of", category: "opener", severity: "high" },
  { pattern: "When it comes to", category: "opener", severity: "high" },
  
  // Transitions
  { pattern: "Let's dive in", category: "transition", severity: "high" },
  { pattern: "Let's delve into", category: "transition", severity: "high" },
  { pattern: "Without further ado", category: "transition", severity: "high" },
  { pattern: "With that said", category: "transition", severity: "high" },
  { pattern: "That being said", category: "transition", severity: "high" },
  { pattern: "Moving forward", category: "transition", severity: "high" },
  
  // Closers
  { pattern: "In conclusion", category: "closer", severity: "high" },
  { pattern: "To sum up", category: "closer", severity: "high" },
  { pattern: "To summarize", category: "closer", severity: "high" },
  { pattern: "All in all", category: "closer", severity: "high" },
  { pattern: "At the end of the day", category: "closer", severity: "high" },
  { pattern: "The bottom line is", category: "closer", severity: "high" },
  
  // Buzzwords
  { pattern: "game-changer", category: "buzzword", severity: "high" },
  { pattern: "game changer", category: "buzzword", severity: "high" },
  { pattern: "paradigm shift", category: "buzzword", severity: "high" },
  { pattern: "synergy", category: "buzzword", severity: "high" },
  { pattern: "leverage", category: "buzzword", severity: "high" }, // when used as verb
  { pattern: "unlock the power", category: "buzzword", severity: "high" },
  { pattern: "unleash the potential", category: "buzzword", severity: "high" },
  { pattern: "harness the power", category: "buzzword", severity: "high" },
  { pattern: "revolutionize", category: "buzzword", severity: "high" },
  { pattern: "cutting-edge", category: "buzzword", severity: "high" },
  { pattern: "bleeding-edge", category: "buzzword", severity: "high" },
  { pattern: "next-level", category: "buzzword", severity: "high" },
  { pattern: "best-in-class", category: "buzzword", severity: "high" },
  { pattern: "world-class", category: "buzzword", severity: "high" },
  
  // Filler
  { pattern: "It's important to note that", category: "filler", severity: "high" },
  { pattern: "It's worth noting that", category: "filler", severity: "high" },
  { pattern: "It's worth mentioning that", category: "filler", severity: "high" },
  { pattern: "It goes without saying", category: "filler", severity: "high" },
  { pattern: "Needless to say", category: "filler", severity: "high" },
  { pattern: "It bears mentioning", category: "filler", severity: "high" },
  
  // Enthusiasm
  { pattern: "I'm excited to", category: "enthusiasm", severity: "high" },
  { pattern: "I'm thrilled to", category: "enthusiasm", severity: "high" },
  { pattern: "incredibly powerful", category: "enthusiasm", severity: "high" },
  { pattern: "absolutely essential", category: "enthusiasm", severity: "high" },
  { pattern: "truly remarkable", category: "enthusiasm", severity: "high" },
];

/**
 * Medium-severity patterns: Common but not always bad
 */
export const MEDIUM_SEVERITY_PATTERNS: AntiPattern[] = [
  // Transitions
  { pattern: "Furthermore", category: "transition", severity: "medium" },
  { pattern: "Moreover", category: "transition", severity: "medium" },
  { pattern: "Additionally", category: "transition", severity: "medium" },
  { pattern: "In addition", category: "transition", severity: "medium" },
  { pattern: "On the other hand", category: "transition", severity: "medium" },
  { pattern: "However", category: "transition", severity: "medium" }, // Overused but not always bad
  { pattern: "Nevertheless", category: "transition", severity: "medium" },
  { pattern: "Nonetheless", category: "transition", severity: "medium" },
  
  // Buzzwords
  { pattern: "robust", category: "buzzword", severity: "medium" },
  { pattern: "scalable", category: "buzzword", severity: "medium" },
  { pattern: "seamless", category: "buzzword", severity: "medium" },
  { pattern: "streamline", category: "buzzword", severity: "medium" },
  { pattern: "optimize", category: "buzzword", severity: "medium" },
  { pattern: "innovative", category: "buzzword", severity: "medium" },
  { pattern: "comprehensive", category: "buzzword", severity: "medium" },
  { pattern: "holistic", category: "buzzword", severity: "medium" },
  { pattern: "dynamic", category: "buzzword", severity: "medium" },
  { pattern: "crucial", category: "buzzword", severity: "medium" },
  { pattern: "essential", category: "buzzword", severity: "medium" },
  { pattern: "vital", category: "buzzword", severity: "medium" },
  { pattern: "key", category: "buzzword", severity: "medium" }, // when overused
  { pattern: "pivotal", category: "buzzword", severity: "medium" },
  
  // Hedge
  { pattern: "It can be argued that", category: "hedge", severity: "medium" },
  { pattern: "One might say", category: "hedge", severity: "medium" },
  { pattern: "Some would argue", category: "hedge", severity: "medium" },
  { pattern: "It could be said", category: "hedge", severity: "medium" },
  { pattern: "In many ways", category: "hedge", severity: "medium" },
  { pattern: "To a certain extent", category: "hedge", severity: "medium" },
  { pattern: "In some cases", category: "hedge", severity: "medium" },
  
  // Structure signals
  { pattern: "First and foremost", category: "structure", severity: "medium" },
  { pattern: "Last but not least", category: "structure", severity: "medium" },
  { pattern: "First, let's", category: "structure", severity: "medium" },
  { pattern: "Now, let's", category: "structure", severity: "medium" },
  { pattern: "Next, we'll", category: "structure", severity: "medium" },
];

/**
 * Low-severity patterns: Context-dependent, use sparingly
 */
export const LOW_SEVERITY_PATTERNS: AntiPattern[] = [
  { pattern: "delve", category: "buzzword", severity: "low" },
  { pattern: "foster", category: "buzzword", severity: "low" },
  { pattern: "facilitate", category: "buzzword", severity: "low" },
  { pattern: "utilize", category: "buzzword", severity: "low", replacement: "use" },
  { pattern: "implement", category: "buzzword", severity: "low" },
  { pattern: "enhance", category: "buzzword", severity: "low" },
  { pattern: "navigate", category: "buzzword", severity: "low" },
  { pattern: "landscape", category: "buzzword", severity: "low" },
  { pattern: "ecosystem", category: "buzzword", severity: "low" },
  { pattern: "journey", category: "buzzword", severity: "low" }, // when metaphorical
  { pattern: "empower", category: "buzzword", severity: "low" },
  { pattern: "enable", category: "buzzword", severity: "low" },
  { pattern: "drive", category: "buzzword", severity: "low" }, // when metaphorical
  { pattern: "ensure", category: "buzzword", severity: "low" },
  { pattern: "leverage", category: "buzzword", severity: "low" },
  { pattern: "myriad", category: "buzzword", severity: "low" },
  { pattern: "plethora", category: "buzzword", severity: "low" },
  { pattern: "multifaceted", category: "buzzword", severity: "low" },
  { pattern: "nuanced", category: "buzzword", severity: "low" },
];

/**
 * All patterns combined
 */
export const ALL_ANTI_PATTERNS: AntiPattern[] = [
  ...HIGH_SEVERITY_PATTERNS,
  ...MEDIUM_SEVERITY_PATTERNS,
  ...LOW_SEVERITY_PATTERNS,
];

/**
 * Get patterns by category
 */
export function getPatternsByCategory(category: AntiPatternCategory): AntiPattern[] {
  return ALL_ANTI_PATTERNS.filter(p => p.category === category);
}

/**
 * Get patterns by severity
 */
export function getPatternsBySeverity(severity: "high" | "medium" | "low"): AntiPattern[] {
  return ALL_ANTI_PATTERNS.filter(p => p.severity === severity);
}

/**
 * Build prompt instruction for avoiding AI patterns
 * Returns a formatted string to include in system prompts
 */
export function buildAntiPatternPromptSection(
  options: {
    includeSeverities?: Array<"high" | "medium" | "low">;
    includeCategories?: AntiPatternCategory[];
    maxPatterns?: number;
  } = {}
): string {
  const {
    includeSeverities = ["high", "medium"],
    includeCategories,
    maxPatterns = 40,
  } = options;

  let patterns = ALL_ANTI_PATTERNS.filter(p => 
    includeSeverities.includes(p.severity)
  );

  if (includeCategories) {
    patterns = patterns.filter(p => includeCategories.includes(p.category));
  }

  // Prioritize high severity, then limit
  patterns.sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  patterns = patterns.slice(0, maxPatterns);

  // Group by category for readability
  const grouped: Record<string, string[]> = {};
  for (const p of patterns) {
    if (!grouped[p.category]) grouped[p.category] = [];
    grouped[p.category].push(p.pattern);
  }

  let section = `
CRITICAL - AVOID AI-SOUNDING LANGUAGE:
The following phrases and patterns are strongly associated with AI-generated content. DO NOT use them:

`;

  const categoryLabels: Record<string, string> = {
    opener: "Generic openers",
    transition: "Overused transitions",
    closer: "Generic conclusions",
    buzzword: "Corporate buzzwords",
    filler: "Empty filler phrases",
    hedge: "Over-hedging",
    enthusiasm: "Fake enthusiasm",
    structure: "Formulaic structure",
  };

  for (const [category, phrases] of Object.entries(grouped)) {
    section += `${categoryLabels[category] || category}:\n`;
    section += `- "${phrases.join('", "')}"\n\n`;
  }

  section += `Instead:
- Use specific, concrete language
- Start with something unexpected or direct
- Vary sentence structure naturally
- Let the content speak for itself without announcing structure
- Be genuine rather than artificially enthusiastic
`;

  return section;
}

/**
 * Scan content for AI patterns and return matches
 */
export interface PatternMatch {
  pattern: AntiPattern;
  position: number;
  matchedText: string;
}

export function scanForAIPatterns(
  content: string,
  options: {
    minSeverity?: "low" | "medium" | "high";
  } = {}
): PatternMatch[] {
  const { minSeverity = "low" } = options;
  const severityThreshold = { low: 0, medium: 1, high: 2 };
  
  const matches: PatternMatch[] = [];
  const lowerContent = content.toLowerCase();

  for (const pattern of ALL_ANTI_PATTERNS) {
    const patternSeverity = severityThreshold[pattern.severity];
    const minSeverityVal = severityThreshold[minSeverity];
    
    if (patternSeverity < minSeverityVal) continue;

    const lowerPattern = pattern.pattern.toLowerCase();
    let pos = 0;
    
    while ((pos = lowerContent.indexOf(lowerPattern, pos)) !== -1) {
      matches.push({
        pattern,
        position: pos,
        matchedText: content.substring(pos, pos + pattern.pattern.length),
      });
      pos += lowerPattern.length;
    }
  }

  // Sort by position
  matches.sort((a, b) => a.position - b.position);
  
  return matches;
}

/**
 * Calculate AI-ness score (0-100, lower is better/more human)
 */
export function calculateAIScore(content: string): {
  score: number;
  breakdown: {
    highSeverityCount: number;
    mediumSeverityCount: number;
    lowSeverityCount: number;
    totalMatches: number;
  };
  matches: PatternMatch[];
} {
  const matches = scanForAIPatterns(content);
  const wordCount = content.split(/\s+/).length;

  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  for (const match of matches) {
    if (match.pattern.severity === "high") highCount++;
    else if (match.pattern.severity === "medium") mediumCount++;
    else lowCount++;
  }

  // Scoring: penalize heavily for high severity, less for medium/low
  // Normalize by word count to be fair to longer content
  const rawScore = (highCount * 15 + mediumCount * 5 + lowCount * 2);
  const normalizedScore = Math.min(100, Math.round((rawScore / Math.max(100, wordCount)) * 100));

  return {
    score: normalizedScore,
    breakdown: {
      highSeverityCount: highCount,
      mediumSeverityCount: mediumCount,
      lowSeverityCount: lowCount,
      totalMatches: matches.length,
    },
    matches,
  };
}
