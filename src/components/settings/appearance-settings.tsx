"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";

export function AppearanceSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Customize how PostMaster looks on your device
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ThemeSwitcher />
      </CardContent>
    </Card>
  );
}
