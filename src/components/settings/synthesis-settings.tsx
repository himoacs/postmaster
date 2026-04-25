"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Sparkles, MessagesSquare, Swords, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SynthesisStrategy, UserPreferences } from "@/types";

export function SynthesisSettings() {
  const [preferences, setPreferences] = useState<UserPreferences>({
    synthesisStrategy: "basic",
    debateMaxRounds: 3,
    showCritiqueDetails: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadPreferences() {
      try {
        const response = await fetch("/api/preferences");
        if (response.ok) {
          const data = await response.json();
          setPreferences(data);
        }
      } catch (error) {
        console.error("Failed to load preferences:", error);
      } finally {
        setLoading(false);
      }
    }
    loadPreferences();
  }, []);

  const updatePreference = async (updates: Partial<UserPreferences>) => {
    setSaving(true);
    const newPrefs = { ...preferences, ...updates };
    setPreferences(newPrefs);

    try {
      const response = await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error("Failed to save");
      }

      toast.success("Preference saved");
    } catch (error) {
      console.error("Failed to save preference:", error);
      toast.error("Failed to save preference");
      // Revert on error
      setPreferences(preferences);
    } finally {
      setSaving(false);
    }
  };

  const strategies: { 
    value: SynthesisStrategy; 
    title: string; 
    description: string;
    icon: React.ReactNode;
    cost: string;
    quality: string;
  }[] = [
    {
      value: "basic",
      title: "Basic Synthesis",
      description: "Direct merge of outputs. Fast and cost-effective.",
      icon: <Sparkles className="h-5 w-5" />,
      cost: "~1x API cost",
      quality: "Good",
    },
    {
      value: "sequential",
      title: "Sequential Critique",
      description: "Models critique each other's work before synthesis. Better quality, moderate cost.",
      icon: <MessagesSquare className="h-5 w-5" />,
      cost: "~3x API cost",
      quality: "Better",
    },
    {
      value: "debate",
      title: "Multi-Model Debate",
      description: "Models engage in iterative debate until reaching consensus. Highest quality.",
      icon: <Swords className="h-5 w-5" />,
      cost: "~5-8x API cost",
      quality: "Best",
    },
  ];

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Synthesis Strategy</CardTitle>
        <CardDescription>
          Choose how multiple AI outputs are combined into your final content
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Strategy selector */}
        <RadioGroup
          value={preferences.synthesisStrategy}
          onValueChange={(value) => updatePreference({ synthesisStrategy: value as SynthesisStrategy })}
          className="space-y-3"
        >
          {strategies.map((strategy) => (
            <div
              key={strategy.value}
              className={`relative flex cursor-pointer rounded-lg border p-4 transition-colors ${
                preferences.synthesisStrategy === strategy.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <RadioGroupItem
                value={strategy.value}
                id={strategy.value}
                className="sr-only"
              />
              <Label
                htmlFor={strategy.value}
                className="flex flex-1 cursor-pointer items-start gap-4"
              >
                <div className={`rounded-lg p-2 ${
                  preferences.synthesisStrategy === strategy.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}>
                  {strategy.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{strategy.title}</span>
                    <Badge 
                      variant={
                        strategy.quality === "Best" ? "default" :
                        strategy.quality === "Better" ? "secondary" : "outline"
                      }
                      className="text-xs"
                    >
                      {strategy.quality}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {strategy.description}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {strategy.cost}
                  </p>
                </div>
              </Label>
            </div>
          ))}
        </RadioGroup>

        {/* Debate-specific settings */}
        {preferences.synthesisStrategy === "debate" && (
          <div className="space-y-4 rounded-lg border p-4">
            <h4 className="text-sm font-medium">Debate Settings</h4>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="max-rounds" className="text-sm">
                  Maximum Debate Rounds
                </Label>
                <span className="text-sm font-medium">{preferences.debateMaxRounds}</span>
              </div>
              <Slider
                id="max-rounds"
                min={1}
                max={5}
                step={1}
                value={[preferences.debateMaxRounds]}
                onValueChange={([value]) => updatePreference({ debateMaxRounds: value })}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                More rounds = better consensus but higher cost. Debate may end early if consensus is reached.
              </p>
            </div>
          </div>
        )}

        {/* Critique details toggle */}
        {preferences.synthesisStrategy !== "basic" && (
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label htmlFor="show-critiques" className="font-medium">
                Show Critique Details
              </Label>
              <p className="text-sm text-muted-foreground">
                Display critique insights in the final synthesis view
              </p>
            </div>
            <Switch
              id="show-critiques"
              checked={preferences.showCritiqueDetails}
              onCheckedChange={(checked) => updatePreference({ showCritiqueDetails: checked })}
            />
          </div>
        )}

        {/* Saving indicator */}
        {saving && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
