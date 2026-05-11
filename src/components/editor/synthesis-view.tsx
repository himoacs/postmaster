"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useTextSelection } from "@/hooks/useTextSelection";
import { AnnotationPopover } from "./annotation-popover";
import { AnnotationAddButton } from "./annotation-add-button";
import { AnnotationSidebar } from "./annotation-sidebar";
import { AnnotationMark } from "./annotation-highlight";
import {
  Annotation,
  generateAnnotationId,
  formatAnnotationsAsFeedback,
  hasOverlap,
  ANNOTATION_COLORS,
} from "@/types/annotation";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import {
  ArrowLeft,
  Copy,
  Check,
  RefreshCw,
  ImageIcon,
  Download,
  Layers,
  ChevronDown,
  MessagesSquare,
  Swords,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  FileText,
  FileCode,
  ClipboardPaste,
  BarChart3,
  FileType,
  GitCompare,
  BrainCircuit,
  X,
  Pencil,
  Eye,
  Quote,
  SearchCheck,
  Bot,
  Loader2,
  AlertTriangle,
  Sparkles,
  History as HistoryIcon,
  MessageSquarePlus,
} from "lucide-react";
import { toast } from "sonner";
import { ImageGenerator } from "./image-generator";
import { ContentAnalysis } from "./content-analysis";
import { DiffView } from "./diff-view";
import { FactCheckPanel } from "./fact-check-panel";
import { SynthesisStrategy, CritiqueOutput, DebateSession, SynthesisReasoning } from "@/types";

type SidePanelType = "refine" | "image" | "analyze" | "history" | "reasoning" | "factcheck" | "critiques" | "aicheck" | "annotate" | null;

interface AICheckResult {
  patternScore: {
    score: number;
    breakdown: {
      highSeverityCount: number;
      mediumSeverityCount: number;
      lowSeverityCount: number;
      totalMatches: number;
    };
    matches: Array<{
      pattern: string;
      category: string;
      severity: string;
      position: number;
    }>;
  };
  aiAnalysis?: {
    humanScore: number;
    confidence: string;
    overallAssessment: string;
    aiIndicators: Array<{
      indicator: string;
      severity: "high" | "medium" | "low";
      example?: string;
      suggestion?: string;
    }>;
    humanIndicators: string[];
    suggestions: string[];
  };
}

interface SynthesisViewProps {
  content: string;
  generationId: string | null;
  synthesisId?: string | null;
  reasoning?: SynthesisReasoning | null;
  onIterate: (feedback: string, modifiedContent?: string) => void;
  onContentChange?: (content: string) => void;
  onRegenerate?: (draftContent: string) => void;
  onBack: () => void;
  onBackToCompare: () => void;
  synthesisStrategy?: SynthesisStrategy;
  critiques?: CritiqueOutput[];
  debateSession?: DebateSession | null;
  contentMode?: "new" | "enhance";
  originalContent?: string | null;
}

