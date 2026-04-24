"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Plus,
  Trash2,
  ExternalLink,
  Loader2,
  FileText,
  Calendar,
  Search,
  User,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";

interface ContentSample {
  id: string;
  url: string;
  title?: string;
  wordCount?: number;
  analyzedAt?: string;
}

interface DiscoveredArticle {
  url: string;
  title: string;
  selected: boolean;
}

interface ContentSampleListProps {
  initialSamples: ContentSample[];
}

export function ContentSampleList({ initialSamples }: ContentSampleListProps) {
  const [samples, setSamples] = useState<ContentSample[]>(initialSamples);
  const [newUrl, setNewUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Discovery state
  const [authorUrl, setAuthorUrl] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [discoveredArticles, setDiscoveredArticles] = useState<DiscoveredArticle[]>([]);
  const [addingSelected, setAddingSelected] = useState(false);

  const addSample = async () => {
    if (!newUrl.trim()) return;

    // Basic URL validation
    try {
      new URL(newUrl);
    } catch {
      toast.error("Please enter a valid URL");
      return;
    }

    setAdding(true);
    try {
      const response = await fetch("/api/samples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newUrl }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add sample");
      }

      const data = await response.json();
      setSamples((prev) => [data.sample, ...prev]);
      setNewUrl("");
      toast.success("Content sample added");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add sample"
      );
    } finally {
      setAdding(false);
    }
  };

  const discoverArticles = async () => {
    if (!authorUrl.trim()) return;

    try {
      new URL(authorUrl);
    } catch {
      toast.error("Please enter a valid URL");
      return;
    }

    setDiscovering(true);
    setDiscoveredArticles([]);
    
    try {
      const response = await fetch("/api/samples/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: authorUrl, maxArticles: 15 }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to discover articles");
      }

      const data = await response.json();
      
      if (data.articles.length === 0) {
        toast.error("No articles found on this page");
        return;
      }

      // Mark articles as selected by default, exclude already added ones
      const existingUrls = new Set(samples.map(s => s.url));
      setDiscoveredArticles(
        data.articles.map((article: { url: string; title: string }) => ({
          ...article,
          selected: !existingUrls.has(article.url),
        }))
      );
      
      toast.success(`Found ${data.articles.length} articles`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to discover articles"
      );
    } finally {
      setDiscovering(false);
    }
  };

  const toggleArticleSelection = (url: string) => {
    setDiscoveredArticles(prev =>
      prev.map(article =>
        article.url === url
          ? { ...article, selected: !article.selected }
          : article
      )
    );
  };

  const selectAll = () => {
    const existingUrls = new Set(samples.map(s => s.url));
    setDiscoveredArticles(prev =>
      prev.map(article => ({
        ...article,
        selected: !existingUrls.has(article.url),
      }))
    );
  };

  const deselectAll = () => {
    setDiscoveredArticles(prev =>
      prev.map(article => ({ ...article, selected: false }))
    );
  };

  const addSelectedArticles = async () => {
    const selected = discoveredArticles.filter(a => a.selected);
    if (selected.length === 0) {
      toast.error("No articles selected");
      return;
    }

    setAddingSelected(true);
    let addedCount = 0;
    let failedCount = 0;

    for (const article of selected) {
      try {
        const response = await fetch("/api/samples", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: article.url }),
        });

        if (response.ok) {
          const data = await response.json();
          setSamples(prev => [data.sample, ...prev]);
          addedCount++;
        } else {
          failedCount++;
        }
      } catch {
        failedCount++;
      }
    }

    // Clear discovered articles after adding
    setDiscoveredArticles([]);
    setAuthorUrl("");

    if (addedCount > 0) {
      toast.success(`Added ${addedCount} content samples`);
    }
    if (failedCount > 0) {
      toast.error(`Failed to add ${failedCount} articles`);
    }
    
    setAddingSelected(false);
  };

  const deleteSample = async (id: string) => {
    setDeletingId(id);
    try {
      const response = await fetch(`/api/samples?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete");

      setSamples((prev) => prev.filter((s) => s.id !== id));
      toast.success("Sample removed");
    } catch (error) {
      toast.error("Failed to remove sample");
    } finally {
      setDeletingId(null);
    }
  };

  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Content Samples</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Add links to your previous blog posts, articles, or other written
          content. PostMaster will analyze these to understand your writing
          style.
        </p>

        {/* Tabs for adding samples */}
        <Tabs defaultValue="single" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Single Article
            </TabsTrigger>
            <TabsTrigger value="discover" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Author Page
            </TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="mt-4">
            <div className="flex gap-2">
              <Input
                placeholder="https://yourblog.com/article"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addSample()}
              />
              <Button onClick={addSample} disabled={adding || !newUrl.trim()}>
                {adding ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Add
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="discover" className="mt-4 space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Paste a link to your author page or blog index and we&apos;ll find your articles.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="https://blog.example.com/author/yourname"
                  value={authorUrl}
                  onChange={(e) => setAuthorUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && discoverArticles()}
                />
                <Button
                  onClick={discoverArticles}
                  disabled={discovering || !authorUrl.trim()}
                >
                  {discovering ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  Discover
                </Button>
              </div>
            </div>

            {/* Discovered articles */}
            {discoveredArticles.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">
                    Discovered Articles ({discoveredArticles.filter(a => a.selected).length} selected)
                  </h4>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={selectAll}>
                      Select All
                    </Button>
                    <Button variant="ghost" size="sm" onClick={deselectAll}>
                      Deselect All
                    </Button>
                  </div>
                </div>
                <div className="max-h-[300px] overflow-y-auto space-y-2 rounded-lg border p-3">
                  {discoveredArticles.map((article) => {
                    const alreadyAdded = samples.some(s => s.url === article.url);
                    return (
                      <div
                        key={article.url}
                        className={`flex items-center gap-3 rounded-md p-2 hover:bg-muted/50 ${
                          alreadyAdded ? "opacity-50" : ""
                        }`}
                      >
                        <Checkbox
                          checked={article.selected}
                          onCheckedChange={() => toggleArticleSelection(article.url)}
                          disabled={alreadyAdded}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {article.title}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {article.url}
                          </p>
                        </div>
                        {alreadyAdded && (
                          <Badge variant="secondary" className="shrink-0">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Added
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
                <Button
                  onClick={addSelectedArticles}
                  disabled={addingSelected || discoveredArticles.filter(a => a.selected).length === 0}
                  className="w-full"
                >
                  {addingSelected ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Add {discoveredArticles.filter(a => a.selected).length} Selected Articles
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Sample list */}
        <div className="space-y-3">
          {samples.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                No content samples yet. Add URLs to your previous writing.
              </p>
            </div>
          ) : (
            samples.map((sample) => (
              <div
                key={sample.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium truncate">
                      {sample.title || getDomain(sample.url)}
                    </h4>
                    <a
                      href={sample.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="truncate max-w-[300px]">{sample.url}</span>
                    {sample.wordCount && (
                      <Badge variant="secondary" className="shrink-0">
                        {sample.wordCount} words
                      </Badge>
                    )}
                    {sample.analyzedAt && (
                      <span className="flex items-center gap-1 shrink-0">
                        <Calendar className="h-3 w-3" />
                        Analyzed{" "}
                        {new Date(sample.analyzedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteSample(sample.id)}
                  disabled={deletingId === sample.id}
                >
                  {deletingId === sample.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))
          )}
        </div>

        {samples.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Tip: Add 3-5 diverse samples for best style analysis results.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
