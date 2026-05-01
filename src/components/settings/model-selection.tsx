"use client";

import { useState, useEffect, useCallback } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Check, X, Loader2 } from "lucide-react";
import { LiteLLMModel, OllamaModel } from "@/types";
import { cn } from "@/lib/utils";

type Model = LiteLLMModel | OllamaModel;

interface ModelSelectionProps {
  models: Model[];
  enabledModels: string[];
  onSave: (enabledModels: string[]) => Promise<void>;
  isLoading?: boolean;
}

export function ModelSelection({ 
  models, 
  enabledModels: initialEnabledModels, 
  onSave,
  isLoading = false 
}: ModelSelectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize selected models from props
  useEffect(() => {
    if (initialEnabledModels.length > 0) {
      setSelectedModels(new Set(initialEnabledModels));
    } else {
      // Empty = all enabled (backward compatible)
      setSelectedModels(new Set(models.map(m => m.id)));
    }
  }, [initialEnabledModels, models]);

  // Track if there are unsaved changes
  useEffect(() => {
    const currentSet = new Set(selectedModels);
    const initialSet = initialEnabledModels.length > 0 
      ? new Set(initialEnabledModels)
      : new Set(models.map(m => m.id));
    
    const sameSize = currentSet.size === initialSet.size;
    const sameContent = [...currentSet].every(id => initialSet.has(id));
    
    setHasChanges(!(sameSize && sameContent));
  }, [selectedModels, initialEnabledModels, models]);

  const toggleModel = useCallback((modelId: string) => {
    setSelectedModels(prev => {
      const next = new Set(prev);
      if (next.has(modelId)) {
        next.delete(modelId);
      } else {
        next.add(modelId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedModels(new Set(models.map(m => m.id)));
  }, [models]);

  const deselectAll = useCallback(() => {
    setSelectedModels(new Set());
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // If all models are selected, save empty array (backward compatible = all enabled)
      const toSave = selectedModels.size === models.length 
        ? [] 
        : [...selectedModels];
      await onSave(toSave);
    } finally {
      setIsSaving(false);
    }
  };

  const enabledCount = selectedModels.size;
  const totalCount = models.length;

  if (models.length === 0) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-4">
      <div className="flex items-center justify-between">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2 p-0 h-auto hover:bg-transparent">
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <span className="text-sm text-muted-foreground">
              {enabledCount} of {totalCount} models enabled
            </span>
          </Button>
        </CollapsibleTrigger>
        
        {hasChanges && (
          <Button 
            size="sm" 
            onClick={handleSave}
            disabled={isSaving || selectedModels.size === 0}
            className="h-7"
          >
            {isSaving ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <Check className="h-3 w-3 mr-1" />
            )}
            Save Selection
          </Button>
        )}
      </div>

      <CollapsibleContent className="mt-3">
        <div className="space-y-3">
          {/* Select/Deselect All */}
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={selectAll}
              disabled={enabledCount === totalCount}
              className="h-7 text-xs"
            >
              Select All
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={deselectAll}
              disabled={enabledCount === 0}
              className="h-7 text-xs"
            >
              Deselect All
            </Button>
          </div>

          {/* Model list */}
          <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-2">
            {models.map((model) => {
              const isSelected = selectedModels.has(model.id);
              return (
                <label
                  key={model.id}
                  className={cn(
                    "flex items-center gap-3 rounded-md border p-2 cursor-pointer transition-colors",
                    isSelected 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:bg-accent"
                  )}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleModel(model.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{model.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{model.id}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {model.provider && model.provider !== "ollama" && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {model.provider}
                      </Badge>
                    )}
                    {model.costTier && (
                      <Badge 
                        variant={model.costTier === "high" ? "default" : "secondary"}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {model.costTier}
                      </Badge>
                    )}
                  </div>
                </label>
              );
            })}
          </div>

          {selectedModels.size === 0 && (
            <p className="text-sm text-destructive">
              At least one model must be selected
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
