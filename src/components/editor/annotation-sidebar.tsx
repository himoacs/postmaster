"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Annotation, ANNOTATION_COLORS } from "@/types/annotation";
import { MessageSquare, Trash2, X, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnnotationSidebarProps {
  /** List of annotations */
  annotations: Annotation[];
  /** Callback to remove an annotation */
  onRemove: (annotationId: string) => void;
  /** Callback to clear all annotations */
  onClearAll: () => void;
  /** Callback to submit all annotations for refinement */
  onSubmit: () => void;
  /** Callback when clicking an annotation (to scroll to it) */
  onAnnotationClick?: (annotation: Annotation) => void;
  /** Close the sidebar */
  onClose: () => void;
  /** Whether refinement is in progress */
  isSubmitting?: boolean;
}

/**
 * Sidebar panel showing all current annotations.
 * Allows users to review, delete, and submit annotations for batch refinement.
 */
export function AnnotationSidebar({
  annotations,
  onRemove,
  onClearAll,
  onSubmit,
  onAnnotationClick,
  onClose,
  isSubmitting = false,
}: AnnotationSidebarProps) {
  const sortedAnnotations = [...annotations].sort(
    (a, b) => a.startOffset - b.startOffset
  );

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-6 w-6 z-10"
        onClick={onClose}
      >
        <X className="h-4 w-4" />
      </Button>

      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Annotations
          {annotations.length > 0 && (
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              {annotations.length} {annotations.length === 1 ? "note" : "notes"}
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col min-h-0 pb-4">
        {annotations.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-center p-4">
            <div className="text-sm text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No annotations yet.</p>
              <p className="text-xs mt-1">
                Select text in the draft and add comments to annotate.
              </p>
            </div>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 pr-2 -mr-2">
              <div className="space-y-3">
                {sortedAnnotations.map((ann, index) => (
                  <AnnotationItem
                    key={ann.id}
                    annotation={ann}
                    index={index + 1}
                    onRemove={() => onRemove(ann.id)}
                    onClick={() => onAnnotationClick?.(ann)}
                  />
                ))}
              </div>
            </ScrollArea>

            <div className="pt-4 mt-4 border-t space-y-2">
              <Button
                className="w-full"
                onClick={onSubmit}
                disabled={isSubmitting || annotations.length === 0}
              >
                <Send className="mr-2 h-4 w-4" />
                {isSubmitting ? "Applying..." : "Apply All Annotations"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={onClearAll}
                disabled={isSubmitting}
              >
                <Trash2 className="mr-2 h-3 w-3" />
                Clear All
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </>
  );
}

interface AnnotationItemProps {
  annotation: Annotation;
  index: number;
  onRemove: () => void;
  onClick?: () => void;
}

function AnnotationItem({
  annotation,
  index,
  onRemove,
  onClick,
}: AnnotationItemProps) {
  const colorClass = ANNOTATION_COLORS[annotation.colorIndex % ANNOTATION_COLORS.length];

  // Truncate selected text for display
  const truncatedText =
    annotation.selectedText.length > 50
      ? annotation.selectedText.slice(0, 50) + "..."
      : annotation.selectedText;

  return (
    <div
      className={cn(
        "group p-2.5 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors",
        "ring-1 ring-transparent hover:ring-primary/20"
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        {/* Color indicator and number */}
        <div
          className={cn(
            "flex-shrink-0 w-5 h-5 rounded text-[10px] font-medium flex items-center justify-center",
            colorClass
          )}
        >
          {index}
        </div>

        <div className="flex-1 min-w-0">
          {/* Selected text */}
          <p className="text-xs text-muted-foreground italic line-clamp-1 mb-1">
            "{truncatedText}"
          </p>

          {/* Comment */}
          <p className="text-sm line-clamp-2">{annotation.comment}</p>
        </div>

        {/* Remove button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
