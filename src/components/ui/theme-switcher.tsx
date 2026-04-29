"use client";

import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Avoid hydration mismatch by only rendering after mount
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center gap-3">
        <Label htmlFor="theme-select" className="text-sm font-medium">
          Theme
        </Label>
        <Select disabled>
          <SelectTrigger id="theme-select" className="w-[180px]">
            <SelectValue placeholder="Loading..." />
          </SelectTrigger>
        </Select>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Label htmlFor="theme-select" className="text-sm font-medium">
        Theme
      </Label>
      <Select value={theme} onValueChange={setTheme}>
        <SelectTrigger id="theme-select" className="w-[180px]">
          <SelectValue placeholder="Select theme" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="light">
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4" />
              <span>Light</span>
            </div>
          </SelectItem>
          <SelectItem value="dark">
            <div className="flex items-center gap-2">
              <Moon className="h-4 w-4" />
              <span>Dark</span>
            </div>
          </SelectItem>
          <SelectItem value="system">
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4" />
              <span>System</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
