"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Link,
  FileText,
  Upload,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

interface AddKnowledgeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddKnowledgeDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddKnowledgeDialogProps) {
  const [activeTab, setActiveTab] = useState("url");
  const [loading, setLoading] = useState(false);
  
  // URL form state
  const [url, setUrl] = useState("");
  const [urlTitle, setUrlTitle] = useState("");
  const [urlPreview, setUrlPreview] = useState<string | null>(null);
  
  // Text form state
  const [textTitle, setTextTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  
  // File form state
  const [file, setFile] = useState<File | null>(null);
  const [fileTitle, setFileTitle] = useState("");
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setUrl("");
    setUrlTitle("");
    setUrlPreview(null);
    setTextTitle("");
    setTextContent("");
    setFile(null);
    setFileTitle("");
    setFilePreview(null);
    setLoading(false);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  // URL submission
  const handleUrlSubmit = async () => {
    if (!url.trim()) {
      toast.error("Please enter a URL");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/knowledge/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), title: urlTitle.trim() || undefined }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to add URL");
        return;
      }

      toast.success(`Added: ${data.entry.title}`);
      onSuccess();
      handleClose();
    } catch (error) {
      console.error("URL submission error:", error);
      toast.error("Failed to add URL");
    } finally {
      setLoading(false);
    }
  };

  // Text submission
  const handleTextSubmit = async () => {
    if (!textTitle.trim()) {
      toast.error("Please enter a title");
      return;
    }
    if (!textContent.trim()) {
      toast.error("Please enter content");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/knowledge/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: textTitle.trim(),
          content: textContent.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to add text");
        return;
      }

      toast.success(`Added: ${data.entry.title}`);
      onSuccess();
      handleClose();
    } catch (error) {
      console.error("Text submission error:", error);
      toast.error("Failed to add text");
    } finally {
      setLoading(false);
    }
  };

  // File submission
  const handleFileSubmit = async () => {
    if (!file) {
      toast.error("Please select a file");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (fileTitle.trim()) {
        formData.append("title", fileTitle.trim());
      }

      const response = await fetch("/api/knowledge/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to upload file");
        return;
      }

      setFilePreview(data.preview);
      toast.success(`Added: ${data.entry.title} (${data.entry.wordCount.toLocaleString()} words)`);
      onSuccess();
      handleClose();
    } catch (error) {
      console.error("File submission error:", error);
      toast.error("Failed to upload file");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file size
    if (selectedFile.size > 5 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 5MB.");
      return;
    }

    // Validate file type
    const allowedTypes = ["application/pdf", "text/plain"];
    if (!allowedTypes.includes(selectedFile.type)) {
      toast.error("Invalid file type. Only PDF and TXT files are supported.");
      return;
    }

    setFile(selectedFile);
    // Use filename (without extension) as default title
    setFileTitle(selectedFile.name.replace(/\.(pdf|txt)$/i, ""));
  };

  const wordCount = textContent.split(/\s+/).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Knowledge Entry</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="url" className="flex items-center gap-2">
              <Link className="h-4 w-4" />
              URL
            </TabsTrigger>
            <TabsTrigger value="text" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Text
            </TabsTrigger>
            <TabsTrigger value="file" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              File
            </TabsTrigger>
          </TabsList>

          {/* URL Tab */}
          <TabsContent value="url" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                placeholder="https://example.com/article"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="url-title">Title (optional)</Label>
              <Input
                id="url-title"
                placeholder="Custom title (or auto-extracted)"
                value={urlTitle}
                onChange={(e) => setUrlTitle(e.target.value)}
                disabled={loading}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Content will be automatically extracted from the webpage.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleUrlSubmit} disabled={loading || !url.trim()}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Fetching...
                  </>
                ) : (
                  "Add URL"
                )}
              </Button>
            </div>
          </TabsContent>

          {/* Text Tab */}
          <TabsContent value="text" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="text-title">Title</Label>
              <Input
                id="text-title"
                placeholder="My Knowledge Entry"
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="text-content">Content</Label>
                <span className="text-sm text-muted-foreground">
                  {wordCount} words
                </span>
              </div>
              <Textarea
                id="text-content"
                placeholder="Paste your content here..."
                className="min-h-[200px]"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose} disabled={loading}>
                Cancel
              </Button>
              <Button
                onClick={handleTextSubmit}
                disabled={loading || !textTitle.trim() || !textContent.trim()}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Add Text"
                )}
              </Button>
            </div>
          </TabsContent>

          {/* File Tab */}
          <TabsContent value="file" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>File</Label>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  file
                    ? "border-green-500 bg-green-50"
                    : "border-muted-foreground/25 hover:border-muted-foreground/50"
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,application/pdf,text/plain"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={loading}
                />
                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                    <span className="font-medium">{file.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <span className="font-medium">Click to upload</span>
                    <span className="text-sm text-muted-foreground">
                      PDF or TXT files only (max 5MB)
                    </span>
                  </div>
                )}
              </div>
            </div>
            {file && (
              <div className="space-y-2">
                <Label htmlFor="file-title">Title</Label>
                <Input
                  id="file-title"
                  placeholder="Custom title"
                  value={fileTitle}
                  onChange={(e) => setFileTitle(e.target.value)}
                  disabled={loading}
                />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleFileSubmit} disabled={loading || !file}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  "Upload File"
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
