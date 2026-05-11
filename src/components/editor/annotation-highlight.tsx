"use client";

import React, { useMemo } from "react";
import { Annotation, ANNOTATION_COLORS } from "@/types/annotation";
import { cn } from "@/lib/utils";

interface AnnotationHighlightsProps {
  /** The full content text (markdown) */
  content: string;
  /** List of annotations to highlight */
  annotations: Annotation[];
  /** Callback when an annotation highlight is clicked */
  onAnnotationClick?: (annotation: Annotation) => void;
  /** The container element's ref for scroll offset calculations */
  contentRef: React.RefObject<HTMLElement | null>;
}

/**
 * Renders highlighted overlays for annotations on top of content.
 * This component uses an overlay approach - it positions highlights
 * based on character offsets in the source content.
 * 
 * Note: This is a simplified approach that works when the rendered
 * content structure matches the source content character positions.
 * For more complex cases with heavy markdown transformation, a
 * different approach (like marking during render) may be needed.
 */
export function AnnotationHighlights({
  content,
  annotations,
  onAnnotationClick,
  contentRef,
}: AnnotationHighlightsProps) {
  // For now, we'll render an inline approach by splitting content
  // This component serves as a utility for future enhancement
  // The actual highlighting is done in the parent component

  if (annotations.length === 0) {
    return null;
  }

  return (
    <div className="annotation-highlights-container pointer-events-none absolute inset-0">
      {/* Highlights will be rendered by the parent using inline marks */}
    </div>
  );
}

interface HighlightedContentProps {
  /** The raw content text */
  content: string;
  /** Annotations to apply as highlights */
  annotations: Annotation[];
  /** Callback when clicking an annotation */
  onAnnotationClick?: (annotation: Annotation) => void;
}

/**
 * Returns content with annotation highlights applied as inline elements.
 * This splits the content at annotation boundaries and wraps annotated
 * sections in highlight spans.
 */
export function useHighlightedSegments(
  content: string,
  annotations: Annotation[]
): Array<{
  text: string;
  annotation: Annotation | null;
  key: string;
}> {
  return useMemo(() => {
    if (annotations.length === 0) {
      return [{ text: content, annotation: null, key: "full" }];
    }

    // Sort annotations by start offset
    const sorted = [...annotations].sort((a, b) => a.startOffset - b.startOffset);

    const segments: Array<{
      text: string;
      annotation: Annotation | null;
      key: string;
    }> = [];

    let lastEnd = 0;

    for (const ann of sorted) {
      // Add non-annotated segment before this annotation
      if (ann.startOffset > lastEnd) {
        segments.push({
          text: content.slice(lastEnd, ann.startOffset),
          annotation: null,
          key: `plain-${lastEnd}`,
        });
      }

      // Add annotated segment
      segments.push({
        text: content.slice(ann.startOffset, ann.endOffset),
        annotation: ann,
        key: `ann-${ann.id}`,
      });

      lastEnd = ann.endOffset;
    }

    // Add remaining content after last annotation
    if (lastEnd < content.length) {
      segments.push({
        text: content.slice(lastEnd),
        annotation: null,
        key: `plain-${lastEnd}`,
      });
    }

    return segments;
  }, [content, annotations]);
}

interface AnnotationMarkProps {
  annotation: Annotation;
  children: React.ReactNode;
  onClick?: (annotation: Annotation) => void;
}

/**
 * Inline highlight mark for annotated text.
 */
export function AnnotationMark({
  annotation,
  children,
  onClick,
}: AnnotationMarkProps) {
  const colorClass = ANNOTATION_COLORS[annotation.colorIndex % ANNOTATION_COLORS.length];

  return (
    <mark
      className={cn(
        colorClass,
        "cursor-pointer rounded-sm px-0.5 transition-all",
        "hover:ring-2 hover:ring-primary/50",
        onClick && "pointer-events-auto"
      )}
      onClick={(e) => {
        if (onClick) {
          e.stopPropagation();
          onClick(annotation);
        }
      }}
      title={`Annotation: ${annotation.comment}`}
    >
      {children}
    </mark>
  );
}
