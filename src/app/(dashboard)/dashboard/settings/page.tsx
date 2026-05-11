import { APIKeyManager } from "@/components/settings/api-key-manager";
import { PrimaryModelSettings } from "@/components/settings/primary-model-settings";
import { UpdateSettings } from "@/components/settings/update-settings";
import { AppearanceSettings } from "@/components/settings/appearance-settings";

export default function SettingsPage() {
  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4 flex-shrink-0">
        <div>
          <h1 className="font-serif text-xl font-medium">Settings</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Manage your API keys and preferences
          </p>
        </div>
      </header>
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <AppearanceSettings />
          <UpdateSettings />
          <APIKeyManager />
          <PrimaryModelSettings />
        </div>
      </div>
    </div>
  );
}
