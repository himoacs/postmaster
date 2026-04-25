"use client";

import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ChevronDown, Plus, X, Link2, FileText, Database } from "lucide-react";

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
}

const contentTypes = [
  { value: "BLOG_POST", label: "Blog Post" },
  { value: "TWEET_THREAD", label: "Tweet Thread" },
  { value: "LINKEDIN_POST", label: "LinkedIn Post" },
  { value: "EMAIL", label: "Email" },
  { value: "ARTICLE", label: "Article" },
  { value: "OTHER", label: "Other" },
];

const lengthOptions = [
  { value: "short", label: "Short (~300 words)" },
  { value: "medium", label: "Medium (~600 words)" },
  { value: "long", label: "Long (~1200 words)" },
];

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
}: PromptInputProps) {
  const [isReferencesOpen, setIsReferencesOpen] = useState(references.length > 0);
  const [isKnowledgeOpen, setIsKnowledgeOpen] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newText, setNewText] = useState("");
  const [knowledgeEntries, setKnowledgeEntries] = useState<KnowledgeEntryBasic[]>([]);

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

  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="prompt" className="text-base font-medium">
          What do you want to write about?
        </Label>
        <Textarea
          id="prompt"
          placeholder="Describe the content you want to create. Be specific about the topic, key points, and any particular angle or perspective you want to take..."
          className="mt-2 min-h-[200px] resize-none"
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
        />
        <p className="mt-2 text-sm text-muted-foreground">
          {prompt.length} characters
        </p>
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
              {lengthOptions.map((option) => (
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
            >
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                <span className="text-sm font-medium">Knowledge Base</span>
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
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {entry.wordCount.toLocaleString()} words
                    </span>
                  </label>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
