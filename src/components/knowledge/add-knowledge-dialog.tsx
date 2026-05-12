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
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Link,
  FileText,
  Upload,
  Loader2,
  CheckCircle,
  X,
  FolderOpen,
} from "lucide-react";

// Supported file types - must match backend EXTENSION_MAP
const SUPPORTED_EXTENSIONS = [".pdf", ".txt", ".md", ".markdown", ".docx", ".doc", ".pptx", ".ppt", ".xlsx", ".xls"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface UploadProgress {
  current: number;
  total: number;
  currentFile: string;
  succeeded: number;
  failed: number;
}

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
  
  // File form state - now supports multiple files
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setUrl("");
    setUrlTitle("");
    setUrlPreview(null);
    setTextTitle("");
    setTextContent("");
    setFiles([]);
    setUploadProgress(null);
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

  // File submission - batch upload
  const handleFileSubmit = async () => {
    if (files.length === 0) {
      toast.error("Please select files to upload");
      return;
    }

    setLoading(true);
    const progress: UploadProgress = {
      current: 0,
      total: files.length,
      currentFile: "",
      succeeded: 0,
      failed: 0,
    };
    setUploadProgress(progress);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      progress.current = i + 1;
      progress.currentFile = file.name;
      setUploadProgress({ ...progress });

      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/knowledge/upload", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          console.error(`Failed to upload ${file.name}:`, data.error);
          progress.failed++;
        } else {
          progress.succeeded++;
        }
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
        progress.failed++;
      }
      setUploadProgress({ ...progress });
    }

    // Show summary toast
    if (progress.failed === 0) {
      toast.success(`Successfully uploaded ${progress.succeeded} file${progress.succeeded !== 1 ? "s" : ""}`);
    } else if (progress.succeeded === 0) {
      toast.error(`Failed to upload all ${progress.failed} file${progress.failed !== 1 ? "s" : ""}`);
    } else {
      toast.warning(`Uploaded ${progress.succeeded} file${progress.succeeded !== 1 ? "s" : ""}, ${progress.failed} failed`);
    }

    if (progress.succeeded > 0) {
      onSuccess();
    }
    handleClose();
  };

  // Validate and filter files
  const validateFiles = (fileList: FileList | File[]): File[] => {
    const validFiles: File[] = [];
    const skipped: string[] = [];

    const filesArray = Array.from(fileList);
    for (const file of filesArray) {
      // Check extension
      const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
      if (!ext || !SUPPORTED_EXTENSIONS.includes(ext)) {
        skipped.push(`${file.name} (unsupported type)`);
        continue;
      }

      // Check size
      if (file.size > MAX_FILE_SIZE) {
        skipped.push(`${file.name} (too large)`);
        continue;
      }

      validFiles.push(file);
    }

    if (skipped.length > 0) {
      const skippedMsg = skipped.length <= 3 
        ? skipped.join(", ") 
        : `${skipped.slice(0, 3).join(", ")} and ${skipped.length - 3} more`;
      toast.warning(`Skipped: ${skippedMsg}`);
    }

    return validFiles;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const validFiles = validateFiles(selectedFiles);
    if (validFiles.length > 0) {
      setFiles((prev) => [...prev, ...validFiles]);
    }

    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const validFiles = validateFiles(selectedFiles);
    if (validFiles.length > 0) {
      setFiles((prev) => [...prev, ...validFiles]);
      toast.info(`Added ${validFiles.length} file${validFiles.length !== 1 ? "s" : ""} from folder`);
    }

    // Reset input
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAllFiles = () => {
    setFiles([]);
  };

  const totalFileSize = files.reduce((sum, f) => sum + f.size, 0);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
              <Label>Files</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Choose Files
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => folderInputRef.current?.click()}
                  disabled={loading}
                >
                  <FolderOpen className="mr-2 h-4 w-4" />
                  Upload Folder
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={SUPPORTED_EXTENSIONS.join(",")}
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={loading}
                />
                <input
                  ref={folderInputRef}
                  type="file"
                  // @ts-expect-error - webkitdirectory is not in the type definition
                  webkitdirectory=""
                  directory=""
                  multiple
                  className="hidden"
                  onChange={handleFolderChange}
                  disabled={loading}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Supported: PDF, TXT, MD, DOCX, PPTX, XLSX (max 10MB each)
              </p>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {files.length} file{files.length !== 1 ? "s" : ""} selected ({formatFileSize(totalFileSize)})
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFiles}
                    disabled={loading}
                  >
                    Clear all
                  </Button>
                </div>
                <div className="max-h-[200px] overflow-y-auto border rounded-md divide-y">
                  {files.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center justify-between px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <span className="truncate">{file.name}</span>
                        <span className="text-muted-foreground flex-shrink-0">
                          ({formatFileSize(file.size)})
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => removeFile(index)}
                        disabled={loading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload Progress */}
            {uploadProgress && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>
                    Uploading {uploadProgress.current} of {uploadProgress.total}...
                  </span>
                  <span className="text-muted-foreground">
                    {uploadProgress.succeeded} ✓ {uploadProgress.failed > 0 && `${uploadProgress.failed} ✗`}
                  </span>
                </div>
                <Progress value={(uploadProgress.current / uploadProgress.total) * 100} />
                <p className="text-xs text-muted-foreground truncate">
                  {uploadProgress.currentFile}
                </p>
              </div>
            )}

            {/* Empty State */}
            {files.length === 0 && !loading && (
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Select files or upload an entire folder
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleFileSubmit} disabled={loading || files.length === 0}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  `Upload ${files.length} File${files.length !== 1 ? "s" : ""}`
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
