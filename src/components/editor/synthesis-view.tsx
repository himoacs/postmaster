"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
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
  GitCompare,
  BrainCircuit,
  X,
  Pencil,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { ImageGenerator } from "./image-generator";
import { ContentAnalysis } from "./content-analysis";
import { DiffView } from "./diff-view";
import { SynthesisStrategy, CritiqueOutput, DebateSession, SynthesisReasoning } from "@/types";

type SidePanelType = "refine" | "image" | "analyze" | "history" | null;

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
}: SynthesisViewProps) {
  const [feedback, setFeedback] = useState("");
  const [copied, setCopied] = useState(false);
  const [activePanel, setActivePanel] = useState<SidePanelType>(null);
  const [showCritiques, setShowCritiques] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftContent, setDraftContent] = useState(content);

  // Sync draft content when content prop changes (e.g., after iteration)
  useEffect(() => {
    setDraftContent(content);
  }, [content]);

  const hasCritiques = critiques.length > 0 || debateSession;
  const isDebate = synthesisStrategy === "debate";
  
  const togglePanel = (panel: SidePanelType) => {
    setActivePanel(activePanel === panel ? null : panel);
  };

  const handleSaveEdits = () => {
    onContentChange?.(draftContent);
    setIsEditing(false);
    toast.success("Draft saved");
  };

  const handleCancelEdits = () => {
    setDraftContent(content);
    setIsEditing(false);
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

  const handleIterate = () => {
    if (!feedback.trim()) return;
    // Pass both feedback and the current (possibly modified) draft content
    onIterate(feedback, draftContent !== content ? draftContent : undefined);
    setFeedback("");
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
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
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
              <ScrollArea className="h-[500px] pr-4">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{currentContent}</ReactMarkdown>
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Side panel - conditionally rendered based on activePanel */}
        {activePanel && (
          <Card className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 h-6 w-6 z-10"
              onClick={() => setActivePanel(null)}
            >
              <X className="h-4 w-4" />
            </Button>

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
              <div className="p-4">
                <DiffView 
                  synthesisId={synthesisId} 
                  currentContent={currentContent}
                  embedded 
                />
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Critique insights section */}
      {hasCritiques && (
        <Collapsible open={showCritiques} onOpenChange={setShowCritiques}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    {isDebate ? (
                      <Swords className="h-4 w-4 text-primary" />
                    ) : (
                      <MessagesSquare className="h-4 w-4 text-primary" />
                    )}
                    {isDebate ? "Debate Insights" : "Critique Insights"}
                    <Badge variant="outline" className="ml-2">
                      {isDebate 
                        ? `${debateSession?.rounds.length || 0} rounds`
                        : `${critiques.length} critiques`}
                    </Badge>
                  </CardTitle>
                  <ChevronDown 
                    className={`h-4 w-4 text-muted-foreground transition-transform ${
                      showCritiques ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
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
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* AI Reasoning transparency section */}
      {reasoning && (
        <Collapsible open={showReasoning} onOpenChange={setShowReasoning}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BrainCircuit className="h-4 w-4 text-primary" />
                    AI Reasoning
                    <Badge variant="outline" className="ml-2">
                      {reasoning.decisions?.length || 0} decisions
                    </Badge>
                  </CardTitle>
                  <ChevronDown 
                    className={`h-4 w-4 text-muted-foreground transition-transform ${
                      showReasoning ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-4">
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
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
    </div>
  );
}
