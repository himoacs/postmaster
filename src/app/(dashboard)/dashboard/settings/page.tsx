import { APIKeyManager } from "@/components/settings/api-key-manager";
import { SynthesisSettings } from "@/components/settings/synthesis-settings";
import { PrimaryModelSettings } from "@/components/settings/primary-model-settings";
import { HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  return (
    <div className="h-full">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="font-serif text-xl font-medium">Settings</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Manage your API keys and preferences
          </p>
        </div>
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
          <a href="https://paypal.me/himoacs" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5">
            <HeartHandshake className="h-4 w-4" />
            Donate
          </a>
        </Button>
      </header>
      <div className="p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <APIKeyManager />
          <PrimaryModelSettings />
          <SynthesisSettings />
        </div>
      </div>
    </div>
  );
}
