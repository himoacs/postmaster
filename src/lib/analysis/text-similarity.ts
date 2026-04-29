/**
 * Text Similarity Analysis for Synthesis Attribution
 * Uses Jaccard similarity to measure text overlap between sources and synthesis
 */

/**
 * Tokenize text into words, removing punctuation and converting to lowercase
 */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ") // Replace punctuation with spaces
      .split(/\s+/)
      .filter((word) => word.length > 2) // Filter out very short words
  );
}

/**
 * Calculate Jaccard similarity between two texts
 * Returns a value between 0 (no similarity) and 1 (identical)
 */
export function calculateJaccardSimilarity(text1: string, text2: string): number {
  const tokens1 = tokenize(text1);
  const tokens2 = tokenize(text2);

  // Calculate intersection
  const intersection = new Set([...tokens1].filter((x) => tokens2.has(x)));

  // Calculate union
  const union = new Set([...tokens1, ...tokens2]);

  // Jaccard similarity = |intersection| / |union|
  return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Split text into paragraphs for analysis
 */
function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Calculate usage attribution for synthesized content
 * Returns percentage contribution from each source
 */
export function calculateUsageAttribution(
  synthesizedContent: string,
  sources: Array<{ id: string; content: string }>
): Record<string, number> {
  // Handle edge cases
  if (sources.length === 0) return {};
  if (sources.length === 1) {
    return { [sources[0].id]: 100 };
  }

  // Split synthesis into paragraphs for granular analysis
  const synthesisParagraphs = splitIntoParagraphs(synthesizedContent);
  
  if (synthesisParagraphs.length === 0) {
    // If no paragraphs, split equally
    const equalShare = Math.floor(100 / sources.length);
    const result: Record<string, number> = {};
    sources.forEach((source) => {
      result[source.id] = equalShare;
    });
    return result;
  }

  // Track attribution for each paragraph
  const attributionScores: Record<string, number> = {};
  sources.forEach((source) => {
    attributionScores[source.id] = 0;
  });

  // For each paragraph, find which source it's most similar to
  for (const paragraph of synthesisParagraphs) {
    let maxSimilarity = 0;
    let bestMatch = sources[0].id;

    for (const source of sources) {
      const similarity = calculateJaccardSimilarity(paragraph, source.content);
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        bestMatch = source.id;
      }
    }

    // Attribute this paragraph to the best matching source
    attributionScores[bestMatch] += 1;
  }

  // Convert counts to percentages
  const totalParagraphs = synthesisParagraphs.length;
  const percentages: Record<string, number> = {};

  for (const [sourceId, count] of Object.entries(attributionScores)) {
    percentages[sourceId] = Math.round((count / totalParagraphs) * 100);
  }

  // Ensure percentages sum to 100 (handle rounding errors)
  const sum = Object.values(percentages).reduce((a, b) => a + b, 0);
  if (sum !== 100 && sum > 0) {
    // Adjust the largest percentage to make sum = 100
    const sortedEntries = Object.entries(percentages).sort((a, b) => b[1] - a[1]);
    const [largestId, largestValue] = sortedEntries[0];
    percentages[largestId] = largestValue + (100 - sum);
  }

  return percentages;
}

/**
 * Calculate a weighted similarity that considers both paragraph-level and overall similarity
 * This gives a more nuanced view of contribution
 */
export function calculateWeightedUsageAttribution(
  synthesizedContent: string,
  sources: Array<{ id: string; content: string }>
): Record<string, number> {
  // Handle edge cases
  if (sources.length === 0) return {};
  if (sources.length === 1) {
    return { [sources[0].id]: 100 };
  }

  // Get paragraph-level attribution (70% weight)
  const paragraphAttribution = calculateUsageAttribution(synthesizedContent, sources);

  // Calculate overall document-level similarity (30% weight)
  const overallSimilarities: Record<string, number> = {};
  let totalSimilarity = 0;

  for (const source of sources) {
    const similarity = calculateJaccardSimilarity(synthesizedContent, source.content);
    overallSimilarities[source.id] = similarity;
    totalSimilarity += similarity;
  }

  // Normalize overall similarities to percentages
  const overallPercentages: Record<string, number> = {};
  if (totalSimilarity > 0) {
    for (const [sourceId, similarity] of Object.entries(overallSimilarities)) {
      overallPercentages[sourceId] = (similarity / totalSimilarity) * 100;
    }
  } else {
    // If no similarity, distribute equally
    const equalShare = 100 / sources.length;
    sources.forEach((source) => {
      overallPercentages[source.id] = equalShare;
    });
  }

  // Combine with weights: 70% paragraph-level, 30% overall
  const weightedPercentages: Record<string, number> = {};
  for (const source of sources) {
    const paragraphScore = paragraphAttribution[source.id] || 0;
    const overallScore = overallPercentages[source.id] || 0;
    weightedPercentages[source.id] = Math.round(paragraphScore * 0.7 + overallScore * 0.3);
  }

  // Ensure sum is 100
  const sum = Object.values(weightedPercentages).reduce((a, b) => a + b, 0);
  if (sum !== 100 && sum > 0) {
    const sortedEntries = Object.entries(weightedPercentages).sort((a, b) => b[1] - a[1]);
    const [largestId, largestValue] = sortedEntries[0];
    weightedPercentages[largestId] = largestValue + (100 - sum);
  }

  return weightedPercentages;
}
