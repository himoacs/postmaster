"use client";

import React from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnnotationAddButtonProps {
  /** Bounding rect of the selection (for positioning) */
  selectionRect: DOMRect;
  /** Container element for positioning calculations */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Callback when button is clicked */
  onClick: () => void;
}

/**
 * Small floating "+" button that appears when text is selected in annotation mode.
 * Clicking expands to show the full annotation popover.
 */
export function AnnotationAddButton({
  selectionRect,
  containerRef,
  onClick,
}: AnnotationAddButtonProps) {
  // Calculate position relative to the container
  const getPosition = () => {
    if (!containerRef.current) {
      return { top: selectionRect.bottom + 4, left: selectionRect.right };
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const buttonSize = 28;
    
    // For large/multiline selections, use the visible portion
    // Get the scroll container (parent with overflow)
    const scrollContainer = containerRef.current.querySelector('[data-radix-scroll-area-viewport]') || containerRef.current;
    const scrollRect = scrollContainer.getBoundingClientRect();
    
    // Clamp the selection rect to the visible scroll area
    const visibleTop = Math.max(selectionRect.top, scrollRect.top);
    const visibleBottom = Math.min(selectionRect.bottom, scrollRect.bottom);
    const visibleRight = Math.min(selectionRect.right, scrollRect.right);
    
    // Position at the end of the visible selection
    let top = visibleBottom - containerRect.top + 4;
    let left = visibleRight - containerRect.left - buttonSize / 2;

    // Keep within container bounds
    if (left + buttonSize > containerRect.width) {
      left = containerRect.width - buttonSize - 8;
    }
    if (left < 8) {
      left = 8;
    }

    // If too close to bottom or below visible area, position above visible selection
    if (top + buttonSize > containerRect.height - 8 || visibleBottom >= scrollRect.bottom) {
      top = visibleTop - containerRect.top - buttonSize - 4;
      // If that's also out of bounds (above visible area), position at top of visible area
      if (top < 8) {
        top = Math.max(8, visibleTop - containerRect.top + 4);
      }
    }

    return { top, left };
  };

  const position = getPosition();

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "absolute z-50 flex h-7 w-7 items-center justify-center",
        "rounded-full bg-primary text-primary-foreground shadow-lg",
        "hover:bg-primary/90 hover:scale-110 active:scale-95",
        "transition-all duration-150 ease-out",
        "animate-in fade-in-0 zoom-in-50 duration-150"
      )}
      style={{
        top: position.top,
        left: position.left,
      }}
      title="Add annotation"
    >
      <Plus className="h-4 w-4" />
    </button>
  );
}