export function SynthesisView({
  content,
  generationId,
  synthesisId,
  reasoning,
  onIterate,
  onContentChange,
  onRegenerate,
  onBack,
  onBackToCompare,
  synthesisStrategy = "basic",
  critiques = [],
  debateSession,
  contentMode,
  originalContent,
}: SynthesisViewProps) {
  const [feedback, setFeedback] = useState("");
  const [copied, setCopied] = useState(false);
  const [activePanel, setActivePanel] = useState<SidePanelType>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draftContent, setDraftContent] = useState(content);
  const [aiCheckResult, setAiCheckResult] = useState<AICheckResult | null>(null);
  const [isCheckingAI, setIsCheckingAI] = useState(false);

  // Annotation state
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isAnnotationMode, setIsAnnotationMode] = useState(false);
  const [showAddButton, setShowAddButton] = useState(false);
  const [showAnnotationPopover, setShowAnnotationPopover] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<{
    text: string;
    rect: DOMRect;
    startOffset: number;
    endOffset: number;
  } | null>(null);
  const contentContainerRef = useRef<HTMLDivElement>(null);

  // Text selection hook for annotation mode
  const { selectedText, selectionRect, isSelecting, clearSelection } = useTextSelection({
    containerRef: contentContainerRef,
    enabled: isAnnotationMode && !isEditing,
    minLength: 3,
  });

  // Track original content with citations for restoration
  const [originalContentWithCitations, setOriginalContentWithCitations] = useState<string | null>(null);
  const [citationsRemoved, setCitationsRemoved] = useState(false);

  // Sync draft content when content prop changes (e.g., after iteration)
  useEffect(() => {
    setDraftContent(content);
    // Reset citation tracking when new content arrives
    setOriginalContentWithCitations(null);
    setCitationsRemoved(false);
  }, [content]);

  const hasCritiques = critiques.length > 0 || debateSession;
  const isDebate = synthesisStrategy === "debate";
  
  const togglePanel = (panel: SidePanelType) => {
    setActivePanel(activePanel === panel ? null : panel);
  };

  // Show add button when text is selected in annotation mode
  // Only trigger when user has finished selecting (isSelecting is false)
  useEffect(() => {
    if (isAnnotationMode && selectedText && selectionRect && !showAddButton && !showAnnotationPopover && !isSelecting) {
      // For annotation, we just need valid selected text (minimum 3 chars)
      const trimmedSelection = selectedText.trim();
      
      if (trimmedSelection.length >= 3) {
        // Use approximate offsets based on text position in rendered content
        // These are just for annotation tracking, not critical for accuracy
        const startOffset = 0;
        const endOffset = trimmedSelection.length;
        
        // Check for overlap with existing annotations by comparing text
        const hasTextOverlap = annotations.some(ann => 
          ann.selectedText === trimmedSelection ||
          trimmedSelection.includes(ann.selectedText) ||
          ann.selectedText.includes(trimmedSelection)
        );
        
        if (!hasTextOverlap) {
          setPendingSelection({
            text: selectedText,
            rect: selectionRect,
            startOffset,
            endOffset,
          });
          // Show the small add button first
          setShowAddButton(true);
        } else {
          toast.error("This selection overlaps with an existing annotation");
          clearSelection();
        }
      }
    }
    
    // Hide add button when selection is cleared
    if (!selectedText && showAddButton && !showAnnotationPopover) {
      setShowAddButton(false);
      setPendingSelection(null);
    }
  }, [selectedText, selectionRect, isAnnotationMode, showAddButton, showAnnotationPopover, isSelecting, annotations, clearSelection]);

  // Handler for when user clicks the add button
  const handleAddButtonClick = useCallback(() => {
    setShowAddButton(false);
    setShowAnnotationPopover(true);
  }, []);

  // Clear annotations when entering edit mode
  useEffect(() => {
    if (isEditing && annotations.length > 0) {
      toast.info("Annotations cleared for editing");
      setAnnotations([]);
      setIsAnnotationMode(false);
      setActivePanel(null);
    }
  }, [isEditing, annotations.length]);

  // Clear annotations when content changes from iteration
  useEffect(() => {
    if (annotations.length > 0) {
      setAnnotations([]);
      setIsAnnotationMode(false);
      if (activePanel === "annotate") {
        setActivePanel(null);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]); // Only trigger on content prop change (iteration complete)

  const handleAddAnnotation = useCallback((comment: string) => {
    if (!pendingSelection) return;

    const newAnnotation: Annotation = {
      id: generateAnnotationId(),
      selectedText: pendingSelection.text,
      comment,
      startOffset: pendingSelection.startOffset,
      endOffset: pendingSelection.endOffset,
      colorIndex: annotations.length % ANNOTATION_COLORS.length,
      createdAt: Date.now(),
    };

    setAnnotations((prev) => [...prev, newAnnotation]);
    setShowAddButton(false);
    setShowAnnotationPopover(false);
    setPendingSelection(null);
    clearSelection();
    
    // Auto-open annotation sidebar if not already open
    if (activePanel !== "annotate") {
      setActivePanel("annotate");
    }
    
    toast.success("Annotation added");
  }, [pendingSelection, annotations.length, clearSelection, activePanel]);

  const handleCancelAnnotation = useCallback(() => {
    setShowAddButton(false);
    setShowAnnotationPopover(false);
    setPendingSelection(null);
    clearSelection();
  }, [clearSelection]);

  const handleRemoveAnnotation = useCallback((annotationId: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== annotationId));
  }, []);

  const handleClearAllAnnotations = useCallback(() => {
    setAnnotations([]);
    toast.success("All annotations cleared");
  }, []);

  const handleSubmitAnnotations = useCallback(() => {
    if (annotations.length === 0) return;
    
    const annotationFeedback = formatAnnotationsAsFeedback(annotations);
    // Combine with any existing feedback
    const combinedFeedback = feedback.trim()
      ? `${feedback.trim()}\n\n${annotationFeedback}`
      : annotationFeedback;
    
    onIterate(combinedFeedback, draftContent !== content ? draftContent : undefined);
    // Annotations will be cleared by the content change effect
    setFeedback("");
  }, [annotations, feedback, onIterate, draftContent, content]);

  const toggleAnnotationMode = useCallback(() => {
    const newMode = !isAnnotationMode;
    setIsAnnotationMode(newMode);
    if (newMode) {
      setActivePanel("annotate");
      toast.info("Annotation mode: Select text to add comments");
    } else {
      if (activePanel === "annotate") {
        setActivePanel(null);
      }
    }
  }, [isAnnotationMode, activePanel]);

  const handleSaveEdits = () => {
    onContentChange?.(draftContent);
    setIsEditing(false);
    toast.success("Draft saved");
  };

  const handleCancelEdits = () => {
    setDraftContent(content);
    setIsEditing(false);
  };

  // Check if content has citations and provide removal/restore function
  const hasCitations = /\[Source:[^\]]+\]/.test(draftContent);
  
  const handleRemoveCitations = () => {
    // Store original before removing
    if (!originalContentWithCitations) {
      setOriginalContentWithCitations(draftContent);
    }
    const cleanedContent = draftContent.replace(/\s*\[Source:[^\]]+\](\([^)]+\))?/g, "");
    setDraftContent(cleanedContent);
    onContentChange?.(cleanedContent);
    setCitationsRemoved(true);
    toast.success("Citations removed");
  };

  const handleRestoreCitations = () => {
    if (originalContentWithCitations) {
      setDraftContent(originalContentWithCitations);
      onContentChange?.(originalContentWithCitations);
      setCitationsRemoved(false);
      toast.success("Citations restored");
    }
  };

  // Use draftContent for all operations
  const currentContent = draftContent;

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(currentContent);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadAsMarkdown = () => {
    const blob = new Blob([currentContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `postmaster-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Downloaded as Markdown");
  };

  const downloadAsPlainText = () => {
    // Strip markdown formatting for plain text
    const plainText = currentContent
      .replace(/#{1,6}\s/g, "") // Remove headers
      .replace(/\*\*(.*?)\*\*/g, "$1") // Remove bold
      .replace(/\*(.*?)\*/g, "$1") // Remove italic
      .replace(/`(.*?)`/g, "$1") // Remove inline code
      .replace(/\[(.*?)\]\(.*?\)/g, "$1"); // Remove links, keep text
    
    const blob = new Blob([plainText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `postmaster-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Downloaded as Plain Text");
  };

  const downloadAsHTML = () => {
    // Convert markdown to basic HTML
    const htmlContent = currentContent
      .replace(/^### (.*$)/gm, "<h3>$1</h3>")
      .replace(/^## (.*$)/gm, "<h2>$1</h2>")
      .replace(/^# (.*$)/gm, "<h1>$1</h1>")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/`(.*?)`/g, "<code>$1</code>")
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br>");

    const fullHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PostMaster Export</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 2rem; color: #333; }
    h1, h2, h3 { margin-top: 1.5em; margin-bottom: 0.5em; }
    p { margin: 1em 0; }
    code { background: #f4f4f4; padding: 0.2em 0.4em; border-radius: 3px; font-size: 0.9em; }
    a { color: #0066cc; }
  </style>
</head>
<body>
  <p>${htmlContent}</p>
</body>
</html>`;

    const blob = new Blob([fullHTML], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `postmaster-${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Downloaded as HTML");
  };

  const copyAsRichText = async () => {
    // Convert to HTML for rich text clipboard
    const htmlContent = currentContent
      .replace(/^### (.*$)/gm, "<h3>$1</h3>")
      .replace(/^## (.*$)/gm, "<h2>$1</h2>")
      .replace(/^# (.*$)/gm, "<h1>$1</h1>")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/`(.*?)`/g, "<code>$1</code>")
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br>");

    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([`<p>${htmlContent}</p>`], { type: "text/html" }),
          "text/plain": new Blob([currentContent], { type: "text/plain" }),
        }),
      ]);
      setCopied(true);
      toast.success("Copied with formatting");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // Fallback to plain text
      await navigator.clipboard.writeText(currentContent);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const downloadAsPDF = () => {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    let y = margin;

    const addPage = () => {
      pdf.addPage();
      y = margin;
    };

    const checkPageBreak = (height: number) => {
      if (y + height > pageHeight - margin) {
        addPage();
      }
    };

    // Parse and render markdown with formatting
    const lines = currentContent.split("\n");
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Handle headers
      if (line.startsWith("# ")) {
        checkPageBreak(20);
        if (y > margin) y += 8; // Add space before header
        pdf.setFontSize(24);
        pdf.setFont("helvetica", "bold");
        const headerText = line.slice(2);
        const headerLines = pdf.splitTextToSize(headerText, maxWidth);
        for (const hl of headerLines) {
          checkPageBreak(12);
          pdf.text(hl, margin, y);
          y += 12;
        }
        y += 4;
      } else if (line.startsWith("## ")) {
        checkPageBreak(16);
        if (y > margin) y += 6;
        pdf.setFontSize(18);
        pdf.setFont("helvetica", "bold");
        const headerText = line.slice(3);
        const headerLines = pdf.splitTextToSize(headerText, maxWidth);
        for (const hl of headerLines) {
          checkPageBreak(10);
          pdf.text(hl, margin, y);
          y += 10;
        }
        y += 3;
      } else if (line.startsWith("### ")) {
        checkPageBreak(14);
        if (y > margin) y += 4;
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        const headerText = line.slice(4);
        const headerLines = pdf.splitTextToSize(headerText, maxWidth);
        for (const hl of headerLines) {
          checkPageBreak(8);
          pdf.text(hl, margin, y);
          y += 8;
        }
        y += 2;
      } else if (line.startsWith("#### ") || line.startsWith("##### ") || line.startsWith("###### ")) {
        checkPageBreak(12);
        if (y > margin) y += 3;
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        const headerText = line.replace(/^#{4,6}\s/, "");
        const headerLines = pdf.splitTextToSize(headerText, maxWidth);
        for (const hl of headerLines) {
          checkPageBreak(7);
          pdf.text(hl, margin, y);
          y += 7;
        }
        y += 2;
      } else if (line.match(/^[-*]\s/)) {
        // Bullet list
        checkPageBreak(7);
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "normal");
        const bulletText = line.replace(/^[-*]\s/, "");
        const cleanText = bulletText
          .replace(/\*\*(.*?)\*\*/g, "$1")
          .replace(/\*(.*?)\*/g, "$1")
          .replace(/`(.*?)`/g, "$1")
          .replace(/\[(.*?)\]\(.*?\)/g, "$1");
        const bulletLines = pdf.splitTextToSize(cleanText, maxWidth - 10);
        pdf.text("•", margin, y);
        for (let j = 0; j < bulletLines.length; j++) {
          checkPageBreak(6);
          pdf.text(bulletLines[j], margin + 8, y);
          y += 6;
        }
      } else if (line.match(/^\d+\.\s/)) {
        // Numbered list
        checkPageBreak(7);
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "normal");
        const match = line.match(/^(\d+)\.\s(.*)$/);
        if (match) {
          const num = match[1];
          const listText = match[2]
            .replace(/\*\*(.*?)\*\*/g, "$1")
            .replace(/\*(.*?)\*/g, "$1")
            .replace(/`(.*?)`/g, "$1")
            .replace(/\[(.*?)\]\(.*?\)/g, "$1");
          const listLines = pdf.splitTextToSize(listText, maxWidth - 12);
          pdf.text(`${num}.`, margin, y);
          for (let j = 0; j < listLines.length; j++) {
            checkPageBreak(6);
            pdf.text(listLines[j], margin + 10, y);
            y += 6;
          }
        }
      } else if (line.trim() === "") {
        // Empty line - add paragraph spacing
        y += 4;
      } else if (line.startsWith("> ")) {
        // Blockquote
        checkPageBreak(7);
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "italic");
        const quoteText = line.slice(2)
          .replace(/\*\*(.*?)\*\*/g, "$1")
          .replace(/\*(.*?)\*/g, "$1");
        const quoteLines = pdf.splitTextToSize(quoteText, maxWidth - 15);
        // Draw a subtle line for blockquote
        pdf.setDrawColor(180, 180, 180);
        pdf.setLineWidth(0.5);
        for (const ql of quoteLines) {
          checkPageBreak(6);
          pdf.line(margin, y - 4, margin, y + 2);
          pdf.text(ql, margin + 8, y);
          y += 6;
        }
        pdf.setFont("helvetica", "normal");
      } else if (line.startsWith("```")) {
        // Code block - skip the fence line
        continue;
      } else {
        // Regular paragraph - handle inline formatting
        checkPageBreak(7);
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "normal");
        
        // Clean inline formatting for PDF (jsPDF doesn't support mixed styles in one line easily)
        const cleanText = line
          .replace(/\*\*(.*?)\*\*/g, "$1")
          .replace(/\*(.*?)\*/g, "$1")
          .replace(/`(.*?)`/g, "$1")
          .replace(/\[(.*?)\]\(.*?\)/g, "$1");
        
        const textLines = pdf.splitTextToSize(cleanText, maxWidth);
        for (const tl of textLines) {
          checkPageBreak(6);
          pdf.text(tl, margin, y);
          y += 6;
        }
      }
    }

    pdf.save(`postmaster-${Date.now()}.pdf`);
    toast.success("Downloaded as PDF");
  };

  const downloadAsDOCX = async () => {
    // Parse markdown into document elements
    const paragraphs: Paragraph[] = [];
    const lines = currentContent.split("\n");

    for (const line of lines) {
      if (line.startsWith("# ")) {
        paragraphs.push(
          new Paragraph({
            text: line.slice(2),
            heading: HeadingLevel.HEADING_1,
          })
        );
      } else if (line.startsWith("## ")) {
        paragraphs.push(
          new Paragraph({
            text: line.slice(3),
            heading: HeadingLevel.HEADING_2,
          })
        );
      } else if (line.startsWith("### ")) {
        paragraphs.push(
          new Paragraph({
            text: line.slice(4),
            heading: HeadingLevel.HEADING_3,
          })
        );
      } else if (line.trim() === "") {
        paragraphs.push(new Paragraph({}));
      } else {
        // Handle bold and italic in text
        const children: TextRun[] = [];
        let remaining = line;
        const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(remaining)) !== null) {
          // Add text before match
          if (match.index > lastIndex) {
            children.push(new TextRun(remaining.slice(lastIndex, match.index)));
          }
          // Add formatted text
          if (match[2]) {
            // Bold
            children.push(new TextRun({ text: match[2], bold: true }));
          } else if (match[3]) {
            // Italic
            children.push(new TextRun({ text: match[3], italics: true }));
          }
          lastIndex = match.index + match[0].length;
        }
        // Add remaining text
        if (lastIndex < remaining.length) {
          children.push(new TextRun(remaining.slice(lastIndex)));
        }

        paragraphs.push(
          new Paragraph({
            children: children.length > 0 ? children : [new TextRun(line)],
          })
        );
      }
    }

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs,
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `postmaster-${Date.now()}.docx`);
    toast.success("Downloaded as DOCX");
  };

  const handleIterate = () => {
    if (!feedback.trim()) return;
    // Pass both feedback and the current (possibly modified) draft content
    onIterate(feedback, draftContent !== content ? draftContent : undefined);
    setFeedback("");
  };

  const runAICheck = async () => {
    setIsCheckingAI(true);
    setActivePanel("aicheck");
    try {
      const response = await fetch("/api/critique/ai-detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: currentContent,
          includePatternScan: true,
        }),
      });
      if (!response.ok) throw new Error("AI check failed");
      const result = await response.json();
      setAiCheckResult(result);
    } catch (error) {
      console.error("AI check error:", error);
      toast.error("Failed to run AI check");
    } finally {
      setIsCheckingAI(false);
    }
  };

  const quickFeedback = [
    "Make it more casual",
    "Make it more professional",
    "Make it shorter",
    "Add more examples",
    "Stronger opening",
    "Better conclusion",
  ];

  const wordCount = currentContent.split(/\s+/).filter(Boolean).length;
  const hasUnsavedChanges = draftContent !== content;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            New
          </Button>
          <Button variant="ghost" size="sm" onClick={onBackToCompare}>
            <Layers className="mr-2 h-4 w-4" />
            Compare
          </Button>
          <div>
            <h2 className="text-xl font-semibold">Draft</h2>
            <p className="text-sm text-muted-foreground">
              Edit your draft, refine it, or export when ready
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <Badge variant="outline" className="text-amber-600 border-amber-300">
              Unsaved changes
            </Badge>
          )}
          <Badge variant="secondary">{wordCount} words</Badge>
          
          {/* Copy button */}
          <Button variant="outline" size="sm" onClick={copyToClipboard}>
            {copied ? (
              <Check className="mr-2 h-4 w-4" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            {copied ? "Copied!" : "Copy"}
          </Button>
          
          {/* Export dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Export
                <ChevronDown className="ml-2 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={downloadAsMarkdown}>
                <FileText className="mr-2 h-4 w-4" />
                Markdown (.md)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={downloadAsPlainText}>
                <FileText className="mr-2 h-4 w-4" />
                Plain Text (.txt)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={downloadAsHTML}>
                <FileCode className="mr-2 h-4 w-4" />
                HTML (.html)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={downloadAsPDF}>
                <FileType className="mr-2 h-4 w-4" />
                PDF (.pdf)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={downloadAsDOCX}>
                <FileType className="mr-2 h-4 w-4" />
                Word (.docx)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={copyAsRichText}>
                <ClipboardPaste className="mr-2 h-4 w-4" />
                Copy with Formatting
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Panel selector toolbar */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground mr-2">Tools:</span>
        <Button
          variant={activePanel === "refine" ? "default" : "outline"}
          size="sm"
          onClick={() => togglePanel("refine")}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refine
        </Button>
        <Button
          variant={activePanel === "image" ? "default" : "outline"}
          size="sm"
          onClick={() => togglePanel("image")}
        >
          <ImageIcon className="mr-2 h-4 w-4" />
          Generate Image
        </Button>
        <Button
          variant={activePanel === "analyze" ? "default" : "outline"}
          size="sm"
          onClick={() => togglePanel("analyze")}
        >
          <BarChart3 className="mr-2 h-4 w-4" />
          Analyze
        </Button>
        {synthesisId && (
          <Button
            variant={activePanel === "history" ? "default" : "outline"}
            size="sm"
            onClick={() => togglePanel("history")}
          >
            <GitCompare className="mr-2 h-4 w-4" />
            History
          </Button>
        )}
        {reasoning && (
          <Button
            variant={activePanel === "reasoning" ? "default" : "outline"}
            size="sm"
            onClick={() => togglePanel("reasoning")}
          >
            <BrainCircuit className="mr-2 h-4 w-4" />
            AI Reasoning
          </Button>
        )}
        <Button
          variant={activePanel === "factcheck" ? "default" : "outline"}
          size="sm"
          onClick={() => togglePanel("factcheck")}
        >
          <SearchCheck className="mr-2 h-4 w-4" />
          Fact Check
        </Button>
        <Button
          variant={activePanel === "aicheck" ? "default" : "outline"}
          size="sm"
          onClick={runAICheck}
          disabled={isCheckingAI}
        >
          {isCheckingAI ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Bot className="mr-2 h-4 w-4" />
          )}
          AI Check
        </Button>
        <Button
          variant={isAnnotationMode ? "default" : "outline"}
          size="sm"
          onClick={toggleAnnotationMode}
          disabled={isEditing}
        >
          <MessageSquarePlus className="mr-2 h-4 w-4" />
          Annotate
          {annotations.length > 0 && (
            <Badge variant="secondary" className="ml-2 h-5 min-w-5 px-1.5">
              {annotations.length}
            </Badge>
          )}
        </Button>
        {hasCritiques && (
          <Button
            variant={activePanel === "critiques" ? "default" : "outline"}
            size="sm"
            onClick={() => togglePanel("critiques")}
          >
            {isDebate ? (
              <Swords className="mr-2 h-4 w-4" />
            ) : (
              <MessagesSquare className="mr-2 h-4 w-4" />
            )}
            {isDebate ? "Debate" : "Critiques"}
          </Button>
        )}
      </div>

      <div className={`grid gap-6 ${activePanel ? "lg:grid-cols-3" : "lg:grid-cols-1"}`}>
        {/* Main content */}
        <Card className={activePanel ? "lg:col-span-2" : ""}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Draft Content</CardTitle>
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <Button variant="ghost" size="sm" onClick={handleCancelEdits}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSaveEdits}>
                      <Check className="mr-2 h-4 w-4" />
                      Save
                    </Button>
                  </>
                ) : (
                  <>
                    {hasCitations && (
                      <Button variant="outline" size="sm" onClick={handleRemoveCitations}>
                        <Quote className="mr-2 h-4 w-4" />
                        Remove Citations
                      </Button>
                    )}
                    {citationsRemoved && originalContentWithCitations && !hasCitations && (
                      <Button variant="outline" size="sm" onClick={handleRestoreCitations}>
                        <Quote className="mr-2 h-4 w-4" />
                        Restore Citations
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <Textarea
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                className="h-[500px] font-mono text-sm resize-none"
                placeholder="Edit your draft content here..."
              />
            ) : (
              <div className="relative" ref={contentContainerRef}>
                {/* Annotation mode indicator - inline banner at top */}
                {isAnnotationMode && (
                  <div className="mb-3 flex items-center justify-center py-2 px-3 rounded-md bg-primary/10 border border-primary/20">
                    <MessageSquarePlus className="h-4 w-4 mr-2 text-primary" />
                    <span className="text-sm text-primary font-medium">
                      Select text below to add annotations
                    </span>
                  </div>
                )}
                <ScrollArea className={`h-[500px] pr-4 ${isAnnotationMode ? "selection:bg-yellow-200/60 dark:selection:bg-yellow-500/40" : ""}`}>
                  <div className={`prose prose-sm prose-editorial dark:prose-invert max-w-none ${isAnnotationMode ? "select-text cursor-text" : ""}`}>
                    <ReactMarkdown
                      components={{
                        a: ({ href, children }) => {
                          // Handle citation links - show URL and open externally
                          const handleClick = (e: React.MouseEvent) => {
                            e.preventDefault();
                            if (href) {
                              window.open(href, '_blank', 'noopener,noreferrer');
                            }
                          };
                          return (
                            <span
                              onClick={handleClick}
                              className="text-primary underline cursor-pointer hover:text-primary/80"
                              title={href}
                            >
                              {children}
                              {href && <span className="text-muted-foreground text-xs ml-1">({href})</span>}
                            </span>
                          );
                        },
                        code: ({ className, children, ...props }) => {
                          // Check if it's an inline code or code block
                          const isInline = !className;
                          if (isInline) {
                            return (
                              <code className="px-1.5 py-0.5 rounded bg-muted text-sm font-mono" {...props}>
                                {children}
                              </code>
                            );
                          }
                          // Code block
                          return (
                            <code className={`block p-4 rounded-lg bg-muted overflow-x-auto text-sm font-mono ${className || ''}`} {...props}>
                              {children}
                            </code>
                          );
                        },
                        pre: ({ children }) => {
                          // Just pass through, styling handled by code component
                          return <pre className="not-prose my-4">{children}</pre>;
                        }
                      }}
                    >{currentContent}</ReactMarkdown>
                  </div>
                </ScrollArea>

                {/* Annotation add button - shows when text is selected */}
                {showAddButton && pendingSelection && (
                  <AnnotationAddButton
                    selectionRect={pendingSelection.rect}
                    containerRef={contentContainerRef}
                    onClick={handleAddButtonClick}
                  />
                )}

                {/* Annotation popover - shows when add button is clicked */}
                {showAnnotationPopover && pendingSelection && (
                  <AnnotationPopover
                    selectedText={pendingSelection.text}
                    selectionRect={pendingSelection.rect}
                    containerRef={contentContainerRef}
                    onConfirm={handleAddAnnotation}
                    onCancel={handleCancelAnnotation}
                  />
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Side panel - conditionally rendered based on activePanel */}
        {activePanel && (
          <Card className="relative">
            {/* Close button - skip for annotation panel which has its own */}
            {activePanel !== "annotate" && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2 h-6 w-6 z-10"
                onClick={() => setActivePanel(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}

            {/* Refine panel */}
            {activePanel === "refine" && (
              <>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Refine
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Not quite right? Provide feedback and we'll iterate.
                  </p>

                  {/* Quick feedback buttons */}
                  <div className="flex flex-wrap gap-2">
                    {quickFeedback.map((text) => (
                      <Button
                        key={text}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => setFeedback(text)}
                      >
                        {text}
                      </Button>
                    ))}
                  </div>

                  <Textarea
                    placeholder="Or describe what you'd like to change..."
                    className="min-h-[120px] resize-none"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                  />

                  <Button
                    className="w-full"
                    onClick={handleIterate}
                    disabled={!feedback.trim()}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Apply Feedback
                  </Button>

                  {onRegenerate && (
                    <div className="pt-4 border-t">
                      <p className="text-xs text-muted-foreground mb-2">
                        Want fresh perspectives? Send your draft through multi-model comparison again.
                      </p>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => onRegenerate(currentContent)}
                      >
                        <Layers className="mr-2 h-4 w-4" />
                        Re-compare with Models
                      </Button>
                    </div>
                  )}
                </CardContent>
              </>
            )}

            {/* Image generation panel */}
            {activePanel === "image" && (
              <div className="p-4">
                <ImageGenerator
                  content={currentContent}
                  generationId={generationId}
                  onClose={() => setActivePanel(null)}
                  embedded
                />
              </div>
            )}

            {/* Content analysis panel */}
            {activePanel === "analyze" && (
              <div className="p-4">
                <ContentAnalysis
                  content={currentContent}
                  onApplySuggestion={(suggestion) => {
                    setFeedback(suggestion);
                    setActivePanel("refine");
                  }}
                  embedded
                />
              </div>
            )}

            {/* History/Diff panel */}
            {activePanel === "history" && synthesisId && (
              <>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <HistoryIcon className="h-4 w-4" />
                    Version History
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ScrollArea className="h-[500px] pr-4">
                    <div className="space-y-4">
                      {/* Original → Enhanced diff (if enhance mode) */}
                      {contentMode === "enhance" && originalContent && (
                        <div className="pb-4 border-b">
                          <div className="flex items-center gap-2 mb-3">
                            <GitCompare className="h-4 w-4 text-green-500" />
                            <h3 className="text-sm font-medium">Original → Enhanced</h3>
                            <Badge variant="outline" className="ml-auto text-xs">
                              {originalContent.split(/\s+/).filter(Boolean).length} → {currentContent.split(/\s+/).filter(Boolean).length} words
                            </Badge>
                          </div>
                          
                          <div className="font-mono text-xs border rounded-lg overflow-hidden">
                            {(() => {
                              const oldLines = originalContent.split('\n');
                              const newLines = currentContent.split('\n');
                              
                              // LCS diff computation
                              const dp: number[][] = Array(oldLines.length + 1).fill(null).map(() => Array(newLines.length + 1).fill(0));
                              
                              for (let i = 1; i <= oldLines.length; i++) {
                                for (let j = 1; j <= newLines.length; j++) {
                                  if (oldLines[i - 1] === newLines[j - 1]) {
                                    dp[i][j] = dp[i - 1][j - 1] + 1;
                                  } else {
                                    dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
                                  }
                                }
                              }
                              
                              let i = oldLines.length;
                              let j = newLines.length;
                              const diffLines: Array<{ type: 'added' | 'removed' | 'unchanged'; content: string }> = [];
                              
                              while (i > 0 || j > 0) {
                                if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
                                  diffLines.push({ type: 'unchanged', content: oldLines[i - 1] });
                                  i--;
                                  j--;
                                } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
                                  diffLines.push({ type: 'added', content: newLines[j - 1] });
                                  j--;
                                } else {
                                  diffLines.push({ type: 'removed', content: oldLines[i - 1] });
                                  i--;
                                }
                              }
                              
                              return diffLines.reverse().map((line, idx) => (
                                <div
                                  key={idx}
                                  className={`px-3 py-1 ${
                                    line.type === 'added'
                                      ? 'bg-green-500/10 border-l-2 border-green-500'
                                      : line.type === 'removed'
                                      ? 'bg-red-500/10 border-l-2 border-red-500'
                                      : 'bg-background'
                                  }`}
                                >
                                  <span className="inline-block w-6 text-muted-foreground mr-2">
                                    {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : '│'}
                                  </span>
                                  <span className={line.type === 'added' ? 'text-green-600 dark:text-green-400' : line.type === 'removed' ? 'text-red-600 dark:text-red-400' : ''}>
                                    {line.content || ' '}
                                  </span>
                                </div>
                              ));
                            })()}
                          </div>
                        </div>
                      )}

                      {/* Version-to-version diffs */}
                      <div>
                        <DiffView 
                          synthesisId={synthesisId} 
                          currentContent={currentContent}
                          embedded 
                        />
                      </div>
                    </div>
                  </ScrollArea>
                </CardContent>
              </>
            )}

            {/* AI Reasoning panel */}
            {activePanel === "reasoning" && reasoning && (
              <>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BrainCircuit className="h-4 w-4" />
                    AI Reasoning
                    <Badge variant="outline" className="ml-auto mr-6">
                      {reasoning.decisions?.length || 0} decisions
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Summary */}
                  {reasoning.summary && (
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground italic">
                        "{reasoning.summary}"
                      </p>
                    </div>
                  )}

                  {/* Key decisions */}
                  {reasoning.decisions && reasoning.decisions.length > 0 && (
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium">Key Synthesis Decisions</h4>
                        {reasoning.decisions.map((decision, i) => (
                          <div key={i} className="border-l-2 border-primary/30 pl-4 space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                {decision.aspect}
                              </Badge>
                            </div>
                            <p className="text-sm font-medium">{decision.choice}</p>
                            <p className="text-xs text-muted-foreground">
                              {decision.rationale}
                            </p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </>
            )}

            {/* Fact Check panel */}
            {activePanel === "factcheck" && (
              <FactCheckPanel content={currentContent} />
            )}

            {/* AI Check panel */}
            {activePanel === "aicheck" && (
              <>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bot className="h-4 w-4 text-primary" />
                    AI Detection Check
                    {aiCheckResult && (
                      <Badge 
                        variant={aiCheckResult.patternScore.score < 30 ? "default" : aiCheckResult.patternScore.score < 60 ? "secondary" : "destructive"}
                        className="ml-auto mr-6"
                      >
                        {aiCheckResult.patternScore.score < 30 ? "Sounds Human" : aiCheckResult.patternScore.score < 60 ? "Some AI Patterns" : "AI-Heavy"}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {isCheckingAI ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-4">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Analyzing content for AI patterns...</p>
                    </div>
                  ) : aiCheckResult ? (
                    <ScrollArea className="h-[450px] pr-4">
                      <div className="space-y-4">
                        {/* Score summary */}
                        <div className="p-4 rounded-lg bg-muted/50">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Human-likeness Score</span>
                            <span className="text-2xl font-bold">
                              {100 - aiCheckResult.patternScore.score}/100
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all ${
                                aiCheckResult.patternScore.score < 30 ? "bg-green-500" : 
                                aiCheckResult.patternScore.score < 60 ? "bg-yellow-500" : "bg-red-500"
                              }`}
                              style={{ width: `${100 - aiCheckResult.patternScore.score}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Found {aiCheckResult.patternScore.breakdown.totalMatches} AI pattern matches
                            ({aiCheckResult.patternScore.breakdown.highSeverityCount} high, 
                            {aiCheckResult.patternScore.breakdown.mediumSeverityCount} medium, 
                            {aiCheckResult.patternScore.breakdown.lowSeverityCount} low severity)
                          </p>
                        </div>

                        {/* Pattern matches */}
                        {aiCheckResult.patternScore.matches.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-amber-500" />
                              AI Patterns Detected
                            </h4>
                            <div className="space-y-2">
                              {aiCheckResult.patternScore.matches.slice(0, 10).map((match, i) => (
                                <div key={i} className="flex items-start gap-2 p-2 rounded bg-muted/30">
                                  <Badge 
                                    variant={match.severity === "high" ? "destructive" : match.severity === "medium" ? "secondary" : "outline"}
                                    className="text-xs shrink-0"
                                  >
                                    {match.severity}
                                  </Badge>
                                  <div className="text-sm">
                                    <span className="font-medium">"{match.pattern}"</span>
                                    <span className="text-muted-foreground ml-2">({match.category})</span>
                                  </div>
                                </div>
                              ))}
                              {aiCheckResult.patternScore.matches.length > 10 && (
                                <p className="text-xs text-muted-foreground">
                                  ... and {aiCheckResult.patternScore.matches.length - 10} more
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Suggestions */}
                        {aiCheckResult.patternScore.matches.length > 0 && (
                          <div className="pt-4 border-t">
                            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                              <Sparkles className="h-4 w-4 text-primary" />
                              Quick Fixes
                            </h4>
                            <div className="space-y-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full justify-start"
                                onClick={() => {
                                  setFeedback("Remove AI-sounding phrases and make the writing more natural and human. Specifically avoid: " + 
                                    aiCheckResult.patternScore.matches.slice(0, 5).map(m => `"${m.pattern}"`).join(", "));
                                  setActivePanel("refine");
                                }}
                              >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Auto-fix with AI refinement
                              </Button>
                            </div>
                          </div>
                        )}

                        {aiCheckResult.patternScore.matches.length === 0 && (
                          <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                            <CheckCircle2 className="h-12 w-12 text-green-500" />
                            <h4 className="font-medium">Looking Good!</h4>
                            <p className="text-sm text-muted-foreground">
                              No obvious AI patterns detected. Your content sounds natural.
                            </p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 gap-4 text-center">
                      <Bot className="h-12 w-12 text-muted-foreground" />
                      <div>
                        <h4 className="font-medium">Check for AI Patterns</h4>
                        <p className="text-sm text-muted-foreground">
                          Scan your content for common AI writing patterns and get suggestions to make it sound more human.
                        </p>
                      </div>
                      <Button onClick={runAICheck} disabled={isCheckingAI}>
                        {isCheckingAI ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <SearchCheck className="mr-2 h-4 w-4" />
                        )}
                        Run AI Check
                      </Button>
                    </div>
                  )}
                </CardContent>
              </>
            )}

            {/* Critique Insights panel */}
            {activePanel === "critiques" && hasCritiques && (
              <>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    {isDebate ? (
                      <Swords className="h-4 w-4 text-primary" />
                    ) : (
                      <MessagesSquare className="h-4 w-4 text-primary" />
                    )}
                    {isDebate ? "Debate Insights" : "Critique Insights"}
                    <Badge variant="outline" className="ml-auto mr-6">
                      {isDebate 
                        ? `${debateSession?.rounds.length || 0} rounds`
                        : `${critiques.length} critiques`}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ScrollArea className="h-[450px] pr-4">
                {/* Debate session info */}
                {isDebate && debateSession && (
                  <div className="mb-4 p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-4 text-sm">
                      <span>
                        <strong>Rounds:</strong> {debateSession.rounds.length}/{debateSession.maxRounds}
                      </span>
                      <span>
                        <strong>Status:</strong>{" "}
                        {debateSession.converged ? (
                          <Badge variant="default" className="text-xs">Converged</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Max Rounds</Badge>
                        )}
                      </span>
                    </div>
                  </div>
                )}

                {/* Consensus points */}
                {(() => {
                  const consensusPoints = new Set<string>();
                  critiques.forEach(c => c.consensusPoints?.forEach(p => consensusPoints.add(p)));
                  
                  return consensusPoints.size > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Consensus Points
                      </h4>
                      <ul className="space-y-1">
                        {Array.from(consensusPoints).slice(0, 5).map((point, i) => (
                          <li key={i} className="text-sm text-muted-foreground pl-6 relative">
                            <span className="absolute left-2 top-2 h-1 w-1 rounded-full bg-green-500" />
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}

                {/* Key improvements */}
                {(() => {
                  const suggestions = new Set<string>();
                  critiques.forEach(c => 
                    c.targetDrafts?.forEach(td => 
                      td.suggestions?.forEach(s => suggestions.add(s))
                    )
                  );
                  
                  return suggestions.size > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-yellow-500" />
                        Key Improvements Applied
                      </h4>
                      <ul className="space-y-1">
                        {Array.from(suggestions).slice(0, 5).map((suggestion, i) => (
                          <li key={i} className="text-sm text-muted-foreground pl-6 relative">
                            <span className="absolute left-2 top-2 h-1 w-1 rounded-full bg-yellow-500" />
                            {suggestion}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}

                {/* Issues addressed */}
                {(() => {
                  const weaknesses = new Set<string>();
                  critiques.forEach(c => 
                    c.targetDrafts?.forEach(td => 
                      td.weaknesses?.forEach(w => weaknesses.add(w))
                    )
                  );
                  
                  return weaknesses.size > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                        Issues Addressed
                      </h4>
                      <ul className="space-y-1">
                        {Array.from(weaknesses).slice(0, 5).map((weakness, i) => (
                          <li key={i} className="text-sm text-muted-foreground pl-6 relative line-through opacity-60">
                            <span className="absolute left-2 top-2 h-1 w-1 rounded-full bg-orange-500" />
                            {weakness}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}
                  </ScrollArea>
                </CardContent>
              </>
            )}

            {/* Annotation panel */}
            {activePanel === "annotate" && (
              <AnnotationSidebar
                annotations={annotations}
                onRemove={handleRemoveAnnotation}
                onClearAll={handleClearAllAnnotations}
                onSubmit={handleSubmitAnnotations}
                onAnnotationClick={(ann) => {
                  // Future: scroll to annotation in content
                }}
                onClose={() => {
                  setActivePanel(null);
                  setIsAnnotationMode(false);
                }}
                isSubmitting={false}
              />
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
