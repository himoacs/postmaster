import { APIKeyManager } from "@/components/settings/api-key-manager";

export default function SettingsPage() {
  return (
    <div className="h-full">
      <header className="border-b px-6 py-4">
        <h1 className="font-serif text-xl font-medium">Settings</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Manage your API keys
        </p>
      </header>
      <div className="p-6">
        <div className="mx-auto max-w-2xl">
          <APIKeyManager />
        </div>
      </div>
    </div>
  );
}
