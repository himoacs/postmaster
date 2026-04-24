import { WritingWorkspace } from "@/components/editor/writing-workspace";

export default function DashboardPage() {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="font-serif text-xl font-medium">New Draft</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Compare outputs from multiple AI models
          </p>
        </div>
      </header>
      <div className="flex-1 overflow-hidden">
        <WritingWorkspace />
      </div>
    </div>
  );
}
