"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X, MessageSquarePlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnnotationPopoverProps {
  /** The selected text to annotate */
  selectedText: string;
  /** Bounding rect of the selection (for positioning) */
  selectionRect: DOMRect;
  /** Container element for positioning calculations */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Callback when annotation is confirmed */
  onConfirm: (comment: string) => void;
  /** Callback when popover is dismissed */
  onCancel: () => void;
  /** Optional initial comment (for editing) */
  initialComment?: string;
}

/**
 * Popover that appears near a text selection, allowing users to add annotation comments.
 * Positions itself relative to the selection, avoiding overflow.
 */
export function AnnotationPopover({
  selectedText,
  selectionRect,
  containerRef,
  onConfirm,
  onCancel,
  initialComment = "",
}: AnnotationPopoverProps) {
  const [comment, setComment] = useState(initialComment);
  const popoverRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Calculate position relative to the container
  const getPosition = () => {
    if (!containerRef.current) {
      return { top: selectionRect.bottom + 8, left: selectionRect.left };
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const popoverWidth = 280;
    const popoverHeight = 180;

    // Position below selection by default
    let top = selectionRect.bottom - containerRect.top + 8;
    let left = selectionRect.left - containerRect.left;

    // Ensure popover stays within container horizontally
    if (left + popoverWidth > containerRect.width) {
      left = containerRect.width - popoverWidth - 8;
    }
    if (left < 8) {
      left = 8;
    }

    // If popover would go below container, position above selection
    if (top + popoverHeight > containerRect.height) {
      top = selectionRect.top - containerRect.top - popoverHeight - 8;
    }

    return { top, left };
  };

  const position = getPosition();

  // Focus textarea on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (comment.trim()) {
        onConfirm(comment.trim());
      }
    }
  };

  const handleConfirm = () => {
    if (comment.trim()) {
      onConfirm(comment.trim());
    }
  };

  // Truncate selected text for display
  const displayText =
    selectedText.length > 60
      ? selectedText.slice(0, 60) + "..."
      : selectedText;

  return (
    <div
      ref={popoverRef}
      className={cn(
        "absolute z-50 w-[280px] rounded-lg border bg-popover p-3 shadow-lg",
        "animate-in fade-in-0 zoom-in-95 duration-150"
      )}
      style={{
        top: position.top,
        left: position.left,
      }}
      onKeyDown={handleKeyDown}
    >
      {/* Header with selected text preview */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MessageSquarePlus className="h-3.5 w-3.5" />
          <span>Annotate selection</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 -mr-1 -mt-1"
          onClick={onCancel}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Selected text preview */}
      <div className="mb-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground italic line-clamp-2">
        "{displayText}"
      </div>

      {/* Comment input */}
      <Textarea
        ref={textareaRef}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="What should change here?"
        className="min-h-[60px] text-sm resize-none mb-2"
      />

      {/* Actions */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+Enter to save
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={!comment.trim()}
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
