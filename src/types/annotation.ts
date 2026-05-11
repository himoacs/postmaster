/**
 * Types for inline draft annotations.
 * Annotations allow users to select text passages and add comments
 * for batch refinement.
 */

export interface Annotation {
  /** Unique identifier for the annotation */
  id: string;
  /** The selected text passage */
  selectedText: string;
  /** User's comment/feedback for this selection */
  comment: string;
  /** Character offset from start of content (for highlight positioning) */
  startOffset: number;
  /** Character offset to end of selection */
  endOffset: number;
  /** Color index for visual differentiation (0-5) */
  colorIndex: number;
  /** Timestamp when annotation was created */
  createdAt: number;
}

export interface AnnotationState {
  /** List of all current annotations */
  annotations: Annotation[];
  /** Whether annotation mode is active */
  isAnnotationMode: boolean;
  /** Currently editing annotation ID (null if none) */
  editingAnnotationId: string | null;
}

/**
 * Annotation highlight colors (Tailwind classes).
 * These should have good contrast in both light and dark mode.
 */
export const ANNOTATION_COLORS = [
  "bg-yellow-200/60 dark:bg-yellow-500/40",
  "bg-blue-200/60 dark:bg-blue-500/40",
  "bg-green-200/60 dark:bg-green-500/40",
  "bg-pink-200/60 dark:bg-pink-500/40",
  "bg-purple-200/60 dark:bg-purple-500/40",
  "bg-orange-200/60 dark:bg-orange-500/40",
] as const;

/**
 * Helper to generate a unique annotation ID.
 */
export function generateAnnotationId(): string {
  return `ann_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Format annotations as structured feedback for AI refinement.
 * @param annotations - The annotations to format
 * @returns Formatted feedback string
 */
export function formatAnnotationsAsFeedback(annotations: Annotation[]): string {
  if (annotations.length === 0) return "";

  const sortedAnnotations = [...annotations].sort(
    (a, b) => a.startOffset - b.startOffset
  );

  const feedbackParts = sortedAnnotations.map((ann, index) => {
    const truncatedText =
      ann.selectedText.length > 100
        ? ann.selectedText.slice(0, 100) + "..."
        : ann.selectedText;

    return `[Annotation ${index + 1}] For the text "${truncatedText}": ${ann.comment}`;
  });

  return feedbackParts.join("\n\n");
}

/**
 * Check if a new annotation would overlap with existing ones.
 * @param newStart - Start offset of new annotation
 * @param newEnd - End offset of new annotation
 * @param existing - Existing annotations to check against
 * @returns True if there's an overlap
 */
export function hasOverlap(
  newStart: number,
  newEnd: number,
  existing: Annotation[]
): boolean {
  return existing.some((ann) => {
    // Check if ranges overlap
    return !(newEnd <= ann.startOffset || newStart >= ann.endOffset);
  });
}
