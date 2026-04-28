"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sparkles, Save, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface StyleProfile {
  bio: string;
  context: string;
  tone: string;
  voice: string;
  vocabulary: string;
  sentence: string;
  patterns: string;
  overrides: string;
}

interface StyleProfileEditorProps {
  initialProfile: StyleProfile | null;
}

export function StyleProfileEditor({ initialProfile }: StyleProfileEditorProps) {
  const router = useRouter();
  const [profile, setProfile] = useState<StyleProfile>(
    initialProfile || {
      bio: "",
      context: "",
      tone: "",
      voice: "",
      vocabulary: "",
      sentence: "",
      patterns: "",
      overrides: "",
    }
  );
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // Sync profile state when initialProfile changes (e.g., after router.refresh())
  useEffect(() => {
    if (initialProfile) {
      setProfile(initialProfile);
    }
  }, [initialProfile]);

  const updateProfile = (field: keyof StyleProfile, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });

      if (!response.ok) throw new Error("Failed to save");

      toast.success("Profile saved successfully");
    } catch (error) {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const analyzeStyle = async () => {
    if (analyzing) return; // Prevent double-clicks
    setAnalyzing(true);
    try {
      const response = await fetch("/api/style/analyze", {
        method: "POST",
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Analysis failed");
      }

      // Update local state with the analysis results
      // Use nullish coalescing to allow empty strings from API
      setProfile((prev) => ({
        ...prev,
        tone: data.tone ?? prev.tone,
        voice: data.voice ?? prev.voice,
        vocabulary: data.vocabulary ?? prev.vocabulary,
        sentence: data.sentence ?? prev.sentence,
        patterns: data.patterns ?? prev.patterns,
      }));
      
      toast.success("Style analysis complete! Fields have been updated.");
      
      // Refresh the page to ensure server data is in sync
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to analyze style");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* About You */}
      <Card>
        <CardHeader>
          <CardTitle>About You</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bio">Short Bio</Label>
            <Textarea
              id="bio"
              placeholder="Tell us about yourself and your background..."
              className="min-h-[100px]"
              value={profile.bio}
              onChange={(e) => updateProfile("bio", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              This helps AI understand your perspective and expertise.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="context">Writing Context</Label>
            <Input
              id="context"
              placeholder="e.g., Tech blogger, Marketing professional, Fiction writer"
              value={profile.context}
              onChange={(e) => updateProfile("context", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* AI-Analyzed Style */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Writing Style
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={analyzeStyle}
            disabled={analyzing}
          >
            {analyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Analyze from Samples
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            These characteristics are extracted from your content samples.
            You can edit them to fine-tune how AI captures your voice.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tone">Tone</Label>
              <Input
                id="tone"
                placeholder="e.g., conversational, professional, humorous"
                value={profile.tone}
                onChange={(e) => updateProfile("tone", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="voice">Voice</Label>
              <Input
                id="voice"
                placeholder="e.g., first-person, authoritative, friendly"
                value={profile.voice}
                onChange={(e) => updateProfile("voice", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vocabulary">Vocabulary</Label>
              <Input
                id="vocabulary"
                placeholder="e.g., technical, simple, creative"
                value={profile.vocabulary}
                onChange={(e) => updateProfile("vocabulary", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sentence">Sentence Style</Label>
              <Input
                id="sentence"
                placeholder="e.g., short punchy, long flowing, varied"
                value={profile.sentence}
                onChange={(e) => updateProfile("sentence", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="patterns">Common Patterns & Phrases</Label>
            <Textarea
              id="patterns"
              placeholder='e.g., ["Let me explain", "Here is the thing", "In my experience"]'
              className="min-h-[80px] font-mono text-sm"
              value={profile.patterns}
              onChange={(e) => updateProfile("patterns", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              JSON array of phrases you commonly use.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Quick Overrides */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Adjustments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Add any specific instructions that should always be applied to your content.
          </p>
          <Textarea
            placeholder="e.g., Always include a call-to-action. Avoid passive voice. Use British spelling."
            className="min-h-[100px]"
            value={profile.overrides}
            onChange={(e) => updateProfile("overrides", e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={saveProfile} disabled={saving} size="lg">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Profile
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
