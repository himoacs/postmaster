/**
 * Readability Analysis Functions
 * 
 * Implements Flesch-Kincaid readability scoring and analysis.
 */

export interface ReadabilityResult {
  fleschKincaid: number; // Grade level (higher = harder to read)
  fleschReadingEase: number; // 0-100 scale (higher = easier)
  avgSentenceLength: number;
  avgSyllablesPerWord: number;
  wordCount: number;
  sentenceCount: number;
  gradeLevel: string;
  difficulty: "easy" | "moderate" | "difficult";
  suggestions: string[];
}

/**
 * Count syllables in a word (approximation)
 */
function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, "");
  if (word.length <= 3) return 1;

  // Count vowel groups
  const vowels = "aeiouy";
  let count = 0;
  let prevVowel = false;

  for (let i = 0; i < word.length; i++) {
    const isVowel = vowels.includes(word[i]);
    if (isVowel && !prevVowel) {
      count++;
    }
    prevVowel = isVowel;
  }

  // Adjust for silent e
  if (word.endsWith("e") && count > 1) {
    count--;
  }

  // Adjust for -le endings
  if (word.endsWith("le") && word.length > 2 && !vowels.includes(word[word.length - 3])) {
    count++;
  }

  return Math.max(1, count);
}

/**
 * Split text into sentences
 */
function splitSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Split text into words
 */
function splitWords(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z']/g, ""))
    .filter((w) => w.length > 0);
}

/**
 * Get grade level label
 */
function getGradeLevel(score: number): string {
  if (score < 6) return "Elementary";
  if (score < 8) return "Middle School";
  if (score < 10) return "High School";
  if (score < 13) return "College";
  return "Graduate";
}

/**
 * Get difficulty label
 */
function getDifficulty(ease: number): "easy" | "moderate" | "difficult" {
  if (ease >= 60) return "easy";
  if (ease >= 40) return "moderate";
  return "difficult";
}

/**
 * Generate improvement suggestions
 */
function generateSuggestions(result: Partial<ReadabilityResult>): string[] {
  const suggestions: string[] = [];

  if ((result.avgSentenceLength ?? 0) > 25) {
    suggestions.push("Consider breaking up long sentences. Aim for 15-20 words per sentence.");
  }

  if ((result.avgSyllablesPerWord ?? 0) > 1.7) {
    suggestions.push("Try using simpler words with fewer syllables to improve clarity.");
  }

  if ((result.fleschKincaid ?? 0) > 12) {
    suggestions.push("Your content may be too complex for general audiences. Consider simplifying.");
  }

  if ((result.fleschReadingEase ?? 0) < 40) {
    suggestions.push("Add more short sentences to improve rhythm and readability.");
  }

  if (suggestions.length === 0) {
    suggestions.push("Your content has good readability!");
  }

  return suggestions;
}

/**
 * Analyze text readability
 */
export function analyzeReadability(text: string): ReadabilityResult {
  const sentences = splitSentences(text);
  const words = splitWords(text);
  
  const wordCount = words.length;
  const sentenceCount = Math.max(sentences.length, 1);
  
  // Calculate total syllables
  let totalSyllables = 0;
  for (const word of words) {
    totalSyllables += countSyllables(word);
  }

  const avgSentenceLength = wordCount / sentenceCount;
  const avgSyllablesPerWord = wordCount > 0 ? totalSyllables / wordCount : 0;

  // Flesch Reading Ease: 206.835 - 1.015 * (words/sentences) - 84.6 * (syllables/words)
  const fleschReadingEase = Math.max(
    0,
    Math.min(
      100,
      206.835 - 1.015 * avgSentenceLength - 84.6 * avgSyllablesPerWord
    )
  );

  // Flesch-Kincaid Grade Level: 0.39 * (words/sentences) + 11.8 * (syllables/words) - 15.59
  const fleschKincaid = Math.max(
    0,
    0.39 * avgSentenceLength + 11.8 * avgSyllablesPerWord - 15.59
  );

  const result: Partial<ReadabilityResult> = {
    fleschKincaid: Math.round(fleschKincaid * 10) / 10,
    fleschReadingEase: Math.round(fleschReadingEase * 10) / 10,
    avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
    avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 100) / 100,
    wordCount,
    sentenceCount,
    gradeLevel: getGradeLevel(fleschKincaid),
    difficulty: getDifficulty(fleschReadingEase),
  };

  return {
    ...result,
    suggestions: generateSuggestions(result),
  } as ReadabilityResult;
}
