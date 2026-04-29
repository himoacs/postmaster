"use client";

import { useState, useEffect, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Plus, X, Link2, FileText, Database, Quote, Sparkles, Loader2, Upload, File, AlertCircle } from "lucide-react";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { toast } from "sonner";

export type ContentMode = "new" | "enhance";

export interface ReferenceSource {
  id: string;
  type: "url" | "text";
  value: string;
  label?: string;
}

export interface KnowledgeEntryBasic {
  id: string;
  title: string;
  type: string;
  wordCount: number;
  subpageCount?: number;
}

interface PromptInputProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  contentType: string;
  onContentTypeChange: (value: string) => void;
  lengthPref: string;
  onLengthPrefChange: (value: string) => void;
  references: ReferenceSource[];
  onReferencesChange: (refs: ReferenceSource[]) => void;
  selectedKnowledge: string[];
  onSelectedKnowledgeChange: (ids: string[]) => void;
  enableCitations: boolean;
  onEnableCitationsChange: (enabled: boolean) => void;
  enableEmojis: boolean;
  onEnableEmojisChange: (enabled: boolean) => void;
  // New props for content mode
  contentMode: ContentMode;
  onContentModeChange: (mode: ContentMode) => void;
  existingContent: string | null;
  onExistingContentChange: (content: string | null) => void;
}

const contentTypes = [
  { value: "BLOG_POST", label: "Blog Post" },
  { value: "TWEET_THREAD", label: "Tweet Thread" },
  { value: "LINKEDIN_POST", label: "LinkedIn Post" },
  { value: "EMAIL", label: "Email" },
  { value: "ARTICLE", label: "Article" },
  { value: "OTHER", label: "Other" },
];

// Content-type-aware length options
const getLengthOptions = (contentType: string) => {
  switch (contentType) {
    case "TWEET_THREAD":
      return [
        { value: "short", label: "Short (3-5 tweets)" },
        { value: "medium", label: "Medium (6-10 tweets)" },
        { value: "long", label: "Long (11-15 tweets)" },
      ];
    case "LINKEDIN_POST":
      return [
        { value: "short", label: "Short (50-100 words)" },
        { value: "medium", label: "Medium (150-200 words)" },
        { value: "long", label: "Long (300-400 words)" },
      ];
    case "EMAIL":
      return [
        { value: "short", label: "Short (~100 words)" },
        { value: "medium", label: "Medium (~200 words)" },
        { value: "long", label: "Long (~400 words)" },
      ];
    case "BLOG_POST":
    case "ARTICLE":
    case "OTHER":
    default:
      return [
        { value: "short", label: "Short (~300 words)" },
        { value: "medium", label: "Medium (~600 words)" },
        { value: "long", label: "Long (~1200 words)" },
      ];
  }
};

