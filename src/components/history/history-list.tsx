"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Calendar,
  Search,
  FileText,
  ImageIcon,
  Clock,
  ArrowRight,
  Trash2,
} from "lucide-react";
import { AIProvider, ContentType, GenerationStatus } from "@/types";
import { AI_PROVIDERS } from "@/lib/ai/providers";
import Link from "next/link";
import { toast } from "sonner";

interface Generation {
  id: string;
  prompt: string;
  contentType: ContentType;
  status: GenerationStatus;
  createdAt: string;
  models: { provider: AIProvider; model: string }[];
  hasSynthesis: boolean;
  synthesisPreview?: string;
  hasImage: boolean;
  version: number;
}

interface HistoryListProps {
  initialGenerations: Generation[];
}

const contentTypeLabels: Record<ContentType, string> = {
  BLOG_POST: "Blog Post",
  TWEET_THREAD: "Tweet Thread",
  LINKEDIN_POST: "LinkedIn",
  EMAIL: "Email",
  ARTICLE: "Article",
  OTHER: "Other",
};

const statusColors: Record<GenerationStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  GENERATING: "bg-blue-100 text-blue-800",
  SYNTHESIZING: "bg-purple-100 text-purple-800",
  COMPLETED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
};

export function HistoryList({ initialGenerations }: HistoryListProps) {
  const [generations, setGenerations] = useState<Generation[]>(initialGenerations);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const response = await fetch(`/api/generations/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete");
      }

      setGenerations((prev) => prev.filter((g) => g.id !== id));
      toast.success("Generation deleted");
    } catch (error) {
      toast.error("Failed to delete generation");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredGenerations = generations.filter((g) => {
    const matchesSearch =
      !search ||
      g.prompt.toLowerCase().includes(search.toLowerCase()) ||
      g.synthesisPreview?.toLowerCase().includes(search.toLowerCase());

    const matchesType =
      typeFilter === "all" || g.contentType === typeFilter;

    return matchesSearch && matchesType;
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search generations..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Content type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {Object.entries(contentTypeLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Generation list */}
      {filteredGenerations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 font-semibold">No generations found</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {generations.length === 0
                ? "Start writing to see your history here."
                : "Try adjusting your search or filters."}
            </p>
            {generations.length === 0 && (
              <Button asChild className="mt-4">
                <Link href="/dashboard">Start Writing</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredGenerations.map((generation) => (
            <Card key={generation.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">
                        {contentTypeLabels[generation.contentType]}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className={statusColors[generation.status]}
                      >
                        {generation.status.toLowerCase()}
                      </Badge>
                      {generation.hasImage && (
                        <Badge variant="secondary" className="gap-1">
                          <ImageIcon className="h-3 w-3" />
                          Image
                        </Badge>
                      )}
                      {generation.version > 1 && (
                        <Badge variant="secondary">
                          v{generation.version}
                        </Badge>
                      )}
                    </div>

                    <p className="text-sm font-medium line-clamp-2">
                      {generation.prompt}
                    </p>

                    {generation.synthesisPreview && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {generation.synthesisPreview}...
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(generation.createdAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        {generation.models.length} models
                      </span>
                      <div className="flex items-center gap-1">
                        {generation.models.slice(0, 3).map((m, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className="text-xs py-0"
                          >
                            {AI_PROVIDERS[m.provider]?.name || m.provider}
                          </Badge>
                        ))}
                        {generation.models.length > 3 && (
                          <span>+{generation.models.length - 3}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-muted-foreground hover:text-destructive"
                          disabled={deletingId === generation.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete generation?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete this generation and all its outputs.
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(generation.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/dashboard/history/${generation.id}`}>
                        View
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
