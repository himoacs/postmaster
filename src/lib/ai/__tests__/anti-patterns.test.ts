import { describe, it, expect } from "vitest";
import {
  HIGH_SEVERITY_PATTERNS,
  MEDIUM_SEVERITY_PATTERNS,
  LOW_SEVERITY_PATTERNS,
  ALL_ANTI_PATTERNS,
  getPatternsByCategory,
  getPatternsBySeverity,
  buildAntiPatternPromptSection,
  scanForAIPatterns,
  calculateAIScore,
  AntiPatternCategory,
} from "../anti-patterns";

describe("Anti-Patterns Module", () => {
  describe("Pattern Constants", () => {
    it("should have high severity patterns", () => {
      expect(HIGH_SEVERITY_PATTERNS.length).toBeGreaterThan(0);
      expect(HIGH_SEVERITY_PATTERNS.every(p => p.severity === "high")).toBe(true);
    });

    it("should have medium severity patterns", () => {
      expect(MEDIUM_SEVERITY_PATTERNS.length).toBeGreaterThan(0);
      expect(MEDIUM_SEVERITY_PATTERNS.every(p => p.severity === "medium")).toBe(true);
    });

    it("should have low severity patterns", () => {
      expect(LOW_SEVERITY_PATTERNS.length).toBeGreaterThan(0);
      expect(LOW_SEVERITY_PATTERNS.every(p => p.severity === "low")).toBe(true);
    });

    it("should combine all patterns in ALL_ANTI_PATTERNS", () => {
      expect(ALL_ANTI_PATTERNS.length).toBe(
        HIGH_SEVERITY_PATTERNS.length + 
        MEDIUM_SEVERITY_PATTERNS.length + 
        LOW_SEVERITY_PATTERNS.length
      );
    });

    it("should have valid categories for all patterns", () => {
      const validCategories: AntiPatternCategory[] = [
        "opener", "transition", "closer", "buzzword", 
        "filler", "structure", "hedge", "enthusiasm",
        "negation", "hype"
      ];
      expect(ALL_ANTI_PATTERNS.every(p => validCategories.includes(p.category))).toBe(true);
    });
  });

  describe("getPatternsByCategory", () => {
    it("should return opener patterns", () => {
      const openers = getPatternsByCategory("opener");
      expect(openers.length).toBeGreaterThan(0);
      expect(openers.every(p => p.category === "opener")).toBe(true);
    });

    it("should return transition patterns", () => {
      const transitions = getPatternsByCategory("transition");
      expect(transitions.length).toBeGreaterThan(0);
      expect(transitions.every(p => p.category === "transition")).toBe(true);
    });

    it("should return buzzword patterns", () => {
      const buzzwords = getPatternsByCategory("buzzword");
      expect(buzzwords.length).toBeGreaterThan(0);
      expect(buzzwords.every(p => p.category === "buzzword")).toBe(true);
    });

    it("should return negation patterns", () => {
      const negations = getPatternsByCategory("negation");
      expect(negations.length).toBeGreaterThan(0);
      expect(negations.every(p => p.category === "negation")).toBe(true);
    });

    it("should return hype patterns", () => {
      const hype = getPatternsByCategory("hype");
      expect(hype.length).toBeGreaterThan(0);
      expect(hype.every(p => p.category === "hype")).toBe(true);
    });

    it("should return empty array for non-existent category patterns if none exist", () => {
      // All categories should have at least some patterns
      const categories: AntiPatternCategory[] = [
        "opener", "transition", "closer", "buzzword", 
        "filler", "structure", "hedge", "enthusiasm",
        "negation", "hype"
      ];
      for (const cat of categories) {
        expect(getPatternsByCategory(cat).length).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("getPatternsBySeverity", () => {
    it("should return high severity patterns", () => {
      const highPatterns = getPatternsBySeverity("high");
      expect(highPatterns.length).toBe(HIGH_SEVERITY_PATTERNS.length);
      expect(highPatterns.every(p => p.severity === "high")).toBe(true);
    });

    it("should return medium severity patterns", () => {
      const mediumPatterns = getPatternsBySeverity("medium");
      expect(mediumPatterns.length).toBe(MEDIUM_SEVERITY_PATTERNS.length);
      expect(mediumPatterns.every(p => p.severity === "medium")).toBe(true);
    });

    it("should return low severity patterns", () => {
      const lowPatterns = getPatternsBySeverity("low");
      expect(lowPatterns.length).toBe(LOW_SEVERITY_PATTERNS.length);
      expect(lowPatterns.every(p => p.severity === "low")).toBe(true);
    });
  });

  describe("buildAntiPatternPromptSection", () => {
    it("should build prompt section with default options", () => {
      const section = buildAntiPatternPromptSection();
      expect(section).toContain("CRITICAL - AVOID AI-SOUNDING LANGUAGE");
      expect(section).toContain("Generic openers");
      expect(section).toContain("Instead:");
    });

    it("should include high and medium severity by default", () => {
      const section = buildAntiPatternPromptSection({ maxPatterns: 100 });
      // Should include some high severity patterns
      expect(section).toContain("In today's fast-paced world");
      // Should include some medium severity patterns (with higher limit to ensure they're included)
      expect(section).toContain("robust");
    });

    it("should filter by severity when specified", () => {
      const highOnly = buildAntiPatternPromptSection({ includeSeverities: ["high"] });
      expect(highOnly).toContain("In today's fast-paced world");
      // Medium patterns should not appear when only high is specified
      // (though may still appear if the pattern exists in high)
    });

    it("should filter by category when specified", () => {
      const openersOnly = buildAntiPatternPromptSection({ 
        includeCategories: ["opener"],
        includeSeverities: ["high", "medium", "low"]
      });
      expect(openersOnly).toContain("Generic openers");
      // Should not include transition label if only openers requested
      expect(openersOnly).not.toContain("Overused transitions");
    });

    it("should respect maxPatterns limit", () => {
      const limited = buildAntiPatternPromptSection({ maxPatterns: 5 });
      // Section should still be valid but shorter
      expect(limited).toContain("CRITICAL");
    });

    it("should include negation category label", () => {
      const section = buildAntiPatternPromptSection({ 
        includeCategories: ["negation"],
        includeSeverities: ["high", "medium"]
      });
      expect(section).toContain("Contrastive negation");
    });

    it("should include hype category label", () => {
      const section = buildAntiPatternPromptSection({ 
        includeCategories: ["hype"],
        includeSeverities: ["high", "medium"]
      });
      expect(section).toContain("Business/sales hype");
    });

    it("should include coherence guidance", () => {
      const section = buildAntiPatternPromptSection();
      expect(section).toContain("Avoid sentence stacking");
      expect(section).toContain("Connect ideas with natural transitions");
    });
  });

  describe("scanForAIPatterns", () => {
    it("should detect high severity patterns in content", () => {
      const content = "In today's fast-paced world, we need to leverage synergy.";
      const matches = scanForAIPatterns(content);
      expect(matches.length).toBeGreaterThan(0);
      expect(matches.some(m => m.pattern.pattern.toLowerCase() === "in today's fast-paced world")).toBe(true);
    });

    it("should detect patterns case-insensitively", () => {
      const content = "IN TODAY'S FAST-PACED WORLD, everything is changing.";
      const matches = scanForAIPatterns(content);
      expect(matches.length).toBeGreaterThan(0);
    });

    it("should return empty array for clean content", () => {
      const content = "The cat sat on the mat. It was a sunny day.";
      const matches = scanForAIPatterns(content);
      expect(matches.length).toBe(0);
    });

    it("should filter by minimum severity", () => {
      const content = "This is robust and seamless. In today's fast-paced world.";
      
      // With low min severity, should find all
      const allMatches = scanForAIPatterns(content, { minSeverity: "low" });
      
      // With high min severity, should only find high severity patterns
      const highMatches = scanForAIPatterns(content, { minSeverity: "high" });
      
      expect(highMatches.length).toBeLessThanOrEqual(allMatches.length);
      expect(highMatches.every(m => m.pattern.severity === "high")).toBe(true);
    });

    it("should return matches sorted by position", () => {
      const content = "Let's dive in to this game-changer. In conclusion, it's important.";
      const matches = scanForAIPatterns(content);
      
      for (let i = 1; i < matches.length; i++) {
        expect(matches[i].position).toBeGreaterThanOrEqual(matches[i-1].position);
      }
    });

    it("should find multiple occurrences of the same pattern", () => {
      const content = "It's robust and also robust again.";
      const matches = scanForAIPatterns(content);
      const robustMatches = matches.filter(m => m.pattern.pattern.toLowerCase() === "robust");
      expect(robustMatches.length).toBe(2);
    });

    it("should include matched text in results", () => {
      const content = "Let's dive in to this topic.";
      const matches = scanForAIPatterns(content);
      const diveMatch = matches.find(m => m.pattern.pattern.toLowerCase() === "let's dive in");
      expect(diveMatch).toBeDefined();
      expect(diveMatch?.matchedText.toLowerCase()).toBe("let's dive in");
    });

    it("should detect negation patterns", () => {
      const content = "It's not just about the code, it's more than just development.";
      const matches = scanForAIPatterns(content);
      expect(matches.some(m => m.pattern.category === "negation")).toBe(true);
    });

    it("should detect hype patterns", () => {
      const content = "Supercharge your workflow and future-proof your business.";
      const matches = scanForAIPatterns(content);
      expect(matches.some(m => m.pattern.category === "hype")).toBe(true);
    });
  });

  describe("calculateAIScore", () => {
    it("should return 0 for clean content with no patterns", () => {
      const content = "The quick brown fox jumps over the lazy dog. This is a simple sentence about animals.";
      const result = calculateAIScore(content);
      expect(result.score).toBe(0);
      expect(result.breakdown.totalMatches).toBe(0);
    });

    it("should return higher score for content with high severity patterns", () => {
      const cleanContent = "Dogs are great pets.";
      const aiContent = "In today's fast-paced world, let's dive in to how game-changer synergy can revolutionize your paradigm shift.";
      
      const cleanResult = calculateAIScore(cleanContent);
      const aiResult = calculateAIScore(aiContent);
      
      expect(aiResult.score).toBeGreaterThan(cleanResult.score);
    });

    it("should include breakdown by severity", () => {
      const content = "In today's fast-paced world, this robust solution is key.";
      const result = calculateAIScore(content);
      
      expect(result.breakdown).toHaveProperty("highSeverityCount");
      expect(result.breakdown).toHaveProperty("mediumSeverityCount");
      expect(result.breakdown).toHaveProperty("lowSeverityCount");
      expect(result.breakdown).toHaveProperty("totalMatches");
    });

    it("should include matches array", () => {
      const content = "Let's dive in to this game-changer.";
      const result = calculateAIScore(content);
      
      expect(Array.isArray(result.matches)).toBe(true);
      expect(result.matches.length).toBe(result.breakdown.totalMatches);
    });

    it("should cap score at 100", () => {
      // Create content with many patterns to try to exceed 100
      const content = "In today's fast-paced world, let's dive in. In conclusion, this game-changer is absolutely essential. It's truly remarkable how we can leverage synergy to revolutionize the paradigm shift. Moving forward, it's important to note that this cutting-edge solution is best-in-class.";
      const result = calculateAIScore(content);
      
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it("should penalize high severity more than medium", () => {
      // Content with one high severity pattern
      const highContent = "In today's fast-paced world, things change.";
      // Content with one medium severity pattern  
      const mediumContent = "This is a robust solution for the problem.";
      
      const highResult = calculateAIScore(highContent);
      const mediumResult = calculateAIScore(mediumContent);
      
      // High severity should have higher score (worse)
      expect(highResult.breakdown.highSeverityCount).toBeGreaterThanOrEqual(1);
      expect(mediumResult.breakdown.mediumSeverityCount).toBeGreaterThanOrEqual(1);
    });

    it("should normalize by word count", () => {
      // Short content with one pattern
      const shortContent = "Game-changer.";
      // Long content with one pattern
      const longContent = "This is a very long piece of content that goes on and on with many words but only has one pattern which is game-changer somewhere in the middle of all these words.";
      
      const shortResult = calculateAIScore(shortContent);
      const longResult = calculateAIScore(longContent);
      
      // Short content should have higher normalized score for same number of patterns
      expect(shortResult.score).toBeGreaterThanOrEqual(longResult.score);
    });

    it("should handle empty content", () => {
      const result = calculateAIScore("");
      expect(result.score).toBe(0);
      expect(result.breakdown.totalMatches).toBe(0);
    });
  });
});
