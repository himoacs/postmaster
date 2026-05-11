"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Link, FileText, FileType, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface KnowledgeEntry {
  id: string;
  title: string;
  type: "url" | "text" | "file";
  source: string;
  mimeType?: string;
  content?: string;
  wordCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EditKnowledgeDialogProps {
  entry: KnowledgeEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const typeIcons = {
  url: Link,
  text: FileText,
  file: FileType,
};

export function EditKnowledgeDialog({
  entry,
  open,
  onOpenChange,
  onSuccess,
}: EditKnowledgeDialogProps) {
  const [loading, setLoading] = useState(false);
  const [fetchingContent, setFetchingContent] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  // Load entry data when dialog opens
  useEffect(() => {
    if (entry && open) {
      setTitle(entry.title);
      // Fetch full content if not already loaded
      if (entry.content) {
        setContent(entry.content);
      } else {
        fetchEntryContent(entry.id);
      }
    }
  }, [entry, open]);

  const fetchEntryContent = async (id: string) => {
    setFetchingContent(true);
    try {
      const response = await fetch(`/api/knowledge/${id}`);
      if (response.ok) {
        const data = await response.json();
        setContent(data.entry.content || "");
      }
    } catch (error) {
      console.error("Failed to fetch content:", error);
      toast.error("Failed to load content");
    } finally {
      setFetchingContent(false);
    }
  };

  const handleClose = () => {
    setTitle("");
    setContent("");
    setLoading(false);
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!entry) return;

    if (!title.trim()) {
      toast.error("Title cannot be empty");
      return;
    }

    // For text entries, content is required
    if (entry.type === "text" && !content.trim()) {
      toast.error("Content cannot be empty");
      return;
    }

    setLoading(true);
    try {
      const updateData: { title: string; content?: string } = {
        title: title.trim(),
      };

      // Only include content for text entries
      if (entry.type === "text") {
        updateData.content = content.trim();
      }

      const response = await fetch(`/api/knowledge/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to update entry");
        return;
      }

      toast.success("Entry updated successfully");
      onSuccess();
      handleClose();
    } catch (error) {
      console.error("Update error:", error);
      toast.error("Failed to update entry");
    } finally {
      setLoading(false);
    }
  };

  if (!entry) return null;

  const TypeIcon = typeIcons[entry.type];
  const isTextEntry = entry.type === "text";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TypeIcon className="h-5 w-5" />
            Edit Knowledge Entry
          </DialogTitle>
          <DialogDescription>
            {isTextEntry
              ? "Edit the title and content of this knowledge entry."
              : "Edit the title of this knowledge entry. Content from URLs and files cannot be modified."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter title"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            {fetchingContent ? (
              <div className="flex items-center justify-center py-8 border rounded-md bg-muted/30">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : isTextEntry ? (
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter content"
                rows={10}
                disabled={loading}
                className="font-mono text-sm"
              />
            ) : (
              <>
                <Textarea
                  id="content"
                  value={content}
                  rows={8}
                  disabled
                  className="font-mono text-sm bg-muted/30"
                />
                <Alert variant="default" className="mt-2">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Content from {entry.type === "url" ? "URLs" : "files"} cannot be edited directly.
                    To update the content, delete this entry and add a new one.
                  </AlertDescription>
                </Alert>
              </>
            )}
          </div>

          {isTextEntry && (
            <p className="text-sm text-muted-foreground">
              Word count: {content.split(/\s+/).filter(Boolean).length.toLocaleString()}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || fetchingContent}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
