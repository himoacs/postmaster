"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface TextSelectionState {
  selectedText: string;
  selectionRect: DOMRect | null;
  isSelecting: boolean;
}

interface UseTextSelectionOptions {
  /** Container element ref to scope selection detection */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Whether selection detection is enabled */
  enabled?: boolean;
  /** Minimum characters required to trigger selection */
  minLength?: number;
}

/**
 * Hook to detect and track text selection within a container element.
 * Returns the selected text and its bounding rectangle for positioning UI elements.
 */
export function useTextSelection({
  containerRef,
  enabled = true,
  minLength = 1,
}: UseTextSelectionOptions): TextSelectionState & {
  clearSelection: () => void;
} {
  const [state, setState] = useState<TextSelectionState>({
    selectedText: "",
    selectionRect: null,
    isSelecting: false,
  });

  const isMouseDownRef = useRef(false);

  const clearSelection = useCallback(() => {
    setState({
      selectedText: "",
      selectionRect: null,
      isSelecting: false,
    });
    // Also clear the browser's selection
    window.getSelection()?.removeAllRanges();
  }, []);

  const handleSelectionChange = useCallback(() => {
    if (!enabled || !containerRef.current) {
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      setState((prev) => ({
        ...prev,
        selectedText: "",
        selectionRect: null,
      }));
      return;
    }

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();

    // Check if selection is within our container
    const container = containerRef.current;
    const isWithinContainer =
      container.contains(range.startContainer) &&
      container.contains(range.endContainer);

    if (!isWithinContainer || selectedText.length < minLength) {
      setState((prev) => ({
        ...prev,
        selectedText: "",
        selectionRect: null,
      }));
      return;
    }

    // Get the bounding rect of the selection
    const rect = range.getBoundingClientRect();

    setState({
      selectedText,
      selectionRect: rect,
      isSelecting: isMouseDownRef.current,
    });
  }, [enabled, containerRef, minLength]);

  const handleMouseDown = useCallback(() => {
    isMouseDownRef.current = true;
    setState((prev) => ({ ...prev, isSelecting: true }));
  }, []);

  const handleMouseUp = useCallback(() => {
    isMouseDownRef.current = false;
    setState((prev) => ({ ...prev, isSelecting: false }));
    // Trigger selection change on mouse up to capture final selection
    handleSelectionChange();
  }, [handleSelectionChange]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    document.addEventListener("selectionchange", handleSelectionChange);
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [enabled, handleSelectionChange, handleMouseDown, handleMouseUp]);

  return {
    ...state,
    clearSelection,
  };
}
