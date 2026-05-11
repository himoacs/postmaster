# Release Notes - v1.3.0

**Release Date:** May 11, 2026

## ✨ New Features

### Annotation UX Overhaul

Completely redesigned annotation system with a modern, intuitive interface:

- **Floating + Button**: Select any text in the synthesis view to see a floating "+" button that lets you instantly add annotations
- **Inline Annotation Highlights**: Annotated text is now highlighted with a subtle background and dashed underline for better visibility
- **Annotation Popover**: Quick-access popover shows annotation details on hover with edit/delete options
- **Annotation Sidebar**: Dedicated sidebar panel for viewing and managing all annotations in one place
- **Visual Feedback**: Real-time visual indicators showing which text is selected and annotated

### Knowledge Base Editing

- **Edit Knowledge Items**: You can now edit existing knowledge base entries directly from the dashboard
- **Inline Edit Dialog**: Modern dialog interface for quick updates to knowledge content

### Improved Toast Notifications

- **Green Success Toasts**: Success notifications now use a pleasant mint green color to clearly distinguish from errors
- **Consistent Color Scheme**: Error and warning toasts remain in terracotta/brown for the editorial theme

---

## 🔧 Improvements

### Marketing Pages Refresh

- Updated about page content and layout
- Improved marketing layout with better navigation
- Streamlined homepage messaging

### Code Block Styling

- Fixed grey box issues with code blocks in synthesis view
- Proper muted background styling for inline code and code blocks

### Anti-Pattern Detection

- Expanded AI writing detection patterns for more accurate humanization
- Better pattern matching for common AI tells

---

## 🐛 Bug Fixes

### Double Close Button Fix

Fixed issue where annotation sidebar displayed two X buttons due to nested Card components.

### Large Selection Positioning

Fixed positioning of the annotation + button when selecting large amounts of text that extend beyond the visible scroll area.

### Text Selection Detection

Improved text selection detection to work reliably with formatted/rich text, not just plain markdown source.

---

## 📦 Technical Changes

- Added new UI components: Popover, Annotation components
- New `useTextSelection` hook for tracking text selections
- Annotation type definitions in `src/types/annotation.ts`

---

## 🚀 Installation

Download the appropriate version for your system:
- **Apple Silicon (M1/M2/M3/M4):** PostMaster-arm64.dmg
- **Intel Mac:** PostMaster-x64.dmg  
- **Windows:** PostMaster-Setup.exe

---