export function PromptInput({
  prompt,
  onPromptChange,
  contentType,
  onContentTypeChange,
  lengthPref,
  onLengthPrefChange,
  references,
  onReferencesChange,
  selectedKnowledge,
  onSelectedKnowledgeChange,
  enableCitations,
  onEnableCitationsChange,
  enableEmojis,
  onEnableEmojisChange,
  contentMode,
  onContentModeChange,
  existingContent,
  onExistingContentChange,
}: PromptInputProps) {
  const [isReferencesOpen, setIsReferencesOpen] = useState(references.length > 0);
  const [isKnowledgeOpen, setIsKnowledgeOpen] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newText, setNewText] = useState("");
  const [knowledgeEntries, setKnowledgeEntries] = useState<KnowledgeEntryBasic[]>([]);
  const [isEnhancing, setIsEnhancing] = useState(false);
  
  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [existingContentWordCount, setExistingContentWordCount] = useState(0);
  const [isContentPreviewOpen, setIsContentPreviewOpen] = useState(false);
  const [pasteMode, setPasteMode] = useState<"upload" | "paste">("upload");

  // Fetch active knowledge entries
  useEffect(() => {
    async function fetchKnowledge() {
      try {
        const response = await fetch("/api/knowledge?active=true");
        if (response.ok) {
          const data = await response.json();
          setKnowledgeEntries(data.entries);
          if (data.entries.length > 0) {
            setIsKnowledgeOpen(true);
          }
        }
      } catch (error) {
        console.error("Failed to fetch knowledge entries:", error);
      }
    }
    fetchKnowledge();
  }, []);

  const toggleKnowledgeEntry = (id: string) => {
    if (selectedKnowledge.includes(id)) {
      onSelectedKnowledgeChange(selectedKnowledge.filter((k) => k !== id));
    } else {
      onSelectedKnowledgeChange([...selectedKnowledge, id]);
    }
  };

  const addUrlReference = () => {
    if (!newUrl.trim()) return;
    try {
      new URL(newUrl); // Validate URL
      const newRef: ReferenceSource = {
        id: crypto.randomUUID(),
        type: "url",
        value: newUrl.trim(),
        label: new URL(newUrl).hostname,
      };
      onReferencesChange([...references, newRef]);
      setNewUrl("");
    } catch {
      // Invalid URL - could add error handling
    }
  };

  const addTextReference = () => {
    if (!newText.trim()) return;
    const newRef: ReferenceSource = {
      id: crypto.randomUUID(),
      type: "text",
      value: newText.trim(),
      label: newText.trim().slice(0, 30) + (newText.length > 30 ? "..." : ""),
    };
    onReferencesChange([...references, newRef]);
    setNewText("");
  };

  const removeReference = (id: string) => {
    onReferencesChange(references.filter((r) => r.id !== id));
  };

  const enhancePrompt = async () => {
    if (!prompt.trim() || prompt.length < 10) {
      toast.error("Please enter a prompt (at least 10 characters) to enhance");
      return;
    }

    setIsEnhancing(true);
    try {
      const response = await fetch("/api/enhance-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          contentType,
          lengthPref,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to enhance prompt");
      }

      const data = await response.json();
      onPromptChange(data.enhanced);
      toast.success("Prompt enhanced successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to enhance prompt");
    } finally {
      setIsEnhancing(false);
    }
  };

  // File upload handling
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Size validation: 10MB
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 10MB.");
      return;
    }

    // Type validation
    const allowedExtensions = [".pdf", ".docx", ".doc", ".md", ".txt"];
    const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
    if (!ext || !allowedExtensions.includes(ext)) {
      toast.error("Unsupported file type. Supported: PDF, DOCX, MD, TXT");
      return;
    }

    setIsExtracting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/content/extract", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to extract content");
      }

      const data = await response.json();
      onExistingContentChange(data.content);
      setUploadedFileName(data.fileName);
      setExistingContentWordCount(data.wordCount);
      setIsContentPreviewOpen(true);
      toast.success(`Extracted ${data.wordCount.toLocaleString()} words from ${data.fileName}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to extract content");
    } finally {
      setIsExtracting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const clearExistingContent = () => {
    onExistingContentChange(null);
    setUploadedFileName(null);
    setExistingContentWordCount(0);
    setIsContentPreviewOpen(false);
  };

  const handlePastedContent = (text: string) => {
    onExistingContentChange(text || null);
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    setExistingContentWordCount(wordCount);
    setUploadedFileName(null);
    if (text.trim()) {
      setIsContentPreviewOpen(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Content Mode Toggle */}
      <div className="space-y-3">
        <Tabs value={contentMode} onValueChange={(v) => onContentModeChange(v as ContentMode)} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="new" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Create New
            </TabsTrigger>
            <TabsTrigger value="enhance" className="gap-2">
              <File className="h-4 w-4" />
              Enhance Existing
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Existing Content Upload (only in enhance mode) */}
      {contentMode === "enhance" && (
        <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Your Existing Content</Label>
            {existingContent && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearExistingContent}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {!existingContent ? (
            <>
              {/* Upload/Paste toggle */}
              <div className="flex gap-2 mb-3">
                <Button
                  type="button"
                  variant={pasteMode === "upload" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPasteMode("upload")}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Upload File
                </Button>
                <Button
                  type="button"
                  variant={pasteMode === "paste" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPasteMode("paste")}
                  className="gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Paste Text
                </Button>
              </div>

              {pasteMode === "upload" ? (
                <>
                  {/* File upload zone */}
                  <div
                    onClick={() => !isExtracting && fileInputRef.current?.click()}
                    className={`relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                      isExtracting 
                        ? "border-muted-foreground/50 bg-muted/50 cursor-wait" 
                        : "border-muted-foreground/30 hover:border-primary hover:bg-muted/50"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx,.doc,.md,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
                      className="hidden"
                      onChange={handleFileChange}
                      disabled={isExtracting}
                    />
                    
                    {isExtracting ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Extracting content...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="h-10 w-10 text-muted-foreground" />
                        <p className="text-sm font-medium">Drop a file here or click to upload</p>
                        <div className="flex gap-2 flex-wrap justify-center">
                          <Badge variant="secondary">PDF</Badge>
                          <Badge variant="secondary">DOCX</Badge>
                          <Badge variant="secondary">MD</Badge>
                          <Badge variant="secondary">TXT</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">Max file size: 10MB</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* Paste textarea */
                <Textarea
                  placeholder="Paste your existing content here..."
                  className="min-h-[150px] resize-none"
                  onChange={(e) => handlePastedContent(e.target.value)}
                />
              )}
            </>
          ) : (
            /* Content preview */
            <Collapsible open={isContentPreviewOpen} onOpenChange={setIsContentPreviewOpen}>
              <div className="flex items-center justify-between rounded-lg border bg-background p-3">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">
                      {uploadedFileName || "Pasted content"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {existingContentWordCount.toLocaleString()} words
                      {existingContentWordCount > 5000 && (
                        <span className="ml-2 text-yellow-600 dark:text-yellow-500">
                          <AlertCircle className="h-3 w-3 inline mr-1" />
                          Large content
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <ChevronDown className={`h-4 w-4 transition-transform ${isContentPreviewOpen ? "rotate-180" : ""}`} />
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent className="mt-2">
                <div className="rounded-lg border bg-muted/50 p-3 max-h-[200px] overflow-y-auto">
                  <pre className="text-sm whitespace-pre-wrap font-mono">
                    {existingContent.slice(0, 2000)}
                    {existingContent.length > 2000 && (
                      <span className="text-muted-foreground">
                        {"\n\n...truncated preview ({(existingContent.length - 2000).toLocaleString()} more characters)"}
                      </span>
                    )}
                  </pre>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      )}

      <div>
        <Label htmlFor="prompt" className="text-base font-medium">
          {contentMode === "new" 
            ? "What do you want to write about?" 
            : "How would you like to enhance this content?"
          }
        </Label>
        <Textarea
          id="prompt"
          placeholder={contentMode === "new" 
            ? "Describe the content you want to create. Be specific about the topic, key points, and any particular angle or perspective you want to take..."
            : "Describe how you'd like to improve this content. For example: 'Make it more engaging', 'Add more technical details', 'Rewrite in a conversational tone'..."
          }
          className="mt-2 min-h-[200px] resize-none"
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
        />
        <div className="mt-2 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {prompt.length} characters
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={enhancePrompt}
            disabled={isEnhancing || prompt.length < 10}
            className="gap-2"
          >
            {isEnhancing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enhancing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Enhance Prompt
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="content-type">Content Type</Label>
          <Select value={contentType} onValueChange={onContentTypeChange}>
            <SelectTrigger id="content-type">
              <SelectValue placeholder="Select content type" />
            </SelectTrigger>
            <SelectContent>
              {contentTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="length">Target Length</Label>
          <Select value={lengthPref} onValueChange={onLengthPrefChange}>
            <SelectTrigger id="length">
              <SelectValue placeholder="Select length" />
            </SelectTrigger>
            <SelectContent>
              {getLengthOptions(contentType).map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Reference Sources Section */}
      <Collapsible open={isReferencesOpen} onOpenChange={setIsReferencesOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="flex w-full items-center justify-between p-0 hover:bg-transparent"
          >
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              <span className="text-sm font-medium">Reference Sources</span>
              {references.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {references.length}
                </Badge>
              )}
            </div>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${
                isReferencesOpen ? "rotate-180" : ""
              }`}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Add URLs or text content for AI models to reference when generating your content.
          </p>

          {/* URL Input */}
          <div className="space-y-2">
            <Label htmlFor="url-input" className="text-sm">
              Add URL
            </Label>
            <div className="flex gap-2">
              <Input
                id="url-input"
                type="url"
                placeholder="https://docs.example.com/..."
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addUrlReference()}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={addUrlReference}
                disabled={!newUrl.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Text Input */}
          <div className="space-y-2">
            <Label htmlFor="text-input" className="text-sm">
              Add Custom Context
            </Label>
            <div className="flex gap-2">
              <Textarea
                id="text-input"
                placeholder="Paste additional context, notes, or reference material..."
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                className="min-h-[80px] flex-1 resize-none"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={addTextReference}
                disabled={!newText.trim()}
                className="self-end"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Added References */}
          {references.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm">Added References</Label>
              <div className="flex flex-wrap gap-2">
                {references.map((ref) => (
                  <Badge
                    key={ref.id}
                    variant="secondary"
                    className="flex items-center gap-1 py-1 pl-2 pr-1"
                  >
                    {ref.type === "url" ? (
                      <Link2 className="h-3 w-3" />
                    ) : (
                      <FileText className="h-3 w-3" />
                    )}
                    <span className="max-w-[200px] truncate">{ref.label}</span>
                    <button
                      onClick={() => removeReference(ref.id)}
                      className="ml-1 rounded-full p-0.5 hover:bg-muted"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Knowledge Base Section */}
      {knowledgeEntries.length > 0 && (
        <Collapsible open={isKnowledgeOpen} onOpenChange={setIsKnowledgeOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="flex w-full items-center justify-between p-0 hover:bg-transparent"
              data-tour="knowledge-base"
            >
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                <span className="text-sm font-medium">Knowledge Base</span>
                <HelpTooltip
                  content={
                    <div className="space-y-1">
                      <p>Select knowledge entries to provide context and reference material to AI models.</p>
                      <p className="text-xs text-muted-foreground">Selected entries will be included in the prompt, helping models generate more accurate and informed content.</p>
                    </div>
                  }
                />
                {selectedKnowledge.length > 0 && (
                  <Badge variant="default" className="ml-2">
                    {selectedKnowledge.length} selected
                  </Badge>
                )}
              </div>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  isKnowledgeOpen ? "rotate-180" : ""
                }`}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Select knowledge entries to include as context for your content.
            </p>
            <div className="space-y-2">
              {knowledgeEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    id={`kb-${entry.id}`}
                    checked={selectedKnowledge.includes(entry.id)}
                    onCheckedChange={() => toggleKnowledgeEntry(entry.id)}
                  />
                  <label
                    htmlFor={`kb-${entry.id}`}
                    className="flex-1 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{entry.title}</span>
                      <Badge variant="outline" className="text-xs">
                        {entry.type.toUpperCase()}
                      </Badge>
                      {entry.subpageCount && entry.subpageCount > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          +{entry.subpageCount} pages
                        </Badge>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {entry.wordCount.toLocaleString()} words
                      {entry.subpageCount && entry.subpageCount > 0 && (
                        <span className="ml-1">· dynamic fetch enabled</span>
                      )}
                    </span>
                  </label>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Citations Toggle - only visible when knowledge base items are selected */}
      {selectedKnowledge.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
          <div className="flex items-center gap-3">
            <Quote className="h-4 w-4 text-muted-foreground" />
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Label htmlFor="citations" className="text-sm font-medium cursor-pointer">
                  Include citations
                </Label>
                <HelpTooltip
                  content={
                    <div className="space-y-1">
                      <p>When enabled, AI models will include citations and references to your knowledge base sources in the generated content.</p>
                      <p className="text-xs text-muted-foreground">Best for factual content, research-based writing, and when attribution is important.</p>
                    </div>
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Add inline source citations to ground content in your knowledge base
              </p>
            </div>
          </div>
          <Switch
            id="citations"
            checked={enableCitations}
            onCheckedChange={onEnableCitationsChange}
          />
        </div>
      )}

      {/* Emoji/Emoticon Toggle */}
      <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <Label htmlFor="emojis" className="cursor-pointer">
              Add Emojis
            </Label>
            <HelpTooltip
              content={
                <div className="space-y-1">
                  <p>When enabled, the AI will include relevant emojis and emoticons in the generated content.</p>
                  <p className="text-xs text-muted-foreground">Great for social media posts, casual emails, and engaging content.</p>
                </div>
              }
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Enhance content with relevant emojis for better engagement
          </p>
        </div>
        <Switch
          id="emojis"
          checked={enableEmojis}
          onCheckedChange={onEnableEmojisChange}
        />
      </div>
    </div>
  );
}
