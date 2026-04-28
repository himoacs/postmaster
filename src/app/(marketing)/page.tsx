import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  PenLine,
  Layers,
  Blend,
  RefreshCw,
  ImageIcon,
  Key,
  ArrowRight,
  HeartHandshake,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Draggable area for Electron window */}
      <div 
        className="fixed top-0 left-0 right-0 h-14 z-40"
        style={{ 
          // @ts-expect-error - Electron-specific CSS property for window dragging
          WebkitAppRegion: 'drag',
          appRegion: 'drag'
        }}
      />
      {/* Header */}
      <header className="fixed top-0 z-50 w-full border-b bg-background/80 backdrop-blur-sm px-4">
        <div className="flex h-14 items-center">
          {/* Spacer for macOS traffic lights */}
          <div className="w-20 lg:block hidden" />
          <Link 
            href="/" 
            className="flex items-center gap-2.5"
            style={{ 
              // @ts-expect-error - Electron-specific CSS property
              WebkitAppRegion: 'no-drag',
              appRegion: 'no-drag'
            }}
          >
            <PenLine className="h-5 w-5 text-primary" strokeWidth={1.5} />
            <span className="font-serif text-lg font-medium">PostMaster</span>
          </Link>
          <div className="flex-1" />
          <nav 
            className="flex items-center gap-4"
            style={{ 
              // @ts-expect-error - Electron-specific CSS property
              WebkitAppRegion: 'no-drag',
              appRegion: 'no-drag'
            }}
          >
            <Button size="sm" variant="ghost" asChild className="text-muted-foreground">
              <Link href="#how-it-works">How it works</Link>
            </Button>
            <Button size="sm" variant="ghost" asChild className="text-muted-foreground">
              <Link href="/about">About</Link>
            </Button>
            <Button size="sm" variant="ghost" asChild className="text-muted-foreground">
              <a href="https://paypal.me/himoacs" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5">
                <HeartHandshake className="h-4 w-4" />
                Donate
              </a>
            </Button>
            <Button size="sm" asChild>
              <Link href="/dashboard">Open Editor</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1 pt-14">
        {/* Hero - Split Screen */}
        <section className="border-b">
          <div className="container grid min-h-[calc(100vh-3.5rem)] items-center gap-12 py-16 lg:grid-cols-2 lg:gap-16">
            {/* Left: Text */}
            <div className="max-w-xl">
              <p className="mb-4 text-sm font-medium uppercase tracking-widest text-primary">
                Multi-model writing assistant
              </p>
              <h1 className="font-serif text-4xl font-normal leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                Write with clarity.
                <br />
                <span className="text-muted-foreground">Refine with precision.</span>
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
                PostMaster runs your prompts through multiple AI models simultaneously—OpenAI, Claude, Grok, Mistral—so you can compare outputs, cherry-pick the best, and synthesize them into content that matches your voice.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <Button size="lg" asChild className="h-12 px-6">
                  <Link href="/dashboard">
                    Start Writing
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="h-12 px-6">
                  <Link href="#how-it-works">Learn More</Link>
                </Button>
              </div>
            </div>
            
            {/* Right: Visual */}
            <div className="relative hidden lg:block">
              <div className="relative mx-auto max-w-md">
                {/* Stacked cards visualization */}
                <div className="absolute -top-4 -left-4 h-64 w-full rounded-lg border bg-card/50 shadow-sm" />
                <div className="absolute -top-2 -left-2 h-64 w-full rounded-lg border bg-card/70 shadow-sm" />
                <div className="relative h-64 w-full rounded-lg border bg-card p-6 shadow-md">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span className="font-mono">comparing 4 models...</span>
                  </div>
                  <div className="mt-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">OpenAI</span>
                      <div className="h-1.5 w-32 rounded-full bg-muted">
                        <div className="h-1.5 w-28 rounded-full bg-primary/60" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Claude</span>
                      <div className="h-1.5 w-32 rounded-full bg-muted">
                        <div className="h-1.5 w-30 rounded-full bg-primary/70" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Grok</span>
                      <div className="h-1.5 w-32 rounded-full bg-muted">
                        <div className="h-1.5 w-24 rounded-full bg-primary/50" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Mistral</span>
                      <div className="h-1.5 w-32 rounded-full bg-muted">
                        <div className="h-1.5 w-26 rounded-full bg-primary/55" />
                      </div>
                    </div>
                  </div>
                  <div className="absolute bottom-6 left-6 right-6">
                    <div className="h-px bg-border" />
                    <p className="mt-4 font-serif text-sm italic text-muted-foreground">
                      "Synthesize the best elements..."
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-24 lg:py-32">
          <div className="container">
            <div className="mx-auto max-w-xl text-center">
              <p className="mb-3 text-sm font-medium uppercase tracking-widest text-primary">
                The workflow
              </p>
              <h2 className="font-serif text-3xl font-normal tracking-tight sm:text-4xl">
                How PostMaster Works
              </h2>
              <p className="mt-4 text-muted-foreground">
                A deliberate approach to AI-assisted writing that keeps you in control.
              </p>
            </div>
            
            <div className="mx-auto mt-20 grid max-w-5xl gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-3">
              <FeatureCard
                icon={<Layers className="h-5 w-5" />}
                number="01"
                title="Compare Models"
                description="Submit your prompt once, receive outputs from multiple AI models. See how each interprets your request."
              />
              <FeatureCard
                icon={<Blend className="h-5 w-5" />}
                number="02"
                title="Synthesize Results"
                description="Pick the strongest elements from each output. Combine them into a cohesive draft that captures your intent."
              />
              <FeatureCard
                icon={<RefreshCw className="h-5 w-5" />}
                number="03"
                title="Refine & Iterate"
                description="Provide feedback, adjust tone, tighten phrasing. Iterate until every sentence feels intentional."
              />
              <FeatureCard
                icon={<PenLine className="h-5 w-5" />}
                number="04"
                title="Learn Your Style"
                description="Share examples of your writing. PostMaster analyzes your voice to generate content that sounds like you."
              />
              <FeatureCard
                icon={<ImageIcon className="h-5 w-5" />}
                number="05"
                title="Generate Images"
                description="Create matching visuals with DALL-E or Stable Diffusion, integrated directly into your workflow."
              />
              <FeatureCard
                icon={<Key className="h-5 w-5" />}
                number="06"
                title="Use Your Own Keys"
                description="Bring your API keys for complete control. No subscriptions, just pay for what you use."
              />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t bg-muted/30 py-24">
          <div className="container">
            <div className="mx-auto max-w-xl text-center">
              <h2 className="font-serif text-3xl font-normal tracking-tight sm:text-4xl">
                Ready to write with intention?
              </h2>
              <p className="mt-4 text-muted-foreground">
                PostMaster runs locally. Your API keys, your content, your control.
              </p>
              <Button size="lg" className="mt-8 h-12 px-8" asChild>
                <Link href="/dashboard">
                  Open the Editor
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-10">
        <div className="container flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <PenLine className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            <span className="font-serif text-sm text-muted-foreground">PostMaster</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Open source. Local-first. Made for writers by{" "}
            <Link href="/about" className="underline hover:text-foreground transition-colors">
              Himanshu Gupta
            </Link>
            .
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  number,
  title,
  description,
}: {
  icon: React.ReactNode;
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-card p-8 transition-colors hover:bg-accent/30">
      <div className="mb-4 flex items-center gap-3">
        <span className="text-xs font-medium text-muted-foreground">{number}</span>
        <div className="text-primary">{icon}</div>
      </div>
      <h3 className="font-serif text-lg font-medium">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}
