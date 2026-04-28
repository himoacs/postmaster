"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Database,
  Plus,
  Trash2,
  Link,
  FileText,
  FileType,
  AlertCircle,
  HeartHandshake,
} from "lucide-react";
import { toast } from "sonner";
import { AddKnowledgeDialog } from "@/components/knowledge/add-knowledge-dialog";

interface KnowledgeEntry {
  id: string;
  title: string;
  type: "url" | "text" | "file";
  source: string;
  mimeType?: string;
  wordCount: number;
  subpageCount?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const typeIcons = {
  url: Link,
  text: FileText,
  file: FileType,
};

const typeBadgeColors = {
  url: "bg-blue-100 text-blue-800",
  text: "bg-green-100 text-green-800",
  file: "bg-purple-100 text-purple-800",
};

export default function KnowledgePage() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchEntries = async () => {
    try {
      const response = await fetch("/api/knowledge");
      if (response.ok) {
        const data = await response.json();
        setEntries(data.entries);
      }
    } catch (error) {
      console.error("Failed to fetch entries:", error);
      toast.error("Failed to load knowledge base");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  const handleToggleActive = async (id: string, currentState: boolean) => {
    setUpdatingId(id);
    try {
      const response = await fetch(`/api/knowledge/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentState }),
      });

      if (response.ok) {
        setEntries((prev) =>
          prev.map((e) => (e.id === id ? { ...e, isActive: !currentState } : e))
        );
        toast.success(
          !currentState ? "Entry enabled" : "Entry disabled"
        );
      } else {
        toast.error("Failed to update entry");
      }
    } catch (error) {
      console.error("Toggle error:", error);
      toast.error("Failed to update entry");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const response = await fetch(`/api/knowledge/${deleteId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setEntries((prev) => prev.filter((e) => e.id !== deleteId));
        toast.success("Entry deleted");
      } else {
        toast.error("Failed to delete entry");
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete entry");
    } finally {
      setDeleteId(null);
    }
  };

  const handleEntryAdded = () => {
    fetchEntries();
    setDialogOpen(false);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getTypeLabel = (entry: KnowledgeEntry) => {
    if (entry.type === "file" && entry.mimeType === "application/pdf") {
      return "PDF";
    }
    if (entry.type === "file" && entry.mimeType === "text/plain") {
      return "TXT";
    }
    return entry.type.toUpperCase();
  };

  const activeCount = entries.filter((e) => e.isActive).length;
  const totalWords = entries.reduce((sum, e) => sum + e.wordCount, 0);

  return (
    <div className="h-full flex flex-col">
      <header className="border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-xl font-medium flex items-center gap-2">
              <Database className="h-5 w-5" />
              Knowledge Base
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Store reference content for AI models to use during generation
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Knowledge
            </Button>
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
              <a href="https://paypal.me/himoacs" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5">
                <HeartHandshake className="h-4 w-4" />
                Donate
              </a>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Entries
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{entries.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Entries
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Words
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalWords.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Entries List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Knowledge Entries</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-6 w-12" />
                  </div>
                ))}
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-medium">No knowledge entries yet</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Add URLs, paste text, or upload files to build your knowledge base.
                </p>
                <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Entry
                </Button>
              </div>
            ) : (
              <div className="divide-y">
                {entries.map((entry) => {
                  const TypeIcon = typeIcons[entry.type];
                  return (
                    <div
                      key={entry.id}
                      className={`flex items-center gap-4 py-4 ${
                        !entry.isActive ? "opacity-50" : ""
                      }`}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
                        <TypeIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium truncate">{entry.title}</h4>
                          <Badge
                            variant="secondary"
                            className={typeBadgeColors[entry.type]}
                          >
                            {getTypeLabel(entry)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span>{entry.wordCount.toLocaleString()} words</span>
                          {entry.subpageCount && entry.subpageCount > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-blue-600">+{entry.subpageCount} subpages</span>
                            </>
                          )}
                          <span>•</span>
                          <span className="truncate max-w-xs">{entry.source}</span>
                          <span>•</span>
                          <span>{formatDate(entry.createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Switch
                          checked={entry.isActive}
                          onCheckedChange={() =>
                            handleToggleActive(entry.id, entry.isActive)
                          }
                          disabled={updatingId === entry.id}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(entry.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Knowledge Dialog */}
      <AddKnowledgeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleEntryAdded}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Knowledge Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this entry? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
